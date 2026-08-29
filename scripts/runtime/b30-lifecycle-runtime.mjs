import { runProbe } from './b30-runtime-probe.mjs';

/** Runtime lifecycle probe for the platform-owned JWT session boundary. */
try {
  const evidence = await runProbe();
  console.log(JSON.stringify({
    ...evidence,
    lifecycle: [
      'account-password-login',
      'refresh-rotation',
      'refresh-replay-rejected',
      'logout-revokes-session',
      'wrong-password-rejected',
      'account-lockout',
      'jwks-public-rs256',
      'forged-authority-ignored',
    ],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    result: 'BLOCKED',
    message: error instanceof Error ? error.message : String(error),
    tokenMaterial: { tokenValuesEmitted: false, credentialsPersisted: false },
  }, null, 2));
  process.exitCode = 1;
}
