package com.englishflow.adminops.web;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.support.TicketPriority;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SupportControllerFailClosedTest {

    @Test
    void hashOnlyCreateWithoutAttachmentsStillFailClosed() {
        SupportController controller = new SupportController(null);
        B13SupportTicketCreateRequest hashOnly = new B13SupportTicketCreateRequest(
                "TECHNICAL", "resource-1",
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                TicketPriority.NORMAL, List.of());
        unavailable(() -> controller.create(hashOnly, "support-test-12345678", null));
    }

    @Test
    void nullBodyCreateFailClosed() {
        SupportController controller = new SupportController(null);
        unavailable(() -> controller.create(null, "support-test-12345678", null));
    }

    private static void unavailable(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(AdminOpsException.class, error -> {
            assertThat(error.code()).isEqualTo("SUPPORT_CONTENT_REFERENCE_UNAVAILABLE");
            assertThat(error.status()).isEqualTo(503);
        });
    }
}
