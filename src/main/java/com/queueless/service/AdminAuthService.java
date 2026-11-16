package com.queueless.service;

import com.queueless.dto.LoginResponse;
import com.queueless.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Very small login system for office staff: one admin account from application.properties.
 * A successful login returns a random session token that the browser sends in the
 * X-Admin-Token header. Sessions live in memory (they end when the server restarts).
 * Five wrong attempts from one address lock that address out for five minutes.
 */
@Service
public class AdminAuthService {

    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK_TIME = Duration.ofMinutes(5);

    private final String username;
    private final String password;
    private final Duration sessionLength;

    private final Map<String, Instant> sessions = new ConcurrentHashMap<>();
    private final Map<String, Failures> failures = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private static final class Failures {
        int count;
        Instant lockedUntil = Instant.EPOCH;
    }

    public AdminAuthService(@Value("${queueless.admin.username}") String username,
                            @Value("${queueless.admin.password}") String password,
                            @Value("${queueless.admin.session-hours:8}") long sessionHours) {
        this.username = username;
        this.password = password;
        this.sessionLength = Duration.ofHours(sessionHours);
    }

    public LoginResponse login(String user, String pass, String clientAddress) {
        Failures f = failures.computeIfAbsent(clientAddress, k -> new Failures());
        synchronized (f) {
            if (Instant.now().isBefore(f.lockedUntil)) {
                throw ApiException.tooManyRequests("err.auth.locked");
            }
            boolean ok = same(username, user) & same(password, pass);
            if (!ok) {
                f.count++;
                if (f.count >= MAX_FAILURES) {
                    f.count = 0;
                    f.lockedUntil = Instant.now().plus(LOCK_TIME);
                }
                throw ApiException.unauthorized("err.auth.wrong");
            }
            f.count = 0;
        }

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = Instant.now().plus(sessionLength);
        sessions.put(token, expires);
        purgeExpired();
        return new LoginResponse(token, expires);
    }

    public boolean isValid(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        Instant expires = sessions.get(token);
        if (expires == null) {
            return false;
        }
        if (Instant.now().isAfter(expires)) {
            sessions.remove(token);
            return false;
        }
        return true;
    }

    public void logout(String token) {
        if (token != null) {
            sessions.remove(token);
        }
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        sessions.entrySet().removeIf(e -> now.isAfter(e.getValue()));
    }

    /** Constant-time comparison so response time does not reveal how much matched. */
    private static boolean same(String expected, String given) {
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = given == null ? new byte[0] : given.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }
}
