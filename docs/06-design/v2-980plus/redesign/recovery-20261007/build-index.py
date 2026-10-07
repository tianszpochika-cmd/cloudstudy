#!/usr/bin/env python3
"""Rebuild read-only-source handoff indexes. Writes only this recovery directory."""
from pathlib import Path
import hashlib, json, re, subprocess, argparse
from functools import lru_cache
ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
PINNED_SOURCE_COMMIT='ff0f8057f4088ead03ab7890493cdf9d06f6d5f1'
PINNED_MANIFEST_SHA256='d6c4f419fa62932d74ab6542ec0ef16583748cde07790f650dba95a9b2f3b319'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-repo',type=Path,default=ROOT,help='Read fixed Git blobs from this repository (temporary fixture supported)')
parser.add_argument('--verify-replay',action='store_true',help='Compare fixed-source generated content without writing any output')
options=parser.parse_args()
P = 'docs/06-design/v2-980plus/redesign/'
O = 'docs/06-design/v2-980plus/phase1-business-operation/'
SOURCES = {
 'plan': P+'dev-plan-R1.md', 'progress': P+'CURRENT-PROGRESS.md', 'handoff':'CURRENT-HANDOFF.md',
 'agents':'AGENTS.md', 'bc':P+'business-chains.md', 'ic':P+'interaction-chains.md', 'redesign_trace':P+'traceability-matrix.md',
 'features':'requirements/feature-matrix.md', 'atoms':'docs/06-design/traceability/03-PRD原子需求候选清单.md',
 'scope':'docs/06-design/v2-980plus/08-980plus-功能点设计登记册.md',
 'arch':'docs/02-architecture/v2-platform-capability-matrix.md',
 'actors_owners':O+'01-角色系统边界与业务总图.md','journeys':O+'02-端到端业务旅程台账.md',
 'pages':O+'03-全端页面功能登记册.md','rules':O+'04-学习机制与学习引擎规则.md',
 'integration':O+'06-业务联调矩阵.md','acceptance':O+'08-验收与追溯规范.md',
 'closeout':'evidence/p1r/m2/P1R-M2-002/redesign/R1-002/reviewer-3-closeout/review.md',
 'closeout_inputs':'evidence/p1r/m2/P1R-M2-002/redesign/R1-002/source-and-inputs-4.json',
 'closeout_commands':'evidence/p1r/m2/P1R-M2-002/redesign/R1-002/commands-4.log',
 'official_sweep':'evidence/live/2026-09-26/page-sweep/official/summary.json',
 'official_courses':'apps/official-site/pages/courses/index.vue','official_start':'apps/official-site/pages/start.vue',
 'official_start_button':'apps/official-site/components/SiteStartButton.vue','official_links':'apps/official-site/composables/useOfficialSiteLinks.ts',
}
def git(*args):
 r=subprocess.run(['git',*args],cwd=options.source_repo,text=True,capture_output=True)
 return {'command':'git '+' '.join(args),'exitCode':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr.strip()}
def write_bytes(name,payload):
 target=OUT/name
 if name=='source-manifest.json' and hashlib.sha256(payload).hexdigest()!=PINNED_MANIFEST_SHA256:
  raise ValueError('Fixed source manifest digest mismatch; original manifest cannot be overwritten')
 if target.exists():
  if target.read_bytes()!=payload:raise ValueError('Immutable recovery artifact differs: '+name)
 elif not options.verify_replay:target.write_bytes(payload)
 else:raise ValueError('Missing recovery artifact for replay: '+name)
