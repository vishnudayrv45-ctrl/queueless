package com.queueless.model;

/**
 * Life cycle of a token:
 * WAITING -> CALLED (at a counter) -> COMPLETED, or SKIPPED (no-show) / CANCELLED.
 */
public enum TokenStatus {
    WAITING,
    CALLED,
    COMPLETED,
    SKIPPED,
    CANCELLED
}
