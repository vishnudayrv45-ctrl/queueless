package com.queueless.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queueless.service.AdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Blocks every /api/admin/** call that does not carry a valid X-Admin-Token header. */
@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    public static final String HEADER = "X-Admin-Token";

    private final AdminAuthService auth;
    private final MessageSource messages;
    private final ObjectMapper mapper;

    public AdminAuthInterceptor(AdminAuthService auth, MessageSource messages, ObjectMapper mapper) {
        this.auth = auth;
        this.messages = messages;
        this.mapper = mapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (auth.isValid(request.getHeader(HEADER))) {
            return true;
        }
        String text = messages.getMessage("err.auth.required", null, "Please sign in as staff to continue",
                LocaleContextHolder.getLocale());
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(mapper.writeValueAsString(Map.of("error", text)));
        return false;
    }
}
