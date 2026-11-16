package com.queueless.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/**
 * One row per WhatsApp message (delivery history).
 * The unique constraint on (token, event) is what stops duplicate notifications:
 * the same event can never be stored, and therefore never sent, twice for one token.
 */
@Entity
@Table(name = "notification_log",
        uniqueConstraints = @UniqueConstraint(name = "uk_notification_token_event", columnNames = {"token_id", "event_type"}),
        indexes = @Index(name = "idx_notification_to", columnList = "to_number"))
public class NotificationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token_id", nullable = false)
    private Long tokenId;

    @Column(name = "token_number", nullable = false, length = 12)
    private String tokenNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 16)
    private NotificationEvent eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 12)
    private NotificationStatus status;

    /** DEMO (simulated) or CLOUD (real WhatsApp Business Cloud API). */
    @Column(name = "delivery_mode", nullable = false, length = 8)
    private String deliveryMode;

    /** Phone number with country code, digits only, for example 919876543210. */
    @Column(name = "to_number", nullable = false, length = 20)
    private String toNumber;

    @Column(name = "lang", length = 5)
    private String language;

    @Column(name = "msg_text", nullable = false, length = 1500)
    private String messageText;

    @Column(name = "provider_message_id", length = 120)
    private String providerMessageId;

    @Column(name = "error_text", length = 255)
    private String errorText;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTokenId() { return tokenId; }
    public void setTokenId(Long tokenId) { this.tokenId = tokenId; }

    public String getTokenNumber() { return tokenNumber; }
    public void setTokenNumber(String tokenNumber) { this.tokenNumber = tokenNumber; }

    public NotificationEvent getEventType() { return eventType; }
    public void setEventType(NotificationEvent eventType) { this.eventType = eventType; }

    public NotificationStatus getStatus() { return status; }
    public void setStatus(NotificationStatus status) { this.status = status; }

    public String getDeliveryMode() { return deliveryMode; }
    public void setDeliveryMode(String deliveryMode) { this.deliveryMode = deliveryMode; }

    public String getToNumber() { return toNumber; }
    public void setToNumber(String toNumber) { this.toNumber = toNumber; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getMessageText() { return messageText; }
    public void setMessageText(String messageText) { this.messageText = messageText; }

    public String getProviderMessageId() { return providerMessageId; }
    public void setProviderMessageId(String providerMessageId) { this.providerMessageId = providerMessageId; }

    public String getErrorText() { return errorText; }
    public void setErrorText(String errorText) { this.errorText = errorText; }

    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
