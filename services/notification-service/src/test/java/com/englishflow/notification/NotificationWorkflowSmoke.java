package com.englishflow.notification;

/** Compatibility entry point for B11 scripts; the canonical smoke is NotificationServiceSmoke. */
public final class NotificationWorkflowSmoke {

    private NotificationWorkflowSmoke() {
    }

    public static void main(String[] args) {
        NotificationServiceSmoke.main(args);
    }
}
