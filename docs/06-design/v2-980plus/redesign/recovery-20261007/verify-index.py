#!/usr/bin/env python3
"""Verify this handoff index only; never accepts a business card."""
from pathlib import Path
import hashlib,json,re,sys,subprocess
from functools import lru_cache
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
PINNED_SOURCE_COMMIT='ff0f8057f4088ead03ab7890493cdf9d06f6d5f1'
PINNED_MANIFEST_SHA256='d6c4f419fa62932d74ab6542ec0ef16583748cde07790f650dba95a9b2f3b319'
checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
@lru_cache(maxsize=None)
def source_blob(path):
 # Explicit indexed documentation/application paths only; never inspect arbitrary blobs.
 if path not in allowed_sources:raise ValueError('unmanifested source path: '+path)
 return git('show',PINNED_SOURCE_COMMIT+':'+path)
def source_lines(path):return source_blob(path).decode('utf-8').splitlines()
def check(name,ok,detail):checks.append({'name':name,'pass':bool(ok),'detail':detail})
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
index=json.loads((OUT/'cards-29-index.json').read_text());cards=index['cards'];ids={x['taskId'] for x in cards}
check('29 exact defined cards',[x['taskId'] for x in cards]==[f'R1-{n:03d}' for n in range(1,30)],len(cards))
check('no workflow promotion',not index['workflowStatesImported'] and all(x['currentWorkflowState'] is None for x in cards),'all null; source index only')
manifest=json.loads((OUT/'source-manifest.json').read_text())
check('fixed source commit',manifest['sourceCommit']==PINNED_SOURCE_COMMIT and index['sourceCommit']==PINNED_SOURCE_COMMIT,PINNED_SOURCE_COMMIT)
check('fixed source manifest digest',digest(OUT/'source-manifest.json')==PINNED_MANIFEST_SHA256,PINNED_MANIFEST_SHA256)
allowed_sources={s['path'] for s in manifest['sources']}
for s in manifest['sources']:
 try:ok=hashlib.sha256(source_blob(s['path'])).hexdigest()==s['sha256']
 except (subprocess.CalledProcessError,UnicodeDecodeError,ValueError):ok=False
 check('historical blob '+s['sourceId'],ok,{'sourceCommit':PINNED_SOURCE_COMMIT,'path':s['path']})
for c in cards:
 row=source_lines(c['definitionSource']['path'])[c['definitionSource']['line']-1]
 check('raw card '+c['taskId'],row==c['rawDefinition'],c['definitionSource'])
 source_refs=c['BC']+c['IC']+c['dataOwnerCandidates']+[r for group in c['sourceNavigationCandidates'].values() for r in group]
 for r in source_refs:
  lines=source_lines(r['path']);needle=r.get('id',r.get('owner'))
  if r in c['dataOwnerCandidates']:needle=r['owner']
  check('ref '+c['taskId']+' '+str(needle),1<=r['line']<=len(lines) and needle in lines[r['line']-1],r)
 check('explicit GAP '+c['taskId'],'GAP-TRACE-SIGNOFF' in c['gaps'] and 'GAP-CURRENT-RUNTIME-EVIDENCE' in c['gaps'],c['gaps'])
# The source plan is authoritative even where its acceptance wording is ambiguous.
edges={}
for c in cards:
 dep=c['dependencyAsWritten']; match=re.match(r'R1-(\d{3})…(\d{3})',dep)
 edges[c['taskId']]=[f'R1-{n:03d}' for n in range(int(match[1]),int(match[2])+1)] if match else re.findall(r'R1-\d{3}',dep)
check('all explicit dependencies defined',all(d in ids for ds in edges.values() for d in ds),edges)
visited=set();visiting=set()
def visit(x):
 if x in visiting:raise ValueError(x)
 if x in visited:return
 visiting.add(x)
 for y in edges[x]:visit(y)
 visiting.remove(x);visited.add(x)
try:
 for x in edges:visit(x)
 check('dependency DAG',True,'no cycle in existing29; does not authorize start')
except ValueError as e:check('dependency DAG',False,str(e))
snapshot=json.loads((OUT/'search-snapshot.json').read_text())
for item in snapshot['preservedMobileFiles']:check('preserve mobile '+item['path'],digest(ROOT/item['path'])==item['sha256'],item['sha256'])
for p in OUT.glob('*.md'):
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if '://' not in target:check('link '+p.name+' '+target,(p.parent/target.split('#')[0]).exists(),target)
# Current changes are an observation boundary, never a historical-source failure or state import.
boundary={'kind':'CURRENT_WORKTREE_BOUNDARY_NOT_CARD_STATE','at':datetime.now(timezone.utc).isoformat(),'historicalSourceCommit':PINNED_SOURCE_COMMIT,'currentHead':git('rev-parse','HEAD').decode().strip(),'trackedNameStatusVsBaseline':git('diff','--name-status',PINNED_SOURCE_COMMIT,'--').decode().splitlines(),'statusPorcelain':git('status','--porcelain=v1').decode().splitlines(),'indexedSourceCurrentChanges':[{'path':s['path'],'historicalSha256':s['sha256'],'currentSha256':digest(ROOT/s['path']) if (ROOT/s['path']).is_file() else None} for s in manifest['sources'] if not (ROOT/s['path']).is_file() or digest(ROOT/s['path'])!=s['sha256']],'preservedMobileFiles':[{'path':item['path'],'originalSha256':item['sha256'],'currentSha256':digest(ROOT/item['path']) if (ROOT/item['path']).is_file() else None,'preserved':(ROOT/item['path']).is_file() and digest(ROOT/item['path'])==item['sha256']} for item in snapshot['preservedMobileFiles']],'workflowStatesImported':False,'policy':'Legal current progress/document changes do not fail historical blob checks and never promote cards; 3 pre-existing mobile files remain separately preserved.'}
(OUT/'current-worktree-boundary.json').write_text(json.dumps(boundary,ensure_ascii=False,indent=2)+'\n')
summary={'sourceCommit':PINNED_SOURCE_COMMIT,'sourceManifestSha256':PINNED_MANIFEST_SHA256,'kind':'HANDOFF_SOURCE_INDEX_VERIFICATION_NOT_BUSINESS_ACCEPTANCE','passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks}
(OUT/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='checks'},ensure_ascii=False))
if summary['failed']:
 print(json.dumps([x for x in checks if not x['pass']],ensure_ascii=False,indent=2));sys.exit(1)
