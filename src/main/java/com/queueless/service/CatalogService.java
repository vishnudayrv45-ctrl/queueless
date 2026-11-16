package com.queueless.service;

import com.queueless.dto.CounterRequest;
import com.queueless.dto.CounterView;
import com.queueless.dto.ServiceRequest;
import com.queueless.dto.ServiceView;
import com.queueless.exception.ApiException;
import com.queueless.model.Counter;
import com.queueless.model.ServiceCategory;
import com.queueless.model.TokenStatus;
import com.queueless.repository.CounterRepository;
import com.queueless.repository.ServiceRepository;
import com.queueless.repository.TokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/** Admin management of services (what the office offers) and counters (the desks). */
@Service
public class CatalogService {

    private final ServiceRepository services;
    private final CounterRepository counters;
    private final TokenRepository tokens;
    private final QueueService queue;

    public CatalogService(ServiceRepository services, CounterRepository counters, TokenRepository tokens,
                          QueueService queue) {
        this.services = services;
        this.counters = counters;
        this.tokens = tokens;
        this.queue = queue;
    }

    /* ---------------------------- services ---------------------------- */

    @Transactional
    public ServiceView createService(ServiceRequest r) {
        String name = r.name().trim();
        String code = r.code().trim().toUpperCase();
        if (services.findByNameIgnoreCase(name).isPresent()) {
            throw ApiException.conflict("err.service.name.exists", name);
        }
        if (services.findByCodeIgnoreCase(code).isPresent()) {
            throw ApiException.conflict("err.service.code.exists", code);
        }
        ServiceCategory s = new ServiceCategory();
        s.setName(name);
        s.setCode(code);
        s.setDescription(blankToNull(r.description()));
        s.setAvgServiceMinutes(r.avgServiceMinutes());
        s.setActive(r.active() == null || r.active());
        services.save(s);
        return queue.serviceView(s.getId());
    }

    @Transactional
    public ServiceView updateService(Long id, ServiceRequest r) {
        ServiceCategory s = services.findById(id).orElseThrow(() -> ApiException.notFound("err.service.notfound"));
        String name = r.name().trim();
        String code = r.code().trim().toUpperCase();

        services.findByNameIgnoreCase(name).filter(o -> !o.getId().equals(id)).ifPresent(o -> {
            throw ApiException.conflict("err.service.name.exists", name);
        });
        services.findByCodeIgnoreCase(code).filter(o -> !o.getId().equals(id)).ifPresent(o -> {
            throw ApiException.conflict("err.service.code.exists", code);
        });

        // Token numbers are built from the code, so it must not change once tokens exist.
        if (!s.getCode().equalsIgnoreCase(code) && tokens.existsByServiceId(id)) {
            throw ApiException.conflict("err.service.code.locked");
        }

        boolean active = r.active() == null || r.active();
        if (s.isActive() && !active && hasPeopleInQueue(id)) {
            throw ApiException.conflict("err.service.deactivate.busy");
        }

        s.setName(name);
        s.setCode(code);
        s.setDescription(blankToNull(r.description()));
        s.setAvgServiceMinutes(r.avgServiceMinutes());
        s.setActive(active);
        services.save(s);
        return queue.serviceView(id);
    }

    @Transactional
    public void deleteService(Long id) {
        if (!services.existsById(id)) {
            throw ApiException.notFound("err.service.notfound");
        }
        if (tokens.existsByServiceId(id) || counters.existsByServiceId(id)) {
            throw ApiException.conflict("err.service.delete.inuse");
        }
        services.deleteById(id);
    }

    /* ---------------------------- counters ---------------------------- */

    @Transactional
    public CounterView createCounter(CounterRequest r) {
        ServiceCategory service = services.findById(r.serviceId())
                .orElseThrow(() -> ApiException.notFound("err.service.notfound"));
        if (!service.isActive()) {
            throw ApiException.conflict("err.service.inactive");
        }
        Counter c = new Counter();
        c.setName(r.name().trim());
        c.setService(service);
        c.setOpen(r.open() == null || r.open());
        counters.save(c);
        return queue.counterView(c.getId());
    }

    @Transactional
    public CounterView updateCounter(Long id, CounterRequest r) {
        Counter c = counters.findById(id).orElseThrow(() -> ApiException.notFound("err.counter.notfound"));
        ServiceCategory service = services.findById(r.serviceId())
                .orElseThrow(() -> ApiException.notFound("err.service.notfound"));
        boolean open = r.open() == null || r.open();

        boolean serving = tokens.findFirstByCounterIdAndStatusAndQueueDate(id, TokenStatus.CALLED, LocalDate.now()).isPresent();
        boolean serviceChanged = !c.getService().getId().equals(service.getId());
        if (serving && (serviceChanged || (c.isOpen() && !open))) {
            throw ApiException.conflict("err.counter.change.busy");
        }

        c.setName(r.name().trim());
        c.setService(service);
        c.setOpen(open);
        counters.save(c);
        return queue.counterView(id);
    }

    @Transactional
    public void deleteCounter(Long id) {
        if (!counters.existsById(id)) {
            throw ApiException.notFound("err.counter.notfound");
        }
        if (tokens.existsByCounterId(id)) {
            throw ApiException.conflict("err.counter.delete.used");
        }
        counters.deleteById(id);
    }

    /* ----------------------------- helpers ---------------------------- */

    private boolean hasPeopleInQueue(Long serviceId) {
        LocalDate today = LocalDate.now();
        return !tokens.findByQueueDateAndServiceIdAndStatus(today, serviceId, TokenStatus.WAITING).isEmpty()
                || !tokens.findByQueueDateAndServiceIdAndStatus(today, serviceId, TokenStatus.CALLED).isEmpty();
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
