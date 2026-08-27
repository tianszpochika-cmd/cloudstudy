package com.englishflow.content.port;

import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;

import java.util.Optional;
import java.util.List;

/** Content-service-owned repository port; no cross-service SQL or shared ORM entity is allowed. */
public interface ContentRepository {

    Optional<ContentDefinition> find(ContentId contentId);

    Optional<ContentDefinition> findByCode(String contentCode);

    List<ContentDefinition> findAll();

    /**
     * Allocates the next service-owned version identifier without rehydrating every aggregate.
     * Implementations must keep this operation independent from unrelated corrupt/read-only
     * facts; a single bad content row must not prevent a new draft from being created.
     */
    ContentVersionId nextVersionId();

    void create(ContentDefinition content);

    void save(ContentDefinition content);
}
