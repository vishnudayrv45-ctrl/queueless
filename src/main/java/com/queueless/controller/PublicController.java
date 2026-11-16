package com.queueless.controller;

import com.queueless.dto.BoardView;
import com.queueless.dto.CancelRequest;
import com.queueless.dto.ConfigView;
import com.queueless.dto.DemoMessageView;
import com.queueless.dto.ServiceView;
import com.queueless.dto.TokenRequest;
import com.queueless.dto.TokenView;
import com.queueless.exception.ApiException;
import com.queueless.model.Priority;
import com.queueless.notify.NotificationService;
import com.queueless.service.I18nService;
import com.queueless.service.QueueService;
import com.queueless.service.SettingsService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Endpoints used by the public: choose a service, get a token, track it, see the live board. */
@RestController
@RequestMapping("/api")
public class PublicController {

    private final QueueService queue;
    private final I18nService i18n;
    private final SettingsService settings;
    private final NotificationService notifications;

    public PublicController(QueueService queue, I18nService i18n, SettingsService settings,
                            NotificationService notifications) {
        this.queue = queue;
        this.i18n = i18n;
        this.settings = settings;
        this.notifications = notifications;
    }

    /** Public settings the pages need: is WhatsApp on, which mode, which languages. */
    @GetMapping("/config")
    public ConfigView config() {
        return new ConfigView(settings.isWhatsappEnabled(), notifications.mode(), I18nService.LANGUAGES);
    }

    /** All UI texts for one language (the browser caches these and applies them to the page). */
    @GetMapping("/i18n/{lang}")
    public Map<String, String> texts(@PathVariable String lang) {
        return i18n.bundle(lang);
    }

    /** Demo mode only: the "phone screen" shows the simulated WhatsApp messages sent to this number. */
    @GetMapping("/demo/whatsapp")
    public List<DemoMessageView> demoInbox(@RequestParam String phone) {
        return notifications.demoInbox(phone);
    }

    @GetMapping("/services")
    public List<ServiceView> services() {
        return queue.activeServices();
    }

    @PostMapping("/tokens")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenView getToken(@Valid @RequestBody TokenRequest request) {
        if (request.phone() == null || request.phone().isBlank()) {
            throw ApiException.badRequest("err.phone.required");
        }
        // The web form sends the priority the visitor chose; staff can verify it at the counter.
        Priority priority = request.priority() == null ? Priority.NORMAL : request.priority();
        return queue.issue(request.withPriority(priority)).masked();
    }

    @GetMapping("/tokens/{number}")
    public TokenView track(@PathVariable String number) {
        return queue.track(number);
    }

    @PostMapping("/tokens/{number}/cancel")
    public TokenView cancel(@PathVariable String number, @Valid @RequestBody CancelRequest request) {
        return queue.cancelByCustomer(number, request.phone());
    }

    @GetMapping("/board")
    public BoardView board() {
        return queue.board();
    }
}
