package com.englishflow.modules.learning.b3;

import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/")
public final class B3Controller {
    private final B3MultimodalService service;

    public B3Controller(B3MultimodalService service) { this.service = service; }

    @GetMapping("/grammar/points")
    public Map<String, Object> grammarPoints(@RequestParam(defaultValue = "20") int limit,
                                              @RequestParam(required = false) String cefrLevel) { return service.listGrammarPoints(limit, cefrLevel); }

    @GetMapping("/grammar/points/{grammarPointId}")
    public Map<String, Object> grammarPoint(@PathVariable long grammarPointId) { return service.getGrammarPoint(grammarPointId); }

    @GetMapping("/grammar/tree")
    public Map<String, Object> grammarTree(@RequestParam(required = false) Long contentVersionId) { return service.grammarTree(contentVersionId); }

    @GetMapping("/grammar/points/{grammarPointId}/traps")
    public Map<String, Object> grammarTraps(@PathVariable long grammarPointId) { return service.listGrammarTraps(grammarPointId); }

    @GetMapping("/grammar/exercises")
    public Map<String, Object> grammarExercises(@RequestParam(required = false) Long grammarPointId,
                                                @RequestParam(required = false) String type,
                                                @RequestParam(defaultValue = "20") int limit) { return service.listGrammarExercises(grammarPointId, type, limit); }

    @GetMapping("/grammar/exercises/{exerciseId}")
    public Map<String, Object> grammarExercise(@PathVariable long exerciseId) { return service.getGrammarExercise(exerciseId); }

    @PostMapping("/grammar/practice/attempts")
    public Map<String, Object> grammarAttempt(@RequestBody Map<String, Object> body,
                                              @RequestHeader("Idempotency-Key") String key,
                                              HttpServletRequest request) { return service.submitGrammarAttempt(user(request), body, key); }

    @GetMapping("/grammar/mastery")
    public Map<String, Object> grammarMastery(@RequestParam(required = false) Long grammarPointId,
                                              HttpServletRequest request) { return service.getGrammarMastery(user(request), grammarPointId); }

    @GetMapping("/grammar/targeted-packs")
    public Map<String, Object> targetedGrammarPack(@RequestParam(defaultValue = "10") int limit,
                                                   HttpServletRequest request) { return service.targetedGrammarPack(user(request), limit); }

    @GetMapping("/grammar/sentences/{sentenceId}")
    public Map<String, Object> sentence(@PathVariable long sentenceId) { return service.getSentence(sentenceId); }

    @GetMapping("/grammar/sentences/{sentenceId}/xray")
    public Map<String, Object> sentenceXray(@PathVariable long sentenceId) { return service.sentenceXray(sentenceId); }

    @GetMapping("/grammar/sentences/{sentenceId}/blocks")
    public Map<String, Object> sentenceBlocks(@PathVariable long sentenceId) { return service.sentenceBlocks(sentenceId); }

    @PostMapping("/grammar/sentences/{sentenceId}/blocks")
    public Map<String, Object> submitSentenceBlocks(@PathVariable long sentenceId, @RequestBody Map<String, Object> body,
                                                    @RequestHeader("Idempotency-Key") String key,
                                                    HttpServletRequest request) { return service.submitSentenceBlocks(user(request), sentenceId, body, key); }

    @PostMapping("/grammar/sentences/{sentenceId}/imitation")
    public Map<String, Object> submitImitation(@PathVariable long sentenceId, @RequestBody Map<String, Object> body,
                                               @RequestHeader("Idempotency-Key") String key,
                                               HttpServletRequest request) { return service.submitImitation(user(request), sentenceId, body, key); }

    @PostMapping("/grammar/practice/sessions")
    public ResponseEntity<Map<String, Object>> grammarSession(@RequestBody Map<String, Object> body,
                                                              @RequestHeader("Idempotency-Key") String key,
                                                              HttpServletRequest request) { return ResponseEntity.status(201).body(service.createGrammarSession(user(request), body, key)); }

