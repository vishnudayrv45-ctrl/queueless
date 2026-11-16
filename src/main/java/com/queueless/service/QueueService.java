package com.queueless.service;

import com.queueless.dto.BoardView;
import com.queueless.dto.CounterView;
import com.queueless.dto.ServiceView;
import com.queueless.dto.StatsView;
import com.queueless.dto.TokenRequest;
import com.queueless.dto.TokenView;
import com.queueless.exception.ApiException;
import com.queueless.model.Counter;
import com.queueless.model.Priority;
import com.queueless.model.ServiceCategory;
import com.queueless.model.Token;
import com.queueless.model.TokenStatus;
import com.queueless.notify.QueueEvent;
import com.queueless.repository.CounterRepository;
import com.queueless.repository.ServiceRepository;
import com.queueless.repository.TokenRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Heart of QueueLess: issuing tokens, ordering the queue, calling people to counters
 * and estimating waiting time.
 *
 * Queue rules
 *  - Each service has its own queue; token numbers restart every day (C-001, C-002 ...).
 *  - Persons with disability are served first, then senior citizens, then everyone else.
 *    Inside the same priority, first come first served.
 *  - Waiting time = people ahead x average service time / open counters.
 *    The average starts from the value set by the admin and switches to the real
 *    average of today's completed tokens once at least 3 have been served.
 *
 * All methods that change data are synchronized and run in their own transaction, so two
 * people can never receive the same token number and two counters can never call the
 * same person.
 */
@Service
public class QueueService {

    private static final int MIN_SAMPLES = 3;

    private static final Comparator<Token> QUEUE_ORDER =
            Comparator.comparingInt((Token t) -> rank(t.getPriority())).thenComparing(Token::getId);

    private final TokenRepository tokens;
    private final ServiceRepository services;
    private final CounterRepository counters;
    private final TransactionTemplate tx;
    private final ApplicationEventPublisher events;

    public QueueService(TokenRepository tokens, ServiceRepository services, CounterRepository counters,
                        TransactionTemplate tx, ApplicationEventPublisher events) {
        this.tokens = tokens;
        this.services = services;
        this.counters = counters;
        this.tx = tx;
        this.events = events;
    }

    /** Tells the WhatsApp notifier what happened (it reacts after the database change is committed). */
    private void publish(Token token, QueueEvent.Type type) {
        events.publishEvent(new QueueEvent(token.getId(), token.getService().getId(), type));
    }

    private static int rank(Priority p) {
        return switch (p) {
            case DISABLED -> 0;
            case SENIOR -> 1;
            case NORMAL -> 2;
        };
    }

    /* ------------------------------------------------------------------ */
    /* Per-service snapshot used to build views                            */
    /* ------------------------------------------------------------------ */

    private record Snapshot(List<Token> queue, int openCounters, double avgMinutes) {
        int eta(int ahead) {
            if (ahead <= 0) {
                return 0;
            }
            return (int) Math.ceil(ahead * avgMinutes / Math.max(1, openCounters));
        }

        int indexOf(Long tokenId) {
            for (int i = 0; i < queue.size(); i++) {
                if (queue.get(i).getId().equals(tokenId)) {
                    return i;
                }
            }
            return -1;
        }
    }

    private Snapshot snapshot(ServiceCategory service, LocalDate day) {
        List<Token> dayTokens = tokens.findByQueueDateAndServiceIdOrderByIdAsc(day, service.getId());

        List<Token> queue = dayTokens.stream()
                .filter(t -> t.getStatus() == TokenStatus.WAITING)
                .sorted(QUEUE_ORDER)
                .toList();

        List<Token> done = dayTokens.stream()
                .filter(t -> t.getStatus() == TokenStatus.COMPLETED
                        && t.getCalledAt() != null && t.getCompletedAt() != null)
                .toList();

        double avg = service.getAvgServiceMinutes();
        if (done.size() >= MIN_SAMPLES) {
            double seconds = done.stream()
                    .mapToLong(t -> Duration.between(t.getCalledAt(), t.getCompletedAt()).getSeconds())
                    .average()
                    .orElse(avg * 60);
            avg = Math.min(60, Math.max(1, seconds / 60.0));
        }
        int open = (int) counters.countByServiceIdAndOpenTrue(service.getId());
        return new Snapshot(queue, open, avg);
    }

