package com.englishflow.modules.learning.vocabulary;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import com.englishflow.modules.user.UserRequestContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * B2 vocabulary/SRS application service. The maps deliberately mirror the
 * V0010 tables while the MySQL adapter is not yet present in the B1 baseline.
 * Snapshot and review records are append-oriented and can be replayed by key.
 */
@Service
public final class VocabularyService {
    private static final String CONTENT_VERSION = "VOCAB_PHASE1_V1";
    private static final String RULES_VERSION = "VOCAB_SRS_RULES_V1";
    private static final int MAX_PAGE = 100;
    private static final int OFFLINE_WINDOW_HOURS = 72;
    private final Clock clock;
    private final AtomicLong ids = new AtomicLong(1000);
    private final Map<Long, Wordbook> wordbooks = new LinkedHashMap<>();
    private final Map<Long, Vocab> vocabs = new LinkedHashMap<>();
    private final Map<Long, Chunk> chunks = new LinkedHashMap<>();
    private final Map<String, SrsState> states = new ConcurrentHashMap<>();
    private final Map<Long, Snapshot> snapshots = new ConcurrentHashMap<>();
    private final Map<Long, LibraryEntry> library = new ConcurrentHashMap<>();
    private final Map<Long, Expression> expressions = new ConcurrentHashMap<>();
    private final Map<String, CachedResponse> idempotency = new ConcurrentHashMap<>();
    private final Map<String, CachedResponse> clientEvents = new ConcurrentHashMap<>();
    private final Map<Long, List<ReviewFact>> reviewFacts = new ConcurrentHashMap<>();
    private final Map<Long, Long> activeWordbooks = new ConcurrentHashMap<>();

    public VocabularyService() { this(Clock.systemUTC()); }

    public VocabularyService(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock");
        seedContent();
    }

    public Map<String, Object> listWordbooks(UserRequestContext context, String cursor, int limit,
                                               String targetGoal, String cefrLevel) {
        List<Map<String, Object>> items = wordbooks.values().stream()
                .filter(book -> "PUBLISHED".equals(book.status))
                .filter(book -> targetGoal == null || targetGoal.isBlank() || targetGoal.equalsIgnoreCase(book.targetGoal))
                .filter(book -> cefrLevel == null || cefrLevel.isBlank() || cefrLevel.equalsIgnoreCase(book.minCefr) || cefrLevel.equalsIgnoreCase(book.maxCefr))
                .map(book -> wordbookView(book, context.userId()))
                .toList();
        return page(context, items, cursor, limit);
    }

    public Map<String, Object> activateWordbook(UserRequestContext context, long wordbookId, String key,
                                                  Map<String, Object> body) {
        requireKey(key);
        Wordbook book = publishedWordbook(wordbookId);
        String hash = hash(body);
        CachedResponse cached = cached(context.userId(), "activate:" + key, hash);
        if (cached != null) return cached.value;
        activeWordbooks.put(context.userId(), book.id);
        Map<String, Object> data = map("activeWordbookId", book.id, "planVersion", ids.get(),
                "retainedStateCount", userStates(context.userId()).size(), "firstSnapshotId", null);
        Map<String, Object> result = envelope(context, data);
        remember(context.userId(), "activate:" + key, hash, result);
        return result;
    }

    public Map<String, Object> listWordbookItems(UserRequestContext context, long wordbookId, String cursor,
                                                  int limit, String masteryStatus, boolean dueOnly, String timezone) {
        Wordbook book = publishedWordbook(wordbookId);
        ZoneId zone = zone(timezone);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        List<Map<String, Object>> items = book.vocabIds.stream().map(vocabs::get).filter(Objects::nonNull)
                .filter(vocab -> "PUBLISHED".equals(vocab.status))
                .map(vocab -> {
                    SrsState state = states.get(stateKey(context.userId(), "VOCAB", vocab.id));
                    return vocabItemView(vocab, state, context.userId(), zone, today);
                })
                .filter(item -> masteryStatus == null || masteryStatus.equals(item.get("masteryStatus")))
                .filter(item -> !dueOnly || Boolean.TRUE.equals(item.get("due")))
                .toList();
        return page(context, items, cursor, limit);
    }

