package com.queueless.dto;

import java.time.LocalDateTime;
import java.util.List;

/** Data for the live display board in the waiting hall. */
public record BoardView(List<CounterView> counters, List<ServiceView> services, LocalDateTime updatedAt) {
}
