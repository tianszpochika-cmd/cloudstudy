package com.englishflow.adminops.web;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.support.SupportAction;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SupportControllerFailClosedTest {

    @Test
    void legacyHashOnlyCreateAndTransitionsCannotReportSuccess() {
        SupportController controller = new SupportController(null);
        unavailable(() -> controller.create(null, "support-test-12345678", null));
        unavailable(() -> controller.prepareTransition("ticket-1", SupportAction.RESOLVE, null));
        unavailable(() -> controller.transition("ticket-1", SupportAction.RESOLVE,
                "support-test-12345678", null, null));
    }

    private static void unavailable(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(AdminOpsException.class, error -> {
            assertThat(error.code()).isEqualTo("SUPPORT_CONTENT_REFERENCE_UNAVAILABLE");
            assertThat(error.status()).isEqualTo(503);
        });
    }
}
