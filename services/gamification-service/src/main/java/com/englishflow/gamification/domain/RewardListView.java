package com.englishflow.gamification.domain;

import java.util.List;

public record RewardListView(String subjectId, List<RewardGrantView> grants) {
}
