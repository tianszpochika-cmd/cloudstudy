package com.englishflow.modules.gamification.b4;

import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.b4.B4Exception;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
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
public final class B4GamificationController {
    private final B4GamificationService service;

    public B4GamificationController(B4GamificationService service) { this.service = service; }

    @GetMapping("/gamification/profile")
    public Map<String, Object> profile(HttpServletRequest request) { return service.profile(user(request)); }

    @GetMapping("/gamification/ledger")
    public Map<String, Object> ledger(@RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { return service.ledger(user(request), limit); }

    @PostMapping("/gamification/events")
    public Map<String, Object> settle(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.settleLearningEvent(user(request), body, key); }

    @GetMapping("/gamification/streak")
    public Map<String, Object> streak(HttpServletRequest request) { return service.streak(user(request)); }

    @PutMapping("/gamification/streak/settings")
    public Map<String, Object> streakSettings(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.saveStreakSettings(user(request), body, key); }

    @PostMapping("/gamification/streak/rescue")
    public Map<String, Object> rescue(@RequestBody(required = false) Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.rescueStreak(user(request), body == null ? Map.of() : body, key); }

    @GetMapping("/gamification/quests")
    public Map<String, Object> quests(HttpServletRequest request) { return service.quests(user(request)); }

    @PostMapping("/gamification/quests/{questId}/claim")
    public Map<String, Object> claimQuest(@PathVariable String questId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.claimQuest(user(request), questId, key); }

    @GetMapping("/gamification/achievements")
    public Map<String, Object> achievements(HttpServletRequest request) { return service.achievements(user(request)); }

    @PutMapping("/gamification/achievements/{achievementCode}/showcase")
    public Map<String, Object> showcase(@PathVariable String achievementCode, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.showcaseAchievement(user(request), achievementCode, body, key); }

    @GetMapping("/gamification/chests")
    public Map<String, Object> chests(HttpServletRequest request) { return service.chests(user(request)); }

    @GetMapping("/gamification/chests/{chestGrantId}/probability")
    public Map<String, Object> probability(@PathVariable String chestGrantId, HttpServletRequest request) { return service.chestProbability(user(request), chestGrantId); }

    @PostMapping("/gamification/chests/{chestGrantId}/open")
    public Map<String, Object> openChest(@PathVariable String chestGrantId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.openChest(user(request), chestGrantId, key); }

    @GetMapping("/gamification/collection")
    public Map<String, Object> collection(HttpServletRequest request) { return service.collection(user(request)); }

    @GetMapping("/gamification/catalog")
    public Map<String, Object> catalog(HttpServletRequest request) { return service.catalog(user(request)); }

    @PostMapping("/gamification/catalog/{catalogItemId}/redeem")
    public Map<String, Object> redeem(@PathVariable String catalogItemId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.redeem(user(request), catalogItemId, key); }

    @GetMapping("/gamification/seasons/current")
    public Map<String, Object> season(HttpServletRequest request) { return service.currentSeason(user(request)); }

    @GetMapping("/gamification/seasons/{seasonId}/rewards")
    public Map<String, Object> seasonRewards(@PathVariable String seasonId, HttpServletRequest request) { return service.seasonRewards(user(request), seasonId); }

    @GetMapping("/avatar/profile")
    public Map<String, Object> avatarProfile(HttpServletRequest request) { return service.avatarProfile(user(request)); }

    @PutMapping("/avatar/profile")
    public Map<String, Object> saveAvatarProfile(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.saveAvatarProfile(user(request), body, key); }

    @GetMapping("/avatar/items")
    public Map<String, Object> avatarItems(HttpServletRequest request) { return service.avatarItems(user(request)); }

    @GetMapping("/avatar/loadouts")
    public Map<String, Object> loadouts(HttpServletRequest request) { return service.avatarLoadouts(user(request)); }

    @PutMapping("/avatar/loadouts/{loadoutId}")
    public Map<String, Object> saveLoadout(@PathVariable String loadoutId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.saveAvatarLoadout(user(request), loadoutId, body, key); }

    @PostMapping("/avatar/loadouts/{loadoutId}/equip")
    public Map<String, Object> equipLoadout(@PathVariable String loadoutId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.equipAvatarLoadout(user(request), loadoutId, key); }

    @GetMapping("/avatar/resources")
    public Map<String, Object> avatarResources(HttpServletRequest request) { return service.avatarResources(user(request)); }

    @GetMapping("/avatar/study-space")
    public Map<String, Object> studySpace(HttpServletRequest request) { return service.studySpace(user(request)); }

    @PutMapping("/avatar/study-space")
    public Map<String, Object> saveStudySpace(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.saveStudySpace(user(request), body, key); }

    @GetMapping("/games/catalog")
    public Map<String, Object> games(HttpServletRequest request) { return service.gameCatalog(user(request)); }

    @PostMapping("/games/sessions")
    public ResponseEntity<Map<String, Object>> createGame(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.createGameSession(user(request), body, key)); }

    @GetMapping("/games/sessions/{sessionId}")
    public Map<String, Object> game(@PathVariable String sessionId, HttpServletRequest request) { return service.gameSession(user(request), sessionId); }

    @PostMapping("/games/sessions/{sessionId}/events")
    public Map<String, Object> gameEvent(@PathVariable String sessionId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.submitGameEvent(user(request), sessionId, body, key); }

    @PostMapping("/games/sessions/{sessionId}/pause")
    public Map<String, Object> pause(@PathVariable String sessionId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.pauseGame(user(request), sessionId, key); }

    @PostMapping("/games/sessions/{sessionId}/resume")
    public Map<String, Object> resume(@PathVariable String sessionId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.resumeGame(user(request), sessionId, key); }

    @PostMapping("/games/sessions/{sessionId}/finish")
    public Map<String, Object> finish(@PathVariable String sessionId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.finishGame(user(request), sessionId, key); }

    private static long user(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context.userId();
        throw new B4Exception("B4_AUTH_REQUIRED", "需要登录", 401, false);
    }

    @RestControllerAdvice(assignableTypes = B4GamificationController.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B4Exception.class)
        public ResponseEntity<Map<String, Object>> handle(B4Exception exception, HttpServletRequest request) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("code", exception.code()); error.put("message", exception.getMessage()); error.put("retryable", exception.retryable());
            String requestId = request.getHeader("X-Request-Id") == null ? "req_b4_error" : request.getHeader("X-Request-Id");
            return ResponseEntity.status(exception.status()).body(Map.of("requestId", requestId, "error", error));
        }
    }
}
