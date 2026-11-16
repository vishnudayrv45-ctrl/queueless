package com.queueless.service;

import com.queueless.model.AppSetting;
import com.queueless.repository.AppSettingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Settings the admin can change in the Staff desk. Until changed, the values from application.properties are used. */
@Service
public class SettingsService {

    private static final String WHATSAPP_ENABLED = "whatsapp.enabled";
    private static final String APPROACH_THRESHOLD = "whatsapp.approachThreshold";

    private final AppSettingRepository repo;
    private final boolean defaultEnabled;
    private final int defaultThreshold;

    public SettingsService(AppSettingRepository repo,
                           @Value("${queueless.whatsapp.default-enabled:true}") boolean defaultEnabled,
                           @Value("${queueless.whatsapp.approach-threshold:3}") int defaultThreshold) {
        this.repo = repo;
        this.defaultEnabled = defaultEnabled;
        this.defaultThreshold = clamp(defaultThreshold);
    }

    public boolean isWhatsappEnabled() {
        return repo.findById(WHATSAPP_ENABLED).map(s -> "true".equals(s.getValue())).orElse(defaultEnabled);
    }

    public void setWhatsappEnabled(boolean enabled) {
        repo.save(new AppSetting(WHATSAPP_ENABLED, String.valueOf(enabled)));
    }

    /** "Your turn is approaching" is sent when this many people (3 to 5) or fewer are ahead. */
    public int approachThreshold() {
        return repo.findById(APPROACH_THRESHOLD).map(s -> {
            try {
                return clamp(Integer.parseInt(s.getValue()));
            } catch (NumberFormatException e) {
                return defaultThreshold;
            }
        }).orElse(defaultThreshold);
    }

    public void setApproachThreshold(int threshold) {
        repo.save(new AppSetting(APPROACH_THRESHOLD, String.valueOf(clamp(threshold))));
    }

    private static int clamp(int v) {
        return Math.max(3, Math.min(5, v));
    }
}