    private TokenView toView(Token t, Snapshot snap, LocalDate day) {
        int position = 0;
        int ahead = 0;
        int eta = 0;
        Snapshot used = snap;
        if (t.getStatus() == TokenStatus.WAITING) {
            if (used == null) {
                used = snapshot(t.getService(), day);
            }
            int index = used.indexOf(t.getId());
            ahead = Math.max(index, 0);
            position = ahead + 1;
            eta = used.eta(ahead);
        }
        return new TokenView(
                t.getId(), t.getNumber(),
                t.getService().getId(), t.getService().getName(),
                t.getCustomerName(), t.getPriority(), t.getStatus(),
                t.getCounter() == null ? null : t.getCounter().getName(),
                position, ahead, eta,
                used == null ? 0 : used.openCounters(),
                t.getCreatedAt(), t.getCalledAt(), t.getCompletedAt());
    }

    private ServiceView toView(ServiceCategory s, LocalDate day) {
        Snapshot snap = snapshot(s, day);
        int waiting = snap.queue().size();
        return new ServiceView(s.getId(), s.getName(), s.getCode(), s.getDescription(),
                s.getAvgServiceMinutes(), s.isActive(), waiting, snap.openCounters(), snap.eta(waiting));
    }

    private CounterView toView(Counter c, LocalDate day, boolean maskNames) {
        Snapshot snap = snapshot(c.getService(), day);
        TokenView current = tokens
                .findFirstByCounterIdAndStatusAndQueueDate(c.getId(), TokenStatus.CALLED, day)
                .map(t -> toView(t, snap, day))
                .map(v -> maskNames ? v.masked() : v)
                .orElse(null);
        return new CounterView(c.getId(), c.getName(), c.getService().getId(), c.getService().getName(),
                c.getService().getCode(), c.isOpen(), snap.queue().size(), current);
    }

    private Token findToken(Long id) {
        return tokens.findById(id).orElseThrow(() -> ApiException.notFound("err.token.notfound"));
    }

    private Counter findCounter(Long id) {
        return counters.findById(id).orElseThrow(() -> ApiException.notFound("err.counter.notfound"));
    }

    /* ------------------------------------------------------------------ */
    /* Customer side                                                       */
    /* ------------------------------------------------------------------ */

    @Transactional(readOnly = true)
    public List<ServiceView> activeServices() {
        LocalDate today = LocalDate.now();
        return services.findByActiveTrueOrderByNameAsc().stream().map(s -> toView(s, today)).toList();
    }

    public synchronized TokenView issue(TokenRequest request) {
        return tx.execute(status -> {
            LocalDate today = LocalDate.now();
            ServiceCategory service = services.findById(request.serviceId())
                    .filter(ServiceCategory::isActive)
                    .orElseThrow(() -> ApiException.notFound("err.service.unavailable"));

            // A walk-in token issued by staff may have no phone number (stored as null).
            String phone = request.phone() == null ? "" : request.phone().trim();
            boolean alreadyActive = !phone.isEmpty() && (
                    tokens.existsByQueueDateAndServiceIdAndPhoneAndStatus(today, service.getId(), phone, TokenStatus.WAITING)
                            || tokens.existsByQueueDateAndServiceIdAndPhoneAndStatus(today, service.getId(), phone, TokenStatus.CALLED));
            if (alreadyActive) {
                throw ApiException.conflict("err.token.dup", service.getName());
            }

            Token token = new Token();
            token.setService(service);
            token.setCustomerName(request.name().trim());
            token.setPhone(phone.isEmpty() ? null : phone);
            token.setNotifyWhatsapp(Boolean.TRUE.equals(request.whatsapp()) && !phone.isEmpty());
            token.setLanguage(I18nService.normalize(request.lang()));
            token.setPriority(request.priority() == null ? Priority.NORMAL : request.priority());
            token.setStatus(TokenStatus.WAITING);
            token.setQueueDate(today);
            token.setCreatedAt(LocalDateTime.now());
            token.setSequence(tokens.maxSequence(service.getId(), today) + 1);
            token.setNumber(service.getCode().toUpperCase() + "-" + String.format("%03d", token.getSequence()));
            tokens.save(token);
            publish(token, QueueEvent.Type.ISSUED);

            return toView(token, snapshot(service, today), today);
        });
    }

    /** Looks up today's token by its number. Customer name is masked for privacy. */
    @Transactional(readOnly = true)
    public TokenView track(String number) {
        LocalDate today = LocalDate.now();
        Token token = tokens.findFirstByNumberAndQueueDate(number.trim().toUpperCase(), today)
                .orElseThrow(() -> ApiException.notFound("err.token.notfound.today", number.trim().toUpperCase()));
        return toView(token, null, today).masked();
    }

