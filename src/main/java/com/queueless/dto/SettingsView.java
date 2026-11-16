package com.queueless.dto;

public record SettingsView(boolean whatsappEnabled, int approachThreshold, String mode, boolean cloudConfigured) {
}
