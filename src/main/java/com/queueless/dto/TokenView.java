package com.queueless.dto;

import com.queueless.model.Priority;
import com.queueless.model.TokenStatus;

import java.time.LocalDateTime;

/**
 * What the screens see of a token. The phone number is never included.
 * position / ahead / etaMinutes are only meaningful while status is WAITING.
 */
public record TokenView(
        Long id,
        String number,
        Long serviceId,
        String serviceName,
        String customerName,
        Priority priority,
        TokenStatus status,
        String counterName,
        int position,
        int ahead,
        int etaMinutes,
        int openCounters,
        LocalDateTime createdAt,
        LocalDateTime calledAt,
        LocalDateTime completedAt) {

    /** Copy for public screens: only the first letter of the name is shown. */
    public TokenView masked() {
        String shown = (customerName == null || customerName.isBlank())
                ? "" : customerName.trim().substring(0, 1) + "***";
        return new TokenView(id, number, serviceId, serviceName, shown, priority, status, counterName,
                position, ahead, etaMinutes, openCounters, createdAt, calledAt, completedAt);
    }
}
