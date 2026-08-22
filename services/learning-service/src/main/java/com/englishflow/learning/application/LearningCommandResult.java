package com.englishflow.learning.application;

/** Common replay marker for application writes. */
public record LearningCommandResult<T>(T value, boolean replayed) {
}
