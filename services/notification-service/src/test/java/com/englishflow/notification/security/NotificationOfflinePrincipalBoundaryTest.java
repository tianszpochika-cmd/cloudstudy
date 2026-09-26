package com.englishflow.notification.security;

import com.englishflow.notification.adapter.http.NotificationPrincipalResolver;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NotificationOfflinePrincipalBoundaryTest {

    private final NotificationPrincipalResolver principals = new NotificationPrincipalResolver();
    private final NotificationAccessPolicy access = new NotificationAccessPolicy();

    @Test
    void offlineManifestReadRequiresSignedDeviceClaim() {
        NotificationDomainException failure = assertThrows(NotificationDomainException.class,
                () -> principals.require(token("notification.read", false)));
        assertEquals(NotificationDomainException.Code.UNAUTHORIZED, failure.code());
    }

    @Test
    void offlineManifestReadRequiresGrantedNotificationPermission() {
        var context = principals.require(token("iam.self.read", true));
        NotificationDomainException failure = assertThrows(NotificationDomainException.class,
                () -> access.requirePermission(context, "notification.read"));
        assertEquals(NotificationDomainException.Code.FORBIDDEN, failure.code());
    }

    private static JwtAuthenticationToken token(String permission, boolean device) {
        var jwt = Jwt.withTokenValue("test-only-jwt")
                .header("alg", "RS256")
                .subject("test-subject")
                .claim("tenant_id", "platform")
                .claim("permissions", List.of(permission));
        if (device) jwt.claim("device_id", "test-device");
        return new JwtAuthenticationToken(jwt.build(),
                List.of(new SimpleGrantedAuthority("PERM_" + permission)));
    }
}
