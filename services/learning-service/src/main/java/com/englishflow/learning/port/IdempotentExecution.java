package com.englishflow.learning.port;

/** Store result with replay metadata so the API can distinguish a safe retry from a new write. */
public record IdempotentExecution<T>(T value, boolean replayed) {
}
