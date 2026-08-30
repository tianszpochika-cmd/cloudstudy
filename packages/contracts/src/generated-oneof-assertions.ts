import type {
  B10ContentRecovery,
  B10ContentVersionPin,
  B9ContentCode,
  B9ContentCommandRequest,
  B9ContentDraftInput,
  B9ExpectedStateVersion,
  B9PublishScheduleInput,
  B9ScheduledPublishTaskId,
} from '../generated/openapi';

declare const contentCode: B9ContentCode;
declare const expectedStateVersion: B9ExpectedStateVersion;
declare const content: B9ContentDraftInput;
declare const schedule: B9PublishScheduleInput;
declare const scheduledPublishTaskId: B9ScheduledPublishTaskId;

// Compile-time regression guards for all eleven B9 command discriminators.
// @ts-expect-error CREATE_DRAFT must carry content.
const invalidCreate: B9ContentCommandRequest = { command: 'CREATE_DRAFT', contentCode, expectedStateVersion };
// @ts-expect-error SAVE_DRAFT must carry content.
const invalidSave: B9ContentCommandRequest = { command: 'SAVE_DRAFT', contentCode, expectedStateVersion };
// @ts-expect-error REVIEW_FIRST must carry reviewDecision.
const invalidFirstReview: B9ContentCommandRequest = { command: 'REVIEW_FIRST', contentCode, expectedStateVersion };
// @ts-expect-error REVIEW_FINAL must carry reviewDecision.
const invalidFinalReview: B9ContentCommandRequest = { command: 'REVIEW_FINAL', contentCode, expectedStateVersion };
// @ts-expect-error PUBLISH must carry targetVersionNumber.
const invalidPublish: B9ContentCommandRequest = { command: 'PUBLISH', contentCode, expectedStateVersion };
// @ts-expect-error PUBLISH cannot carry draft content.
const invalidPublishContent: B9ContentCommandRequest = {
  command: 'PUBLISH', contentCode, expectedStateVersion, targetVersionNumber: 1, content,
};
// @ts-expect-error SCHEDULE_PUBLISH must carry schedule.
const invalidSchedule: B9ContentCommandRequest = { command: 'SCHEDULE_PUBLISH', contentCode, expectedStateVersion };
// @ts-expect-error CANCEL_SCHEDULED_PUBLISH must carry scheduledPublishTaskId.
const invalidCancel: B9ContentCommandRequest = { command: 'CANCEL_SCHEDULED_PUBLISH', contentCode, expectedStateVersion };
// @ts-expect-error UNPUBLISH must carry reasonCode.
const invalidUnpublish: B9ContentCommandRequest = { command: 'UNPUBLISH', contentCode, expectedStateVersion };
// @ts-expect-error ROLLBACK must carry targetVersionNumber and reasonCode.
const invalidRollback: B9ContentCommandRequest = { command: 'ROLLBACK', contentCode, expectedStateVersion };

const validCommands: B9ContentCommandRequest[] = [
  { command: 'CREATE_DRAFT', contentCode, expectedStateVersion, content },
  { command: 'SAVE_DRAFT', contentCode, expectedStateVersion, content },
  { command: 'VALIDATE_DRAFT', contentCode, expectedStateVersion },
  { command: 'SUBMIT_REVIEW', contentCode, expectedStateVersion },
  { command: 'REVIEW_FIRST', contentCode, expectedStateVersion, reviewDecision: 'APPROVED' },
  { command: 'REVIEW_FINAL', contentCode, expectedStateVersion, reviewDecision: 'APPROVED' },
  { command: 'PUBLISH', contentCode, expectedStateVersion, targetVersionNumber: 1 },
  { command: 'SCHEDULE_PUBLISH', contentCode, expectedStateVersion, schedule },
  { command: 'CANCEL_SCHEDULED_PUBLISH', contentCode, expectedStateVersion, scheduledPublishTaskId },
  { command: 'UNPUBLISH', contentCode, expectedStateVersion, reasonCode: 'rights-change' },
  { command: 'ROLLBACK', contentCode, expectedStateVersion, targetVersionNumber: 1, reasonCode: 'rollback' },
];

declare const recoveredPinBase: Omit<
  B10ContentVersionPin,
  'pinStatus' | 'recoveryReasonCode' | 'fallbackVersionId' | 'fallbackContentEpoch' | 'fallbackSnapshotId' | 'fallbackSnapshotHash'
>;
// @ts-expect-error RECOVERED must carry the complete fallback identity.
const invalidRecoveredPin: B10ContentVersionPin = {
  ...recoveredPinBase,
  pinStatus: 'RECOVERED',
  recoveryReasonCode: 'CONTENT_UNPUBLISHED',
};
// @ts-expect-error UNAVAILABLE cannot carry a fallback version.
const invalidUnavailablePin: B10ContentVersionPin = {
  ...recoveredPinBase,
  pinStatus: 'UNAVAILABLE',
  recoveryReasonCode: 'RIGHTS_REMOVED',
  fallbackVersionId: 1,
};

declare const recoveryBase: Omit<
  B10ContentRecovery,
  'resolution' | 'resolvedVersionId' | 'resolvedSnapshotId' | 'recoveryReasonCode'
>;
// @ts-expect-error EXACT_PIN must bind both the resolved version and snapshot.
const invalidExactRecovery: B10ContentRecovery = { ...recoveryBase, resolution: 'EXACT_PIN' };
// @ts-expect-error UNAVAILABLE must carry a governed recovery reason.
const invalidUnavailableRecovery: B10ContentRecovery = { ...recoveryBase, resolution: 'UNAVAILABLE' };
// @ts-expect-error UNAVAILABLE cannot carry a resolved version.
const invalidUnavailableResolvedRecovery: B10ContentRecovery = {
  ...recoveryBase,
  resolution: 'UNAVAILABLE',
  recoveryReasonCode: 'RIGHTS_REMOVED',
  resolvedVersionId: null,
};

void [
  invalidCreate,
  invalidSave,
  invalidFirstReview,
  invalidFinalReview,
  invalidPublish,
  invalidPublishContent,
  invalidSchedule,
  invalidCancel,
  invalidUnpublish,
  invalidRollback,
  invalidRecoveredPin,
  invalidUnavailablePin,
  invalidExactRecovery,
  invalidUnavailableRecovery,
  invalidUnavailableResolvedRecovery,
  validCommands,
];
