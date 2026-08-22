package com.englishflow.commerce.application.ports;

import java.time.Instant;

@FunctionalInterface
public interface CommerceClock {
    Instant now();
}
