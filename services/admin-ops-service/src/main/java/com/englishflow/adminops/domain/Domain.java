package com.englishflow.adminops.domain;

public enum Domain {
    CONTENT("content-service"),
    COMMERCE("commerce-service"),
    LEARNER("learner-service"),
    NOTIFICATION("notification-service"),
    MEDIA("media-service"),
    SUPPORT("admin-ops-service");

    private final String targetService;

    Domain(String targetService) {
        this.targetService = targetService;
    }

    public String targetService() {
        return targetService;
    }
}