    public Map<String, Object> vocabDetail(UserRequestContext context, long vocabId, String requestedVersion) {
        Vocab vocab = publishedVocab(vocabId);
        if (requestedVersion != null && !requestedVersion.isBlank() && !requestedVersion.equals(vocab.contentVersion)) {
            throw api("CONTENT_VERSION_CONFLICT", "requested content version is not the published version", HttpStatus.CONFLICT);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("vocabId", vocab.id);
        data.put("word", vocab.word);
        data.put("phoneticUs", vocab.phoneticUs);
        data.put("phoneticUk", vocab.phoneticUk);
        data.put("audio", vocab.audio);
        data.put("pronunciation", map("syllables", List.of(vocab.word), "stressSyllable", 1,
                "anatomyCode", "PHASE1_2D_FALLBACK", "renderModes", List.of("ULTRA", "HIGH", "MEDIUM", "PERFORMANCE"),
                "fallback", "2D_STATIC"));
        data.put("cefrLevel", vocab.cefr);
        data.put("frequencyRank", vocab.frequencyRank);
        data.put("examHeat", vocab.examHeat);
        data.put("definitions", vocab.definitions);
        data.put("examples", vocab.examples);
        data.put("relations", vocab.relations);
        data.put("rootTopics", List.of(map("rootId", 1L, "rootCode", "port", "role", "ROOT")));
        data.put("confusablePairs", List.of());
        data.put("srsState", stateView(states.get(stateKey(context.userId(), "VOCAB", vocab.id)), context.userId(), ZoneId.of("Asia/Shanghai")));
        data.put("contentVersion", vocab.contentVersion);
        return envelope(context, data);
    }

    public Map<String, Object> chunkDetail(UserRequestContext context, long chunkId) {
        Chunk chunk = publishedChunk(chunkId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("chunkId", chunk.id);
        data.put("canonicalText", chunk.text);
        data.put("chunkType", chunk.type);
        data.put("meaningCn", chunk.meaningCn);
        data.put("usageNote", chunk.usageNote);
        data.put("scenarioCode", chunk.scenarioCode);
        data.put("examples", chunk.examples);
        data.put("srsState", stateView(states.get(stateKey(context.userId(), "CHUNK", chunk.id)), context.userId(), ZoneId.of("Asia/Shanghai")));
        data.put("contentVersion", chunk.contentVersion);
        return envelope(context, data);
    }

    public Map<String, Object> rootTopic(UserRequestContext context, long rootId, String cursor, int limit) {
        if (rootId != 1) throw api("ROOT_NOT_FOUND", "root topic does not exist", HttpStatus.NOT_FOUND);
        List<Map<String, Object>> nodes = vocabs.values().stream().filter(v -> "PUBLISHED".equals(v.status))
                .limit(Math.min(safeLimit(limit), 20)).map(v -> map("vocabId", v.id, "word", v.word, "morphemeText", "port", "linkRole", "DERIVATIVE")).toList();
        Map<String, Object> data = map("rootId", 1L, "rootCode", "port", "titleCn", "port 词根专题", "meaningCn", "carry / bring", "nodes", nodes);
        return envelope(context, data);
    }

    public Map<String, Object> offlineCards(UserRequestContext context, long wordbookId, int limit, String timezone) {
        Wordbook book = publishedWordbook(wordbookId);
        ZoneId zone = zone(timezone);
        List<Map<String, Object>> cards = book.vocabIds.stream().limit(safeLimit(limit)).map(vocabs::get).filter(Objects::nonNull)
                .map(vocab -> {
                    SrsState state = ensureState(context.userId(), "VOCAB", vocab.id, zone);
                    return map("snapshotItemId", 0L, "item", itemRef("VOCAB", vocab.id),
                            "front", map("word", vocab.word, "phoneticUs", vocab.phoneticUs, "phoneticUk", vocab.phoneticUk, "audio", vocab.audio),
                            "contentVersion", vocab.contentVersion);
                }).toList();
        Map<String, Object> data = map("manifestHash", hash(cards), "wordbookId", book.id,
                "contentVersion", book.contentVersion, "expiresAt", clock.instant().plus(Duration.ofDays(7)), "cards", cards,
                "answerFieldsIncluded", false);
        return envelope(context, data);
    }

    public Map<String, Object> listLibrary(UserRequestContext context, String cursor, int limit, String itemType,
                                            String masteryStatus, String collectionStatus, String sourceType, String dueRange,
                                            String timezone) {
        ZoneId zone = zone(timezone);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        List<Map<String, Object>> items = library.values().stream()
                .filter(entry -> entry.userId == context.userId() && entry.deletedAt == null)
                .filter(entry -> itemType == null || itemType.equals(entry.itemType))
                .filter(entry -> collectionStatus == null || collectionStatus.equals(entry.collectionStatus))
                .filter(entry -> sourceType == null || sourceType.equals(entry.sourceType))
                .map(entry -> libraryView(entry, context.userId(), zone, today))
                .filter(item -> masteryStatus == null || masteryStatus.equals(item.get("masteryStatus")))
                .filter(item -> dueRange == null || dueRangeMatch(item, dueRange, today))
                .sorted(Comparator.comparingLong(item -> ((Number) item.get("entryId")).longValue()))
                .toList();
        return page(context, items, cursor, limit);
    }

    public Map<String, Object> addLibrary(UserRequestContext context, String key, Map<String, Object> body, String timezone) {
        requireKey(key);
        String hash = hash(body);
        CachedResponse cached = cached(context.userId(), "library:" + key, hash);
        if (cached != null) return cached.value;
        Item item = parseItem(body);
        validateItem(item);
        String stateKey = stateKey(context.userId(), item.type, item.id);
        ZoneId zone = zone(timezone);
        ensureState(context.userId(), item.type, item.id, zone);
        LibraryEntry existing = library.values().stream().filter(entry -> entry.userId == context.userId() && entry.key.equals(stateKey)).findFirst().orElse(null);
        if (existing != null) {
            Map<String, Object> result = envelope(context, libraryView(existing, context.userId(), zone, LocalDate.now(clock.withZone(zone))));
            remember(context.userId(), "library:" + key, hash, result);
            return result;
        }
        LibraryEntry entry = new LibraryEntry(ids.incrementAndGet(), context.userId(), item.type, item.id,
                text(body, "sourceType", "MANUAL"), text(body, "collectionStatus", "NEW_WORD"), null);
        library.put(entry.id, entry);
        Map<String, Object> result = envelope(context, libraryView(entry, context.userId(), zone, LocalDate.now(clock.withZone(zone))));
        remember(context.userId(), "library:" + key, hash, result);
        return result;
    }

    public Map<String, Object> removeLibrary(UserRequestContext context, long entryId, String key) {
        requireKey(key);
        LibraryEntry entry = library.get(entryId);
        if (entry == null || entry.userId != context.userId() || entry.deletedAt != null) throw api("LIBRARY_ENTRY_NOT_FOUND", "library entry does not exist", HttpStatus.NOT_FOUND);
        String hash = hash(Map.of("entryId", entryId));
        CachedResponse cached = cached(context.userId(), "library-remove:" + key, hash);
        if (cached != null) return cached.value;
        entry.deletedAt = clock.instant();
        Map<String, Object> result = envelope(context, map("entryId", entryId, "status", "DELETED"));
        remember(context.userId(), "library-remove:" + key, hash, result);
        return result;
    }

    public Map<String, Object> listExpressions(UserRequestContext context, String cursor, int limit,
                                                String sourceType, Boolean wantToSay, Long tagId, String timezone) {
        ZoneId zone = zone(timezone);
        List<Map<String, Object>> items = expressions.values().stream()
                .filter(expression -> expression.userId == context.userId() && "ACTIVE".equals(expression.status))
                .filter(expression -> sourceType == null || sourceType.equals(expression.sourceType))
                .filter(expression -> wantToSay == null || wantToSay == expression.wantToSay)
                .filter(expression -> tagId == null || expression.tagIds.contains(tagId))
                .sorted(Comparator.comparingLong(expression -> expression.id))
                .map(expression -> envelope(context, expressionView(expression, context.userId(), zone)).get("data"))
                .map(value -> (Map<String, Object>) value)
                .toList();
        return page(context, items, cursor, limit);
    }

    public Map<String, Object> createExpression(UserRequestContext context, String key, Map<String, Object> body,
                                                 String timezone) {
        requireKey(key);
        validateExpression(body);
        String hash = hash(Map.of("userId", context.userId(), "sourceType", text(body, "sourceType", ""),
                "sourceRef", text(body, "sourceRef", ""), "sentenceText", text(body, "sentenceText", ""),
                "selectedText", text(body, "selectedText", "")));
        CachedResponse cached = cached(context.userId(), "expression:" + key, hash);
        if (cached != null) return cached.value;
        Expression existing = expressions.values().stream().filter(expression -> expression.userId == context.userId() && expression.dedupeHash.equals(hash)).findFirst().orElse(null);
        if (existing != null) return envelope(context, expressionView(existing, context.userId(), zone(timezone)));
        Expression expression = new Expression(ids.incrementAndGet(), context.userId(), text(body, "sourceType", "READING"),
                text(body, "sourceRef", null), text(body, "sourceContentVersion", null), text(body, "sourceAudioRef", null),
                text(body, "sentenceText", ""), text(body, "translationCn", null), text(body, "selectedText", null),
                integer(body, "rangeStart", -1), integer(body, "rangeEnd", -1), bool(body, "wantToSay", false),
                text(body, "privateNote", null), hash);
        expressions.put(expression.id, expression);
        if (bool(body, "addToSrs", false)) ensureState(context.userId(), "EXPRESSION", expression.id, zone(timezone));
        Map<String, Object> result = envelope(context, expressionView(expression, context.userId(), zone(timezone)));
        remember(context.userId(), "expression:" + key, hash, result);
        return result;
    }

    public Map<String, Object> updateExpression(UserRequestContext context, long expressionId, String key,
                                                 Map<String, Object> body, String timezone) {
        requireKey(key);
        Expression expression = ownExpression(context.userId(), expressionId);
        String hash = hash(body);
        CachedResponse cached = cached(context.userId(), "expression-update:" + key, hash);
        if (cached != null) return cached.value;
        if (body != null && body.containsKey("wantToSay")) expression.wantToSay = bool(body, "wantToSay", expression.wantToSay);
        if (body != null && body.containsKey("privateNote")) expression.privateNote = text(body, "privateNote", null);
        for (Long tag : longs(body == null ? null : body.get("addTagIds"))) expression.tagIds.add(tag);
        for (Long tag : longs(body == null ? null : body.get("removeTagIds"))) expression.tagIds.remove(tag);
        expression.updatedAt = clock.instant();
        Map<String, Object> result = envelope(context, expressionView(expression, context.userId(), zone(timezone)));
        remember(context.userId(), "expression-update:" + key, hash, result);
        return result;
    }

    public Map<String, Object> deleteExpression(UserRequestContext context, long expressionId, String key) {
        requireKey(key);
        Expression expression = ownExpression(context.userId(), expressionId);
        String hash = hash(Map.of("expressionId", expressionId));
        CachedResponse cached = cached(context.userId(), "expression-delete:" + key, hash);
        if (cached != null) return cached.value;
        expression.status = "DELETED";
        expression.deletedAt = clock.instant();
        Map<String, Object> result = envelope(context, map("expressionId", expressionId, "status", "DELETED"));
        remember(context.userId(), "expression-delete:" + key, hash, result);
        return result;
    }

    public Map<String, Object> createBatch(UserRequestContext context, String key, Map<String, Object> body,
                                            String timezone) {
        requireKey(key);
        if (body == null) throw api("VALIDATION_ERROR", "batch body is required", HttpStatus.BAD_REQUEST);
        String hash = hash(body);
        CachedResponse cached = cached(context.userId(), "batch:" + key, hash);
        if (cached != null) return cached.value;
        ZoneId zone = zone(text(body, "timezone", timezone));
        LocalDate localDate = date(body, "localDate", LocalDate.now(clock.withZone(zone)));
        int dailyNewTarget = boundedInt(body, "dailyNewTarget", 0, 100);
        int maxDailyReview = boundedInt(body, "maxDailyReview", 1, 200);
        String scheduleType = text(body, "scheduleType", "DAILY").toUpperCase();
        if (!Set.of("DAILY", "CATCH_UP", "EXPRESSION").contains(scheduleType)) throw api("VALIDATION_ERROR", "scheduleType is invalid", HttpStatus.BAD_REQUEST);
        Snapshot existing = snapshots.values().stream().filter(snapshot -> snapshot.userId == context.userId() && snapshot.localDate.equals(localDate) && snapshot.scheduleType.equals(scheduleType)).findFirst().orElse(null);
        if (existing != null) return envelope(context, snapshotView(existing, context.userId(), zone));
        long activeWordbookId = activeWordbooks.getOrDefault(context.userId(), wordbooks.values().stream().filter(book -> "PUBLISHED".equals(book.status)).findFirst().map(book -> book.id).orElse(1L));
        Wordbook book = publishedWordbook(activeWordbookId);
        Instant generatedAt = clock.instant();
        Snapshot snapshot = new Snapshot(ids.incrementAndGet(), context.userId(), localDate, zone.getId(), scheduleType, book.id,
                dailyNewTarget, maxDailyReview, SrsAlgorithm.VERSION, RULES_VERSION, book.contentVersion,
                generatedAt, generatedAt, generatedAt.plus(Duration.ofDays(7)));
        List<Candidate> candidates = candidates(context.userId(), book, scheduleType, localDate, zone);
        int reviewCount = 0;
        int newCount = 0;
        for (Candidate candidate : candidates) {
            if (candidate.isNew && newCount >= dailyNewTarget) continue;
            if (!candidate.isNew && reviewCount >= maxDailyReview) continue;
            int sequence = snapshot.items.size() + 1;
            LocalDate planned = candidate.plannedDate == null ? localDate : candidate.plannedDate;
            SnapshotItem item = new SnapshotItem(ids.incrementAndGet(), candidate.item.type, candidate.item.id, sequence,
                    candidate.reason, planned, candidate.state == null ? null : candidate.state.dueAt,
                    candidate.state == null ? 0L : candidate.state.version, candidate.priority, contentVersion(candidate.item),
                    hash(Map.of("item", candidate.item.key(), "version", contentVersion(candidate.item))), "PENDING");
            snapshot.items.add(item);
            if (candidate.isNew) newCount++; else reviewCount++;
        }
        snapshots.put(snapshot.id, snapshot);
        Map<String, Object> result = envelope(context, snapshotView(snapshot, context.userId(), zone));
        remember(context.userId(), "batch:" + key, hash, result);
        return result;
    }

    public Map<String, Object> getBatch(UserRequestContext context, long snapshotId) {
        Snapshot snapshot = ownSnapshot(context.userId(), snapshotId);
        if (snapshot.expiresAt.isBefore(clock.instant())) throw api("SNAPSHOT_EXPIRED", "snapshot is read-only after expiry", HttpStatus.GONE);
        return envelope(context, snapshotView(snapshot, context.userId(), zone(snapshot.timezone)));
    }

    public Map<String, Object> submitReview(UserRequestContext context, String key, Map<String, Object> body,
                                             String timezone) {
        requireKey(key);
        if (body == null) throw api("VALIDATION_ERROR", "review body is required", HttpStatus.BAD_REQUEST);
        String payloadHash = hash(body);
        CachedResponse cached = cached(context.userId(), "review:" + key, payloadHash);
        if (cached != null) return cached.value;
        String clientEventId = text(body, "clientEventId", null);
        if (clientEventId == null || clientEventId.length() < 8) throw api("VALIDATION_ERROR", "clientEventId is required", HttpStatus.BAD_REQUEST);
        CachedResponse clientCached = clientEvents.get(context.userId() + ":" + clientEventId);
        if (clientCached != null) {
            Map<String, Object> duplicate = new LinkedHashMap<>(clientCached.value);
            duplicate.put("data", new LinkedHashMap<>((Map<String, Object>) duplicate.get("data")));
            ((Map<String, Object>) duplicate.get("data")).put("eventStatus", "DUPLICATE");
            remember(context.userId(), "review:" + key, payloadHash, duplicate);
            return duplicate;
        }
        Item item = parseItem((Map<String, Object>) body.get("item"));
        validateItem(item);
        long snapshotId = longValue(body.get("snapshotId"), 0L);
        long snapshotItemId = longValue(body.get("snapshotItemId"), 0L);
        Snapshot snapshot = ownSnapshot(context.userId(), snapshotId);
        if (snapshot.expiresAt.isBefore(clock.instant())) throw api("SNAPSHOT_EXPIRED", "snapshot is expired", HttpStatus.CONFLICT);
        SnapshotItem snapshotItem = snapshot.items.stream().filter(candidate -> candidate.id == snapshotItemId).findFirst().orElseThrow(() -> api("SNAPSHOT_SCOPE", "snapshot item is not in this batch", HttpStatus.CONFLICT));
        if (!snapshotItem.item.key().equals(item.key())) throw api("SNAPSHOT_SCOPE", "item does not match snapshot item", HttpStatus.CONFLICT);
        ZoneId zone = zone(text(body, "clientTimezone", timezone));
        Instant clientOccurredAt = instant(body, "clientOccurredAt", null);
        if (clientOccurredAt == null) throw api("VALIDATION_ERROR", "clientOccurredAt is required", HttpStatus.BAD_REQUEST);
        Instant receivedAt = clock.instant();
        if (clientOccurredAt.isBefore(receivedAt.minus(Duration.ofHours(OFFLINE_WINDOW_HOURS)))) {
            Map<String, Object> expired = envelope(context, map("reviewEventId", ids.incrementAndGet(), "eventStatus", "EXPIRED",
                    "riskDecision", "REJECT", "effectiveQuality", null, "reconciled", false, "stateVersion", 0L,
                    "rewardSettlementStatus", "NOT_ELIGIBLE", "reasonCode", "OFFLINE_EVENT_EXPIRED"));
            remember(context.userId(), "review:" + key, payloadHash, expired);
            clientEvents.put(context.userId() + ":" + clientEventId, new CachedResponse(payloadHash, expired));
            return expired;
        }
        int rawQuality = integerRequired(body, "rawQuality");
        String outcome = text(body, "answerOutcome", "").toUpperCase();
        int effective;
        try {
            effective = SrsAlgorithm.effectiveQuality(rawQuality, outcome);
        } catch (IllegalArgumentException error) {
            throw api("INVALID_REVIEW_QUALITY", error.getMessage(), HttpStatus.UNPROCESSABLE_ENTITY);
        }
        SrsState state = ensureState(context.userId(), item.type, item.id, zone);
        long baseVersion = longValue(body.get("baseStateVersion"), -1L);
        if (baseVersion != state.version) throw api("SRS_VERSION_CONFLICT", "state version is stale", HttpStatus.CONFLICT);
        int responseTime = integer(body, "responseTimeMs", 0);
        boolean dwellTooShort = responseTime > 0 && responseTime < 300;
        String riskDecision = dwellTooShort ? "ACCEPT_NO_REWARD" : "ALLOW";
        if (dwellTooShort) {
            Map<String, Object> filtered = reviewResponse(context, ids.incrementAndGet(), "RISK_FILTERED", riskDecision,
                    effective, state, false, "NOT_ELIGIBLE");
            remember(context.userId(), "review:" + key, payloadHash, filtered);
            clientEvents.put(context.userId() + ":" + clientEventId, new CachedResponse(payloadHash, filtered));
            return filtered;
        }
        synchronized (state) {
            long before = state.version;
            SrsAlgorithm.Result next = SrsAlgorithm.calculate(new SrsAlgorithm.Input(state.repetitionCount, state.intervalDays,
                    state.easeFactor, rawQuality, outcome, receivedAt, zone));
            state.repetitionCount = next.repetitionCount();
            state.intervalDays = next.intervalDays();
            state.easeFactor = next.easeFactor();
            state.dueAt = next.dueAt();
            state.dueLocalDate = LocalDate.parse(next.dueLocalDate());
            state.lastQuality = effective;
            state.reviewCount++;
            state.lastReviewedAt = receivedAt;
            state.lastResponseTimeMs = responseTime;
            if (effective < 2) {
                state.totalWrongCount++;
                state.lapseCount++;
                state.consecutiveCorrect = 0;
            } else state.consecutiveCorrect++;
            state.masteryStatus = nextMastery(state, effective);
            state.version++;
            if (state.firstLearnedAt == null) state.firstLearnedAt = receivedAt;
            if ("MASTERED".equals(state.masteryStatus) || "CONSOLIDATED".equals(state.masteryStatus)) state.masteredAt = receivedAt;
            snapshotItem.status = "COMPLETED";
            snapshotItem.completedAt = receivedAt;
            snapshot.status = snapshot.items.stream().allMatch(itemRow -> "COMPLETED".equals(itemRow.status)) ? "CONSUMED" : "PARTIALLY_CONSUMED";
            Map<String, Object> accepted = reviewResponse(context, ids.incrementAndGet(), "ACCEPTED", riskDecision,
                    effective, state, false, "SETTLED");
            ((Map<String, Object>) accepted.get("data")).put("stateVersionBefore", before);
            ((Map<String, Object>) accepted.get("data")).put("stateVersionAfter", state.version);
            remember(context.userId(), "review:" + key, payloadHash, accepted);
            clientEvents.put(context.userId() + ":" + clientEventId, new CachedResponse(payloadHash, accepted));
            reviewFacts.computeIfAbsent(context.userId(), ignored -> new ArrayList<>()).add(new ReviewFact(receivedAt, effective));
            return accepted;
        }
    }

    public Map<String, Object> syncReviews(UserRequestContext context, String key, Map<String, Object> body, String timezone) {
        requireKey(key);
        if (!(body == null ? null : body.get("events") instanceof List<?>)) throw api("VALIDATION_ERROR", "events must be a non-empty array", HttpStatus.BAD_REQUEST);
        List<?> events = (List<?>) body.get("events");
        if (events.isEmpty() || events.size() > 50) throw api("VALIDATION_ERROR", "events must contain 1..50 items", HttpStatus.BAD_REQUEST);
        List<Map<String, Object>> results = new ArrayList<>();
        for (Object event : events) {
            if (!(event instanceof Map<?, ?> raw)) throw api("VALIDATION_ERROR", "each event must be an object", HttpStatus.BAD_REQUEST);
            Map<String, Object> request = new LinkedHashMap<>();
            raw.forEach((eventKey, value) -> request.put(String.valueOf(eventKey), value));
            String eventKey = text(request, "clientEventId", null);
            try {
                Map<String, Object> result = submitReview(context, eventKey == null ? UUID.randomUUID().toString() : eventKey, request, timezone);
                results.add(map("clientEventId", eventKey, "status", ((Map<?, ?>) result.get("data")).get("eventStatus"), "result", result));
            } catch (ResponseStatusException error) {
                results.add(map("clientEventId", eventKey, "status", "REJECTED", "errorCode", error.getReason()));
            }
        }
        return envelope(context, map("results", results));
    }

    public Map<String, Object> listStates(UserRequestContext context, String cursor, int limit, String itemType,
                                          String masteryStatus, String dueRange, String timezone) {
        ZoneId zone = zone(timezone);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        List<Map<String, Object>> items = userStates(context.userId()).stream()
                .filter(state -> itemType == null || itemType.equals(state.item.type))
                .filter(state -> masteryStatus == null || masteryStatus.equals(state.masteryStatus))
                .filter(state -> dueRange == null || dueRangeMatch(state, dueRange, today))
                .sorted(Comparator.comparing((SrsState state) -> state.dueAt).thenComparing(state -> state.item.key()))
                .map(state -> stateView(state, context.userId(), zone)).toList();
        return page(context, items, cursor, limit);
    }

    public Map<String, Object> overview(UserRequestContext context, String timezone) {
        ZoneId zone = zone(timezone);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        List<SrsState> own = userStates(context.userId());
        long todayDue = own.stream().filter(state -> !state.dueLocalDate.isAfter(today) && !"SUSPENDED".equals(state.masteryStatus)).count();
        long overdue = own.stream().filter(state -> state.dueLocalDate.isBefore(today)).count();
        long atRisk = own.stream().filter(state -> "AT_RISK".equals(state.masteryStatus)).count();
        long shortTerm = own.stream().filter(state -> "SHORT_TERM".equals(state.masteryStatus)).count();
        long mastered = own.stream().filter(state -> "MASTERED".equals(state.masteryStatus)).count();
        long consolidated = own.stream().filter(state -> "CONSOLIDATED".equals(state.masteryStatus)).count();
        Instant from = clock.instant().minus(Duration.ofDays(7));
        List<ReviewFact> facts = reviewFacts.getOrDefault(context.userId(), List.of()).stream().filter(fact -> fact.at.isAfter(from)).toList();
        double rate = facts.isEmpty() ? 0 : facts.stream().filter(fact -> fact.quality >= 2).count() / (double) facts.size();
        return envelope(context, map("todayDue", todayDue, "overdue", overdue, "atRisk", atRisk, "shortTerm", shortTerm,
                "mastered", mastered, "consolidated", consolidated, "last7DaysMasteryRate", BigDecimal.valueOf(rate).setScale(4, RoundingMode.HALF_UP).doubleValue()));
    }

    private List<Candidate> candidates(long userId, Wordbook book, String scheduleType, LocalDate localDate, ZoneId zone) {
        List<Candidate> result = new ArrayList<>();
        if (!"EXPRESSION".equals(scheduleType)) {
            for (Long id : book.vocabIds) {
                Item item = new Item("VOCAB", id);
                SrsState state = states.get(stateKey(userId, item.type, item.id));
                if (state == null) result.add(new Candidate(item, null, "NEW", 0, true, null));
                else if (!"SUSPENDED".equals(state.masteryStatus) && !state.dueLocalDate.isAfter(localDate)) {
                    long overdueDays = Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(state.dueLocalDate, localDate));
                    double score = round4(((overdueDays + 1.0) / Math.max(1, state.intervalDays)) * (3.0 - state.easeFactor.doubleValue())
                            + (0.25 * state.lapseCount) + (("D1_PENDING".equals(state.delayedVerifyStage) || "D7_PENDING".equals(state.delayedVerifyStage)) ? 0.50 : 0));
                    result.add(new Candidate(item, state, overdueDays > 0 ? "OVERDUE_SMOOTHING" : "DUE", score, false,
                            overdueDays > 0 ? localDate.plusDays(Math.min(6, overdueDays / 10)) : localDate));
                }
            }
        }
        if ("EXPRESSION".equals(scheduleType)) {
            expressions.values().stream().filter(expression -> expression.userId == userId && "ACTIVE".equals(expression.status)).forEach(expression -> {
                Item item = new Item("EXPRESSION", expression.id);
                SrsState state = states.get(stateKey(userId, item.type, item.id));
                if (state == null) result.add(new Candidate(item, null, "EXPRESSION", 0, true, localDate));
                else if (!state.dueLocalDate.isAfter(localDate) && !"SUSPENDED".equals(state.masteryStatus)) result.add(new Candidate(item, state, "EXPRESSION", 0, false, localDate));
            });
        }
        result.sort(Comparator.comparing((Candidate candidate) -> candidate.isNew)
                .thenComparing(Comparator.comparingDouble((Candidate candidate) -> candidate.priority).reversed())
                .thenComparing(candidate -> candidate.item.key()));
        return result;
    }

    private String nextMastery(SrsState state, int quality) {
        if (quality < 2) {
            state.delayedVerifyStage = "FAILED";
            if ("MASTERED".equals(state.masteryStatus) || "CONSOLIDATED".equals(state.masteryStatus) || "CONSOLIDATING".equals(state.masteryStatus)) return "AT_RISK";
            return "LEARNING";
        }
        if ("D1_PENDING".equals(state.delayedVerifyStage)) {
            state.delayedVerifyStage = "D7_PENDING";
            state.delayedVerifyDueDate = state.dueLocalDate.plusDays(6);
            return "CONSOLIDATING";
        }
        if ("D7_PENDING".equals(state.delayedVerifyStage)) {
            state.delayedVerifyStage = "PASSED";
            return state.consecutiveCorrect >= 6 ? "CONSOLIDATED" : "MASTERED";
        }
        if (state.repetitionCount == 1) {
            state.delayedVerifyStage = "D1_PENDING";
            state.delayedVerifyDueDate = state.dueLocalDate;
            return "SHORT_TERM";
        }
        if ("AT_RISK".equals(state.masteryStatus)) return "CONSOLIDATING";
        if (state.repetitionCount >= 6) return "CONSOLIDATING";
        return "CONSOLIDATING";
    }

    private Map<String, Object> reviewResponse(UserRequestContext context, long eventId, String eventStatus,
                                                String riskDecision, int effectiveQuality, SrsState state,
                                                boolean reconciled, String rewardStatus) {
        return envelope(context, map("reviewEventId", eventId, "eventStatus", eventStatus, "riskDecision", riskDecision,
                "riskAuditId", null, "effectiveQuality", effectiveQuality, "reconciled", reconciled,
                "stateVersion", state.version, "srsState", stateView(state, context.userId(), ZoneId.of("Asia/Shanghai")),
                "rewardSettlementStatus", rewardStatus, "nextSnapshotItemId", null));
    }

    private SrsState ensureState(long userId, String itemType, long itemId, ZoneId zone) {
        String key = stateKey(userId, itemType, itemId);
        return states.computeIfAbsent(key, ignored -> {
            Instant now = clock.instant();
            return new SrsState(ids.incrementAndGet(), userId, new Item(itemType, itemId), 0, 0,
                    SrsAlgorithm.MAX_EASE, now, LocalDate.now(clock.withZone(zone)), "NEW", "NONE", null,
                    0, 0, 0, 0, null, 0, null, null, null, 0);
        });
    }

    private List<SrsState> userStates(long userId) { return states.values().stream().filter(state -> state.userId == userId).toList(); }

    private SrsState ownState(long userId, Item item, ZoneId zone) { return ensureState(userId, item.type, item.id, zone); }

    private Map<String, Object> stateView(SrsState state, long userId, ZoneId zone) {
        if (state == null) return null;
        Instant now = clock.instant();
        long elapsed = state.lastReviewedAt == null ? 0 : Math.max(0, Duration.between(state.lastReviewedAt, now).toDays());
        double risk = Math.max(0, Math.min(1, 0.7 * elapsed / Math.max(1, state.intervalDays)
                + 0.3 * (2.5 - state.easeFactor.doubleValue()) / 1.2));
        String riskBand = risk < 0.4 ? "LOW" : risk < 0.7 ? "MEDIUM" : "HIGH";
        List<String> explanation = new ArrayList<>();
        explanation.add("algorithm=" + SrsAlgorithm.VERSION);
        explanation.add("quality scale=0..3");
        if (state.delayedVerifyStage.endsWith("PENDING")) explanation.add("delayed verification=" + state.delayedVerifyStage);
        return map("srsStateId", state.id, "item", itemRef(state.item.type, state.item.id), "repetitionCount", state.repetitionCount,
                "easeFactor", state.easeFactor, "intervalDays", state.intervalDays, "dueAt", state.dueAt,
                "dueLocalDate", state.dueLocalDate, "masteryStatus", state.masteryStatus, "delayedVerifyStage", state.delayedVerifyStage,
                "stateVersion", state.version, "riskBand", riskBand, "explanation", explanation);
    }

    private Map<String, Object> snapshotView(Snapshot snapshot, long userId, ZoneId zone) {
        List<Map<String, Object>> items = snapshot.items.stream().map(item -> {
            Map<String, Object> view = map("snapshotItemId", item.id, "sequenceNo", item.sequenceNo,
                    "item", itemRef(item.item.type, item.item.id), "sourceReason", item.sourceReason,
                    "plannedLocalDate", item.plannedLocalDate, "dueAtAtSnapshot", item.dueAtAtSnapshot,
                    "priorityScore", item.priority, "status", item.status, "contentVersion", item.contentVersion);
            return view;
        }).toList();
        return map("snapshotId", snapshot.id, "localDate", snapshot.localDate, "timezone", snapshot.timezone,
                "status", snapshot.status, "algorithmVersion", snapshot.algorithmVersion, "rulesVersion", snapshot.rulesVersion,
                "contentVersion", snapshot.contentVersion, "items", items, "expiresAt", snapshot.expiresAt);
    }

    private Map<String, Object> vocabItemView(Vocab vocab, SrsState state, long userId, ZoneId zone, LocalDate today) {
        boolean due = state != null && !state.dueLocalDate.isAfter(today) && !"SUSPENDED".equals(state.masteryStatus);
        return map("vocabId", vocab.id, "word", vocab.word, "cefrLevel", vocab.cefr, "contentVersion", vocab.contentVersion,
                "srsState", stateView(state, userId, zone), "masteryStatus", state == null ? "NEW" : state.masteryStatus, "due", due);
    }

    private Map<String, Object> libraryView(LibraryEntry entry, long userId, ZoneId zone, LocalDate today) {
        SrsState state = states.get(stateKey(userId, entry.itemType, entry.itemId));
        return map("entryId", entry.id, "item", itemRef(entry.itemType, entry.itemId), "collectionStatus", entry.collectionStatus,
                "sourceType", entry.sourceType, "masteryStatus", state == null ? "NEW" : state.masteryStatus,
                "due", state != null && !state.dueLocalDate.isAfter(today), "createdAt", entry.createdAt);
    }

    private Map<String, Object> expressionView(Expression expression, long userId, ZoneId zone) {
        return map("expressionId", expression.id, "sourceType", expression.sourceType, "sourceRef", expression.sourceRef,
                "sentenceText", expression.sentenceText, "translationCn", expression.translationCn, "selectedText", expression.selectedText,
                "wantToSay", expression.wantToSay, "privateNote", expression.privateNote, "tags", expression.tagIds,
                "srsState", stateView(states.get(stateKey(userId, "EXPRESSION", expression.id)), userId, zone), "status", expression.status);
    }

    private Wordbook publishedWordbook(long id) {
        Wordbook book = wordbooks.get(id);
        if (book == null || !"PUBLISHED".equals(book.status)) throw api("WORD_BOOK_NOT_FOUND", "wordbook does not exist or is not published", HttpStatus.NOT_FOUND);
        return book;
    }

    private Vocab publishedVocab(long id) {
        Vocab vocab = vocabs.get(id);
        if (vocab == null || !"PUBLISHED".equals(vocab.status)) throw api("VOCAB_NOT_FOUND", "vocabulary does not exist or is not published", HttpStatus.NOT_FOUND);
        return vocab;
    }

    private Chunk publishedChunk(long id) {
        Chunk chunk = chunks.get(id);
        if (chunk == null || !"PUBLISHED".equals(chunk.status)) throw api("CHUNK_NOT_FOUND", "chunk does not exist or is not published", HttpStatus.NOT_FOUND);
        return chunk;
    }

    private Expression ownExpression(long userId, long id) {
        Expression expression = expressions.get(id);
        if (expression == null || expression.userId != userId || "DELETED".equals(expression.status)) throw api("EXPRESSION_NOT_FOUND", "expression does not exist", HttpStatus.NOT_FOUND);
        return expression;
    }

    private Snapshot ownSnapshot(long userId, long id) {
        Snapshot snapshot = snapshots.get(id);
        if (snapshot == null || snapshot.userId != userId) throw api("SNAPSHOT_NOT_FOUND", "snapshot does not exist", HttpStatus.NOT_FOUND);
        return snapshot;
    }

    private void validateItem(Item item) {
        if (item == null || !Set.of("VOCAB", "CHUNK", "EXPRESSION").contains(item.type) || item.id < 1) throw api("VALIDATION_ERROR", "itemType and exactly one target id are required", HttpStatus.BAD_REQUEST);
        if ("VOCAB".equals(item.type)) publishedVocab(item.id);
        if ("CHUNK".equals(item.type)) publishedChunk(item.id);
        if ("EXPRESSION".equals(item.type)) {
            Expression expression = expressions.get(item.id);
            if (expression == null || "DELETED".equals(expression.status)) throw api("EXPRESSION_NOT_FOUND", "expression does not exist", HttpStatus.NOT_FOUND);
        }
    }

    private static Item parseItem(Map<String, Object> body) {
        if (body == null) return null;
        String type = text(body, "itemType", "").toUpperCase();
        long id = switch (type) {
            case "VOCAB" -> longValue(body.get("vocabId"), 0);
            case "CHUNK" -> longValue(body.get("chunkId"), 0);
            case "EXPRESSION" -> longValue(body.get("expressionId"), 0);
            default -> 0;
        };
        return new Item(type, id);
    }

    private static String stateKey(long userId, String type, long id) { return userId + ":" + type + ":" + id; }

    private String contentVersion(Item item) {
        if ("VOCAB".equals(item.type)) return vocabs.get(item.id).contentVersion;
        if ("CHUNK".equals(item.type)) return chunks.get(item.id).contentVersion;
        return CONTENT_VERSION;
    }

    private static Map<String, Object> itemRef(String type, long id) {
        Map<String, Object> ref = new LinkedHashMap<>();
        ref.put("itemType", type);
        if ("VOCAB".equals(type)) ref.put("vocabId", id);
        if ("CHUNK".equals(type)) ref.put("chunkId", id);
        if ("EXPRESSION".equals(type)) ref.put("expressionId", id);
        return ref;
    }

    private static boolean dueRangeMatch(Map<String, Object> item, String range, LocalDate today) {
        Object due = item.get("due");
        if ("TODAY".equals(range)) return Boolean.TRUE.equals(due);
        if ("OVERDUE".equals(range)) return Boolean.TRUE.equals(due);
        return Boolean.TRUE.equals(due);
    }

    private static boolean dueRangeMatch(SrsState state, String range, LocalDate today) {
        if ("AT_RISK".equals(range)) return "AT_RISK".equals(state.masteryStatus);
        if ("OVERDUE".equals(range)) return state.dueLocalDate.isBefore(today);
        if ("TODAY".equals(range)) return state.dueLocalDate.equals(today);
        if ("UPCOMING".equals(range)) return state.dueLocalDate.isAfter(today);
        return true;
    }

    private static int safeLimit(int limit) { return limit <= 0 ? 20 : Math.min(MAX_PAGE, limit); }

    private Map<String, Object> page(UserRequestContext context, List<Map<String, Object>> items, String cursor, int limit) {
        int start = cursor == null || cursor.isBlank() ? 0 : (int) longValue(cursor, 0);
        start = Math.max(0, Math.min(start, items.size()));
        int end = Math.min(items.size(), start + safeLimit(limit));
        String next = end < items.size() ? String.valueOf(end) : null;
        Map<String, Object> meta = map("serverTime", clock.instant(), "snapshotAt", clock.instant(), "nextCursor", next, "hasMore", end < items.size());
        return map("requestId", context.requestId(), "data", map("items", items.subList(start, end)), "meta", meta);
    }

    private Map<String, Object> envelope(UserRequestContext context, Map<String, Object> data) {
        return map("requestId", context.requestId(), "data", data);
    }

    private static Map<String, Object> map(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) result.put(String.valueOf(pairs[i]), pairs[i + 1]);
        return result;
    }