def write(name,obj):write_bytes(name,(json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
@lru_cache(maxsize=None)
def historical_blob(path):
 if path not in SOURCES.values():raise ValueError('Unmanifested path')
 return subprocess.check_output(['git','show',PINNED_SOURCE_COMMIT+':'+path],cwd=options.source_repo)
texts={k:historical_blob(v).decode('utf-8') for k,v in SOURCES.items()}
source_index=[]
for k,v in SOURCES.items():
 source_index.append({'sourceId':k,'path':v,'sha256':hashlib.sha256(historical_blob(v)).hexdigest(),'lastPathCommit':git('log','-1','--format=%H',PINNED_SOURCE_COMMIT,'--',v)['stdout']})
write('source-manifest.json',{'sourceCommit':PINNED_SOURCE_COMMIT,'sources':source_index})
def anchor(src,needle):
 lines=texts[src].splitlines()
 for i,line in enumerate(lines,1):
  if needle in line:return {'path':SOURCES[src],'line':i,'id':needle}
 raise ValueError(f'Missing source ID: {src}/{needle}')
def refs(src,ids):return [anchor(src,x) for x in ids]
def expand(expr,prefix):
 ids=[]
 if not expr.startswith(prefix+'-'):return ids
 # Expand only written ranges/shorthand; do not derive undefined task IDs.
 for part in expr.split('/'):
  m=re.fullmatch(r'(?:'+prefix+r'-)?(\d{3})(?:…(\d{3}))?',part.strip())
  if m: ids += [f'{prefix}-{i:03d}' for i in range(int(m[1]),int(m[2] or m[1])+1)]
 return ids
bcrows={}
for n,l in enumerate(texts['bc'].splitlines(),1):
 m=re.match(r'\| (BC-\d{3})<',l)
 if m:bcrows[m[1]]={'path':SOURCES['bc'],'line':n,'ic':list(dict.fromkeys(re.findall(r'IC-\d{3}',l)))}
# These are source-navigation candidates, not imported approvals or exhaustive requirement coverage.
groups={
 'public':dict(feat=['FEAT-USR-003'],atom=['PRD-ATOM-1044'],jny=['JNY-P1-01'],page=['PAGE-P1-OFFICIAL-'+x for x in ['HOME','COURSES','PRICING','DOWNLOAD','ANNOUNCEMENTS','ABOUT','COMPLIANCE','STATUS','PRIVACY','TERMS','MINORS']]+['PAGE-P1-AUTH-REGISTER-RESET'],rule=[],integ=['INT-P1-001','INT-P1-005'],e2e=['E2E-P1-PUBLIC-ENTRY'],actor=['ACT-P1-VISITOR'],arch=['ARCH-GW-001','ARCH-API-001'],owner=['content-service']),
 'auth':dict(feat=['FEAT-USR-001','FEAT-USR-004'],atom=['PRD-ATOM-1044','PRD-ATOM-1049'],jny=['JNY-P1-01'],page=['PAGE-P1-AUTH-LOGIN','PAGE-P1-AUTH-REGISTER-RESET'],rule=[],integ=['INT-P1-001'],e2e=['E2E-P1-AUTH-LIFECYCLE'],actor=['ACT-P1-VISITOR','ACT-P1-LEARNER'],arch=['ARCH-IAM-001','ARCH-IAM-002','ARCH-GW-001','ARCH-EVT-001'],owner=['iam-service']),
 'device':dict(feat=['FEAT-USR-005'],atom=['PRD-ATOM-1050'],jny=['JNY-P1-01'],page=['PAGE-P1-DEVICES'],rule=[],integ=['INT-P1-001'],e2e=['E2E-P1-AUTH-LIFECYCLE'],actor=['ACT-P1-LEARNER'],arch=['ARCH-IAM-001','ARCH-IAM-002','ARCH-GW-001'],owner=['iam-service']),
 'gate':dict(feat=['FEAT-USR-001'],atom=['PRD-ATOM-1039','PRD-ATOM-1043'],jny=['JNY-P1-02'],page=['PAGE-P1-ADULT-CONSENT'],rule=[],integ=['INT-P1-002'],e2e=['E2E-P1-ADULT-CONSENT'],actor=['ACT-P1-LEARNER','ACT-P1-SYSTEM'],arch=['ARCH-IAM-001','ARCH-IAM-002','ARCH-GW-001','ARCH-EVT-001'],owner=['iam-service']),
 'profile':dict(feat=['FEAT-ONB-001','FEAT-ONB-002'],atom=['PRD-ATOM-1053','PRD-ATOM-1056'],jny=['JNY-P1-03'],page=['PAGE-P1-ONB-GOAL'],rule=['RULE-P1-DAILY-PLAN','RULE-P1-TIME-SYNC'],integ=['INT-P1-003'],e2e=['E2E-P1-FIRST-DAY'],actor=['ACT-P1-LEARNER'],arch=['ARCH-IAM-002','ARCH-GW-001','ARCH-DATA-001','ARCH-EVT-001'],owner=['learner-service']),
 'placement':dict(feat=['FEAT-ONB-003','FEAT-ONB-004'],atom=['PRD-ATOM-0087','PRD-ATOM-0090','PRD-ATOM-0091','PRD-ATOM-0092'],jny=['JNY-P1-04'],page=['PAGE-P1-ASSESSMENT','PAGE-P1-ASSESSMENT-RESULT'],rule=['RULE-P1-PLACEMENT','RULE-P1-SESSION'],integ=['INT-P1-004'],e2e=['E2E-P1-FIRST-DAY'],actor=['ACT-P1-LEARNER','ACT-P1-SYSTEM'],arch=['ARCH-API-001','ARCH-IAM-002','ARCH-GW-001','ARCH-DATA-001','ARCH-EVT-001'],owner=['assessment-service']),
 'reset':dict(feat=['FEAT-USR-002'],atom=[],jny=['JNY-P1-01'],page=['PAGE-P1-AUTH-REGISTER-RESET'],rule=[],integ=['INT-P1-001'],e2e=['E2E-P1-AUTH-LIFECYCLE'],actor=['ACT-P1-VISITOR'],arch=['ARCH-IAM-001','ARCH-GW-001','ARCH-SEC-001'],owner=['iam-service']),
}
category={1:'public',2:'auth',3:'auth',4:'auth',5:'device',6:'gate',7:'gate',8:'gate',9:'gate',10:'profile',11:'profile',12:'reset',13:'gate',15:'auth',16:'gate',17:'profile'}
scope_rows={}
for n,l in enumerate(texts['scope'].splitlines(),1):
 if l.startswith('| V2-980-'):
  c=[x.strip() for x in l.strip('|').split('|')]
  for f in re.findall(r'FEAT-[A-Z0-9]+-\d{3}',c[4]):scope_rows.setdefault(f,[]).append({'path':SOURCES['scope'],'line':n,'id':c[0]})
cards=[]
for n,l in enumerate(texts['plan'].splitlines(),1):
 if not re.match(r'\| R1-\d{3} \|',l):continue
 c=[x.strip() for x in l.strip('|').split('|')]; num=int(c[0][-3:]); acceptance,rest=c[3].split(' → owner: ');own,dep=rest.split('；依赖：')
 bc=expand(c[1],'BC');ic=expand(c[1],'IC')
 derived=False
 if ic and not bc:
  bc=sorted({b for b,v in bcrows.items() if set(v['ic'])&set(ic) and ((num<=17 and (1<=int(b[-3:])<=12 or b in ['BC-201','BC-202'])) or (num>=18 and 13<=int(b[-3:])<=22))})
  derived=True
 if num==14:bc=[f'BC-{i:03d}' for i in range(1,13)]+['BC-201','BC-202'];derived=True
 if num==29:bc=[f'BC-{i:03d}' for i in range(13,23)];derived=True
 linked_ic=sorted(set(ic)|{x for b in bc for x in bcrows[b]['ic']})
 if num in (14,29):
  gs=['public','auth','device','gate','profile','reset'] if num==14 else ['placement']
  g={k:sorted({x for group in gs for x in groups[group][k]}) for k in groups[gs[0]]}
 else:g={k:list(v) for k,v in groups[category.get(num,'placement')].items()}
 if num==23:g['feat']=['FEAT-ONB-005'];g['atom']=['PRD-ATOM-0090','PRD-ATOM-0091'];g['rule']=['RULE-P1-PLACEMENT']
 if num in (25,26):g['owner']=['content-service'];g['actor']=['ACT-P1-SYSTEM'];g['page']=[]
 if num==19:g['arch']+=['ARCH-SVC-001','ARCH-LCM-001']
 source_refs={'FEAT':refs('features',g['feat']),'PRD_ATOM':refs('atoms',g['atom']),'V2_980':[x for f in g['feat'] for x in scope_rows.get(f,[])],
  'ARCH':refs('arch',g['arch']),'ACT':refs('actors_owners',g['actor']),'JNY':refs('journeys',g['jny']),
  'PAGE':refs('pages',g['page']),'RULE':refs('rules',g['rule']),'INT':refs('integration',g['integ']),'E2E':refs('acceptance',g['e2e'])}
 owner_refs=[]
 for owner in g['owner']:
  if owner=='content-service':needle='| 内容、课程、题目、答案规则版本'
  elif owner=='assessment-service':needle='| placement/练习/模考会话'
  elif owner=='learner-service':needle='| 学习目标、每日时长'
  else:needle='| principal、账号密码'
  ref=anchor('actors_owners',needle);ref['owner']=owner;owner_refs.append(ref)
 historical=[]
 if num==1:historical=[{'source':anchor('closeout_inputs','"r1_001"'),'claim':'原机器上下文 ACCEPTED，publishedWithThisBundle=false；不迁移'}, {'source':anchor('official_sweep','"capturedAt"'),'claim':'2026-09-26 页面 sweep；非 R1-001 验收'}]
 if num==2:historical=[{'source':anchor('closeout','PREPARATION_PARTIAL_NOT_READY'),'claim':'原机器 PLANNED/revision27；未 READY'}]
 gaps=['GAP-TRACE-SIGNOFF','GAP-CARD-CONTRACT-BINDING','GAP-CURRENT-RUNTIME-EVIDENCE','GAP-NAMED-ACCEPTOR']
 if not g['atom']:gaps.append('GAP-PRD-ATOM-EXACT')
 if num in (6,7,8,9,13,16):gaps.append('GAP-ADULT-CONSENT-EXACT-SOURCE')
 if num==1:gaps+=['GAP-R1-001-DELIVERY','GAP-R1-001-ACCEPTANCE']
 cards.append({'taskId':c[0],'station':'IT-1' if num<=17 else 'IT-2','definitionSource':{'path':SOURCES['plan'],'line':n},'title':c[2],
  'rawDefinition':l,'deliveryOwnerAsWritten':own,'dependencyAsWritten':dep,'acceptanceAsWritten':acceptance,
  'BC':[dict(id=b,path=bcrows[b]['path'],line=bcrows[b]['line']) for b in bc],'IC':refs('ic',linked_ic),
  'BCMappingKind':'BC/IC关联或汇总派生，非原卡新增范围' if derived else '计划显式BC',
  'sourceNavigationCandidates':source_refs,'candidateMappingBoundary':'候选导航：源ID存在，逐卡完整覆盖/权威绑定未签收；不迁移源文状态',
  'dataOwnerCandidates':owner_refs,'ruleBoundary':'源旅程标为不适用（认证/成人/官网），安全/同意政策仍需绑定' if not g['rule'] else '只引用设计规则，不声明实现',
  'pageBoundary':'技术种子无独立用户幕' if num in (25,26) else '页面台账为源快照，代码存在/缺失描述未在此升级',
  'historicalEvidenceNotes':historical,'currentWorkflowState':None,'gaps':gaps})
assert [x['taskId'] for x in cards]==[f'R1-{i:03d}' for i in range(1,30)]
write('cards-29-index.json',{'kind':'SOURCE_HANDOFF_INDEX_NOT_EXECUTABLE_WALL','sourceCommit':PINNED_SOURCE_COMMIT,
 'definedCardCount':29,'original114WallRecovered':False,'workflowStatesImported':False,'cards':cards})
# Search/machine observations are immutable original snapshots. A later machine cannot
# reconstruct or refresh them from present refs, progress or mobile working files.
for name in ['search-snapshot.json','source-integrity-check.json']:
 if not (OUT/name).is_file():raise ValueError('Original historical snapshot missing: '+name)
checks=json.loads((OUT/'source-integrity-check.json').read_text())['r1_002_inputManifest']['files']
# Compact human index; full source references remain in JSON.
lines=['# 29 卡接手索引（来源导航，非状态墙）','','来源：`ff0f8057` 的 `dev-plan-R1.md`；共 29 条显式卡定义。原始 owner、依赖、验收文字保留在 JSON；不填 R1-030…114，不迁移 ACCEPTED。',
 '', 'BC/IC 是原卡或源文关联；FEAT/PRD-ATOM/V2-980、ARCH、运行层 ID 和 data owner 均为可审查候选导航，逐卡绑定未签收。完整来源行号、缺口见 [cards-29-index.json](cards-29-index.json)。',
 '', '| 卡 | 站 | owner（原文） | 依赖（原文） | BC | IC | 当前证据边界 |','|---|---|---|---|---|---|---|']
for x in cards:
 evidence='R1-001 原机器摘要；完整交付缺失' if x['taskId']=='R1-001' else 'R1-002 准备未 READY' if x['taskId']=='R1-002' else '当前卡验收包未找到；不推断从未实现'
 lines.append('| '+ ' | '.join([x['taskId'],x['station'],x['deliveryOwnerAsWritten'],x['dependencyAsWritten'],', '.join(y['id'] for y in x['BC']),', '.join(y['id'] for y in x['IC']),evidence])+' |')
write_bytes('cards-29-index.md',('\n'.join(lines)+'\n').encode('utf-8'))
print(json.dumps({'sourceCommit':PINNED_SOURCE_COMMIT,'sourceManifestSha256':PINNED_MANIFEST_SHA256,'verifyReplay':options.verify_replay,'cards':len(cards),'sourceFiles':len(source_index),'r1_002_artifactsMatching':sum(x['digestMatches'] for x in checks),'r1_002_artifactsTotal':len(checks)},ensure_ascii=False))
