'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const https = require('node:https');
const http = require('node:http');
const base = path.resolve(__dirname, '..');
const root = path.resolve(base, '../../../../../..');
const guard = require('../r1-002-process-guard.cjs');
const ca = fs.readFileSync(path.join(base, 't3-tls/r1-002.pem'));
const log = { checkedAt: new Date().toISOString(), scope: 'owned preparation instances; public GET and identity-checked stop only', checks: [], stopped: [], registrationPerformed: false };
function get(client, port, pathname) {
  return new Promise(resolve => {
    const req = client.get({ host: '127.0.0.1', port, path: pathname, ca, rejectUnauthorized: true, timeout: 10000 }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let data; try { data = JSON.parse(body); } catch {}
        resolve({ port, path: pathname, status: res.statusCode, kids: (data?.keys || data?.data?.keys || []).map(k => k.kid) });
      });
    });
    req.on('error', e => resolve({ port, path: pathname, error: e.code || e.message }));
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}
(async () => {
  try {
    log.publicGet = await Promise.all([get(https,18087,'/actuator/health/readiness'), get(https,18087,'/api/v1/auth/jwks'), get(http,18070,'/api/v1/auth/jwks')]);
    for (const [folder, service, port] of [['gateway-4','api-gateway',18070],['launcher-4','iam-service',18087]]) {
      const receipt = JSON.parse(fs.readFileSync(path.join(base, folder, 'pid.json')));
      const jar = path.join(root, 'services', service, 'target', service + '-0.1.0-SNAPSHOT.jar');
      const current = guard.inspect(receipt.pid);
      const identity = guard.assertOwned(receipt,current,jar,port,true);
      const strict = { ...receipt, processCreatedAt: identity.processCreatedAt };
      assert.doesNotThrow(() => guard.assertOwned(strict,current,jar,port));
      log.checks.push({name:service+'-owned-identity',result:'PASS'});
      for (const [name, altered, processInfo, checkedPort] of [
        ['wrong-pid',{...strict,pid:strict.pid+1},current,port],
        ['wrong-time',{...strict,processCreatedAt:'2000-01-01T00:00:00Z'},current,port],
        ['wrong-hash',{...strict,jarSha256:'bad'},current,port],
        ['wrong-jar',strict,{...current,commandLine:current.commandLine.replace(service+'-0.1.0-SNAPSHOT.jar','unrelated.jar')},port],
        ['wrong-port',strict,current,port+1],
        ['missing-time',receipt,current,port]
      ]) {
        assert.throws(() => guard.assertOwned(altered,processInfo,jar,checkedPort));
        log.checks.push({name:service+'-'+name,result:'PASS',type:'controlled rejection; no signal sent'});
      }
      if(service==='iam-service') log.secure = { explicitLaunchArgument:current.commandLine.includes('--iam.jwt.refresh-cookie-secure=true'), actualSetCookieVerified:false, reason:'registration not authorized in preparation' };
      log.stopped.push(await guard.stopOwned(strict,jar,port));
    }
    log.ports = await Promise.all([18070,18087,18090].map(async port=>({port,listening:await guard.listening(port)})));
    assert.ok(log.ports.every(p=>!p.listening),'preparation ports not released');
    log.result='PASS_OWNED_CLEANUP';
  } catch(e) {
    log.result='FAIL'; log.error=e.message; process.exitCode=1;
  } finally {
    log.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(__dirname,'runtime-and-cleanup.json'),JSON.stringify(log,null,2)+'\n');
    console.log(JSON.stringify({result:log.result,publicGet:log.publicGet,guardChecks:log.checks.length,stopped:log.stopped.map(s=>s.pid),ports:log.ports,error:log.error},null,2));
  }
})();
