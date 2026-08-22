package com.englishflow.social;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import com.englishflow.social.domain.SocialService;
import com.englishflow.social.security.SocialPep;
import com.englishflow.social.security.SocialPrincipal;
import com.englishflow.social.security.SocialAuthenticationToken;
import com.englishflow.social.web.ApiExceptionHandler;
import com.englishflow.social.web.SocialController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SocialHttpBoundarySmokeTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        SocialService service = new SocialService(Clock.fixed(
                Instant.parse("2026-08-22T00:00:00Z"), ZoneOffset.UTC));
        mockMvc = MockMvcBuilders.standaloneSetup(new SocialController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void unauthenticatedRoomQueryIs401AndPermissionDenialIs403() throws Exception {
        mockMvc.perform(get("/api/v1/social/rooms"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code", is("UNAUTHENTICATED")));

        authenticate(SocialPrincipal.phaseOne("read-only", "platform", Set.of(SocialPep.ROOM_READ)));
        mockMvc.perform(post("/api/v1/social/rooms/ROOM-001/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "http-permission-001")
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code", is("SOCIAL_PERMISSION_DENIED")));
    }

    @Test
    void joinAndInteractionRejectFreeTextAtHttpBoundary() throws Exception {
        authenticate(SocialPrincipal.phaseOne("http-alice"));
        mockMvc.perform(post("/api/v1/social/rooms/ROOM-001/join")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "http-join-001")
                        .content("{\"preferredSeatIndex\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roomId", is("ROOM-001")));

        mockMvc.perform(post("/api/v1/social/rooms/ROOM-001/interactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "http-interaction-001")
                        .content("{\"presetCode\":\"CHEER_UP\",\"clientEventId\":\"http-event-001\",\"text\":\"hello\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code", is("SOC_TEXT_NOT_ALLOWED")));
    }

    private static void authenticate(SocialPrincipal principal) {
        SecurityContextHolder.getContext().setAuthentication(
                SocialAuthenticationToken.fromVerifiedPrincipal(principal));
    }
}
