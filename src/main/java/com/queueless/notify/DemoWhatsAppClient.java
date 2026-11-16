package com.queueless.notify;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Demo sender: nothing leaves the computer. The message is only stored in the notification
 * history and printed in the console, and it can be read on the "WhatsApp demo" page.
 * Used whenever real WhatsApp credentials are not configured.
 */
@Component
public class DemoWhatsAppClient implements WhatsAppClient {

    private static final Logger log = LoggerFactory.getLogger(DemoWhatsAppClient.class);

    @Override
    public SendResult send(String to, String text) {
        log.info("[WhatsApp DEMO] to +{}:\n{}", to, text);
        return new SendResult("demo-" + UUID.randomUUID());
    }

    @Override
    public String mode() {
        return "DEMO";
    }
}
