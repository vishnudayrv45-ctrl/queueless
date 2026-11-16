package com.queueless.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CounterRequest(
        @NotBlank(message = "{val.counter.name.required}")
        @Size(max = 40, message = "{val.counter.name.long}")
        String name,

        @NotNull(message = "{val.counter.service}")
        Long serviceId,

        Boolean open) {
}
