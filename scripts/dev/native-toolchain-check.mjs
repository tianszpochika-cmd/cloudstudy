import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2).filter(arg => arg !== '--');
if (args.some(arg => !['--ios', '--android'].includes(arg)) || (args.includes('--ios') && args.includes('--android'))) {
  console.error('Usage: pnpm native:check [-- --ios | -- --android]');
  process.exit(2);
}
const requested = process.argv.includes('--ios') ? 'ios' : process.argv.includes('--android') ? 'android' : 'all';
const checks = [];
function probe(name, command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, windowsHide: true, timeout: 30000 });
  checks.push({ name, passed: result.status === 0, exitCode: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() || result.error?.message
      || (result.status === 0 ? 'OK' : 'Not initialized; complete the tool setup before device tests.') });
}
if (requested !== 'android') {
  if (process.platform !== 'darwin') checks.push({ name: 'iOS host', passed: false, output: 'macOS with full Xcode required' });
  else {
    probe('Xcode', 'xcodebuild', ['-version']);
    probe('Xcode first launch', 'xcodebuild', ['-checkFirstLaunchStatus']);
    probe('iOS Simulator', 'xcrun', ['simctl', 'list', 'devices', 'available']);
  }
}
if (requested !== 'ios') {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(os.homedir(), 'Library/Android/sdk');
  const suffix = process.platform === 'win32' ? '.exe' : '';
  probe('Android platform tools', path.join(sdk, `platform-tools/adb${suffix}`), ['version']);
  probe('Android emulator', path.join(sdk, `emulator/emulator${suffix}`), ['-version']);
  const manager = path.join(sdk, 'cmdline-tools/latest/bin', process.platform === 'win32' ? 'sdkmanager.bat' : 'sdkmanager');
  checks.push({ name: 'Android SDK manager', passed: fs.existsSync(manager), output: manager });
  const buildTools = path.join(sdk, 'build-tools');
  const installedBuildTools = fs.existsSync(buildTools) ? fs.readdirSync(buildTools) : [];
  checks.push({ name: 'Android build tools', passed: installedBuildTools.some(version =>
    fs.existsSync(path.join(buildTools, version, 'aapt2' + suffix))
      && fs.existsSync(path.join(buildTools, version, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner'))),
    output: installedBuildTools.join(', ') || 'No build-tools installed' });
  checks.push({ name: 'Android SDK platform', passed: fs.existsSync(path.join(sdk, 'platforms'))
    && fs.readdirSync(path.join(sdk, 'platforms')).some(name => /^android-\d+$/.test(name)), output: sdk });
}
console.log(JSON.stringify({ result: checks.every(check => check.passed) ? 'PASS' : 'FAIL', scope: requested,
  runtimeVerification: 'Tool availability only; packaged-app/device tests are separate.', checks }, null, 2));
if (checks.some(check => !check.passed)) process.exitCode = 1;
