package com.queueless.config;

import com.queueless.model.Counter;
import com.queueless.model.ServiceCategory;
import com.queueless.repository.CounterRepository;
import com.queueless.repository.ServiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/** On the very first run, fills the database with a sample office so the screens are not empty. */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final ServiceRepository services;
    private final CounterRepository counters;

    public DataSeeder(ServiceRepository services, CounterRepository counters) {
        this.services = services;
        this.counters = counters;
    }

    @Override
    public void run(String... args) {
        if (services.count() > 0) {
            return;
        }
        ServiceCategory certificates = service("Certificates & Revenue", "C",
                "Birth, income, caste and residence certificates; land records", 8);
        ServiceCategory licences = service("Licences & Permits", "L",
                "Driving licence, trade licence, building permits", 10);
        ServiceCategory payments = service("Payments & Bills", "P",
                "Property tax, water and electricity bill payments", 4);
        ServiceCategory help = service("Enquiry & Grievances", "E",
                "General questions, complaints and application status", 6);

        counter("Counter 1", certificates);
        counter("Counter 2", licences);
        counter("Counter 3", payments);
        counter("Counter 4", payments);
        counter("Counter 5", help);
        log.info("Sample services and counters created. Change them in the admin panel.");
    }

    private ServiceCategory service(String name, String code, String description, int minutes) {
        ServiceCategory s = new ServiceCategory();
        s.setName(name);
        s.setCode(code);
        s.setDescription(description);
        s.setAvgServiceMinutes(minutes);
        s.setActive(true);
        return services.save(s);
    }

    private void counter(String name, ServiceCategory service) {
        Counter c = new Counter();
        c.setName(name);
        c.setService(service);
        c.setOpen(true);
        counters.save(c);
    }
}
