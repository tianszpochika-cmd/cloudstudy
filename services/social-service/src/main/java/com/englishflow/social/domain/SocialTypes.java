package com.englishflow.social.domain;

import java.util.Map;

/** Closed vocabularies used by the social boundary. There is deliberately no text payload type. */
public final class SocialTypes {

    private SocialTypes() {
    }

    public enum RoomState {
        OPEN, ACTIVE, EMPTY, CLOSED
    }

    public enum RoomTemplateCode {
        CET4_SPRINT("CET4 冲刺"),
        POSTGRAD_EARLY("考研早起"),
        IELTS_SILENT("雅思静音"),
        NIGHT_FOCUS("深夜自律");

        private final String label;

        RoomTemplateCode(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public enum LeaseState {
        ACTIVE, RELEASED, EXPIRED
    }

    public enum PresenceState {
        ONLINE, DISCONNECTED, OFFLINE
    }

    public enum FocusState {
        IDLE, FOCUSING, PAUSED, COMPLETE
    }

    public enum VisibilityMode {
        PUBLIC, ANONYMOUS, PRIVATE
    }

    public enum PresetCode {
        CHEER_UP("加油"),
        TOGETHER_STUDY("一起上岸"),
        APPLAUSE("太强了");

        private final String label;

        PresetCode(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public enum FocusTagCode {
        VOCAB_REVIEW("核心词复习"),
        GRAMMAR_PRACTICE("语法练习"),
        LISTENING("精听"),
        READING("阅读训练"),
        MOCK_TEST("模考");

        private final String label;

        FocusTagCode(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public enum LeaderboardMetric {
        FOCUS_QUALIFIED_SECONDS,
        MASTERED_WORDS,
        XP,
        STREAK_DAYS
    }

    public enum TrustedEventType {
        LEARNING_FOCUS_SCORE_V1,
        LEARNING_MASTERED_WORDS_V1,
        GROWTH_XP_V1,
        GROWTH_STREAK_V1
    }

    public enum ReportReasonCode {
        SPAM,
        PRESET_ABUSE,
        HARASSMENT,
        IMPERSONATION,
        UNSAFE_BEHAVIOR
    }

    public enum ModerationState {
        RECEIVED, TRIAGED, ACTIONED, REJECTED, APPEALED, CLOSED
    }

    public enum ModerationAction {
        TRIAGE, ACTION, REJECT, CLOSE, APPEAL
    }

    public record CommandResult(int status, Map<String, Object> body, boolean replayed) {
        public CommandResult {
            if (status < 200 || status > 599) {
                throw new IllegalArgumentException("invalid HTTP status");
            }
            body = Map.copyOf(body);
        }

        public static CommandResult created(Map<String, Object> body) {
            return new CommandResult(201, body, false);
        }

        public static CommandResult ok(Map<String, Object> body) {
            return new CommandResult(200, body, false);
        }

        public CommandResult replay() {
            return new CommandResult(status, body, true);
        }
    }
}
