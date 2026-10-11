package com.englishflow.adminops.closure;

/**
 * Owner of the IT-7 closure desk facts. A new process reads the same snapshot back.
 */
public interface ClosureDeskStore {

    ClosureDeskState load();

    void save(ClosureDeskState state);
}
