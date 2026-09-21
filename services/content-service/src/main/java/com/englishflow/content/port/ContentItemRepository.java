package com.englishflow.content.port;

import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ItemAvailability;

import java.util.List;
import java.util.Optional;

/** Content-item repository port owned by content-service. */
public interface ContentItemRepository {

    Optional<ContentItem> findById(String itemId);

    List<ContentItem> search(String packCode, String kind, String query, ItemAvailability availability,
            int limit, String afterItemId);

    void save(ContentItem item);
}
