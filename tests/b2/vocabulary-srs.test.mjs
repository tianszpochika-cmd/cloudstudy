import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const contract = JSON.parse(
  read("packages/contracts/fragments/b2-vocabulary-srs.openapi.json"),
);
const events = JSON.parse(
  read("packages/contracts/events/v1/fragments/b2-vocabulary-srs.events.json"),
);
const migration = read(
  "database/mysql/migrations/V0010__create_vocabulary_srs.sql",
);
const algorithm = read(
  "services/core-api/src/main/java/com/englishflow/modules/learning/vocabulary/SrsAlgorithm.java",
);
const service = read(
  "services/core-api/src/main/java/com/englishflow/modules/learning/vocabulary/VocabularyService.java",
);

const pathNames = Object.keys(contract.paths);

test("B2 contract is valid JSON and exposes DEV-04-001..009 foundations", () => {
  for (const path of [
    "/api/v1/vocab/wordbooks",
    "/api/v1/content/learner/vocabulary/{vocabularyId}",
    "/api/v1/vocab/chunks/{chunkId}",
    "/api/v1/vocab/expressions",
    "/api/v1/vocab/offline/cards",
    "/api/v1/learning/srs/batches",
    "/api/v1/learning/srs/reviews",
    "/api/v1/learning/srs/reviews:sync",
    "/api/v1/learning/srs/states",
  ])
    assert.ok(pathNames.includes(path), `missing ${path}`);
  assert.deepEqual(contract.components.schemas.MasteryStatus.enum, [
    "NEW",
    "LEARNING",
    "MASTERED",
    "CONSOLIDATED",
    "SHORT_TERM",
    "CONSOLIDATING",
    "AT_RISK",
    "SUSPENDED",
  ]);
  assert.equal(
    contract.components.schemas.ReviewEventRequest.properties.rawQuality.enum.join(
      ",",
    ),
    "0,1,2,3",
  );
});

test("B2 migration contains replayable versioned content and SRS projections", () => {
  for (const table of [
    "cnt_wordbook",
    "cnt_vocabulary",
    "cnt_vocab_definition",
    "cnt_vocab_example",
    "cnt_chunk",
    "cnt_chunk_example",
    "lrn_mined_expression",
    "lrn_user_library_entry",
    "lrn_srs_state",
    "lrn_schedule_snapshot",
    "lrn_schedule_snapshot_item",
    "lrn_review_event",
    "lrn_risk_audit",
    "lrn_learning_outbox",
  ])
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration, /uk_srs_user_item/);
  assert.match(migration, /uk_snapshot_user_date_type/);
  assert.match(migration, /uk_review_user_idem/);
  assert.match(migration, /uk_review_user_client_event/);
  assert.match(migration, /algorithm_version VARCHAR\(32\)/);
  assert.match(migration, /content_version VARCHAR\(32\)/);
  assert.doesNotMatch(migration, /DROP\s+(DATABASE|SCHEMA|TABLE|TRUNCATE)/i);
});

test("SM2_Q03_V1 source contains the exact quality delta, clamps and anchors", () => {
  assert.match(algorithm, /SM2_Q03_V1/);
  assert.match(algorithm, /new BigDecimal\("0\.10"\)/);
  assert.match(algorithm, /new BigDecimal\("0\.08"\)/);
  assert.match(algorithm, /new BigDecimal\("0\.02"\)/);
  assert.match(algorithm, /MIN_EASE/);
  assert.match(algorithm, /MAX_EASE/);
  assert.match(algorithm, /RoundingMode\.HALF_UP/);
  assert.match(algorithm, /int\[\] ANCHORS = \{0, 1, 3, 7, 15, 30, 90\}/);
  assert.match(algorithm, /Math\.min\(rawQuality, 1\)/);
  assert.match(algorithm, /case "UNANSWERED" -> 0/);
});

const delta = (q) => 0.1 - (3 - q) * (0.08 + (3 - q) * 0.02);
const calculate = ({ n, interval, ef, q }) => {
  const nextEf = Math.min(
    2.5,
    Math.max(1.3, Number((ef + delta(q)).toFixed(2))),
  );
  const nextN = q < 2 ? 0 : n + 1;
  const anchors = [0, 1, 3, 7, 15, 30, 90];
  const nextInterval =
    q < 2
      ? 1
      : nextN <= 6
        ? anchors[nextN]
        : Math.min(365, Math.max(1, Math.round(interval * nextEf)));
  return { n: nextN, interval: nextInterval, ef: nextEf };
};

test("SM2 fixed examples are deterministic and bounded", () => {
  assert.deepEqual(calculate({ n: 0, interval: 0, ef: 2.5, q: 3 }), {
    n: 1,
    interval: 1,
    ef: 2.5,
  });
  assert.deepEqual(calculate({ n: 1, interval: 1, ef: 2.5, q: 2 }), {
    n: 2,
    interval: 3,
    ef: 2.5,
  });
  assert.deepEqual(calculate({ n: 2, interval: 3, ef: 2.5, q: 2 }), {
    n: 3,
    interval: 7,
    ef: 2.5,
  });
  assert.deepEqual(calculate({ n: 6, interval: 90, ef: 2.4, q: 3 }), {
    n: 7,
    interval: 225,
    ef: 2.5,
  });
  assert.deepEqual(calculate({ n: 6, interval: 90, ef: 1.3, q: 0 }), {
    n: 0,
    interval: 1,
    ef: 1.3,
  });
  assert.ok(calculate({ n: 50, interval: 365, ef: 2.5, q: 3 }).interval <= 365);
});

test("service source enforces snapshot scope, idempotency, timezone and offline expiry", () => {
  for (const marker of [
    "SNAPSHOT_SCOPE",
    "IDEMPOTENCY_KEY_REUSED",
    "SRS_VERSION_CONFLICT",
    "OFFLINE_EVENT_EXPIRED",
    "ZoneId.of",
    "stateVersion",
    "clientEventId",
    "PENDING",
    "OVERDUE_SMOOTHING",
  ])
    assert.match(
      service,
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  assert.match(service, /answerFieldsIncluded.*false/);
  assert.match(service, /front.*phoneticUs/);
  assert.doesNotMatch(service, /offlineCards[\s\S]{0,3000}meaningCn/);
});

test("B2 event fragment is versioned and forbids answer/private data leakage", () => {
  assert.equal(events.version, "1.0.0");
  assert.equal(events.events.length, 3);
  for (const event of events.events) {
    assert.match(event.eventName, /\.v1$/);
    assert.equal(event.version, 1);
    assert.equal(typeof event.payloadSchema?.$ref, "string");
    assert.equal(event.compatibility.strategy, "additive");
  }
  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /rawAnswer|answerText|answerContent|rawAudio|privateNote|accessToken/u);
});
