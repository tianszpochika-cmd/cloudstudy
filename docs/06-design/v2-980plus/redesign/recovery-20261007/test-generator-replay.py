#!/usr/bin/env python3
"""Replay fixed history with a changed progress file in an isolated fixture; never edit real progress."""
from pathlib import Path
import tempfile,subprocess,json,hashlib
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
SOURCE='ff0f8057f4088ead03ab7890493cdf9d06f6d5f1'
PROGRESS='docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
names=['source-manifest.json','cards-29-index.json','cards-29-index.md','search-snapshot.json','source-integrity-check.json']
before={n:digest(OUT/n) for n in names};progress_before=digest(ROOT/PROGRESS)
with tempfile.TemporaryDirectory(prefix='r1-recovery-replay-') as tmp:
 fixture=Path(tmp);subprocess.run(['git','init','-q',str(fixture)],check=True)
 objects=subprocess.check_output(['git','rev-parse','--path-format=absolute','--git-path','objects'],cwd=ROOT,text=True).strip()
 (fixture/'.git/objects/info/alternates').write_text(objects+'\n')
 subprocess.run(['git','update-ref','refs/heads/main',SOURCE],cwd=fixture,check=True)
 subprocess.run(['git','symbolic-ref','HEAD','refs/heads/main'],cwd=fixture,check=True)
 original=subprocess.check_output(['git','show',SOURCE+':'+PROGRESS],cwd=ROOT)
 progress=fixture/PROGRESS;progress.parent.mkdir(parents=True)
 progress.write_bytes(original+b'\nFixture: legitimate later progress update; no workflow promotion.\n')
 result=subprocess.run(['python3',str(OUT/'build-index.py'),'--source-repo',str(fixture),'--verify-replay'],cwd=ROOT,text=True,capture_output=True)
 summary={'kind':'FIXED_HISTORY_REPLAY_VERIFICATION_NOT_BUSINESS_ACCEPTANCE','fixture':'temporary Git repository; fixed original object store read-only alternate; changed progress input only; fixture removed','sourceCommit':SOURCE,'fixtureWorkingProgressDiffers':digest(progress)!=hashlib.sha256(original).hexdigest(),'realProgressUnchanged':digest(ROOT/PROGRESS)==progress_before,'exitCode':result.returncode,'stdout':result.stdout.strip(),'stderr':result.stderr.strip(),'immutableOutputsUnchanged':all(digest(OUT/n)==before[n] for n in names),'sha256':before}
 (OUT/'generator-replay-check.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in summary.items() if k not in ['stdout','stderr','sha256']},ensure_ascii=False))
 assert result.returncode==0 and summary['fixtureWorkingProgressDiffers'] and summary['realProgressUnchanged'] and summary['immutableOutputsUnchanged']
