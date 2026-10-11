package com.englishflow.adminops.closure;

/** Process-local stand-in used outside the local-real profile and by unit tests. */
public final class MemoryClosureDeskStore implements ClosureDeskStore {

    private ClosureDeskState state = ClosureDeskState.empty();

    @Override
    public synchronized ClosureDeskState load() {
        return state;
    }

    @Override
    public synchronized void save(ClosureDeskState next) {
        state = next == null ? ClosureDeskState.empty() : next;
    }
}