    private Map<String, Object> wordbookView(Wordbook book, long userId) {
        return map("wordbookId", book.id, "code", book.code, "nameCn", book.nameCn, "status", book.status,
                "contentVersion", book.contentVersion, "sourceVersion", book.sourceVersion, "minCefr", book.minCefr,
                "maxCefr", book.maxCefr, "wordCount", book.vocabIds.size(), "active", activeWordbooks.getOrDefault(userId, 0L) == book.id);
    }

    private static void requireKey(String key) {
        if (key == null || !key.matches("[A-Za-z0-9._:-]{16,128}")) throw api("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key must contain 16..128 safe characters", HttpStatus.BAD_REQUEST);
    }

    private CachedResponse cached(long userId, String operation, String payloadHash) {
        CachedResponse response = idempotency.get(userId + ":" + operation);
        if (response == null) return null;
        if (!response.payloadHash.equals(payloadHash)) throw api("IDEMPOTENCY_KEY_REUSED", "idempotency key was used with a different body", HttpStatus.CONFLICT);
        return response;
    }

    private void remember(long userId, String operation, String payloadHash, Map<String, Object> value) {
        idempotency.putIfAbsent(userId + ":" + operation, new CachedResponse(payloadHash, value));
    }

    private static ResponseStatusException api(String code, String message, HttpStatus status) {
        return new ResponseStatusException(status, code + ":" + message);
    }

