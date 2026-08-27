package com.englishflow.gamification.adapter.jdbc;

import com.englishflow.gamification.domain.EventConsumptionReceipt;
import com.englishflow.gamification.domain.GamificationPersistenceException;
import com.englishflow.gamification.domain.LedgerEntry;
import com.englishflow.gamification.domain.RewardClaimReceipt;
import com.englishflow.gamification.domain.RewardGrant;
import com.englishflow.gamification.domain.SeasonFact;
import com.englishflow.gamification.domain.UserFacts;
import com.englishflow.gamification.port.GamificationFactStore;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * Owner-schema adapter for the gamification aggregate.
 *
 * <p>The application service remains responsible for the domain state machine. This adapter only
 * rehydrates and appends facts in {@code gamification_service}; it never reaches into learner,
 * IAM, content or assessment schemas.</p>
 */
public final class JdbcGamificationFactStore implements GamificationFactStore {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper mapper;
    private final Map<String, Object> subjectLocks = new ConcurrentHashMap<>();

    public JdbcGamificationFactStore(JdbcTemplate jdbc, TransactionTemplate transactions,
            ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    public <T> T inUserTransaction(String subjectId, Function<UserFacts, T> work) {
        if (subjectId == null || subjectId.isBlank()) {
            throw GamificationPersistenceException.localRealUnavailable("subject id");
        }
        Objects.requireNonNull(work, "work");
        Object lock = subjectLocks.computeIfAbsent(subjectId, ignored -> new Object());
        synchronized (lock) {
            return transactions.execute(status -> {
                UserFacts facts = load(subjectId);
                T result = work.apply(facts);
                persist(facts);
                return result;
            });
        }
    }

    private UserFacts load(String subjectId) {
        UserFacts facts = new UserFacts(subjectId);
        jdbc.query("SELECT ledger_id, source_event_id, delta, balance_after, created_at "
                        + "FROM xp_ledger WHERE subject_id = ? ORDER BY created_at, ledger_id",
                (rs, row) -> ledger(rs, "XP"), subjectId)
                .forEach(entry -> facts.appendXp(entry.entryId(), entry.delta(), entry.sourceEventId(),
                        entry.reasonCode(), entry.traceId(), entry.ruleVersion(), entry.occurredAt(),
                        entry.postedAt()));
        jdbc.query("SELECT ledger_id, source_event_id, delta, balance_after, created_at "
                        + "FROM coin_ledger WHERE subject_id = ? ORDER BY created_at, ledger_id",
                (rs, row) -> ledger(rs, "COIN"), subjectId)
                .forEach(entry -> facts.appendCoins(entry.entryId(), entry.delta(), entry.sourceEventId(),
                        entry.reasonCode(), entry.traceId(), entry.ruleVersion(), entry.occurredAt(),
                        entry.postedAt()));
        jdbc.query("SELECT active_date FROM gamification_active_date WHERE subject_id = ? "
                        + "ORDER BY active_date", (rs, row) -> rs.getDate("active_date").toLocalDate(), subjectId)
                .forEach(facts::addActiveDate);
        jdbc.query("SELECT season_id, event_id, subject_id, points, rule_version, occurred_at, recorded_at "
                        + "FROM gamification_season_fact WHERE subject_id = ? ORDER BY occurred_at, event_id",
                this::seasonFact, subjectId).forEach(facts::addSeasonFact);
        jdbc.query("SELECT grant_id, source_event_id, subject_id, reward_key, probability_version, "
                        + "claim_status, outcome_code, claimed_at, created_at FROM reward_grant "
                        + "WHERE subject_id = ? ORDER BY created_at, grant_id", this::rewardGrant, subjectId)
                .forEach(facts::addReward);
        jdbc.query("SELECT event_id, fingerprint, response_json FROM gamification_event_record "
                        + "WHERE subject_id = ? ORDER BY created_at, event_id", (rs, row) -> {
                    EventConsumptionReceipt receipt = decode(rs.getString("response_json"),
                            EventConsumptionReceipt.class);
                    return new EventRow(rs.getString("event_id"), rs.getString("fingerprint"), receipt);
                }, subjectId).forEach(item -> facts.recordEvent(item.eventId(), item.fingerprint(), item.receipt()));
        jdbc.query("SELECT idempotency_key, fingerprint, response_type, response_json "
                        + "FROM gamification_idempotency_record WHERE subject_id = ? ORDER BY id",
                (rs, row) -> new IdempotencyRow(rs.getString("idempotency_key"),
                        rs.getString("fingerprint"), rs.getString("response_type"),
                        rs.getString("response_json")), subjectId)
                .forEach(item -> facts.recordIdempotency(item.key(), item.fingerprint(),
                        decodeResponse(item.responseType(), item.responseJson())));
        facts.assertConservation();
        return facts;
    }

    private void persist(UserFacts facts) {
        for (LedgerEntry entry : facts.xpLedger()) {
            jdbc.update("INSERT IGNORE INTO xp_ledger "
                            + "(ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at) "
                            + "VALUES (?, ?, 'platform', ?, ?, ?, ?)", entry.entryId(), facts.subjectId(),
                    entry.sourceEventId(), entry.delta(), entry.balanceAfter(), timestamp(entry.postedAt()));
        }
        for (LedgerEntry entry : facts.coinLedger()) {
            jdbc.update("INSERT IGNORE INTO coin_ledger "
                            + "(ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at) "
                            + "VALUES (?, ?, 'platform', ?, ?, ?, ?)", entry.entryId(), facts.subjectId(),
                    entry.sourceEventId(), entry.delta(), entry.balanceAfter(), timestamp(entry.postedAt()));
        }
        for (LocalDate date : facts.activeDates()) {
            jdbc.update("INSERT IGNORE INTO gamification_active_date "
                            + "(subject_id, active_date, created_at) VALUES (?, ?, UTC_TIMESTAMP(6))",
                    facts.subjectId(), date);
        }
        for (SeasonFact fact : facts.seasonFacts()) {
            jdbc.update("INSERT IGNORE INTO gamification_season_fact "
                            + "(season_id, event_id, subject_id, points, rule_version, occurred_at, recorded_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?)", fact.seasonId(), fact.eventId(), facts.subjectId(),
                    fact.points(), fact.ruleVersion(), timestamp(fact.occurredAt()), timestamp(fact.recordedAt()));
        }
        for (Map.Entry<String, UserFacts.EventRecord> entry : facts.events().entrySet()) {
            jdbc.update("INSERT INTO gamification_event_record "
                            + "(event_id, subject_id, fingerprint, response_json, created_at) "
                            + "VALUES (?, ?, ?, ?, UTC_TIMESTAMP(6)) "
                            + "ON DUPLICATE KEY UPDATE fingerprint = VALUES(fingerprint), response_json = VALUES(response_json)",
                    entry.getKey(), facts.subjectId(), entry.getValue().fingerprint(),
                    encode(entry.getValue().receipt()));
        }
        for (Map.Entry<String, UserFacts.IdempotencyRecord> entry : facts.idempotencies().entrySet()) {
            Object response = entry.getValue().response();
            jdbc.update("INSERT INTO gamification_idempotency_record "
                            + "(subject_id, idempotency_key, fingerprint, response_type, response_json, created_at) "
                            + "VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(6)) "
                            + "ON DUPLICATE KEY UPDATE fingerprint = VALUES(fingerprint), response_type = VALUES(response_type), response_json = VALUES(response_json)",
                    facts.subjectId(), entry.getKey(), entry.getValue().fingerprint(),
                    response.getClass().getName(), encode(response));
        }
        for (var grant : facts.rewardViews()) {
            jdbc.update("INSERT INTO reward_grant "
                            + "(grant_id, subject_id, tenant_id, reward_key, probability_version, claim_status, "
                            + "idempotency_key, created_at, source_event_id, outcome_code, claimed_at) "
                            + "VALUES (?, ?, 'platform', ?, ?, ?, ?, ?, ?, ?, ?) "
                            + "ON DUPLICATE KEY UPDATE claim_status = VALUES(claim_status), outcome_code = VALUES(outcome_code), "
                            + "claimed_at = VALUES(claimed_at), source_event_id = VALUES(source_event_id)",
                    grant.grantId(), facts.subjectId(), grant.rewardCode(), grant.probabilityVersion(),
                    grant.status(), "grant:" + grant.grantId(), timestamp(grant.grantedAt()),
                    sourceEventId(facts, grant.grantId()), grant.outcomeCode(), timestamp(grant.claimedAt()));
        }
    }

    private String sourceEventId(UserFacts facts, String grantId) {
        return facts.reward(grantId).map(RewardGrant::sourceEventId).orElse(null);
    }

    private LedgerEntry ledger(ResultSet rs, String currency) throws SQLException {
        Instant created = rs.getTimestamp("created_at").toInstant();
        return new LedgerEntry(rs.getString("ledger_id"), currency, rs.getLong("delta"),
                rs.getLong("balance_after"), rs.getString("source_event_id"), "PERSISTED",
                "", "GAMIFICATION_RULES_2026_08_20_01", created, created);
    }

    private SeasonFact seasonFact(ResultSet rs, int row) throws SQLException {
        return new SeasonFact(rs.getString("season_id"), rs.getString("event_id"),
                rs.getString("subject_id"), rs.getLong("points"), rs.getString("rule_version"),
                rs.getTimestamp("occurred_at").toInstant(), rs.getTimestamp("recorded_at").toInstant());
    }

    private RewardGrant rewardGrant(ResultSet rs, int row) throws SQLException {
        RewardGrant grant = new RewardGrant(rs.getString("grant_id"), rs.getString("source_event_id"),
                rs.getString("subject_id"), rs.getString("reward_key"),
                rs.getString("probability_version"), rs.getTimestamp("created_at").toInstant());
        String outcome = rs.getString("outcome_code");
        Timestamp claimedAt = rs.getTimestamp("claimed_at");
        if (outcome != null && claimedAt != null) {
            grant.restoreClaim(outcome, claimedAt.toInstant());
        }
        return grant;
    }

    private Object decodeResponse(String responseType, String responseJson) {
        if (responseType.endsWith("EventConsumptionReceipt")) {
            return decode(responseJson, EventConsumptionReceipt.class);
        }
        if (responseType.endsWith("RewardClaimReceipt")) {
            return decode(responseJson, RewardClaimReceipt.class);
        }
        throw new GamificationPersistenceException("unsupported persisted response type: " + responseType);
    }

    private <T> T decode(String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (JacksonException exception) {
            throw new GamificationPersistenceException("gamification persisted response could not be decoded", exception);
        }
    }

    private String encode(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw new GamificationPersistenceException("gamification response could not be persisted", exception);
        }
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private record EventRow(String eventId, String fingerprint, EventConsumptionReceipt receipt) {
    }

    private record IdempotencyRow(String key, String fingerprint, String responseType, String responseJson) {
    }
}
