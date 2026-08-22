package com.englishflow.commerce.adapter.memory;

import com.englishflow.commerce.application.ports.CommerceClock;
import java.time.Clock;
import java.time.Instant;

public final class SystemCommerceClock implements CommerceClock {
    private final Clock clock;

    public SystemCommerceClock() { this(Clock.systemUTC()); }
    public SystemCommerceClock(Clock clock) { this.clock = clock; }
    @Override public Instant now() { return clock.instant(); }
}
