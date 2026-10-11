package com.englishflow.adminops.closure;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

class It7ClosureDeskRestartTest {

    @Test
    void aNewInstanceReadsTheSameDeskWithoutReplayingCommands() {
        MemoryClosureDeskStore store = new MemoryClosureDeskStore();
        It7ClosureStudio first = new It7ClosureStudio(store);
        It7ClosureStudio.Result filed = first.handle(staff(), "FILE", Map.of(
                "sourceRef", "source-restart", "title", "有来源的档案", "idempotencyKey", "file-restart"));
        assertThat(filed.status()).isEqualTo(200);
        first.handle(learner(), "TICKET_SUBMIT", Map.of("bodyHash", "hash-restart", "idempotencyKey", "ticket-restart"));
        first.handle(learner(), "EXPORT", Map.of("confirmed", true, "mark", "QUEUED", "idempotencyKey", "export-restart"));
        first.handle(staff(), "OUTBOX", Map.of("type", "closure.case.filed", "idempotencyKey", "outbox-restart"));
        String before = digest(first.handle(staff(), "BOARD", Map.of()));
        String learnerBefore = digest(first.handle(learner(), "BOARD", Map.of()));

        It7ClosureStudio second = new It7ClosureStudio(store);
        assertThat(second.caseCount()).isEqualTo(1);
        assertThat(digest(second.handle(staff(), "BOARD", Map.of()))).isEqualTo(before);
        assertThat(digest(second.handle(learner(), "BOARD", Map.of()))).isEqualTo(learnerBefore);
        assertThat(second.handle(staff(), "FILE", Map.of(
                "sourceRef", "source-restart", "title", "有来源的档案", "idempotencyKey", "file-restart"))
                .data().get("caseId")).isEqualTo(filed.data().get("caseId"));
        assertThat(second.caseCount()).isEqualTo(1);
        It7ClosureStudio.Result tickets = second.handle(learner(), "TICKETS", Map.of());
        assertThat(tickets.data().get("items")).asList().hasSize(1);
    }

    @Test
    void theOwnerDocumentRoundTripsThroughJsonForANewInstance() {
        JsonRoundTripStore store = new JsonRoundTripStore();
        It7ClosureStudio first = new It7ClosureStudio(store);
        It7ClosureStudio.Result filed = first.handle(staff(), "FILE", Map.of(
                "sourceRef", "source-json", "title", "落库", "idempotencyKey", "file-json"));
        String before = digest(first.handle(staff(), "BOARD", Map.of()));

        It7ClosureStudio second = new It7ClosureStudio(store);
        assertThat(digest(second.handle(staff(), "BOARD", Map.of()))).isEqualTo(before);
        assertThat(second.handle(staff(), "CASES", Map.of()).data().get("casesState")).isEqualTo("HAS_CASES");
        assertThat(second.handle(staff(), "FILE", Map.of(
                "sourceRef", "source-json", "title", "落库", "idempotencyKey", "file-json"))
                .data().get("caseId")).isEqualTo(filed.data().get("caseId"));
    }

    private static String digest(It7ClosureStudio.Result board) {
        Map<String, Object> data = board.data();
        Object privacy = data.get("privacy");
        String exportState = privacy instanceof Map<?, ?> map ? String.valueOf(map.get("exportState")) : "";
        Object cases = data.get("cases");
        int count = cases instanceof java.util.List<?> list ? list.size() : 0;
        return data.get("writeSwitch") + "|" + data.get("dispositionOpen") + "|" + data.get("casesState")
                + "|" + count + "|" + exportState + "|" + data.get("supportNumber");
    }

    private static It7ClosureStudio.Actor staff() {
        return new It7ClosureStudio.Actor("staff-1", true, Set.of("admin.risk.read", "admin.audit.read"));
    }

    private static It7ClosureStudio.Actor learner() {
        return new It7ClosureStudio.Actor("learner-1", true, Set.of("learner.home.read"));
    }

    private static final class JsonRoundTripStore implements ClosureDeskStore {
        private final ObjectMapper mapper = new ObjectMapper();
        private String json;

        @Override
        public ClosureDeskState load() {
            if (json == null) {
                return ClosureDeskState.empty();
            }
            return mapper.readValue(json, ClosureDeskState.class);
        }

        @Override
        public void save(ClosureDeskState state) {
            json = mapper.writeValueAsString(state);
        }
    }
}
