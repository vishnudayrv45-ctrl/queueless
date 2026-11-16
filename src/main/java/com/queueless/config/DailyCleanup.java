package com.queueless.config;

import com.queueless.service.QueueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/** Closes tokens that were never served on a previous day (at start-up and just after midnight). */
@Configuration
@EnableScheduling
public class DailyCleanup {

    private static final Logger log = LoggerFactory.getLogger(DailyCleanup.class);

    private final QueueService queue;

    public DailyCleanup(QueueService queue) {
        this.queue = queue;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStart() {
        run();
    }

    @Scheduled(cron = "0 5 0 * * *")
    public void nightly() {
        run();
    }

    private void run() {
        int closed = queue.closeStaleTokens();
        if (closed > 0) {
            log.info("Closed {} unserved token(s) from earlier days", closed);
        }
    }
}
