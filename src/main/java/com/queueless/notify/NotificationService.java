package com.queueless.notify;

import com.queueless.dto.DemoMessageView;
import com.queueless.dto.NotificationView;
import com.queueless.dto.TokenView;
import com.queueless.exception.ApiException;
import com.queueless.model.NotificationEvent;
import com.queueless.model.NotificationLog;
import com.queueless.model.NotificationStatus;
import com.queueless.model.Token;
import com.queueless.model.TokenStatus;
import com.queueless.repository.NotificationLogRepository;
import com.queueless.repository.TokenRepository;
import com.queueless.service.I18nService;
import com.queueless.service.QueueService;
import com.queueless.service.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Sends WhatsApp messages about queue events.
 *
 * How it stays safe for the queue:
 *  - It runs AFTER the queue change is committed and on a separate thread (@Async), so a slow or
 *    broken WhatsApp connection can never delay or undo token generation or calling.
 *  - Every exception is caught and written to the history as FAILED.
 *
 * How duplicates are prevented:
 *  - Each (token, event) pair can be stored only once (unique constraint in notification_log).
 *    The row is saved BEFORE sending, so even two threads racing for the same event send only one message.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final TokenRepository tokens;
    private final NotificationLogRepository logs;
    private final QueueService queue;
    private final SettingsService settings;
    private final I18nService i18n;
    private final DemoWhatsAppClient demo;
    private final CloudWhatsAppClient cloud;
    private final String configuredMode;
    private final String countryCode;
    private volatile boolean warnedAboutCredentials;

    public NotificationService(TokenRepository tokens, NotificationLogRepository logs, QueueService queue,
                               SettingsService settings, I18nService i18n,
                               DemoWhatsAppClient demo, CloudWhatsAppClient cloud,
                               @Value("${queueless.whatsapp.mode:demo}") String configuredMode,
                               @Value("${queueless.whatsapp.country-code:91}") String countryCode) {
        this.tokens = tokens;
        this.logs = logs;
        this.queue = queue;
        this.settings = settings;
        this.i18n = i18n;
        this.demo = demo;
        this.cloud = cloud;
        this.configuredMode = configuredMode;
        this.countryCode = countryCode.replaceAll("\\D", "");
    }

    /* ------------------------------------------------------------------ */
    /* Mode                                                                */
    /* ------------------------------------------------------------------ */

    /** CLOUD only when asked for AND credentials exist; otherwise the safe DEMO mode. */
    private WhatsAppClient client() {
        if ("cloud".equalsIgnoreCase(configuredMode)) {
            if (cloud.isConfigured()) {
                return cloud;
            }
            if (!warnedAboutCredentials) {
                warnedAboutCredentials = true;
                log.warn("WHATSAPP_MODE=cloud but WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN are missing. Using DEMO mode.");
            }
        }
        return demo;
    }

    public String mode() {
        return client().mode();
    }

    public boolean cloudConfigured() {
        return cloud.isConfigured();
    }

    /* ------------------------------------------------------------------ */
    /* Event entry point                                                   */
    /* ------------------------------------------------------------------ */

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onQueueEvent(QueueEvent event) {
        try {
            if (!settings.isWhatsappEnabled()) {
                return;
            }
            switch (event.type()) {
                case ISSUED -> handleIssued(event.tokenId());
                case CALLED -> send(event.tokenId(), NotificationEvent.CALLED);
                case SKIPPED -> send(event.tokenId(), NotificationEvent.SKIPPED);
                case CANCELLED -> send(event.tokenId(), NotificationEvent.CANCELLED);
                case QUEUE_CHANGED -> checkApproaching(event.serviceId());
            }
        } catch (Exception e) {
            // Never let a notification problem escape; the queue must keep working.
            log.warn("WhatsApp notification for {} failed: {}", event, e.toString());
        }
    }

    private void handleIssued(Long tokenId) {
        Token token = tokens.findById(tokenId).orElse(null);
        if (token == null || !wantsWhatsapp(token)) {
            return;
        }
        send(token, NotificationEvent.CONFIRMATION);

        // Someone who joins near the front does not also need an immediate "approaching" message.
        int threshold = settings.approachThreshold();
        TokenView view = queue.viewOf(tokenId);
        if (view.status() == TokenStatus.WAITING && view.ahead() <= threshold) {
            suppress(token, NotificationEvent.APPROACHING,
                    "Not sent: already within " + threshold + " people of the front when the token was issued");
        }
    }

    /** Tell everyone who has just come within range (3 to 5 people ahead, as set by the admin). */
    private void checkApproaching(Long serviceId) {
        int threshold = settings.approachThreshold();
        for (TokenView view : queue.listToday(serviceId, TokenStatus.WAITING)) {
            if (view.ahead() >= 1 && view.ahead() <= threshold) {
                send(view.id(), NotificationEvent.APPROACHING);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Sending                                                             */
    /* ------------------------------------------------------------------ */

    private static boolean wantsWhatsapp(Token t) {
        return Boolean.TRUE.equals(t.getNotifyWhatsapp()) && t.getPhone() != null && !t.getPhone().isBlank();
    }

    private String toNumber(Token t) {
        return countryCode + t.getPhone().trim();
    }

    private void send(Long tokenId, NotificationEvent event) {
        Token token = tokens.findById(tokenId).orElse(null);
        if (token != null && wantsWhatsapp(token)) {
            send(token, event);
        }
    }

    private void send(Token token, NotificationEvent event) {
        if (logs.existsByTokenIdAndEventType(token.getId(), event)) {
            return;                                   // this event was already handled
        }
        String lang = I18nService.normalize(token.getLanguage());
        NotificationLog row = new NotificationLog();
        row.setTokenId(token.getId());
        row.setTokenNumber(token.getNumber());
        row.setEventType(event);
        row.setStatus(NotificationStatus.PENDING);
        row.setDeliveryMode(mode());
        row.setToNumber(toNumber(token));
        row.setLanguage(lang);
        row.setMessageText(compose(event, queue.viewOf(token.getId()), lang));
        row.setAttempts(0);
        row.setCreatedAt(LocalDateTime.now());
        try {
            row = logs.saveAndFlush(row);             // claims the (token, event) slot
        } catch (DataIntegrityViolationException duplicate) {
            return;                                   // another thread claimed it first
        }
        deliver(row);
    }

    private void suppress(Token token, NotificationEvent event, String note) {
        NotificationLog row = new NotificationLog();
        row.setTokenId(token.getId());
        row.setTokenNumber(token.getNumber());
        row.setEventType(event);
        row.setStatus(NotificationStatus.SUPPRESSED);
        row.setDeliveryMode(mode());
        row.setToNumber(toNumber(token));
        row.setLanguage(I18nService.normalize(token.getLanguage()));
        row.setMessageText(note);
        row.setAttempts(0);
        row.setCreatedAt(LocalDateTime.now());
        try {
            logs.saveAndFlush(row);
        } catch (DataIntegrityViolationException ignored) {
            // already recorded
        }
    }

    /** Hands the stored message to WhatsApp and records the outcome. Never throws. */
    private void deliver(NotificationLog row) {
        row.setAttempts(row.getAttempts() + 1);
        row.setUpdatedAt(LocalDateTime.now());
        try {
            WhatsAppClient client = client();
            WhatsAppClient.SendResult result = client.send(row.getToNumber(), row.getMessageText());
            row.setDeliveryMode(client.mode());
            row.setProviderMessageId(result.messageId());
            row.setStatus(NotificationStatus.SENT);
            row.setErrorText(null);
        } catch (Exception e) {
            row.setStatus(NotificationStatus.FAILED);
            row.setErrorText(shorten(e.getMessage() == null ? e.toString() : e.getMessage()));
            log.warn("WhatsApp delivery for token {} ({}) failed: {}", row.getTokenNumber(), row.getEventType(), row.getErrorText());
        }
        try {
            logs.save(row);
        } catch (Exception e) {
            log.warn("Could not save notification history: {}", e.toString());
        }
    }

    private String compose(NotificationEvent event, TokenView v, String lang) {
        String code = v.number().contains("-") ? v.number().substring(0, v.number().indexOf('-')) : "";
        return i18n.msg("wa." + event.name().toLowerCase(), lang,
                v.number(),
                i18n.serviceName(code, v.serviceName(), lang),
                String.valueOf(v.position()),
                String.valueOf(v.ahead()),
                i18n.eta(v.etaMinutes(), v.ahead(), lang),
                i18n.counterName(v.counterName(), lang));
    }

    private static String shorten(String s) {
        return s.length() <= 250 ? s : s.substring(0, 250);
    }

    /* ------------------------------------------------------------------ */
    /* Staff and demo screens                                              */
    /* ------------------------------------------------------------------ */

    public List<NotificationView> recent() {
        return logs.findTop100ByOrderByIdDesc().stream().map(this::view).toList();
    }

    public NotificationView retry(Long id) {
        NotificationLog row = logs.findById(id).orElseThrow(() -> ApiException.notFound("err.notification.notfound"));
        if (row.getStatus() != NotificationStatus.FAILED) {
            throw ApiException.conflict("err.notification.retry");
        }
        deliver(row);
        return view(row);
    }

    /** Messages "received" by a phone number in DEMO mode (what the visitor's WhatsApp would show). */
    public List<DemoMessageView> demoInbox(String phone) {
        if (!"DEMO".equals(mode())) {
            throw ApiException.notFound("err.demo.off");
        }
        String digits = phone == null ? "" : phone.replaceAll("\\D", "");
        if (digits.length() < 10) {
            throw ApiException.badRequest("val.phone.format");
        }
        digits = digits.substring(digits.length() - 10);
        List<NotificationLog> rows = new ArrayList<>(
                logs.findTop50ByToNumberAndStatusOrderByIdDesc(countryCode + digits, NotificationStatus.SENT));
        Collections.reverse(rows);
        return rows.stream().map(r -> new DemoMessageView(r.getEventType(), r.getMessageText(), r.getCreatedAt())).toList();
    }

    private NotificationView view(NotificationLog r) {
        String to = r.getToNumber();
        String masked = to.length() > 6 ? to.substring(0, 4) + "*****" + to.substring(to.length() - 2) : to;
        return new NotificationView(r.getId(), r.getTokenNumber(), r.getEventType(), r.getStatus(),
                r.getDeliveryMode(), "+" + masked, r.getLanguage(), r.getMessageText(), r.getErrorText(),
                r.getAttempts(), r.getCreatedAt());
    }
}
