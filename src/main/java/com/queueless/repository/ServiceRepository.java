package com.queueless.repository;

import com.queueless.model.ServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ServiceRepository extends JpaRepository<ServiceCategory, Long> {

    List<ServiceCategory> findByActiveTrueOrderByNameAsc();

    Optional<ServiceCategory> findByNameIgnoreCase(String name);

    Optional<ServiceCategory> findByCodeIgnoreCase(String code);
}
