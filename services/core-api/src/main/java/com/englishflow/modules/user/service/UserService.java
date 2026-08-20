package com.englishflow.modules.user.service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.englishflow.modules.auth.B1AuthService;
import com.englishflow.modules.auth.DeviceSessionListResponse;
import com.englishflow.modules.auth.DeviceSessionView;
import com.englishflow.modules.user.UserModuleException;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.domain.AuditEvent;
import com.englishflow.modules.user.domain.LoginAlert;
import com.englishflow.modules.user.domain.NotificationPreferences;
import com.englishflow.modules.user.domain.PrivacySettings;
import com.englishflow.modules.user.domain.UserDeviceSession;
import com.englishflow.modules.user.domain.UserProfile;
import com.englishflow.modules.user.dto.DeviceListResponse;
import com.englishflow.modules.user.dto.DeviceResponse;
import com.englishflow.modules.user.dto.KickDevicesResponse;
import com.englishflow.modules.user.dto.LearningPreferencesResponse;
import com.englishflow.modules.user.dto.LoginAlertResponse;
import com.englishflow.modules.user.dto.NotificationPreferencesResponse;
import com.englishflow.modules.user.dto.PrivacySettingsResponse;
import com.englishflow.modules.user.dto.UpdateLearningPreferencesRequest;
import com.englishflow.modules.user.dto.UpdateNotificationPreferencesRequest;
import com.englishflow.modules.user.dto.UpdatePrivacySettingsRequest;
import com.englishflow.modules.user.dto.UpdateUserProfileRequest;
import com.englishflow.modules.user.dto.UserProfileResponse;
import com.englishflow.modules.user.repository.AuditEventRepository;
import com.englishflow.modules.user.repository.LoginAlertRepository;
import com.englishflow.modules.user.repository.NotificationPreferencesRepository;
import com.englishflow.modules.user.repository.PrivacySettingsRepository;
import com.englishflow.modules.user.repository.UserDeviceRepository;
import com.englishflow.modules.user.repository.UserProfileRepository;
import org.springframework.stereotype.Service;

@Service
public final class UserService {
    private final B1AuthService authService;
    private final UserProfileRepository profileRepository;
    private final PrivacySettingsRepository privacyRepository;
    private final NotificationPreferencesRepository notificationRepository;
    private final UserDeviceRepository deviceRepository;
    private final LoginAlertRepository alertRepository;
    private final AuditEventRepository auditRepository;
    private final Map<String, Instant> deletionRequests = new ConcurrentHashMap<>();

    public UserService(B1AuthService authService, UserProfileRepository profileRepository,
                       PrivacySettingsRepository privacyRepository,
                       NotificationPreferencesRepository notificationRepository,
                       UserDeviceRepository deviceRepository, LoginAlertRepository alertRepository,
                       AuditEventRepository auditRepository) {
        this.authService = authService;
        this.profileRepository = profileRepository;
        this.privacyRepository = privacyRepository;
        this.notificationRepository = notificationRepository;
        this.deviceRepository = deviceRepository;
        this.alertRepository = alertRepository;
        this.auditRepository = auditRepository;
    }

    public UserProfileResponse profile(UserRequestContext context) {
        return toProfile(profileRepository.find(context.tenantId(), context.userId()).orElseGet(() -> profileRepository.save(defaultProfile(context))));
    }

    public UserProfileResponse updateProfile(UserRequestContext context, UpdateUserProfileRequest request) {
        UserProfile current = profileRepository.find(context.tenantId(), context.userId()).orElseGet(() -> defaultProfile(context));
        String nickname = request == null || request.nickname() == null ? current.nickname() : request.nickname().trim();
        if (nickname.isBlank() || nickname.length() > 40) throw new UserModuleException("VALIDATION_ERROR", "nickname 格式不正确", 400, false);
        int quota = request == null || request.dailyQuotaMinutes() == null ? current.dailyQuotaMinutes() : request.dailyQuotaMinutes();
        validateQuota(quota);
        UserProfile next = new UserProfile(context.tenantId(), context.userId(), nickname,
                request == null || request.avatarAssetCode() == null ? current.avatarAssetCode() : request.avatarAssetCode(),
                request == null || request.accentPref() == null ? current.accentPref() : normalizeAccent(request.accentPref()),
                quota, current.soundEnabled(), current.autoPlayAudio(), current.playbackRate(), current.performanceTier(),
                current.version() + 1, Instant.now());
        return toProfile(profileRepository.save(next));
    }

