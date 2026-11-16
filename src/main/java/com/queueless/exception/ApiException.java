package com.queueless.exception;

import org.springframework.http.HttpStatus;

/**
 * An error that is safe to show to the user.
 *
 * The message is a KEY from messages*.properties (for example "err.token.dup") plus optional
 * arguments. GlobalExceptionHandler translates it into the language the browser asked for.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final transient Object[] args;

    public ApiException(HttpStatus status, String key, Object... args) {
        super(key);
        this.status = status;
        this.args = args;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getKey() {
        return getMessage();
    }

    public Object[] getArgs() {
        return args;
    }

    public static ApiException badRequest(String key, Object... args) {
        return new ApiException(HttpStatus.BAD_REQUEST, key, args);
    }

    public static ApiException unauthorized(String key, Object... args) {
        return new ApiException(HttpStatus.UNAUTHORIZED, key, args);
    }

    public static ApiException forbidden(String key, Object... args) {
        return new ApiException(HttpStatus.FORBIDDEN, key, args);
    }

    public static ApiException notFound(String key, Object... args) {
        return new ApiException(HttpStatus.NOT_FOUND, key, args);
    }

    public static ApiException conflict(String key, Object... args) {
        return new ApiException(HttpStatus.CONFLICT, key, args);
    }

    public static ApiException tooManyRequests(String key, Object... args) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, key, args);
    }
}
