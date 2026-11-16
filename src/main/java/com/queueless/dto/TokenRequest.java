package com.queueless.dto;

import com.queueless.model.Priority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Validation messages are keys ("{val...}") from messages*.properties, so they are shown in the
 * visitor's language.
 */
public record TokenRequest(
        @NotBlank(message = "{val.name.required}")
        @Size(max = 80, message = "{val.name.long}")
        String name,

        // Empty is allowed here so staff can issue walk-in tokens for visitors without a phone.
        // The public endpoint (PublicController) still insists on a number.
        @Pattern(regexp = "|\\d{10}", message = "{val.phone.format}")
        String phone,

        @NotNull(message = "{val.service.required}")
        Long serviceId,

        Priority priority,

        /** true = send WhatsApp updates to the phone number above. */
        Boolean whatsapp,

        /** Visitor's language (en, hi, kn, ta, te, ml); used for WhatsApp messages. */
        @Pattern(regexp = "|[a-zA-Z]{2}(-[a-zA-Z]{2})?", message = "{val.lang.format}")
        String lang) {

    /** Same request with a different priority (used by the public endpoint). */
    public TokenRequest withPriority(Priority newPriority) {
        return new TokenRequest(name, phone, serviceId, newPriority, whatsapp, lang);
    }
}
