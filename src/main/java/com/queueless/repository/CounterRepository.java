package com.queueless.repository;

import com.queueless.model.Counter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CounterRepository extends JpaRepository<Counter, Long> {

    List<Counter> findAllByOrderByNameAsc();

    long countByServiceIdAndOpenTrue(Long serviceId);

    boolean existsByServiceId(Long serviceId);
}
