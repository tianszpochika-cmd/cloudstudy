import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkEventCompatibility,
  isTelemetryEventCompatible,
} from '../../packages/telemetry/src/index.mjs';

test('same registered event version is compatible with itself', () => {
  const event = { eventName: 'learning.task.completed.v1', eventVersion: '1.0.0' };
  assert.equal(isTelemetryEventCompatible(event, event), true);
  assert.deepEqual(checkEventCompatibility(event, event), { compatible: true, reasons: [] });
});

test('changing event name or moving to an unregistered major version is incompatible', () => {
  const previous = { eventName: 'learning.task.completed.v1', eventVersion: '1.0.0' };
  const changedName = { eventName: 'practice.submitted.v1', eventVersion: '1.0.0' };
  const changedVersion = { eventName: 'learning.task.completed.v1', eventVersion: '2.0.0' };

  assert.equal(isTelemetryEventCompatible(previous, changedName), false);
  assert.equal(isTelemetryEventCompatible(previous, changedVersion), false);
  assert.ok(checkEventCompatibility(previous, changedVersion).reasons.includes('EVENT_VERSION_NOT_REGISTERED'));
});
