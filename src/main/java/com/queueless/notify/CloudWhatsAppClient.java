package com.queueless.notify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Real sender using the WhatsApp Business Cloud API (Meta).
 *
 * Credentials come from environment variables (see application.properties):
 *   WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN. They are never written in the code.
 *
 * Note: WhatsApp only allows free text to people who messaged the business number in the last
 * 24 hours. For a production system, approved message templates are required.
 */
@Component
public class CloudWhatsAppClient implements WhatsAppClient {

    private final String phoneNumberId;
    private final String accessToken;
    private final String apiVersion;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public CloudWhatsAppClient(@Value("${queueless.whatsapp.phone-number-id:}") String phoneNumberId,
                               @Value("${queueless.whatsapp.access-token:}") String accessToken,
                               @Value("${queueless.whatsapp.api-version:v20.0}") String apiVersion,
                               ObjectMapper mapper) {
        this.phoneNumberId = phoneNumberId == null ? "" : phoneNumberId.trim();
        this.accessToken = accessToken == null ? "" : accessToken.trim();
        this.apiVersion = apiVersion;
        this.mapper = mapper;
    }

    public boolean isConfigured() {
        return !phoneNumberId.isEmpty() && !accessToken.isEmpty();
    }

    @Override
    public SendResult send(String to, String text) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("WhatsApp credentials are not set");
        }
        Map<String, Object> body = Map.of(
                "messaging_product", "whatsapp",
                "to", to,
                "type", "text",
                "text", Map.of("body", text));

        HttpRequest request = HttpRequest.newBuilder(
                        URI.create("https://graph.facebook.com/" + apiVersion + "/" + phoneNumberId + "/messages"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            throw new IOException("WhatsApp API answered " + response.statusCode() + ": " + errorText(response.body()));
        }
        JsonNode id = mapper.readTree(response.body()).path("messages").path(0).path("id");
        return new SendResult(id.isMissingNode() ? "" : id.asText());
    }

    private String errorText(String body) {
        try {
            String message = mapper.readTree(body).path("error").path("message").asText("");
            return message.isEmpty() ? "unknown error" : message;
        } catch (Exception e) {
            return "unreadable response";
        }
    }

    @Override
    public String mode() {
        return "CLOUD";
    }
}