    private static String text(Map<String, Object> body, String key, String fallback) {
        if (body == null || body.get(key) == null) return fallback;
        String value = String.valueOf(body.get(key)).trim();
        return value.isBlank() ? fallback : value;
    }

    private static boolean bool(Map<String, Object> body, String key, boolean fallback) {
        if (body == null || body.get(key) == null) return fallback;
        if (body.get(key) instanceof Boolean value) return value;
        return Boolean.parseBoolean(String.valueOf(body.get(key)));
    }

    private static int integer(Map<String, Object> body, String key, int fallback) { return body == null ? fallback : (int) longValue(body.get(key), fallback); }
    private static int integerRequired(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) throw api("VALIDATION_ERROR", key + " is required", HttpStatus.BAD_REQUEST);
        return (int) longValue(body.get(key), Integer.MIN_VALUE);
    }
    private static int boundedInt(Map<String, Object> body, String key, int min, int max) {
        int value = integer(body, key, min);
        if (value < min || value > max) throw api("VALIDATION_ERROR", key + " is outside its allowed range", HttpStatus.BAD_REQUEST);
        return value;
    }
    private static long longValue(Object value, long fallback) {
        if (value == null) return fallback;
        if (value instanceof Number number) return number.longValue();
        try { return Long.parseLong(String.valueOf(value)); } catch (NumberFormatException ignored) { return fallback; }
    }
    private static List<Long> longs(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().map(item -> longValue(item, -1)).filter(item -> item > 0).toList();
    }

    private static LocalDate date(Map<String, Object> body, String key, LocalDate fallback) {
        String value = text(body, key, null);
        if (value == null) return fallback;
        try { return LocalDate.parse(value); } catch (DateTimeParseException error) { throw api("VALIDATION_ERROR", key + " must be YYYY-MM-DD", HttpStatus.BAD_REQUEST); }
    }

    private static Instant instant(Map<String, Object> body, String key, Instant fallback) {
        String value = text(body, key, null);
        if (value == null) return fallback;
        try { return Instant.parse(value); } catch (DateTimeParseException ignored) {
            try { return ZonedDateTime.parse(value).toInstant(); } catch (DateTimeParseException error) { throw api("VALIDATION_ERROR", key + " must be ISO-8601", HttpStatus.BAD_REQUEST); }
        }
    }

    private static ZoneId zone(String value) {
        String candidate = value == null || value.isBlank() ? "Asia/Shanghai" : value.trim();
        try { return ZoneId.of(candidate); } catch (Exception error) { throw api("INVALID_TIMEZONE", "timezone must be an IANA zone id", HttpStatus.BAD_REQUEST); }
    }

    private static double round4(double value) { return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP).doubleValue(); }

    private static String hash(Object value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest.digest(canonical(value).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) { throw new IllegalStateException("sha256 unavailable", error); }
    }

    private static String canonical(Object value) {
        if (value == null) return "null";
        if (value instanceof Map<?, ?> map) return map.keySet().stream().map(String::valueOf).sorted()
                .map(key -> key + "=" + canonical(map.get(key))).collect(Collectors.joining("{", "", "}"));
        if (value instanceof List<?> list) return list.stream().map(VocabularyService::canonical).collect(Collectors.joining(",", "[", "]"));
        return String.valueOf(value);
    }

    private static void validateExpression(Map<String, Object> body) {
        String sentence = text(body, "sentenceText", "");
        String source = text(body, "sourceType", "").toUpperCase();
        if (sentence.isBlank() || sentence.length() > 5000 || !Set.of("READING", "LISTENING", "SCENARIO", "VOCAB_EXAMPLE").contains(source)) throw api("VALIDATION_ERROR", "sourceType and sentenceText are invalid", HttpStatus.UNPROCESSABLE_ENTITY);
        int start = integer(body, "rangeStart", -1), end = integer(body, "rangeEnd", -1);
        if ((start < 0) != (end < 0) || (start >= 0 && (end <= start || end > sentence.length()))) throw api("MINING_OFFSET_INVALID", "selected range is outside sentence", HttpStatus.UNPROCESSABLE_ENTITY);
    }

    private void seedContent() {
        Vocab learn = vocab(1, "learn", "学习", "A1", 12, "/audio/learn-us.mp3", "liːrn", "lɜːn");
        learn.definitions.add(map("definitionId", 101L, "vocabId", 1L, "senseNo", 1, "partOfSpeech", "V", "meaningCn", "学习；学会", "definitionEn", "to gain knowledge", "contentVersion", CONTENT_VERSION));
        learn.examples.add(map("exampleId", 201L, "vocabId", 1L, "definitionId", 101L, "sentenceEn", "I learn English every day.", "sentenceCn", "我每天学习英语。", "highlightSpans", List.of(map("start", 2, "end", 7)), "contentVersion", CONTENT_VERSION));
        Vocab review = vocab(2, "review", "复习", "A1", 31, "/audio/review-us.mp3", "rɪˈvjuː", "rɪˈvjuː");
        review.definitions.add(map("definitionId", 102L, "vocabId", 2L, "senseNo", 1, "partOfSpeech", "V", "meaningCn", "复习；审查", "definitionEn", "to study again", "contentVersion", CONTENT_VERSION));
        review.examples.add(map("exampleId", 202L, "vocabId", 2L, "definitionId", 102L, "sentenceEn", "Review the cards before the test.", "sentenceCn", "考试前复习卡片。", "highlightSpans", List.of(map("start", 0, "end", 6)), "contentVersion", CONTENT_VERSION));
        Vocab practice = vocab(3, "practice", "练习", "A1", 45, "/audio/practice-us.mp3", "ˈpræktɪs", "ˈpræktɪs");
        practice.definitions.add(map("definitionId", 103L, "vocabId", 3L, "senseNo", 1, "partOfSpeech", "V", "meaningCn", "练习；实践", "definitionEn", "to do repeatedly to improve", "contentVersion", CONTENT_VERSION));
        practice.examples.add(map("exampleId", 203L, "vocabId", 3L, "definitionId", 103L, "sentenceEn", "Practice makes progress.", "sentenceCn", "练习带来进步。", "highlightSpans", List.of(map("start", 0, "end", 8)), "contentVersion", CONTENT_VERSION));
        vocabs.put(1L, learn); vocabs.put(2L, review); vocabs.put(3L, practice);
        Wordbook starter = new Wordbook(1L, "PHASE1_STARTER", "成人起步词汇", "A1", "B1", "PUBLISHED", List.of(1L, 2L, 3L));
        wordbooks.put(starter.id, starter);
        chunks.put(11L, new Chunk(11L, "make progress", "make progress", "COLLOCATION", "取得进步", "常用于描述学习或工作进展", "STUDY", "A1", List.of(map("exampleId", 301L, "sentenceEn", "Small steps make progress.", "sentenceCn", "小步积累带来进步。"))));
    }

    private static Vocab vocab(long id, String word, String ignoredMeaning, String cefr, int frequency, String audio, String us, String uk) {
        return new Vocab(id, word, cefr, frequency, us, uk, Map.of("us", audio, "uk", audio), CONTENT_VERSION);
    }

    private record CachedResponse(String payloadHash, Map<String, Object> value) {}
    private record Item(String type, long id) { String key() { return type + ":" + id; } }
    private record Candidate(Item item, SrsState state, String reason, double priority, boolean isNew, LocalDate plannedDate) {}
    private record ReviewFact(Instant at, int quality) {}

    private static final class Wordbook {
        final long id; final String code, nameCn, minCefr, maxCefr, status = "PUBLISHED"; final String contentVersion = CONTENT_VERSION, sourceVersion = "SEED_B2_V1", targetGoal = "GENERAL"; final List<Long> vocabIds;
        Wordbook(long id, String code, String nameCn, String minCefr, String maxCefr, String ignoredStatus, List<Long> vocabIds) { this.id = id; this.code = code; this.nameCn = nameCn; this.minCefr = minCefr; this.maxCefr = maxCefr; this.vocabIds = List.copyOf(vocabIds); }
    }

    private static final class Vocab {
        final long id; final String word, cefr, contentVersion, phoneticUs, phoneticUk; final int frequencyRank; final Map<String, String> audio; final String status = "PUBLISHED"; final List<Map<String, Object>> definitions = new ArrayList<>(), examples = new ArrayList<>(), relations = new ArrayList<>(); final List<Map<String, Object>> examHeat = List.of(map("exam", "GENERAL", "weight", 1));
        Vocab(long id, String word, String cefr, int frequencyRank, String phoneticUs, String phoneticUk, Map<String, String> audio, String contentVersion) { this.id = id; this.word = word; this.cefr = cefr; this.frequencyRank = frequencyRank; this.phoneticUs = phoneticUs; this.phoneticUk = phoneticUk; this.audio = audio; this.contentVersion = contentVersion; }
    }

    private static final class Chunk {
        final long id; final String text, normalizedText, type, meaningCn, usageNote, scenarioCode, cefr, contentVersion = CONTENT_VERSION, status = "PUBLISHED"; final List<Map<String, Object>> examples;
        Chunk(long id, String text, String normalizedText, String type, String meaningCn, String usageNote, String scenarioCode, String cefr, List<Map<String, Object>> examples) { this.id = id; this.text = text; this.normalizedText = normalizedText; this.type = type; this.meaningCn = meaningCn; this.usageNote = usageNote; this.scenarioCode = scenarioCode; this.cefr = cefr; this.examples = examples; }
    }

    private static final class SrsState {
        final long id, userId; final Item item; int repetitionCount, intervalDays, lastQuality, reviewCount, consecutiveCorrect, totalWrongCount, lapseCount, lastResponseTimeMs; BigDecimal easeFactor; Instant dueAt, firstLearnedAt, lastReviewedAt, masteredAt; LocalDate dueLocalDate, delayedVerifyDueDate; String masteryStatus, delayedVerifyStage; long version;
        SrsState(long id, long userId, Item item, int repetitionCount, int intervalDays, BigDecimal easeFactor, Instant dueAt, LocalDate dueLocalDate, String masteryStatus, String delayedVerifyStage, LocalDate delayedVerifyDueDate, int consecutiveCorrect, int totalWrongCount, int lapseCount, int reviewCount, Integer lastQuality, int lastResponseTimeMs, Instant firstLearnedAt, Instant lastReviewedAt, Instant masteredAt, long version) { this.id = id; this.userId = userId; this.item = item; this.repetitionCount = repetitionCount; this.intervalDays = intervalDays; this.easeFactor = easeFactor; this.dueAt = dueAt; this.dueLocalDate = dueLocalDate; this.masteryStatus = masteryStatus; this.delayedVerifyStage = delayedVerifyStage; this.delayedVerifyDueDate = delayedVerifyDueDate; this.consecutiveCorrect = consecutiveCorrect; this.totalWrongCount = totalWrongCount; this.lapseCount = lapseCount; this.reviewCount = reviewCount; this.lastQuality = lastQuality == null ? 0 : lastQuality; this.lastResponseTimeMs = lastResponseTimeMs; this.firstLearnedAt = firstLearnedAt; this.lastReviewedAt = lastReviewedAt; this.masteredAt = masteredAt; this.version = version; }
    }

    private static final class Snapshot {
        final long id, userId, activeWordbookId; final LocalDate localDate; final String timezone, scheduleType, algorithmVersion, rulesVersion, contentVersion; final int dailyNewTarget, maxDailyReview; final Instant generatedAt, expiresAt, serverCutoffAt; String status = "ACTIVE"; final List<SnapshotItem> items = new ArrayList<>();
        Snapshot(long id, long userId, LocalDate localDate, String timezone, String scheduleType, long activeWordbookId, int dailyNewTarget, int maxDailyReview, String algorithmVersion, String rulesVersion, String contentVersion, Instant generatedAt, Instant serverCutoffAt, Instant expiresAt) { this.id = id; this.userId = userId; this.localDate = localDate; this.timezone = timezone; this.scheduleType = scheduleType; this.activeWordbookId = activeWordbookId; this.dailyNewTarget = dailyNewTarget; this.maxDailyReview = maxDailyReview; this.algorithmVersion = algorithmVersion; this.rulesVersion = rulesVersion; this.contentVersion = contentVersion; this.serverCutoffAt = serverCutoffAt; this.expiresAt = expiresAt; this.generatedAt = generatedAt; }
    }

    private static final class SnapshotItem {
        final long id; final Item item; final int sequenceNo; final String sourceReason, contentVersion, contentHash; final LocalDate plannedLocalDate; final Instant dueAtAtSnapshot; final long stateVersionAtSnapshot; final double priority; String status; Instant completedAt;
        SnapshotItem(long id, String type, long targetId, int sequenceNo, String sourceReason, LocalDate plannedLocalDate, Instant dueAtAtSnapshot, long stateVersionAtSnapshot, double priority, String contentVersion, String contentHash, String status) { this.id = id; this.item = new Item(type, targetId); this.sequenceNo = sequenceNo; this.sourceReason = sourceReason; this.plannedLocalDate = plannedLocalDate; this.dueAtAtSnapshot = dueAtAtSnapshot; this.stateVersionAtSnapshot = stateVersionAtSnapshot; this.priority = priority; this.contentVersion = contentVersion; this.contentHash = contentHash; this.status = status; }
    }

    private static final class LibraryEntry {
        final long id, userId; final String itemType, sourceType, collectionStatus, key; final long itemId; final Instant createdAt = Instant.now(); Instant deletedAt;
        LibraryEntry(long id, long userId, String itemType, long itemId, String sourceType, String collectionStatus, Instant ignored) { this.id = id; this.userId = userId; this.itemType = itemType; this.itemId = itemId; this.sourceType = sourceType; this.collectionStatus = collectionStatus; this.key = stateKey(userId, itemType, itemId); }
    }

    private static final class Expression {
        final long id, userId; final String sourceType, sourceRef, sourceContentVersion, sourceAudioRef, sentenceText, translationCn, selectedText, dedupeHash; String privateNote; final int rangeStart, rangeEnd; boolean wantToSay; String status = "ACTIVE"; final Set<Long> tagIds = ConcurrentHashMap.newKeySet(); Instant updatedAt = Instant.now(), deletedAt;
        Expression(long id, long userId, String sourceType, String sourceRef, String sourceContentVersion, String sourceAudioRef, String sentenceText, String translationCn, String selectedText, int rangeStart, int rangeEnd, boolean wantToSay, String privateNote, String dedupeHash) { this.id = id; this.userId = userId; this.sourceType = sourceType; this.sourceRef = sourceRef; this.sourceContentVersion = sourceContentVersion; this.sourceAudioRef = sourceAudioRef; this.sentenceText = sentenceText; this.translationCn = translationCn; this.selectedText = selectedText; this.rangeStart = rangeStart; this.rangeEnd = rangeEnd; this.wantToSay = wantToSay; this.privateNote = privateNote; this.dedupeHash = dedupeHash; }
    }
}
