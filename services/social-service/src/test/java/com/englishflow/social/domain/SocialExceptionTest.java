package com.englishflow.social.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Stable, transport-neutral social boundary error envelope. Codes and HTTP statuses must stay
 * fixed because controllers map them directly onto responses.
 */
class SocialExceptionTest {

    @Test
    void unauthorizedFactoryIsFixed401NonRetryable() {
        SocialException e = SocialException.unauthorized();

        assertThat(e.code()).isEqualTo("UNAUTHENTICATED");
        assertThat(e.status()).isEqualTo(401);
        assertThat(e.retryable()).isFalse();
    }

    @Test
    void forbiddenFactoryIs403NonRetryable() {
        SocialException e = SocialException.forbidden("SOCIAL_OWNER_FORBIDDEN", "no");

        assertThat(e.code()).isEqualTo("SOCIAL_OWNER_FORBIDDEN");
        assertThat(e.status()).isEqualTo(403);
        assertThat(e.retryable()).isFalse();
    }

    @Test
    void notFoundFactoryIs404() {
        SocialException e = SocialException.notFound("SOCIAL_ROOM_NOT_FOUND", "missing");

        assertThat(e.status()).isEqualTo(404);
    }

    @Test
    void conflictFactoryCarriesRetryableFlag() {
        assertThat(SocialException.conflict("SOCIAL_VERSION_CONFLICT", "stale", true).retryable()).isTrue();
        assertThat(SocialException.conflict("SOCIAL_STATE_CONFLICT", "bad state", false).retryable()).isFalse();
        assertThat(SocialException.conflict("SOCIAL_VERSION_CONFLICT", "stale", true).status()).isEqualTo(409);
    }

    @Test
    void invalidFactoryIs400UnprocessableIs422() {
        assertThat(SocialException.invalid("SOCIAL_INVALID", "bad").status()).isEqualTo(400);
        assertThat(SocialException.unprocessable("SOCIAL_RULE_VIOLATION", "bad").status()).isEqualTo(422);
    }

    @Test
    void codeAndMessageAreRequired() {
        assertThatThrownBy(() -> new SocialException(null, "msg", 400, false))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new SocialException("CODE", null, 400, false))
                .isInstanceOf(NullPointerException.class);
    }

    // --- the domain-flavoured twin, used by SocialService ---

    @Test
    void domainExceptionFactoriesMirrorStatuses() {
        assertThat(SocialDomainException.unauthenticated().status()).isEqualTo(401);
        assertThat(SocialDomainException.forbidden("SOCIAL_TENANT_FORBIDDEN", "no").status()).isEqualTo(403);
        assertThat(SocialDomainException.notFound("SOCIAL_ROOM_NOT_FOUND", "missing").status()).isEqualTo(404);
        assertThat(SocialDomainException.invalid("SOCIAL_INVALID", "bad").status()).isEqualTo(400);
        assertThat(SocialDomainException.unprocessable("SOCIAL_RULE_VIOLATION", "bad").status()).isEqualTo(422);
    }

    @Test
    void domainExceptionConflictCarriesRetryableFlag() {
        SocialDomainException retryable = SocialDomainException.conflict("SOCIAL_VERSION_CONFLICT", "stale", true);
        SocialDomainException terminal = SocialDomainException.conflict("SOCIAL_STATE_CONFLICT", "bad", false);

        assertThat(retryable.status()).isEqualTo(409);
        assertThat(retryable.retryable()).isTrue();
        assertThat(terminal.retryable()).isFalse();
    }

    @Test
    void domainExceptionExposesCodeAndMessage() {
        SocialDomainException e = SocialDomainException.invalid("SOCIAL_INVALID", "payload is malformed");

        assertThat(e.code()).isEqualTo("SOCIAL_INVALID");
        assertThat(e.getMessage()).isEqualTo("payload is malformed");
    }
}
