package com.queueless.model;

public enum NotificationStatus {
    /** Saved, not yet handed to WhatsApp. */
    PENDING,
    /** Accepted by WhatsApp (or by the demo sender). */
    SENT,
    /** WhatsApp refused it or could not be reached. Staff can retry. */
    FAILED,
    /** Deliberately not sent, for example the visitor was already near the front when the token was issued. */
    SUPPRESSED
}
