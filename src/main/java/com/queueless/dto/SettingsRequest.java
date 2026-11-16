package com.queueless.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record SettingsRequest(
        Boolean whatsappEnabled,

        @Min(value = 3, message = "{val.threshold.range}")
        @Max(value = 5, message = "{val.threshold.range}")
        Integer approachThreshold) {
}
