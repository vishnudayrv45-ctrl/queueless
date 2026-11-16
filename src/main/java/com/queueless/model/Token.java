package com.queueless.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** A digital queue token issued to a customer. Token numbers restart every day. */
@Entity
@Table(name = "queue_token", indexes = {
        @Index(name = "idx_token_number", columnList = "token_number"),
        @Index(name = "idx_token_day_status", columnList = "queue_date,status")
})
public class Token {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Display number such as "C-007". */
    @Column(name = "token_number", nullable = false, length = 12)
    private String number;

    /** Running number for this service on this day (1, 2, 3 ...). */
    @Column(name = "seq_no", nullable = false)
    private int sequence;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "service_id")
    private ServiceCategory service;

    @Column(name = "customer_name", nullable = false, length = 80)
    private String customerName;

    @Column(length = 15)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Priority priority = Priority.NORMAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private TokenStatus status = TokenStatus.WAITING;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "counter_id")
    private Counter counter;

    /** true = the visitor asked for WhatsApp updates. Null in rows created before this feature existed. */
    @Column(name = "notify_whatsapp")
    private Boolean notifyWhatsapp;

    /** Visitor's language code (en, hi, kn, ta, te, ml); WhatsApp messages are sent in it. */
    @Column(name = "lang", length = 5)
    private String language;

    @Column(name = "queue_date", nullable = false)
    private LocalDate queueDate;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "called_at")
    private LocalDateTime calledAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public int getSequence() { return sequence; }
    public void setSequence(int sequence) { this.sequence = sequence; }

    public ServiceCategory getService() { return service; }
    public void setService(ServiceCategory service) { this.service = service; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public Priority getPriority() { return priority; }
    public void setPriority(Priority priority) { this.priority = priority; }

    public TokenStatus getStatus() { return status; }
    public void setStatus(TokenStatus status) { this.status = status; }

    public Counter getCounter() { return counter; }
    public void setCounter(Counter counter) { this.counter = counter; }

    public Boolean getNotifyWhatsapp() { return notifyWhatsapp; }
    public void setNotifyWhatsapp(Boolean notifyWhatsapp) { this.notifyWhatsapp = notifyWhatsapp; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public LocalDate getQueueDate() { return queueDate; }
    public void setQueueDate(LocalDate queueDate) { this.queueDate = queueDate; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getCalledAt() { return calledAt; }
    public void setCalledAt(LocalDateTime calledAt) { this.calledAt = calledAt; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
