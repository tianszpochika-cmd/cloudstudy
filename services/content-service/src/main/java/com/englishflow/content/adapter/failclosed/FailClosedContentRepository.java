package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.port.ContentRepository;

import java.util.List;
import java.util.Optional;

/** No-data runtime adapter; it prevents an unconfigured service from pretending to be durable. */
public final class FailClosedContentRepository implements ContentRepository {

    @Override
    public Optional<ContentDefinition> find(ContentId contentId) {
        throw ContentPersistenceFailure.unavailable();
    }

    @Override
    public Optional<ContentDefinition> findByCode(String contentCode) {
        throw ContentPersistenceFailure.unavailable();
    }

    @Override
    public List<ContentDefinition> findAll() {
        throw ContentPersistenceFailure.unavailable();
    }

    @Override
    public ContentVersionId nextVersionId() {
        throw ContentPersistenceFailure.unavailable();
    }

    @Override
    public void create(ContentDefinition content) {
        throw ContentPersistenceFailure.unavailable();
    }

    @Override
    public void save(ContentDefinition content) {
        throw ContentPersistenceFailure.unavailable();
    }
}
