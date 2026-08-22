package com.englishflow.content.port;

import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;

import java.util.Optional;

/** Content-service-owned repository port; no cross-service SQL or shared ORM entity is allowed. */
public interface ContentRepository {

    Optional<ContentDefinition> find(ContentId contentId);

    void create(ContentDefinition content);

    void save(ContentDefinition content);
}