    /** A customer cancels their own waiting token; the mobile number must match. */
    public synchronized TokenView cancelByCustomer(String number, String phone) {
        return tx.execute(status -> {
            LocalDate today = LocalDate.now();
            Token token = tokens.findFirstByNumberAndQueueDate(number.trim().toUpperCase(), today)
                    .orElseThrow(() -> ApiException.notFound("err.token.notfound.today", number.trim().toUpperCase()));
            if (token.getPhone() == null || !token.getPhone().equals(phone.trim())) {
                throw ApiException.forbidden("err.token.phone.mismatch");
            }
            if (token.getStatus() != TokenStatus.WAITING) {
                throw ApiException.conflict("err.token.cancel.waiting");
            }
            token.setStatus(TokenStatus.CANCELLED);
            token.setCompletedAt(LocalDateTime.now());
            tokens.save(token);
            publish(token, QueueEvent.Type.CANCELLED);
            publish(token, QueueEvent.Type.QUEUE_CHANGED);
            return toView(token, null, today).masked();
        });
    }

    @Transactional(readOnly = true)
    public BoardView board() {
        LocalDate today = LocalDate.now();
        List<CounterView> open = counters.findAllByOrderByNameAsc().stream()
                .filter(Counter::isOpen)
                .map(c -> toView(c, today, true))
                .toList();
        return new BoardView(open, activeServices(), LocalDateTime.now());
    }

    /* ------------------------------------------------------------------ */
    /* Staff side                                                          */
    /* ------------------------------------------------------------------ */

    @Transactional(readOnly = true)
    public List<ServiceView> allServices() {
        LocalDate today = LocalDate.now();
        return services.findAll(Sort.by("name")).stream().map(s -> toView(s, today)).toList();
    }

    @Transactional(readOnly = true)
    public ServiceView serviceView(Long id) {
        ServiceCategory s = services.findById(id).orElseThrow(() -> ApiException.notFound("err.service.notfound"));
        return toView(s, LocalDate.now());
    }

    /** Full (unmasked) view of one token; used by the WhatsApp notifier to fill in position and wait time. */
    @Transactional(readOnly = true)
    public TokenView viewOf(Long tokenId) {
        Token token = findToken(tokenId);
        return toView(token, null, token.getQueueDate());
    }

    @Transactional(readOnly = true)
    public List<CounterView> counterViews() {
        LocalDate today = LocalDate.now();
        return counters.findAllByOrderByNameAsc().stream().map(c -> toView(c, today, false)).toList();
    }

    @Transactional(readOnly = true)
    public CounterView counterView(Long id) {
        return toView(findCounter(id), LocalDate.now(), false);
    }

