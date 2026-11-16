package com.queueless.dto;

import com.queueless.model.NotificationEvent;

import java.time.LocalDateTime;

/** A simulated WhatsApp message for the demo inbox page. */
public record DemoMessageView(NotificationEvent eventType, String message, LocalDateTime createdAt) {
}
