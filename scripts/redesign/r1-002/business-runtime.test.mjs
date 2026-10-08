import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { assertSchema, assertLearnerSchema, databaseGrantScope, validateCookie, validateRestrictedToken } from './business-runtime.mjs';

test('DB write names cannot target existing schemas or SQL injection',()=>{
  assert.equal(assertSchema('r1_002_20261008_aabbccddeeff'),'r1_002_20261008_aabbccddeeff');
  assert.equal(assertLearnerSchema('r1_002_learner_20261008_aabbccddeeff'),'r1_002_learner_20261008_aabbccddeeff');
  for(const name of ['learner_service','r1_002_20261008_aabbccddeeff'])assert.throws(()=>assertLearnerSchema(name),/LEARNER_SCHEMA_SCOPE/);
  for(const value of ['iam_service','r1_002_20261008_bad;DROP DATABASE iam_service','r1_002_20261007_aabbccddeeff'])assert.throws(()=>assertSchema(value),/SCHEMA_SCOPE/);
});
test('cookie verification requires all browser safeguards and no JSON credential',()=>{
  const value='yuxuexing_refresh=synthetic; Path=/api/v1/auth; Max-Age=120; HttpOnly; Secure; SameSite=Lax';
  assert.equal(validateCookie(value,{data:{}}).secure,true);
  for(const attribute of ['; Path=/api/v1/auth','; Max-Age=120','; HttpOnly','; Secure','; SameSite=Lax'])assert.throws(()=>validateCookie(value.replace(attribute,''),{data:{}}),/COOKIE_SECURITY/);
  assert.throws(()=>validateCookie(value,{data:{refreshToken:'synthetic'}}),/COOKIE_SECURITY/);
});
test('actual RS256 signature and exact pre-gate owner/tenant/permissions required',()=>{
  const keys=generateKeyPairSync('rsa',{modulusLength:2048}),kid='synthetic-key';
  const document={data:{keys:[{...keys.publicKey.export({format:'jwk'}),kid}]}};
  const claims={iss:'http://127.0.0.1:18087',aud:['yuxuexing-api'],exp:Math.floor(Date.now()/1000)+30,
    sub:'aabbccdd-aabb-4cdd-abbb-aabbccddeeff',owner_id:'aabbccdd-aabb-4cdd-abbb-aabbccddeeff',
    token_type:'access',tenant_id:'platform',phase:'phase-1',adult_gate:'NOT_EVALUATED',consent_state:'UNKNOWN',
    permissions:['iam.self.read','iam.self.write','learner.profile.read','learner.profile.write'],
    scope:'iam.self.read iam.self.write learner.profile.read learner.profile.write'};
  const token=payload=>{const encoded=[Buffer.from(JSON.stringify({alg:'RS256',kid})).toString('base64url'),Buffer.from(JSON.stringify(payload)).toString('base64url')].join('.');return encoded+'.'+sign('RSA-SHA256',Buffer.from(encoded),keys.privateKey).toString('base64url');};
  assert.equal(validateRestrictedToken(token(claims),document).subjectOwnerEqual,true);
  for(const update of [{adult_gate:'PASSED'},{consent_state:'GRANTED'},{owner_id:'other'},{phase:'phase-2'},
    {permissions:[...claims.permissions,'learning:read']},{permissions:[]},{tenant_id:'other'}])assert.throws(()=>validateRestrictedToken(token({...claims,...update}),document),/TOKEN_NOT_RESTRICTED/);
  assert.throws(()=>validateRestrictedToken(token(claims).slice(0,-16)+'A'.repeat(16),document),/TOKEN_SIGNATURE/);
});

test('damaged token JSON has fixed safe classification without echoing token bytes',()=>{
  for(const input of ['eyJzZWNyZXQiOiJzeW50aGV0aWMtc2VjcmV0Iix9.e30.x','e30.eyJzZWNyZXQiOiJzeW50aGV0aWMtc2VjcmV0Iix9.x']){
    assert.throws(()=>validateRestrictedToken(input,{data:{keys:[]}}),error=> /^TOKEN_(HEADER|CLAIMS)_INVALID$/.test(error.message) && !error.message.includes('synthetic-secret'));
  }
});

test('MySQL database grants encode literal underscores for exact owned schema scope',()=>{
  const schema='r1_002_20261008_aabbccddeeff';
  assert.equal(databaseGrantScope(schema,false),'`r1\\_002\\_20261008\\_aabbccddeeff`.*');
  assert.equal(databaseGrantScope(schema,true),'`'+schema+'`.*');
  assert.throws(()=>databaseGrantScope('iam_service',false),/GRANT_SCOPE/);
  assert.throws(()=>databaseGrantScope(schema,'false'),/GRANT_SCOPE/);
});
