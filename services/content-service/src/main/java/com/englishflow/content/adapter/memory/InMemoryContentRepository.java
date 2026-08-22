package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentId;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.port.ContentRepository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Test/local adapter only; production must replace this with a content-owned MySQL adapter. */
public final class InMemoryContentRepository implements ContentRepository {

    private final Map<ContentId, ContentDefinition> contents = new ConcurrentHashMap<>();

    @Override
    public Optional<ContentDefinition> find(ContentId contentId) {
        return Optional.ofNullable(contents.get(contentId));
    }

    @Override
    public void create(ContentDefinition content) {
        if (contents.putIfAbsent(content.contentId(), content) != null) {
            throw ContentOperationException.conflict("CONTENT_EXISTS", "content already exists");
        }
    }

    @Override
    public void save(ContentDefinition content) {
        contents.put(content.contentId(), content);
    }
}
