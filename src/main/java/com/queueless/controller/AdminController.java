package com.queueless.controller;

import com.queueless.config.AdminAuthInterceptor;
import com.queueless.dto.CounterRequest;
import com.queueless.dto.CounterView;
import com.queueless.dto.LoginRequest;
import com.queueless.dto.LoginResponse;
import com.queueless.dto.PriorityRequest;
import com.queueless.dto.ServiceRequest;
import com.queueless.dto.ServiceView;
import com.queueless.dto.NotificationView;
import com.queueless.dto.SettingsRequest;
import com.queueless.dto.SettingsView;
import com.queueless.dto.StatsView;
import com.queueless.dto.TokenRequest;
import com.queueless.dto.TokenView;
import com.queueless.model.TokenStatus;
import com.queueless.service.AdminAuthService;
import com.queueless.service.CatalogService;
import com.queueless.notify.NotificationService;
import com.queueless.service.QueueService;
import com.queueless.service.SettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Staff endpoints. Everything except /login needs the X-Admin-Token header (see AdminAuthInterceptor). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminAuthService auth;
    private final QueueService queue;
    private final CatalogService catalog;
    private final SettingsService settings;
    private final NotificationService notifications;

    public AdminController(AdminAuthService auth, QueueService queue, CatalogService catalog,
                           SettingsService settings, NotificationService notifications) {
        this.auth = auth;
        this.queue = queue;
        this.catalog = catalog;
        this.settings = settings;
        this.notifications = notifications;
    }

    /* ------------------------- WhatsApp settings ------------------------- */

    @GetMapping("/settings")
    public SettingsView getSettings() {
        return settingsView();
    }

    @PutMapping("/settings")
    public SettingsView saveSettings(@Valid @RequestBody SettingsRequest r) {
        if (r.whatsappEnabled() != null) {
            settings.setWhatsappEnabled(r.whatsappEnabled());
        }
        if (r.approachThreshold() != null) {
            settings.setApproachThreshold(r.approachThreshold());
        }
        return settingsView();
    }

    @GetMapping("/notifications")
    public List<NotificationView> notificationHistory() {
        return notifications.recent();
    }

    @PostMapping("/notifications/{id}/retry")
    public NotificationView retryNotification(@PathVariable Long id) {
        return notifications.retry(id);
    }

    private SettingsView settingsView() {
        return new SettingsView(settings.isWhatsappEnabled(), settings.approachThreshold(),
                notifications.mode(), notifications.cloudConfigured());
    }

    /* ------------------------------ session ------------------------------ */

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return auth.login(request.username(), request.password(), http.getRemoteAddr());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader(AdminAuthInterceptor.HEADER) String token) {
        auth.logout(token);
    }

    /* ------------------------------ overview ----------------------------- */

    @GetMapping("/stats")
    public StatsView stats() {
        return queue.stats();
    }

    @GetMapping("/tokens")
    public List<TokenView> tokens(@RequestParam(required = false) Long serviceId,
                                  @RequestParam(required = false) TokenStatus status) {
        return queue.listToday(serviceId, status);
    }

    /** Staff can issue a token for a walk-in visitor who does not use the website. */
    @PostMapping("/tokens")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenView issueWalkIn(@Valid @RequestBody TokenRequest request) {
        return queue.issue(request);
    }

    /* --------------------------- token actions --------------------------- */

    @PostMapping("/counters/{id}/call-next")
    public TokenView callNext(@PathVariable Long id) {
        return queue.callNext(id);
    }

    @PostMapping("/tokens/{id}/complete")
    public TokenView complete(@PathVariable Long id) {
        return queue.complete(id);
    }

    @PostMapping("/tokens/{id}/skip")
    public TokenView skip(@PathVariable Long id) {
        return queue.skip(id);
    }

    @PostMapping("/tokens/{id}/cancel")
    public TokenView cancel(@PathVariable Long id) {
        return queue.cancel(id);
    }

    @PutMapping("/tokens/{id}/priority")
    public TokenView priority(@PathVariable Long id, @Valid @RequestBody PriorityRequest request) {
        return queue.changePriority(id, request.priority());
    }

    /* ------------------------------ counters ----------------------------- */

    @GetMapping("/counters")
    public List<CounterView> counters() {
        return queue.counterViews();
    }

    @PostMapping("/counters")
    @ResponseStatus(HttpStatus.CREATED)
    public CounterView createCounter(@Valid @RequestBody CounterRequest request) {
        return catalog.createCounter(request);
    }

    @PutMapping("/counters/{id}")
    public CounterView updateCounter(@PathVariable Long id, @Valid @RequestBody CounterRequest request) {
        return catalog.updateCounter(id, request);
    }

    @DeleteMapping("/counters/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCounter(@PathVariable Long id) {
        catalog.deleteCounter(id);
    }

    /* ------------------------------ services ----------------------------- */

    @GetMapping("/services")
    public List<ServiceView> services() {
        return queue.allServices();
    }

    @PostMapping("/services")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceView createService(@Valid @RequestBody ServiceRequest request) {
        return catalog.createService(request);
    }

    @PutMapping("/services/{id}")
    public ServiceView updateService(@PathVariable Long id, @Valid @RequestBody ServiceRequest request) {
        return catalog.updateService(id, request);
    }

    @DeleteMapping("/services/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteService(@PathVariable Long id) {
        catalog.deleteService(id);
    }
}