    @PostMapping("/grammar/practice/sessions/{sessionId}/answers")
    public Map<String, Object> grammarAnswer(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                             @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.answerGrammar(user(request), sessionId, body, key); }

    @GetMapping("/writing/prompts")
    public Map<String, Object> writingPrompts(@RequestParam(defaultValue = "20") int limit,
                                              @RequestParam(required = false) String promptType) { return service.listWritingPrompts(limit, promptType); }

    @GetMapping("/writing/translation/exercises")
    public Map<String, Object> translationExercises(@RequestParam(defaultValue = "20") int limit) { return service.listTranslationExercises(limit); }

    @GetMapping("/writing/templates")
    public Map<String, Object> writingTemplates(@RequestParam(defaultValue = "20") int limit) { return service.listWritingTemplates(limit); }

    @GetMapping("/writing/materials")
    public Map<String, Object> writingMaterials(@RequestParam(defaultValue = "20") int limit,
                                                @RequestParam(required = false) String topicCode) { return service.listWritingMaterials(limit, topicCode); }

    @GetMapping("/writing/proofreading/exercises")
    public Map<String, Object> proofreadingExercises(@RequestParam(defaultValue = "20") int limit) { return service.listProofreadingExercises(limit); }

    @GetMapping("/writing/history")
    public Map<String, Object> writingHistory(@RequestParam(defaultValue = "20") int limit,
                                              HttpServletRequest request) { return service.listWritingHistory(user(request), limit); }

    @PostMapping("/writing/submissions")
    public ResponseEntity<Map<String, Object>> writing(@RequestBody Map<String, Object> body,
                                                       @RequestHeader("Idempotency-Key") String key,
                                                       HttpServletRequest request) { return ResponseEntity.status(201).body(service.submitWriting(user(request), body, key)); }

    @GetMapping("/writing/submissions/{submissionId}")
    public Map<String, Object> writingResult(@PathVariable long submissionId, HttpServletRequest request) { return service.getWriting(user(request), submissionId); }

    @PostMapping("/writing/corrections")
    public Map<String, Object> correction(@RequestBody Map<String, Object> body,
                                          @RequestHeader("Idempotency-Key") String key,
                                          HttpServletRequest request) { return service.submitCorrection(user(request), body, key); }

    @GetMapping("/listening/materials")
    public Map<String, Object> materials(@RequestParam(defaultValue = "20") int limit,
                                         @RequestParam(required = false) String cefrLevel) { return service.listMaterials(limit, cefrLevel); }

    @GetMapping("/listening/materials/{materialId}")
    public Map<String, Object> material(@PathVariable long materialId) { return service.getMaterial(materialId); }

    @GetMapping("/listening/materials/{materialId}/timeline")
    public Map<String, Object> listeningTimeline(@PathVariable long materialId) { return service.getListeningTimeline(materialId); }

    @GetMapping("/listening/clips")
    public Map<String, Object> clips(@RequestParam(required = false) Long materialId,
                                     @RequestParam(defaultValue = "20") int limit) { return service.listClips(materialId, limit); }

    @GetMapping("/listening/offline-packages")
    public Map<String, Object> offlinePackages(@RequestParam(defaultValue = "20") int limit,
                                               HttpServletRequest request) { return service.listOfflinePackages(user(request), limit); }

    @PostMapping("/listening/offline-packages")
    public ResponseEntity<Map<String, Object>> createOfflinePackage(@RequestBody Map<String, Object> body,
                                                                     @RequestHeader("Idempotency-Key") String key,
                                                                     HttpServletRequest request) { return ResponseEntity.status(201).body(service.createOfflinePackage(user(request), body, key)); }

    @GetMapping("/listening/offline-packages/{packageId}")
    public Map<String, Object> offlinePackage(@PathVariable long packageId, HttpServletRequest request) { return service.getOfflinePackage(user(request), packageId); }

