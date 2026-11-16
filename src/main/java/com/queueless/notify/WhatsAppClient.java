package com.queueless.notify;

/** Something that can deliver one WhatsApp text message. */
public interface WhatsAppClient {

    /** Result of a successful hand-over to WhatsApp. */
    record SendResult(String messageId) {
    }

    /**
     * @param to   phone number with country code, digits only (for example 919876543210)
     * @param text message body
     * @throws Exception if the message could not be delivered
     */
    SendResult send(String to, String text) throws Exception;

    /** "DEMO" or "CLOUD". */
    String mode();
}
