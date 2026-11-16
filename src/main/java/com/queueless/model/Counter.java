package com.queueless.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** A physical service counter (desk) that serves one service. */
@Entity
@Table(name = "service_counter")
public class Counter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String name;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "service_id")
    private ServiceCategory service;

    @Column(name = "is_open", nullable = false)
    private boolean open = true;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public ServiceCategory getService() { return service; }
    public void setService(ServiceCategory service) { this.service = service; }

    public boolean isOpen() { return open; }
    public void setOpen(boolean open) { this.open = open; }
}