    public LearningPreferencesResponse learningPreferences(UserRequestContext context) {
        UserProfile current = profileRepository.find(context.tenantId(), context.userId()).orElseGet(() -> defaultProfile(context));
        return new LearningPreferencesResponse(current.accentPref(), current.dailyQuotaMinutes(), current.soundEnabled(), current.autoPlayAudio(), current.playbackRate(), current.performanceTier(), current.version(), current.updatedAt());
    }

    public LearningPreferencesResponse updateLearningPreferences(UserRequestContext context, UpdateLearningPreferencesRequest request) {
        UserProfile current = profileRepository.find(context.tenantId(), context.userId()).orElseGet(() -> defaultProfile(context));
        int quota = request == null || request.dailyQuotaMinutes() == null ? current.dailyQuotaMinutes() : request.dailyQuotaMinutes();
        validateQuota(quota);
        UserProfile next = new UserProfile(context.tenantId(), context.userId(), current.nickname(), current.avatarAssetCode(),
                request == null || request.accentPref() == null ? current.accentPref() : normalizeAccent(request.accentPref()), quota,
                request == null || request.soundEnabled() == null ? current.soundEnabled() : request.soundEnabled(),
                request == null || request.autoPlayAudio() == null ? current.autoPlayAudio() : request.autoPlayAudio(),
                request == null || request.playbackRate() == null ? current.playbackRate() : request.playbackRate(),
                request == null || request.performanceTier() == null ? current.performanceTier() : request.performanceTier(), current.version() + 1, Instant.now());
        return learningPreferences(context, profileRepository.save(next));
    }

    private LearningPreferencesResponse learningPreferences(UserRequestContext context, UserProfile profile) {
        return new LearningPreferencesResponse(profile.accentPref(), profile.dailyQuotaMinutes(), profile.soundEnabled(), profile.autoPlayAudio(), profile.playbackRate(), profile.performanceTier(), profile.version(), profile.updatedAt());
    }

    public PrivacySettingsResponse privacy(UserRequestContext context) {
        PrivacySettings value = privacyRepository.find(context.tenantId(), context.userId()).orElseGet(() -> privacyRepository.save(defaultPrivacy(context)));
        return toPrivacy(value);
    }

    public PrivacySettingsResponse updatePrivacy(UserRequestContext context, UpdatePrivacySettingsRequest request) {
        PrivacySettings current = privacyRepository.find(context.tenantId(), context.userId()).orElseGet(() -> defaultPrivacy(context));
        String leaderboard = request == null || request.leaderboardVisibility() == null ? current.leaderboardVisibility() : request.leaderboardVisibility();
        String feed = request == null || request.feedVisibility() == null ? current.feedVisibility() : request.feedVisibility();
        if (!List.of("NICKNAME", "ANONYMOUS", "OPT_OUT").contains(leaderboard) || !List.of("PUBLIC", "ROOM_ONLY", "GROUP_ONLY", "HIDDEN").contains(feed)) {
            throw new UserModuleException("VALIDATION_ERROR", "隐私可见性选项不受支持", 400, false);
        }
        PrivacySettings next = new PrivacySettings(context.tenantId(), context.userId(), leaderboard, feed,
                request == null || request.showMinutes() == null ? current.showMinutes() : request.showMinutes(),
                request == null || request.showStreak() == null ? current.showStreak() : request.showStreak(),
                request == null || request.showCourse() == null ? current.showCourse() : request.showCourse(),
                request == null || request.showAssessment() == null ? current.showAssessment() : request.showAssessment(),
                current.version() + 1, Instant.now());
        return toPrivacy(privacyRepository.save(next));
    }

    public NotificationPreferencesResponse notifications(UserRequestContext context) {
        NotificationPreferences value = notificationRepository.find(context.tenantId(), context.userId()).orElseGet(() -> notificationRepository.save(defaultNotifications(context)));
        return toNotifications(value);
    }

