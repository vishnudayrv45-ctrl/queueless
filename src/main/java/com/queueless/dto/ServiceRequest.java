package com.queueless.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ServiceRequest(
        @NotBlank(message = "{val.svc.name.required}")
        @Size(max = 60, message = "{val.svc.name.long}")
        String name,

        @NotBlank(message = "{val.svc.code.required}")
        @Pattern(regexp = "[A-Za-z]{1,3}", message = "{val.svc.code.format}")
        String code,

        @Size(max = 255, message = "{val.svc.desc.long}")
        String description,

        @Min(value = 1, message = "{val.svc.min.min}")
        @Max(value = 120, message = "{val.svc.min.max}")
        int avgServiceMinutes,

        Boolean active) {
}