    @Transactional(readOnly = true)
    public List<TokenView> listToday(Long serviceId, TokenStatus status) {
        LocalDate today = LocalDate.now();
        List<Token> list = serviceId == null
                ? tokens.findByQueueDateOrderByIdAsc(today)
                : tokens.findByQueueDateAndServiceIdOrderByIdAsc(today, serviceId);
        Map<Long, Snapshot> cache = new HashMap<>();
        return list.stream()
                .filter(t -> status == null || t.getStatus() == status)
                .map(t -> {
                    Snapshot snap = cache.get(t.getService().getId());
                    if (snap == null) {
                        snap = snapshot(t.getService(), today);
                        cache.put(t.getService().getId(), snap);
                    }
                    return toView(t, snap, today);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public StatsView stats() {
        List<Token> list = tokens.findByQueueDateOrderByIdAsc(LocalDate.now());
        int waiting = count(list, TokenStatus.WAITING);
        int serving = count(list, TokenStatus.CALLED);
        int completed = count(list, TokenStatus.COMPLETED);
        int skipped = count(list, TokenStatus.SKIPPED);
        int cancelled = count(list, TokenStatus.CANCELLED);

        double avgWait = list.stream()
                .filter(t -> t.getCalledAt() != null)
                .mapToLong(t -> Duration.between(t.getCreatedAt(), t.getCalledAt()).getSeconds())
                .average().orElse(0) / 60.0;
        double avgService = list.stream()
                .filter(t -> t.getStatus() == TokenStatus.COMPLETED && t.getCalledAt() != null && t.getCompletedAt() != null)
                .mapToLong(t -> Duration.between(t.getCalledAt(), t.getCompletedAt()).getSeconds())
                .average().orElse(0) / 60.0;

        return new StatsView(list.size(), waiting, serving, completed, skipped, cancelled,
                round1(avgWait), round1(avgService));
    }

    private static int count(List<Token> list, TokenStatus status) {
        return (int) list.stream().filter(t -> t.getStatus() == status).count();
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /** Counter staff presses "Call next": the best-ranked waiting person for that counter's service. */
    public synchronized TokenView callNext(Long counterId) {
        return tx.execute(status -> {
            LocalDate today = LocalDate.now();
            Counter counter = findCounter(counterId);
            if (!counter.isOpen()) {
                throw ApiException.conflict("err.counter.closed", counter.getName());
            }
            if (tokens.findFirstByCounterIdAndStatusAndQueueDate(counterId, TokenStatus.CALLED, today).isPresent()) {
                throw ApiException.conflict("err.counter.busy");
            }
            Snapshot snap = snapshot(counter.getService(), today);
            if (snap.queue().isEmpty()) {
                throw ApiException.notFound("err.counter.nobody", counter.getService().getName());
            }
            Token next = snap.queue().get(0);
            next.setStatus(TokenStatus.CALLED);
            next.setCounter(counter);
            next.setCalledAt(LocalDateTime.now());
            tokens.save(next);
            publish(next, QueueEvent.Type.CALLED);
            publish(next, QueueEvent.Type.QUEUE_CHANGED);
            return toView(next, null, today);
        });
    }

    public synchronized TokenView complete(Long tokenId) {
        return finishCalled(tokenId, TokenStatus.COMPLETED);
    }

    public synchronized TokenView skip(Long tokenId) {
        return finishCalled(tokenId, TokenStatus.SKIPPED);
    }

    private TokenView finishCalled(Long tokenId, TokenStatus result) {
        return tx.execute(status -> {
            Token token = findToken(tokenId);
            if (token.getStatus() != TokenStatus.CALLED) {
                throw ApiException.conflict("err.token.notcalled", token.getNumber());
            }
            token.setStatus(result);
            token.setCompletedAt(LocalDateTime.now());
            tokens.save(token);
            if (result == TokenStatus.SKIPPED) {
                publish(token, QueueEvent.Type.SKIPPED);
            }
            return toView(token, null, token.getQueueDate());
        });
    }

    /** Staff cancel a token that is waiting or at a counter. */
    public synchronized TokenView cancel(Long tokenId) {
        return tx.execute(status -> {
            Token token = findToken(tokenId);
            if (token.getStatus() != TokenStatus.WAITING && token.getStatus() != TokenStatus.CALLED) {
                throw ApiException.conflict("err.token.closed", token.getNumber());
            }
            boolean wasWaiting = token.getStatus() == TokenStatus.WAITING;
            token.setStatus(TokenStatus.CANCELLED);
            token.setCompletedAt(LocalDateTime.now());
            tokens.save(token);
            publish(token, QueueEvent.Type.CANCELLED);
            if (wasWaiting) {
                publish(token, QueueEvent.Type.QUEUE_CHANGED);
            }
            return toView(token, null, token.getQueueDate());
        });
    }

    /** Staff move a waiting token to another priority (for example after checking an ID card). */
    public synchronized TokenView changePriority(Long tokenId, Priority priority) {
        return tx.execute(status -> {
            Token token = findToken(tokenId);
            if (token.getStatus() != TokenStatus.WAITING) {
                throw ApiException.conflict("err.token.priority.waiting");
            }
            token.setPriority(priority);
            tokens.save(token);
            publish(token, QueueEvent.Type.QUEUE_CHANGED);
            return toView(token, null, token.getQueueDate());
        });
    }

    /**
     * Tokens left over from earlier days can never be served, so they are closed.
     * Runs at start-up and every night (see {@link com.queueless.config.DailyCleanup}).
     */
    public synchronized int closeStaleTokens() {
        Integer closed = tx.execute(status -> {
            List<Token> stale = tokens.findByQueueDateBeforeAndStatusIn(LocalDate.now(),
                    EnumSet.of(TokenStatus.WAITING, TokenStatus.CALLED));
            LocalDateTime now = LocalDateTime.now();
            for (Token t : stale) {
                t.setStatus(TokenStatus.CANCELLED);
                t.setCompletedAt(now);
            }
            tokens.saveAll(stale);
            return stale.size();
        });
        return closed == null ? 0 : closed;
    }
}