    public NotificationPreferencesResponse updateNotifications(UserRequestContext context, UpdateNotificationPreferencesRequest request) {
        NotificationPreferences current = notificationRepository.find(context.tenantId(), context.userId()).orElseGet(() -> defaultNotifications(context));
        int limit = request == null || request.dailyPushLimit() == null ? current.dailyPushLimit() : request.dailyPushLimit();
        if (limit < 0 || limit > 50) throw new UserModuleException("VALIDATION_ERROR", "dailyPushLimit 必须在 0 到 50 之间", 400, false);
        NotificationPreferences next = new NotificationPreferences(context.tenantId(), context.userId(),
                request == null || request.categorySettings() == null ? current.categorySettings() : Map.copyOf(request.categorySettings()),
                request == null || request.pushEnabled() == null ? current.pushEnabled() : request.pushEnabled(),
                request == null || request.emailEnabled() == null ? current.emailEnabled() : request.emailEnabled(),
                request == null || request.nonEssentialSmsEnabled() == null ? current.nonEssentialSmsEnabled() : request.nonEssentialSmsEnabled(),
                request == null || request.dndStart() == null ? current.dndStart() : request.dndStart(),
                request == null || request.dndEnd() == null ? current.dndEnd() : request.dndEnd(),
                request == null || request.timezone() == null ? current.timezone() : request.timezone(), limit, current.version() + 1, Instant.now());
        return toNotifications(notificationRepository.save(next));
    }

    public DeviceListResponse devices(UserRequestContext context) {
        DeviceSessionListResponse sessions = authService.sessions(context.userId(), null);
        List<DeviceResponse> items = sessions.items().stream().map(view -> {
            UserDeviceSession saved = toDevice(context, view);
            deviceRepository.save(saved);
            boolean current = context.isCurrentDevice(view.deviceId());
            return new DeviceResponse(view.deviceId(), view.deviceType(), view.deviceName(), view.clientVersion(), view.lastActiveAt().toInstant(), view.regionCode(), current, view.status().name());
        }).toList();
        return new DeviceListResponse(items);
    }

    public KickDevicesResponse kickDevice(UserRequestContext context, String devicePublicId) {
        if (devicePublicId == null || devicePublicId.isBlank()) throw new UserModuleException("VALIDATION_ERROR", "devicePublicId 不能为空", 400, false);
        DeviceSessionView target = authService.sessions(context.userId(), null).items().stream().filter(item -> item.deviceId().equals(devicePublicId)).findFirst().orElseThrow(() -> new UserModuleException("NOT_FOUND", "设备不存在", 404, false));
        if (context.isCurrentDevice(devicePublicId)) throw new UserModuleException("CANNOT_KICK_CURRENT", "不能下线当前设备", 409, false);
        authService.revokeSession(context.userId(), target.sessionId(), context.devicePublicId() == null ? "" : currentSession(context), "USER_KICKED", Instant.now());
        appendAudit(context, "USER_DEVICE_KICK", devicePublicId, "SUCCESS");
        return new KickDevicesResponse(List.of(devicePublicId), 1, true);
    }

    public KickDevicesResponse kickOtherDevices(UserRequestContext context) {
        int count = authService.revokeAllOtherSessions(context.userId(), currentSession(context), Instant.now());
        appendAudit(context, "USER_DEVICE_KICK_ALL", "other_devices", "SUCCESS");
        return new KickDevicesResponse(List.of(), count, true);
    }

    public List<LoginAlertResponse> loginAlerts(UserRequestContext context) {
        return alertRepository.findOwned(context).stream().map(alert -> new LoginAlertResponse(alert.alertId(), alert.devicePublicId(), alert.deviceType(), alert.regionCode(), alert.previousRegionCode(), alert.reasonCode(), alert.occurredAt())).toList();
    }

