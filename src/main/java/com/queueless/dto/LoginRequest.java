package com.queueless.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "{val.login.user}") String username,
        @NotBlank(message = "{val.login.pass}") String password) {
}
