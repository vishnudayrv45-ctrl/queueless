package com.queueless.repository;

import com.queueless.model.NotificationEvent;
import com.queueless.model.NotificationLog;
import com.queueless.model.NotificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, Long> {

    boolean existsByTokenIdAndEventType(Long tokenId, NotificationEvent eventType);

    List<NotificationLog> findTop100ByOrderByIdDesc();

    List<NotificationLog> findTop50ByToNumberAndStatusOrderByIdDesc(String toNumber, NotificationStatus status);
}
