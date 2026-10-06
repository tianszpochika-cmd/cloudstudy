// prep-4 TLS 测试证书重建（受控目录，当前 vault 口令加密）。
// 原因：轮换后 vault tlsStorePassword 已更新，旧 keystore（旧口令加密）无法打开；
//   旧明文已按任务一清理，不恢复旧口令。测试证书可重建（CN=127.0.0.1/SAN IP，30 天）。
// 新证书指纹将更新；公开 .cer/.pem 重新导出到证据 t3-tls（公开材料可保留）。
// 秘密经 stdin/内存注入，不出现在 argv/日志。
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vaultLib = require('./r1-002-vault-4.cjs');

const dir = __dirname;
const controlledTlsDir = path.join(vaultLib.CONTROLLED_DIR, 'tls');
const legacyTlsDir = path.join(dir, 't3-tls');
fs.mkdirSync(controlledTlsDir, { recursive: true });

const { vault } = vaultLib.loadOrCreate();
const storePass = vault.tlsStorePassword;
const ks = path.join(controlledTlsDir, 'r1-002-tls.p12');
const ts = path.join(controlledTlsDir, 'r1-002-trust.p12');
const cer = path.join(controlledTlsDir, 'r1-002.cer');

// 旧 keystore 备份后删除（受控目录内，不进证据）。
for (const f of [ks, ts]) {
  if (fs.existsSync(f)) {
    fs.renameSync(f, f + '.bak-' + Date.now());
    console.log('BACKUP-OLD ' + path.basename(f));
  }
}

function keytool(args, password) {
  // keytool resolves passwords from its own environment; argv contains variable names only.
  const r = spawnSync('keytool', args, { encoding: 'utf8', windowsHide: true, env: { ...process.env, R1_002_TLS_STORE_PASSWORD: password } });
  if (r.status !== 0) throw new Error('keytool failed: ' + ((r.stderr || r.stdout || '').slice(0, 300)));
  return r;
}

// Password values never appear in keytool arguments.
keytool(['-genkeypair', '-alias', 'r1-002', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '30',
  '-storetype', 'PKCS12', '-keystore', ks, '-storepass:env', 'R1_002_TLS_STORE_PASSWORD', '-keypass:env', 'R1_002_TLS_STORE_PASSWORD',
  '-dname', 'CN=127.0.0.1', '-ext', 'SAN=IP:127.0.0.1'], storePass);
keytool(['-exportcert', '-alias', 'r1-002', '-keystore', ks, '-storepass:env', 'R1_002_TLS_STORE_PASSWORD', '-file', cer], storePass);
keytool(['-importcert', '-noprompt', '-trustcacerts', '-alias', 'r1-002', '-file', cer,
  '-keystore', ts, '-storetype', 'PKCS12', '-storepass:env', 'R1_002_TLS_STORE_PASSWORD'], storePass);
console.log('TLS-REBUILD-OK controlled-dir');

// 公开证书同步到证据目录（公开材料，可保留）。
for (const src of [cer]) {
  fs.copyFileSync(src, path.join(legacyTlsDir, 'r1-002.cer'));
}
// DER cer -> PEM（Node ca 需要 PEM）。
const der = fs.readFileSync(cer);
const pem = '-----BEGIN CERTIFICATE-----\n' + der.toString('base64').match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n';
fs.writeFileSync(path.join(legacyTlsDir, 'r1-002.pem'), pem);
console.log('TLS-PUBLIC-SYNC-OK t3-tls/r1-002.cer+pem');

// 新指纹（公开信息，可记录）。
const fp = spawnSync('keytool', ['-list', '-v', '-keystore', ks, '-storepass:env', 'R1_002_TLS_STORE_PASSWORD', '-alias', 'r1-002'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, R1_002_TLS_STORE_PASSWORD: storePass } });
const m = (fp.stdout || '').match(/SHA256:\s*([0-9A-F:]+)/);
console.log('TLS-NEW-FP256 ' + (m ? m[1] : 'UNKNOWN'));
