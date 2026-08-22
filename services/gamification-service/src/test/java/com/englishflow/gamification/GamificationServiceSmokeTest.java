package com.englishflow.gamification;

import org.junit.jupiter.api.Test;

class GamificationServiceSmokeTest {

    @Test
    void b12GamificationSmokePassesWithoutExternalInfrastructure() {
        GamificationServiceSmoke.run();
    }
}
