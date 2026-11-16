package com.queueless.dto;

import jakarta.validation.constraints.NotBlank;

public record CancelRequest(
        @NotBlank(message = "{val.cancel.phone}")
        String phone) {
}
