package com.queueless.dto;

import java.util.List;

/** Public settings the website needs: is WhatsApp on, which mode, which languages. */
public record ConfigView(boolean whatsappEnabled, String whatsappMode, List<String> languages) {
}
