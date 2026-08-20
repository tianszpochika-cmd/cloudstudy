package com.englishflow.modules.auth;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public final class AuthController {

    private final B1AuthService authService;

    public AuthController(B1AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/sms/send-code")
    public ResponseEntity<AuthApiResponse<SmsCodeResponse>> sendCode(@RequestBody SmsCodeRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(ok(http, authService.issueSmsCode(request, Instant.now())));
    }

    @PostMapping("/login/phone")
    public ResponseEntity<AuthApiResponse<AuthTokenResponse>> login(@RequestBody PhoneLoginRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(ok(http, authService.login(request, Instant.now())));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthApiResponse<AuthTokenResponse>> register(@RequestBody RegisterRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(ok(http, authService.register(request, Instant.now())));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthApiResponse<AuthTokenResponse>> refresh(@RequestBody TokenRefreshRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(ok(http, authService.refresh(request, Instant.now())));
    }

    @PostMapping("/logout")
    public ResponseEntity<AuthApiResponse<LogoutResponse>> logout(@RequestBody(required = false) LogoutRequest request,
                                                                   HttpServletRequest http) {
        UserRequestContext context = context(http);
        authService.revokeCurrent(context.userId(), currentSession(http), request != null && request.revokeAllDevices(), Instant.now());
        return ResponseEntity.ok(ok(http, new LogoutResponse(request != null && request.revokeAllDevices() ? 1 : 1)));
    }

    @GetMapping("/sessions")
    public ResponseEntity<AuthApiResponse<DeviceSessionListResponse>> sessions(HttpServletRequest http) {
        UserRequestContext context = context(http);
        return ResponseEntity.ok(ok(http, authService.sessions(context.userId(), currentSession(http))));
    }

    @PostMapping("/sessions/{sessionId}/revoke")
    public ResponseEntity<AuthApiResponse<LogoutResponse>> revoke(@PathVariable String sessionId, HttpServletRequest http) {
        UserRequestContext context = context(http);
        authService.revokeSession(context.userId(), sessionId, currentSession(http), "USER_REVOKED", Instant.now());
        return ResponseEntity.ok(ok(http, new LogoutResponse(1)));
    }

    private UserRequestContext context(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context;
        throw AuthException.required();
    }

    private String currentSession(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) throw AuthException.required();
        return authService.resolveAccessToken(authorization.substring(7).trim(), Instant.now()).sessionId();
    }

    private static <T> AuthApiResponse<T> ok(HttpServletRequest request, T data) {
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || !requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            requestId = "req_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        String traceId = request.getHeader("X-Trace-Id");
        if (traceId == null || !traceId.matches("[a-f0-9]{32}")) traceId = UUID.randomUUID().toString().replace("-", "") + "00000000";
        return new AuthApiResponse<>(requestId, data,
                new AuthApiResponse.ApiMeta("v1", "1.0.0", OffsetDateTime.now(ZoneOffset.UTC), traceId));
    }
}
