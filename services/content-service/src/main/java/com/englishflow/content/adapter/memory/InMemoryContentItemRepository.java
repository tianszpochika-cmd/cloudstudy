package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ItemAvailability;
import com.englishflow.content.port.ContentItemRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Test-only item double. Production uses the JDBC adapter. */
public final class InMemoryContentItemRepository implements ContentItemRepository {

    private final Map<String, ContentItem> items = new ConcurrentHashMap<>();

    @Override
    public Optional<ContentItem> findById(String itemId) {
        return Optional.ofNullable(items.get(itemId));
    }

    @Override
    public List<ContentItem> search(String packCode, String kind, String query, ItemAvailability availability,
            int limit, String afterItemId) {
        String needle = query == null ? "" : query.trim().toLowerCase();
        return items.values().stream()
                .filter(item -> item.packCode().equals(packCode))
                .filter(item -> kind == null || kind.isBlank() || item.kind().equalsIgnoreCase(kind))
                .filter(item -> needle.isEmpty() || item.stem().toLowerCase().contains(needle))
                .filter(item -> availability == null || item.availability() == availability)
                .sorted(Comparator.comparing(ContentItem::itemId))
                .filter(item -> afterItemId == null || afterItemId.isBlank()
                        || item.itemId().compareTo(afterItemId) > 0)
                .limit(Math.max(1, Math.min(limit, 100)))
                .toList();
    }

    @Override
    public void save(ContentItem item) {
        items.put(item.itemId(), item);
    }
}
