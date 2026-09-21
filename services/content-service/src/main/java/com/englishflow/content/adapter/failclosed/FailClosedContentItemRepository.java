package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ItemAvailability;
import com.englishflow.content.port.ContentItemRepository;

import java.util.List;
import java.util.Optional;

/** Fail-closed item port used when JDBC persistence is disabled. */
public final class FailClosedContentItemRepository implements ContentItemRepository {

    private static ContentOperationException unavailable() {
        return ContentOperationException.unavailable("ITEM_PERSISTENCE_DISABLED",
                "item persistence is disabled; refusing to invent content-item facts");
    }

    @Override
    public Optional<ContentItem> findById(String itemId) {
        throw unavailable();
    }

    @Override
    public List<ContentItem> search(String packCode, String kind, String query, ItemAvailability availability,
            int limit, String afterItemId) {
        throw unavailable();
    }

    @Override
    public void save(ContentItem item) {
        throw unavailable();
    }
}
