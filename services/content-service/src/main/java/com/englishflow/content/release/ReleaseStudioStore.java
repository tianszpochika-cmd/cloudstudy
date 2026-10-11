package com.englishflow.content.release;

/**
 * Owner of the IT-6 release desk facts. A new process reads the same snapshot back.
 */
public interface ReleaseStudioStore {

    ReleaseStudioState load();

    void save(ReleaseStudioState state);
}