    @GetMapping("/listening/offline-packages/{packageId}/assets/{assetId}")
    public ResponseEntity<Map<String, Object>> offlineAsset(@PathVariable long packageId, @PathVariable String assetId,
                                                            @RequestHeader(value = "Range", required = false) String range,
                                                            HttpServletRequest request) { return ResponseEntity.status(206).body(service.downloadOfflineAsset(user(request), packageId, assetId, range)); }

    @PostMapping("/listening/offline-packages/{packageId}/sync")
    public Map<String, Object> syncOfflinePackage(@PathVariable long packageId, @RequestBody Map<String, Object> body,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  HttpServletRequest request) { return service.syncOfflinePackage(user(request), packageId, body, key); }

    @PostMapping("/listening/sessions")
    public ResponseEntity<Map<String, Object>> listeningSession(@RequestBody Map<String, Object> body,
                                                                @RequestHeader("Idempotency-Key") String key,
                                                                HttpServletRequest request) { return ResponseEntity.status(201).body(service.createListeningSession(user(request), body, key)); }

    @PostMapping("/listening/sessions/{sessionId}/dictation")
    public Map<String, Object> dictation(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                         @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.submitDictation(user(request), sessionId, body, key); }

    @PutMapping("/listening/sessions/{sessionId}/progress")
    public Map<String, Object> listeningProgress(@PathVariable String sessionId, @RequestBody Map<String, Object> body,
                                                  @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.updateListeningProgress(user(request), sessionId, body, key); }

    @GetMapping("/reading/articles")
    public Map<String, Object> articles(@RequestParam(defaultValue = "20") int limit,
                                        @RequestParam(required = false) String cefrLevel) { return service.listArticles(limit, cefrLevel); }

    @GetMapping("/reading/articles/{articleId}")
    public Map<String, Object> article(@PathVariable long articleId) { return service.getArticle(articleId); }

    @GetMapping("/reading/articles/{articleId}/dictionary")
    public Map<String, Object> dictionary(@PathVariable long articleId, @RequestParam String tokenId) { return service.dictionaryEntry(articleId, tokenId); }

    @GetMapping("/reading/articles/{articleId}/story")
    public Map<String, Object> story(@PathVariable long articleId) { return service.readingStory(articleId); }

    @GetMapping("/reading/questions")
    public Map<String, Object> readingQuestions(@RequestParam(required = false) Long articleId,
                                                @RequestParam(defaultValue = "20") int limit) { return service.listReadingQuestions(articleId, limit); }

    @PostMapping("/reading/attempts")
    public Map<String, Object> readingAttempt(@RequestBody Map<String, Object> body,
                                              @RequestHeader("Idempotency-Key") String key,
                                              HttpServletRequest request) { return service.submitReadingAttempt(user(request), body, key); }

    @PutMapping("/reading/progress")
    public Map<String, Object> readingProgress(@RequestBody Map<String, Object> body,
                                               @RequestHeader("Idempotency-Key") String key,
                                               HttpServletRequest request) { return service.updateReadingProgress(user(request), body, key); }

    @PostMapping("/reading/mining")
    public ResponseEntity<Map<String, Object>> mining(@RequestBody Map<String, Object> body,
                                                      @RequestHeader("Idempotency-Key") String key,
                                                      HttpServletRequest request) { return ResponseEntity.status(201).body(service.createMining(user(request), body, key)); }

    @GetMapping("/phonetics/catalog")
    public Map<String, Object> phonetics(@RequestParam(required = false) String setCode) { return service.phoneticsCatalog(setCode); }

    @GetMapping("/phonetics/minimal-pairs")
    public Map<String, Object> minimalPairs(@RequestParam(required = false) Long phonemeId,
                                            @RequestParam(defaultValue = "20") int limit) { return service.listMinimalPairs(phonemeId, limit); }

