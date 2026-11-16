package com.queueless.dto;

import com.queueless.model.Priority;
import jakarta.validation.constraints.NotNull;

public record PriorityRequest(
        @NotNull(message = "{val.priority.required}")
        Priority priority) {
}