    public Map<String, Object> requestExport(UserRequestContext context) {
        appendAudit(context, "PRIVACY_EXPORT_REQUESTED", "self", "ACCEPTED");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "PROCESSING");
        result.put("downloadUrl", null);
        result.put("requestedAt", Instant.now());
        return result;
    }

    public Map<String, Object> requestDeletion(UserRequestContext context) {
        Instant executeAt = Instant.now().plusSeconds(30L * 24 * 60 * 60);
        deletionRequests.put(key(context), executeAt);
        appendAudit(context, "PRIVACY_DELETE_REQUESTED", "self", "ACCEPTED");
        return Map.of("state", "DELETION_PENDING", "executeAt", executeAt);
    }

    public Map<String, Object> deletion(UserRequestContext context) {
        Instant executeAt = deletionRequests.get(key(context));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("state", executeAt == null ? "ACTIVE" : "DELETION_PENDING");
        result.put("executeAt", executeAt);
        return result;
    }

    public void cancelDeletion(UserRequestContext context) {
        deletionRequests.remove(key(context));
        appendAudit(context, "PRIVACY_DELETE_CANCELLED", "self", "SUCCESS");
    }

    private String currentSession(UserRequestContext context) {
        return authService.sessions(context.userId(), null).items().stream().filter(view -> context.isCurrentDevice(view.deviceId())).map(DeviceSessionView::sessionId).findFirst().orElse("");
    }

    private UserDeviceSession toDevice(UserRequestContext context, DeviceSessionView view) {
        UserDeviceSession.Status status = switch (view.status()) {
            case KICKED -> UserDeviceSession.Status.KICKED;
            case REVOKED -> UserDeviceSession.Status.REVOKED;
            case EXPIRED -> UserDeviceSession.Status.EXPIRED;
            default -> UserDeviceSession.Status.ACTIVE;
        };
        return new UserDeviceSession(context.tenantId(), context.userId(), view.sessionId(), view.deviceId(), B1AuthService.sha256(view.deviceId()), view.deviceType(), view.deviceName(), null, view.clientVersion(), B1AuthService.sha256(view.deviceId() + ":ua"), view.regionCode(), status, view.current(), view.lastActiveAt().toInstant(), null, null);
    }

    private void appendAudit(UserRequestContext context, String action, String resource, String result) {
        auditRepository.append(new AuditEvent("audit_" + UUID.randomUUID().toString().replace("-", ""), context.requestId(), context.tenantId(), B1AuthService.sha256(Long.toString(context.userId())), context.userId(), action, "USER", resource, result, null, Map.of(), Instant.now()));
    }

    private static UserProfile defaultProfile(UserRequestContext context) {
        return new UserProfile(context.tenantId(), context.userId(), "学习者", "", "US", 15, true, true, "1.0", "High", 1, Instant.now());
    }

    private static PrivacySettings defaultPrivacy(UserRequestContext context) {
        return new PrivacySettings(context.tenantId(), context.userId(), "NICKNAME", "ROOM_ONLY", true, true, false, false, 1, Instant.now());
    }

    private static NotificationPreferences defaultNotifications(UserRequestContext context) {
        return new NotificationPreferences(context.tenantId(), context.userId(), Map.of("LEARNING", true, "SOCIAL", false, "SYSTEM", true), true, false, false, "22:00", "07:00", "Asia/Shanghai", 3, 1, Instant.now());
    }

    private static UserProfileResponse toProfile(UserProfile value) {
        return new UserProfileResponse(value.nickname(), value.avatarAssetCode(), value.accentPref(), value.dailyQuotaMinutes(), value.soundEnabled(), value.autoPlayAudio(), value.playbackRate(), value.performanceTier(), value.version(), value.updatedAt());
    }

    private static PrivacySettingsResponse toPrivacy(PrivacySettings value) {
        return new PrivacySettingsResponse(value.leaderboardVisibility(), value.feedVisibility(), value.showMinutes(), value.showStreak(), value.showCourse(), value.showAssessment(), value.version(), value.updatedAt());
    }

    private static NotificationPreferencesResponse toNotifications(NotificationPreferences value) {
        return new NotificationPreferencesResponse(value.categorySettings(), value.pushEnabled(), value.emailEnabled(), value.nonEssentialSmsEnabled(), value.dndStart(), value.dndEnd(), value.timezone(), value.dailyPushLimit(), value.version(), value.updatedAt());
    }

    private static String normalizeAccent(String value) {
        if (!List.of("US", "UK", "NEUTRAL").contains(value.toUpperCase())) throw new UserModuleException("VALIDATION_ERROR", "accentPref 不受支持", 400, false);
        return value.toUpperCase();
    }

    private static void validateQuota(int quota) {
        if (!List.of(5, 15, 30, 45).contains(quota)) throw new UserModuleException("VALIDATION_ERROR", "dailyQuotaMinutes 不受支持", 400, false);
    }

    private static String key(UserRequestContext context) { return context.tenantId() + "|" + context.userId(); }
}