    @PostMapping("/speaking/recordings")
    public ResponseEntity<Map<String, Object>> recording(@RequestBody Map<String, Object> body,
                                                         @RequestHeader("Idempotency-Key") String key,
                                                         HttpServletRequest request) { return ResponseEntity.status(201).body(service.createRecording(user(request), body, key)); }

    @GetMapping("/speaking/recordings/{recordingId}")
    public Map<String, Object> recording(@PathVariable String recordingId, HttpServletRequest request) { return service.getRecording(user(request), recordingId); }

    @DeleteMapping("/speaking/recordings/{recordingId}")
    public Map<String, Object> deleteRecording(@PathVariable String recordingId,
                                               @RequestHeader("Idempotency-Key") String key,
                                               HttpServletRequest request) { return service.deleteRecording(user(request), recordingId, key); }

    @PostMapping("/speaking/recordings/{recordingId}/self-rating")
    public Map<String, Object> selfRating(@PathVariable String recordingId, @RequestBody Map<String, Object> body,
                                          @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.selfRate(user(request), recordingId, body, key); }

    @PostMapping("/speaking/shadowing/sessions")
    public ResponseEntity<Map<String, Object>> createShadowing(@RequestBody Map<String, Object> body,
                                                               @RequestHeader("Idempotency-Key") String key,
                                                               HttpServletRequest request) { return ResponseEntity.status(201).body(service.createShadowingSession(user(request), body, key)); }

    @PostMapping("/speaking/shadowing/sessions/{shadowingSessionId}/progress")
    public Map<String, Object> shadowingProgress(@PathVariable String shadowingSessionId, @RequestBody Map<String, Object> body,
                                                  @RequestHeader("Idempotency-Key") String key,
                                                  HttpServletRequest request) { return service.updateShadowingProgress(user(request), shadowingSessionId, body, key); }

    @PostMapping("/speaking/roleplay/sessions")
    public ResponseEntity<Map<String, Object>> createRoleplay(@RequestBody Map<String, Object> body,
                                                              @RequestHeader("Idempotency-Key") String key,
                                                              HttpServletRequest request) { return ResponseEntity.status(201).body(service.createRoleplaySession(user(request), body, key)); }

    @PostMapping("/speaking/roleplay/sessions/{roleplaySessionId}/turns")
    public Map<String, Object> roleplayTurn(@PathVariable String roleplaySessionId, @RequestBody Map<String, Object> body,
                                            @RequestHeader("Idempotency-Key") String key,
                                            HttpServletRequest request) { return service.submitRoleplayTurn(user(request), roleplaySessionId, body, key); }

    @PostMapping("/offline/sync/push")
    public Map<String, Object> syncPush(@RequestBody Map<String, Object> body,
                                        @RequestHeader("Idempotency-Key") String key,
                                        HttpServletRequest request) { return service.pushSync(user(request), body, key); }

    @GetMapping("/offline/sync/pull")
    public Map<String, Object> syncPull(@RequestParam(required = false) String cursor,
                                        @RequestParam(defaultValue = "50") int limit,
                                        HttpServletRequest request) { return service.pullSync(user(request), cursor, limit); }

    @GetMapping("/offline/manifests/{manifestId}")
    public Map<String, Object> manifest(@PathVariable String manifestId) { return service.manifest(manifestId); }

    private static long user(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context.userId();
        throw new B3Exception("B3_AUTH_REQUIRED", "需要登录", 401, false);
    }

    @RestControllerAdvice(assignableTypes = B3Controller.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B3Exception.class)
        public ResponseEntity<Map<String, Object>> handle(B3Exception exception, HttpServletRequest request) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("code", exception.code());
            error.put("message", exception.getMessage());
            error.put("retryable", exception.retryable());
            return ResponseEntity.status(exception.status()).body(Map.of("requestId", request.getHeader("X-Request-Id") == null ? "req_b3_error" : request.getHeader("X-Request-Id"), "error", error));
        }
    }
}
