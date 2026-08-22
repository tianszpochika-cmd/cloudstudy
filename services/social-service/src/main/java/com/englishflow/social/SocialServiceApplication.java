package com.englishflow.social;

import java.time.Clock;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Independently deployable v2 social-service process. */
@SpringBootApplication
@EnableScheduling
public class SocialServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(SocialServiceApplication.class, args);
    }

    @Bean
    Clock socialClock() {
        return Clock.systemUTC();
    }
}
