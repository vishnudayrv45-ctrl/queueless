package com.queueless.dto;

import com.queueless.model.NotificationEvent;
import com.queueless.model.NotificationStatus;

import java.time.LocalDateTime;

/** One row of the WhatsApp delivery history shown to staff (phone number partly hidden). */
public record NotificationView(
        Long id,
        String tokenNumber,
        NotificationEvent eventType,
        NotificationStatus status,
        String mode,
        String to,
        String language,
        String message,
        String error,
        int attempts,
        LocalDateTime createdAt) {
}
