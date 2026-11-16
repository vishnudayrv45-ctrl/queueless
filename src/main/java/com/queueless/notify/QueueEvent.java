package com.queueless.notify;

/**
 * Published by QueueService whenever something happens in a queue.
 * NotificationService listens for it AFTER the database change has been committed,
 * so a WhatsApp problem can never undo or delay a queue operation.
 */
public record QueueEvent(Long tokenId, Long serviceId, Type type) {

    public enum Type {
        /** A token was just created. */
        ISSUED,
        /** A token was called to a counter. */
        CALLED,
        /** A called token was skipped (visitor did not come). */
        SKIPPED,
        /** A token was cancelled. */
        CANCELLED,
        /** The waiting line of a service changed (someone left it, or priorities changed). */
        QUEUE_CHANGED
    }
}
