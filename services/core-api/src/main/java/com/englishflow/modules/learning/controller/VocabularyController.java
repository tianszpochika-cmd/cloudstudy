package com.englishflow.modules.learning.controller;

import java.util.Map;

import com.englishflow.modules.learning.vocabulary.VocabularyService;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.UserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/")
public final class VocabularyController {
    private final VocabularyService service;
    private final UserContextResolver contextResolver;

    public VocabularyController(VocabularyService service, UserContextResolver contextResolver) {
        this.service = service;
        this.contextResolver = contextResolver;
    }

    @GetMapping("/vocab/wordbooks")
    public Map<String, Object> wordbooks(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit,
                                         @RequestParam(required = false) String targetGoal, @RequestParam(required = false) String cefrLevel,
                                         @RequestHeader("X-Timezone") String timezone, HttpServletRequest request) {
        return service.listWordbooks(context(request), cursor, limit, targetGoal, cefrLevel);
    }

    @PutMapping("/vocab/wordbooks/{wordbookId}/activation")
    public Map<String, Object> activate(@PathVariable long wordbookId, @RequestHeader("Idempotency-Key") String key,
                                         @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return service.activateWordbook(context(request), wordbookId, key, body);
    }

    @GetMapping("/vocab/wordbooks/{wordbookId}/items")
    public Map<String, Object> wordbookItems(@PathVariable long wordbookId, @RequestParam(required = false) String cursor,
                                             @RequestParam(defaultValue = "20") int limit, @RequestParam(required = false) String masteryStatus,
                                             @RequestParam(defaultValue = "false") boolean dueOnly, @RequestHeader("X-Timezone") String timezone,
                                             HttpServletRequest request) {
        return service.listWordbookItems(context(request), wordbookId, cursor, limit, masteryStatus, dueOnly, timezone);
    }

    @GetMapping("/vocab/items/{vocabId}")
    public Map<String, Object> vocab(@PathVariable long vocabId, @RequestParam(required = false) String contentVersion, HttpServletRequest request) {
        return service.vocabDetail(context(request), vocabId, contentVersion);
    }

    @GetMapping("/vocab/chunks/{chunkId}")
    public Map<String, Object> chunk(@PathVariable long chunkId, HttpServletRequest request) { return service.chunkDetail(context(request), chunkId); }

    @GetMapping("/vocab/roots/{rootId}")
    public Map<String, Object> root(@PathVariable long rootId, @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit, HttpServletRequest request) {
        return service.rootTopic(context(request), rootId, cursor, limit);
    }

    @GetMapping("/vocab/library")
    public Map<String, Object> library(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit,
                                       @RequestParam(required = false) String itemType, @RequestParam(required = false) String masteryStatus,
                                       @RequestParam(required = false) String collectionStatus, @RequestParam(required = false) String sourceType,
                                       @RequestParam(required = false) String dueRange, @RequestHeader("X-Timezone") String timezone, HttpServletRequest request) {
        return service.listLibrary(context(request), cursor, limit, itemType, masteryStatus, collectionStatus, sourceType, dueRange, timezone);
    }

    @PostMapping("/vocab/library/entries")
    public Map<String, Object> addLibrary(@RequestHeader("Idempotency-Key") String key, @RequestHeader("X-Timezone") String timezone,
                                          @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return service.addLibrary(context(request), key, body, timezone);
    }

    @DeleteMapping("/vocab/library/entries/{entryId}")
    public Map<String, Object> removeLibrary(@PathVariable long entryId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) {
        return service.removeLibrary(context(request), entryId, key);
    }

    @GetMapping("/vocab/expressions")
    public Map<String, Object> expressions(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit,
                                           @RequestParam(required = false) String sourceType, @RequestParam(required = false) Boolean wantToSay,
                                           @RequestParam(required = false) Long tagId, @RequestHeader("X-Timezone") String timezone, HttpServletRequest request) {
        return service.listExpressions(context(request), cursor, limit, sourceType, wantToSay, tagId, timezone);
    }

    @PostMapping("/vocab/expressions")
    public Map<String, Object> createExpression(@RequestHeader("Idempotency-Key") String key, @RequestHeader("X-Timezone") String timezone,
                                                @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return service.createExpression(context(request), key, body, timezone);
    }

    @PatchMapping("/vocab/expressions/{expressionId}")
    public Map<String, Object> updateExpression(@PathVariable long expressionId, @RequestHeader("Idempotency-Key") String key,
                                                 @RequestHeader("X-Timezone") String timezone, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return service.updateExpression(context(request), expressionId, key, body, timezone);
    }

    @DeleteMapping("/vocab/expressions/{expressionId}")
    public Map<String, Object> deleteExpression(@PathVariable long expressionId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) {
        return service.deleteExpression(context(request), expressionId, key);
    }

    @GetMapping("/vocab/offline/cards")
    public Map<String, Object> offlineCards(@RequestParam long wordbookId, @RequestParam(defaultValue = "50") int limit,
                                            @RequestHeader("X-Timezone") String timezone, HttpServletRequest request) {
        return service.offlineCards(context(request), wordbookId, limit, timezone);
    }

    @PostMapping("/learning/srs/batches")
    public Map<String, Object> createBatch(@RequestHeader("Idempotency-Key") String key, @RequestHeader("X-Timezone") String timezone,
                                           @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return service.createBatch(context(request), key, body, timezone);
    }

    @GetMapping("/learning/srs/batches/{snapshotId}")
    public Map<String, Object> batch(@PathVariable long snapshotId, HttpServletRequest request) { return service.getBatch(context(request), snapshotId); }

    @PostMapping("/learning/srs/reviews")
    public Map<String, Object> review(@RequestHeader("Idempotency-Key") String key, @RequestHeader("X-Timezone") String timezone,
                                      @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return service.submitReview(context(request), key, body, timezone);
    }

    @PostMapping("/learning/srs/reviews:sync")
    public Map<String, Object> sync(@RequestHeader("Idempotency-Key") String key, @RequestHeader("X-Timezone") String timezone,
                                    @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return service.syncReviews(context(request), key, body, timezone);
    }

    @GetMapping("/learning/srs/states")
    public Map<String, Object> states(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit,
                                      @RequestParam(required = false) String itemType, @RequestParam(required = false) String masteryStatus,
                                      @RequestParam(required = false) String dueRange, @RequestHeader("X-Timezone") String timezone, HttpServletRequest request) {
        return service.listStates(context(request), cursor, limit, itemType, masteryStatus, dueRange, timezone);
    }

    @GetMapping("/learning/srs/overview")
    public Map<String, Object> overview(@RequestHeader("X-Timezone") String timezone, HttpServletRequest request) { return service.overview(context(request), timezone); }

    private UserRequestContext context(HttpServletRequest request) { return contextResolver.resolve(request); }
}
