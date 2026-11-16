package com.queueless.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A service offered by the office, e.g. "Certificates & Revenue". */
@Entity
@Table(name = "service_category")
public class ServiceCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    /** Short prefix used in token numbers, e.g. "C" gives C-001. */
    @Column(nullable = false, unique = true, length = 3)
    private String code;

    @Column(length = 255)
    private String description;

    @Column(name = "avg_service_minutes", nullable = false)
    private int avgServiceMinutes = 5;

    @Column(nullable = false)
    private boolean active = true;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getAvgServiceMinutes() { return avgServiceMinutes; }
    public void setAvgServiceMinutes(int avgServiceMinutes) { this.avgServiceMinutes = avgServiceMinutes; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
