package com.queueless.repository;

import com.queueless.model.Token;
import com.queueless.model.TokenStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TokenRepository extends JpaRepository<Token, Long> {

    List<Token> findByQueueDateAndServiceIdAndStatus(LocalDate queueDate, Long serviceId, TokenStatus status);

    List<Token> findByQueueDateOrderByIdAsc(LocalDate queueDate);

    List<Token> findByQueueDateAndServiceIdOrderByIdAsc(LocalDate queueDate, Long serviceId);

    List<Token> findByQueueDateBeforeAndStatusIn(LocalDate queueDate, Collection<TokenStatus> statuses);

    Optional<Token> findFirstByNumberAndQueueDate(String number, LocalDate queueDate);

    Optional<Token> findFirstByCounterIdAndStatusAndQueueDate(Long counterId, TokenStatus status, LocalDate queueDate);

    boolean existsByCounterId(Long counterId);

    boolean existsByServiceId(Long serviceId);

    boolean existsByQueueDateAndServiceIdAndPhoneAndStatus(LocalDate queueDate, Long serviceId, String phone,
                                                           TokenStatus status);

    @Query("select coalesce(max(t.sequence), 0) from Token t where t.service.id = :serviceId and t.queueDate = :day")
    int maxSequence(@Param("serviceId") Long serviceId, @Param("day") LocalDate day);
}
