package com.englishflow.content.release;

/** Process-local stand-in used when JDBC is off, and by unit tests. */
public final class MemoryReleaseStudioStore implements ReleaseStudioStore {

    private ReleaseStudioState state = ReleaseStudioState.empty();

    @Override
    public synchronized ReleaseStudioState load() {
        return state;
    }

    @Override
    public synchronized void save(ReleaseStudioState next) {
        state = next == null ? ReleaseStudioState.empty() : next;
    }
}
