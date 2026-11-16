package com.queueless.model;

/**
 * Priority of a customer. Senior citizens and persons with disabilities are
 * served before regular customers of the same service.
 */
public enum Priority {
    NORMAL,
    SENIOR,
    DISABLED
}
