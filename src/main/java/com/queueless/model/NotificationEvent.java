package com.queueless.model;

/** The queue events a visitor can be told about on WhatsApp. Each one is sent at most once per token. */
public enum NotificationEvent {
    /** Token created. */
    CONFIRMATION,
    /** A few people are left ahead of the visitor. */
    APPROACHING,
    /** The token is called to a counter (the message also names the counter). */
    CALLED,
    /** The visitor was not at the counter, so the turn was skipped (a missed / delayed turn). */
    SKIPPED,
    /** The token was cancelled. */
    CANCELLED
}
