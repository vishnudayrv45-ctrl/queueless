package com.queueless.dto;

public record StatsView(
        int total,
        int waiting,
        int serving,
        int completed,
        int skipped,
        int cancelled,
        double avgWaitMinutes,
        double avgServiceMinutes) {
}
