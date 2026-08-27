import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const EVENT_NAMES = Object.freeze({
  submitted: 'assessment.attempt.submitted.v1',
  assessed: 'assessment.attempt.assessed.v1',
  mastery: 'learning.mastery.projected.v1',
  notification: 'notification.requested.v1',
  reward: 'gamification.xp.ledger_posted.v1',
  sagaStarted: 'workflow.assessment_learning.saga_started.v1',
  sagaCompensated: 'workflow.assessment_learning.saga_compensated.v1'
});

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value.trim();
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function envelope({ eventName, aggregateId, traceId, idempotencyKey, payload, sequence }) {
  return Object.freeze({
    eventId: `evt-${digest(`${traceId}:${eventName}:${aggregateId}:${sequence}`).slice(0, 24)}`,
    traceId,
    schemaVersion: '1',
    eventName,
    aggregateId,
    idempotencyKey,
    sequence,
    payload: Object.freeze({ ...payload })
  });
}

function ensureTrustedContext(context) {
  requiredText(context.subject, 'subject');
  requiredText(context.tenantId, 'tenantId');
  requiredText(context.traceId, 'traceId');
  if (context.tenantId !== 'platform') throw new Error('tenant must be server-derived platform');
}

export function createSyntheticJourney(seed = {}) {
  const context = {
    subject: seed.subject ?? 'principal-b17-demo',
    tenantId: seed.tenantId ?? 'platform',
    traceId: seed.traceId ?? 'trace-b17-demo'
  };
  ensureTrustedContext(context);
  const state = {
    learner: { profileId: `profile-${context.subject}`, goal: 'FOUNDATION', status: 'ACTIVE' },
    content: { contentId: 'content-b17-001', version: 3, status: 'PUBLISHED', rights: 'ACTIVE' },
    learning: { taskId: 'task-b17-001', contentVersion: 3, status: 'READY', masteryVersion: 0 },
    assessment: { attemptId: null, version: null, status: 'NOT_STARTED', scoreBucket: null },
    projection: { status: 'NOT_STARTED', version: 0 },
    notifications: [],
    rewards: [],
    events: [],
    idempotency: new Map(),
    seenAssessmentEvents: new Set(),
    nextSequence: 1
  };

  function emit(eventName, aggregateId, idempotencyKey, payload) {
    const event = envelope({
      eventName,
      aggregateId,
      traceId: context.traceId,
      idempotencyKey,
      payload,
      sequence: state.nextSequence++
    });
    state.events.push(event);
    return event;
  }

  function readToday({ requestedVersion = state.content.version, cacheVersion = requestedVersion } = {}) {
    if (state.content.status !== 'PUBLISHED' || state.content.rights !== 'ACTIVE') {
      return { status: 'DENIED', reason: 'CONTENT_RIGHTS_REVOKED' };
    }
    if (requestedVersion !== state.content.version) {
      return { status: 'EMPTY', reason: 'CONTENT_VERSION_UNAVAILABLE' };
    }
    if (cacheVersion !== state.content.version) {
      return { status: 'RECOVERY', reason: 'CACHE_INVALIDATED', expectedVersion: state.content.version };
    }
    return {
      status: 'READY',
      profileId: state.learner.profileId,
      goal: state.learner.goal,
      taskId: state.learning.taskId,
      contentId: state.content.contentId,
      contentVersion: state.content.version,
      rights: state.content.rights
    };
  }

  function submitAttempt({ attemptId, assessmentVersion = state.content.version, idempotencyKey, answerDigest, score }) {
    requiredText(attemptId, 'attemptId');
    requiredText(idempotencyKey, 'idempotencyKey');
    requiredText(answerDigest, 'answerDigest');
    if (score !== undefined || arguments.length > 1 && Object.prototype.hasOwnProperty.call(arguments[0], 'correctAnswer')) {
      throw new Error('client score or answer authority is forbidden');
    }
    if (assessmentVersion !== state.content.version || state.content.rights !== 'ACTIVE') {
      throw new Error('assessment snapshot is unavailable or unauthorized');
    }
    const fingerprint = digest(`${context.subject}:${attemptId}:${assessmentVersion}:${answerDigest}`);
    const previous = state.idempotency.get(idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error('idempotency key payload mismatch');
      return { ...previous.result, replayed: true };
    }

    state.assessment = { attemptId, version: assessmentVersion, status: 'COMPLETED', scoreBucket: 'PASS' };
    const submitted = emit(EVENT_NAMES.submitted, attemptId, idempotencyKey, {
      subject: context.subject,
      tenantId: context.tenantId,
      assessmentVersion,
      answerDigest,
      attemptStatus: 'SUBMITTED'
    });
    emit(EVENT_NAMES.sagaStarted, `saga-${attemptId}`, `saga:${attemptId}`, {
      rootEventId: submitted.eventId,
      source: 'assessment-service',
      target: 'learning-service'
    });
    const assessed = emit(EVENT_NAMES.assessed, attemptId, `assessed:${attemptId}`, {
      subject: context.subject,
      tenantId: context.tenantId,
      assessmentVersion,
      scoreBucket: 'PASS',
      mistakeCodes: []
    });
    state.projection = { status: 'PROJECTED', version: 1 };
    state.learning = { ...state.learning, status: 'COMPLETED', masteryVersion: 1 };
    const mastery = emit(EVENT_NAMES.mastery, state.learning.taskId, `mastery:${assessed.eventId}`, {
      subject: context.subject,
      tenantId: context.tenantId,
      sourceAssessmentEventId: assessed.eventId,
      itemId: state.learning.taskId,
      projectionVersion: 1,
      masterySignal: 'ADVANCED'
    });
    emit(EVENT_NAMES.notification, context.subject, `notification:${mastery.eventId}`, {
      subject: context.subject,
      tenantId: context.tenantId,
      sourceEventId: mastery.eventId,
      templateKey: 'learning.mastery.projected'
    });
    emit(EVENT_NAMES.reward, context.subject, `reward:${mastery.eventId}`, {
      subject: context.subject,
      tenantId: context.tenantId,
      sourceEventId: mastery.eventId,
      delta: 10,
      ledgerType: 'XP'
    });
    state.seenAssessmentEvents.add(assessed.eventId);
    state.notifications.push(mastery.eventId);
    state.rewards.push(mastery.eventId);
    const result = Object.freeze({ attemptId, assessmentVersion, scoreBucket: 'PASS', masteryVersion: 1, replayed: false });
    state.idempotency.set(idempotencyKey, { fingerprint, result });
    return result;
  }

  function replayAssessmentEvent(event) {
    if (!event || event.eventName !== EVENT_NAMES.assessed) throw new Error('unsupported assessment event');
    if (state.seenAssessmentEvents.has(event.eventId)) return { replayed: true, projectionVersion: state.projection.version };
    state.seenAssessmentEvents.add(event.eventId);
    state.projection = { status: 'PROJECTED', version: state.projection.version + 1 };
    return { replayed: false, projectionVersion: state.projection.version };
  }

  function compensate(reason = 'projection_timeout') {
    const safeReason = requiredText(reason, 'reason');
    state.projection = { status: 'COMPENSATION_REQUIRED', version: state.projection.version };
    emit(EVENT_NAMES.sagaCompensated, `saga-${state.assessment.attemptId ?? 'unknown'}`, `compensate:${safeReason}`, {
      reasonCode: safeReason,
      assessmentFactPreserved: true,
      learningProjectionAction: 'MARK_RECOVERY_REQUIRED'
    });
    return { status: state.projection.status, assessmentFactPreserved: true };
  }

  return Object.freeze({ context, state, readToday, submitAttempt, replayAssessmentEvent, compensate });
}

export function runSyntheticJourney() {
  const journey = createSyntheticJourney();
  const read = journey.readToday();
  const write = journey.submitAttempt({
    attemptId: 'attempt-b17-001',
    idempotencyKey: 'idem-b17-001',
    answerDigest: digest('synthetic-answer')
  });
  return {
    read,
    write,
    eventNames: journey.state.events.map((event) => event.eventName),
    eventCount: journey.state.events.length,
    state: {
      learning: journey.state.learning.status,
      assessment: journey.state.assessment.status,
      projection: journey.state.projection.status,
      notificationCount: journey.state.notifications.length,
      rewardCount: journey.state.rewards.length
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(runSyntheticJourney(), null, 2));
}
