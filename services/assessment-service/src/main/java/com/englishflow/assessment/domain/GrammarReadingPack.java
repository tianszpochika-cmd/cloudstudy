package com.englishflow.assessment.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Grammar practice is three items and reading practice is two.
 * A short pack closes. It does not borrow items from another skill.
 * Named item lists stay as the caller asked; this rule applies when
 * the client opens the pack itself.
 */
public final class GrammarReadingPack {
    public static final String CLOSED_MISSING = "CLOSED_MISSING";

    public enum Kind { GRAMMAR, READING, OTHER }

    public record Selection(List<Map<String, Object>> rules, boolean closedMissing) {
    }

    private GrammarReadingPack() {
    }

    public static Selection select(String contentCode, List<Map<String, Object>> rules, boolean namedItems) {
        List<Map<String, Object>> source = rules == null ? List.of() : rules;
        Kind kind = kind(contentCode, dimensions(source));
        if (kind == Kind.OTHER || namedItems) {
            return new Selection(source, false);
        }
        List<Map<String, Object>> matched = new ArrayList<>();
        for (Map<String, Object> rule : source) {
            if (matches(kind, rule.get("dimension"))) matched.add(rule);
        }
        int required = required(kind);
        if (matched.size() < required) {
            return new Selection(List.of(), true);
        }
        return new Selection(List.copyOf(matched.subList(0, required)), false);
    }

    public static boolean isExactPack(List<String> itemTypes) {
        if (itemTypes == null || itemTypes.isEmpty()) return false;
        Kind kind = kindOfTypes(itemTypes);
        return kind != Kind.OTHER && itemTypes.size() == required(kind);
    }

    /** A pack is FULL only when every item is correct. Otherwise ZERO. */
    public static String score(int correct, int total) {
        if (total < 1) throw new IllegalArgumentException("pack score needs items");
        if (correct < 0 || correct > total) throw new IllegalArgumentException("pack score is out of range");
        return correct == total ? "FULL" : "ZERO";
    }

    public static int required(Kind kind) {
        return switch (kind) {
            case GRAMMAR -> 3;
            case READING -> 2;
            case OTHER -> 0;
        };
    }

    static Kind kind(String contentCode, List<String> dimensions) {
        Kind fromCode = kindFromCode(contentCode);
        if (fromCode != Kind.OTHER) return fromCode;
        return kindOfTypes(dimensions);
    }

    private static Kind kindFromCode(String contentCode) {
        String code = contentCode == null ? "" : contentCode.toLowerCase(Locale.ROOT);
        if (hasToken(code, "grammar") || hasToken(code, "grm")) return Kind.GRAMMAR;
        if (hasToken(code, "reading") || hasToken(code, "rdg")) return Kind.READING;
        return Kind.OTHER;
    }

    /** A skill token counts only on a code boundary, so "basics" stays other. */
    private static boolean hasToken(String code, String token) {
        int from = 0;
        while (from <= code.length() - token.length()) {
            int at = code.indexOf(token, from);
            if (at < 0) return false;
            boolean left = at == 0 || isBoundary(code.charAt(at - 1));
            int end = at + token.length();
            boolean right = end == code.length() || isBoundary(code.charAt(end));
            if (left && right) return true;
            from = at + 1;
        }
        return false;
    }

    private static boolean isBoundary(char value) {
        return value == '.' || value == '_' || value == ':' || value == '-';
    }

    private static Kind kindOfTypes(List<String> values) {
        if (values == null || values.isEmpty()) return Kind.OTHER;
        boolean grammar = true;
        boolean reading = true;
        for (String value : values) {
            String normalized = normalize(value);
            grammar = grammar && ("GRAMMAR".equals(normalized) || "BASIC_GRAMMAR".equals(normalized));
            reading = reading && "READING".equals(normalized);
        }
        if (grammar) return Kind.GRAMMAR;
        if (reading) return Kind.READING;
        return Kind.OTHER;
    }

    private static boolean matches(Kind kind, Object dimension) {
        String normalized = normalize(dimension);
        return switch (kind) {
            case GRAMMAR -> "GRAMMAR".equals(normalized) || "BASIC_GRAMMAR".equals(normalized);
            case READING -> "READING".equals(normalized);
            case OTHER -> false;
        };
    }

    private static List<String> dimensions(List<Map<String, Object>> rules) {
        List<String> values = new ArrayList<>();
        for (Map<String, Object> rule : rules) values.add(String.valueOf(rule.get("dimension")));
        return values;
    }

    private static String normalize(Object value) {
        return value == null ? "" : String.valueOf(value).trim().toUpperCase(Locale.ROOT);
    }
}
