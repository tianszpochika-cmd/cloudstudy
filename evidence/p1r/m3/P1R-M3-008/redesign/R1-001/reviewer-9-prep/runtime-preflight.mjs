import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const schema='r1_001_empty_20261005_t9b',reader='r1_001_reader_t9b';
const prep=fs.readFileSync('evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/prepare-empty-schema-9.mjs','utf8');
// Reuse the local fixture's existing credential input policy; never emit values.
const fallback=prep.match(/const adminPassword = process\.env\.MYSQL_ROOT_PASSWORD \|\| "([^"]+)";/)?.[1];
const adminPassword=process.env.MYSQL_ROOT_PASSWORD||fallback;
const readerPassword=process.env.R1_001_READER_PASSWORD||(adminPassword?`${adminPassword}_ro_tmp`:null);
if(!adminPassword||!readerPassword)throw Error('Fixture credential input unavailable');
function query(user,password,sql){
 if(password.includes('\n'))throw Error('Unsupported credential format');
 // Password travels via stdin, not process arguments or output.
 const run=spawnSync('docker',['exec','-i','yuxuexing-local-mysql-1','sh','-c',
  'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql "$@"','sh','--protocol=TCP','--host','127.0.0.1','--port','3306','--user',user,'--batch','--skip-column-names'],
 {input:password+'\n'+sql+'\n',encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
 if(run.status!==0)throw Error('Fixture database query failed; exit='+run.status+' (credential and raw stderr suppressed)');
 return run.stdout.trim();
}
const startedAt=new Date().toISOString();
const tables=['content_definition','content_version','content_public_projection','content_outbox_event','content_idempotency_record','content_cache_invalidation','content_version_id_sequence','content_public_site_facet'];
const beforeDemoCount=Number(query('root',adminPassword,"SELECT COUNT(*) FROM content_service.content_definition WHERE content_code LIKE 'DEMO%';"));
const exists=query('root',adminPassword,`SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${schema}';`);
if(exists!=='1')throw Error('Expected owned fixture schema is missing');
const grants=query('root',adminPassword,`SHOW GRANTS FOR '${reader}'@'%';`).split('\n');
if(grants.some(g=>!/^GRANT USAGE ON \*\.\* /.test(g)&&!g.startsWith(`GRANT SELECT ON \`${schema}\`.* TO `)))throw Error('Fixture reader grant scope unexpected');
const facetExists=query('root',adminPassword,`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${schema}' AND TABLE_NAME='content_public_site_facet';`);
let addedFacetTable=false;
if(facetExists==='0'){
 // The only write: add the missing public GET read table to the approved test schema.
 query('root',adminPassword,`CREATE TABLE \`${schema}\`.\`content_public_site_facet\` LIKE \`content_service\`.\`content_public_site_facet\`;`);
 addedFacetTable=true;
}else if(facetExists!=='1')throw Error('Unexpected fixture table metadata');
const counts=[];
for(const table of tables){
 const rows=Number(query(reader,readerPassword,`SELECT COUNT(*) FROM \`${schema}\`.\`${table}\`;`));
 if(rows!==0)throw Error('Fixture table is not empty: '+table);
 counts.push({table,rows,structureSha256:crypto.createHash('sha256').update(query('root',adminPassword,`SHOW CREATE TABLE \`${schema}\`.\`${table}\`;`)).digest('hex')});
}
const identity=query(reader,readerPassword,`USE \`${schema}\`; SELECT CURRENT_USER(), DATABASE();`);
const afterDemoCount=Number(query('root',adminPassword,"SELECT COUNT(*) FROM content_service.content_definition WHERE content_code LIKE 'DEMO%';"));
if(beforeDemoCount!==afterDemoCount)throw Error('Shared DEMO count changed during check');
const result={startedAt,finishedAt:new Date().toISOString(),schema,reader,addedFacetTable,counts,grants,identity,beforeDemoCount,afterDemoCount,
 scope:'Own test schema only: cloned one missing public facet table; SELECT with dedicated reader against eight empty tables. Shared source structure/count read only; count equality does not prove all historical data unchanged.',
 limitations:['CREATE TABLE LIKE is a read-fixture structure copy, not full migration or foreign-key equivalence certification','No service or browser started']};
fs.writeFileSync(path.join(dir,'runtime-preflight.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({schema,reader,addedFacetTable,emptyTables:counts.length,readerIdentity:identity,beforeDemoCount,afterDemoCount}));
