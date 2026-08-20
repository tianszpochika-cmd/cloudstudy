package com.englishflow.modules.onboarding;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/")
public final class OnboardingController {
    private final OnboardingProfileService profileService;
    private final FirstGoalService goalService;
    private final DailyTaskService taskService;
    private final PlacementService placementService;
    private final Map<Long, Map<String, Object>> continueContexts = new java.util.concurrent.ConcurrentHashMap<>();

    public OnboardingController(OnboardingProfileService profileService, FirstGoalService goalService,
                                DailyTaskService taskService, PlacementService placementService) {
        this.profileService = profileService;
        this.goalService = goalService;
        this.taskService = taskService;
        this.placementService = placementService;
    }

    @GetMapping("/onboarding/options")
    public ProfileOptionsResponse options() { return ProfileOptionsResponse.phaseOne(); }

    @GetMapping("/onboarding/profile")
    public OnboardingProfile profile(HttpServletRequest request) { return profileService.get(B1RequestUser.id(request)); }

    @PostMapping("/onboarding/profile")
    public OnboardingProfile saveProfile(@RequestBody OnboardingProfileRequest body, HttpServletRequest request) {
        return profileService.save(B1RequestUser.id(request), body);
    }

    @PatchMapping("/onboarding/profile")
    public OnboardingProfile patchProfile(@RequestBody OnboardingProfilePatchRequest body, HttpServletRequest request) {
        return profileService.patch(B1RequestUser.id(request), body);
    }

    @PostMapping("/onboarding/goals/first")
    public FirstGoal firstGoal(HttpServletRequest request) {
        long userId = B1RequestUser.id(request);
        return goalService.ensure(userId, profileService.get(userId));
    }

    @GetMapping("/onboarding/daily-tasks/today")
    public DailyTaskPlan today(HttpServletRequest request) { return taskService.today(B1RequestUser.id(request)); }

    @PostMapping("/onboarding/daily-tasks/{taskId}/complete")
    public DailyTaskPlan complete(@PathVariable String taskId, HttpServletRequest request) {
        return taskService.completeTask(B1RequestUser.id(request), LocalDate.now(), taskId);
    }

    @PostMapping("/onboarding/daily-tasks/reorder")
    public DailyTaskPlan reorder(HttpServletRequest request) { return taskService.reorder(B1RequestUser.id(request), LocalDate.now()); }

    @PostMapping("/assessment/placement/start")
    public PlacementStartResponse startPlacement(HttpServletRequest request) { return placementService.start(B1RequestUser.id(request)); }

    @PostMapping("/assessment/placement/submit-step")
    public PlacementSubmitResponse submitPlacement(@RequestBody PlacementSubmitRequest body,
                                                    @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                                    HttpServletRequest request) {
        return placementService.submit(B1RequestUser.id(request), body, idempotencyKey);
    }

    @PostMapping("/assessment/placement/skip")
    public PlacementSubmitResponse skipPlacement(@RequestBody(required = false) Map<String, String> body,
                                                  @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                                  HttpServletRequest request) {
        return placementService.skip(B1RequestUser.id(request), body == null ? null : body.get("fastTrackLevel"), idempotencyKey);
    }

    @GetMapping("/assessment/placement/report/{sessionId}")
    public PlacementReport placementReport(@PathVariable String sessionId, HttpServletRequest request) {
        return placementService.report(sessionId, B1RequestUser.id(request));
    }

    @GetMapping("/home/feed")
    public Map<String, Object> home(HttpServletRequest request) {
        long userId = B1RequestUser.id(request);
        DailyTaskPlan plan = taskService.today(userId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("streakDays", 0);
        result.put("starCoins", 0);
        result.put("currentXp", plan.completedMinutes() * 10);
        result.put("levelTitle", "L1 起点探索者");
        result.put("dailyStream", plan);
        result.put("orderedWidgets", java.util.List.of("CONTINUE_LEARNING", "DAILY_STREAM", "CORE_VOCAB", "WORLD_MAP"));
        result.put("lastSyncedAt", Instant.now());
        return result;
    }

    @GetMapping("/learning/continue-context")
    public Map<String, Object> continueContext(HttpServletRequest request) {
        return continueContexts.getOrDefault(B1RequestUser.id(request), Map.of("hasContext", false));
    }

    @PutMapping("/learning/continue-context")
    public Map<String, Object> saveContinue(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        Map<String, Object> copy = new LinkedHashMap<>(body == null ? Map.of() : body);
        copy.put("hasContext", true);
        copy.put("status", "ACTIVE");
        copy.put("updatedAt", Instant.now());
        continueContexts.put(B1RequestUser.id(request), copy);
        return copy;
    }

    @PutMapping("/sync/checkpoints/{lessonId}")
    public ResponseEntity<Map<String, Object>> checkpoint(@PathVariable String lessonId, @RequestBody Map<String, Object> body,
                                                           HttpServletRequest request) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("accepted", true);
        response.put("lessonId", lessonId);
        response.put("userId", B1RequestUser.id(request));
        response.put("updatedAt", Instant.now());
        return ResponseEntity.ok(response);
    }
}
