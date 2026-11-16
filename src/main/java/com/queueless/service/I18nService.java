package com.queueless.service;

import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ResourceBundle;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Everything about languages, in one place.
 *
 * All text lives in src/main/resources/messages*.properties (one file per language).
 * Spring's MessageSource reads them for server-side texts (errors, WhatsApp messages) and
 * {@link #bundle(String)} hands the website texts to the browser as JSON.
 */
@Service
public class I18nService {

    /** Supported language codes: English, Hindi, Kannada, Tamil, Telugu, Malayalam. */
    public static final List<String> LANGUAGES = List.of("en", "hi", "kn", "ta", "te", "ml");

    /** Same files, but without falling back to the server's own language. */
    private static final ResourceBundle.Control NO_FALLBACK =
            ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_PROPERTIES);

    private static final Pattern COUNTER_NAME = Pattern.compile("^counter\\s*(\\d+)$", Pattern.CASE_INSENSITIVE);

    private final MessageSource messageSource;
    private final Map<String, Map<String, String>> cache = new ConcurrentHashMap<>();

    public I18nService(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    /** Returns a supported language code; anything unknown becomes "en". */
    public static String normalize(String lang) {
        if (lang == null) {
            return "en";
        }
        String l = lang.trim().toLowerCase(Locale.ROOT);
        int dash = l.indexOf('-');
        if (dash > 0) {
            l = l.substring(0, dash);
        }
        return LANGUAGES.contains(l) ? l : "en";
    }

    public static Locale locale(String lang) {
        return Locale.forLanguageTag(normalize(lang));
    }

    /** Translated text for a key; arguments replace {0}, {1} ... in the text. */
    public String msg(String key, String lang, Object... args) {
        return messageSource.getMessage(key, args, key, locale(lang));
    }

    private String find(String key, String lang) {
        return messageSource.getMessage(key, null, null, locale(lang));
    }

    /**
     * Services are created by the admin, so their names live in the database. The four sample
     * services have translations; they are used only while the name is still the original English one.
     */
    public String serviceName(String code, String dbName, String lang) {
        return serviceText(code, dbName, lang, "name");
    }

    public String serviceDescription(String code, String dbText, String dbName, String lang) {
        String original = find("service." + safe(code) + ".default", "en");
        if (original != null && original.equalsIgnoreCase(dbName)) {
            String tr = find("service." + safe(code) + ".desc", lang);
            if (tr != null) {
                return tr;
            }
        }
        return dbText;
    }

    private String serviceText(String code, String dbName, String lang, String part) {
        String original = find("service." + safe(code) + ".default", "en");
        if (original != null && original.equalsIgnoreCase(dbName)) {
            String tr = find("service." + safe(code) + "." + part, lang);
            if (tr != null) {
                return tr;
            }
        }
        return dbName;
    }

    private static String safe(String code) {
        return code == null ? "" : code.toUpperCase(Locale.ROOT);
    }

    /** "Counter 3" is shown as the translated word plus the number; custom counter names stay as typed. */
    public String counterName(String name, String lang) {
        if (name == null) {
            return "-";
        }
        Matcher m = COUNTER_NAME.matcher(name.trim());
        return m.matches() ? msg("counter.n", lang, m.group(1)) : name;
    }

    /** Estimated waiting time as text, for example "24 min". */
    public String eta(int minutes, int ahead, String lang) {
        if (ahead <= 0 || minutes <= 0) {
            return msg("eta.soon", lang);
        }
        if (minutes < 60) {
            return msg("eta.min", lang, String.valueOf(minutes));
        }
        int h = minutes / 60;
        int m = minutes % 60;
        return m == 0 ? msg("eta.hour", lang, String.valueOf(h))
                : msg("eta.hourmin", lang, String.valueOf(h), String.valueOf(m));
    }

    /** All website texts for one language (missing keys fall back to English). */
    public Map<String, String> bundle(String lang) {
        String l = normalize(lang);
        return cache.computeIfAbsent(l, k -> {
            ResourceBundle rb = ResourceBundle.getBundle("messages", locale(k), NO_FALLBACK);
            Map<String, String> out = new TreeMap<>();
            for (String key : rb.keySet()) {
                if (key.startsWith("ui.") || key.startsWith("service.") || key.startsWith("counter.") || key.startsWith("eta.")) {
                    out.put(key, rb.getString(key));
                }
            }
            return Collections.unmodifiableMap(out);
        });
    }
}
