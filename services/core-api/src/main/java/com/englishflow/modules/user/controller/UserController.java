package com.englishflow.modules.user.controller;

import java.util.Map;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.UserContextResolver;
import com.englishflow.modules.user.dto.DeviceListResponse;
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
import com.englishflow.modules.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/")
public final class UserController {
    private final UserContextResolver contextResolver;
    private final UserService userService;

    public UserController(UserContextResolver contextResolver, UserService userService) {
        this.contextResolver = contextResolver;
        this.userService = userService;
    }

    @GetMapping("/user/profile")
    public UserProfileResponse profile(HttpServletRequest request) { return userService.profile(context(request)); }

    @PatchMapping("/user/profile")
    public UserProfileResponse updateProfile(@RequestBody UpdateUserProfileRequest body, HttpServletRequest request) { return userService.updateProfile(context(request), body); }

    @GetMapping("/user/learning-preferences")
    public LearningPreferencesResponse learning(HttpServletRequest request) { return userService.learningPreferences(context(request)); }

    @PatchMapping("/user/learning-preferences")
    public LearningPreferencesResponse updateLearning(@RequestBody UpdateLearningPreferencesRequest body, HttpServletRequest request) { return userService.updateLearningPreferences(context(request), body); }

    @GetMapping("/user/privacy")
    public PrivacySettingsResponse privacy(HttpServletRequest request) { return userService.privacy(context(request)); }

    @PatchMapping("/user/privacy")
    public PrivacySettingsResponse updatePrivacy(@RequestBody UpdatePrivacySettingsRequest body, HttpServletRequest request) { return userService.updatePrivacy(context(request), body); }

    @GetMapping("/user/notifications")
    public NotificationPreferencesResponse notifications(HttpServletRequest request) { return userService.notifications(context(request)); }

    @PatchMapping("/user/notifications")
    public NotificationPreferencesResponse updateNotifications(@RequestBody UpdateNotificationPreferencesRequest body, HttpServletRequest request) { return userService.updateNotifications(context(request), body); }

    @GetMapping("/user/devices")
    public DeviceListResponse devices(HttpServletRequest request) { return userService.devices(context(request)); }

    @PostMapping("/user/devices/{devicePublicId}/kick")
    public KickDevicesResponse kick(@PathVariable String devicePublicId, HttpServletRequest request) { return userService.kickDevice(context(request), devicePublicId); }

    @PostMapping("/user/devices/kickout")
    public KickDevicesResponse kickOthers(HttpServletRequest request) { return userService.kickOtherDevices(context(request)); }

    @GetMapping("/user/login-alerts")
    public java.util.List<LoginAlertResponse> loginAlerts(HttpServletRequest request) { return userService.loginAlerts(context(request)); }

    @PostMapping({"/privacy/export", "/user/data-export"})
    public Map<String, Object> export(HttpServletRequest request) { return userService.requestExport(context(request)); }

    @PostMapping({"/privacy/delete", "/user/deletion"})
    public Map<String, Object> delete(HttpServletRequest request) { return userService.requestDeletion(context(request)); }

    @GetMapping("/user/deletion")
    public Map<String, Object> deletion(HttpServletRequest request) { return userService.deletion(context(request)); }

    @DeleteMapping("/user/deletion")
    public Map<String, Object> cancelDeletion(HttpServletRequest request) { userService.cancelDeletion(context(request)); return userService.deletion(context(request)); }

    private UserRequestContext context(HttpServletRequest request) { return contextResolver.resolve(request); }
}
