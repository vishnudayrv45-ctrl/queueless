package com.queueless.dto;

public record ServiceView(
        Long id,
        String name,
        String code,
        String description,
        int avgServiceMinutes,
        boolean active,
        int waiting,
        int openCounters,
        int estimatedWaitMinutes) {
}
