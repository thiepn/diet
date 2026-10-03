#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REM=ROOT/"scripts/p35-assess-remediation.py"
OE=ROOT/"scripts/p35-evaluate-operating-effectiveness.py"
DRY=ROOT/"scripts/p35-audit-dry-run.py"
PLAN=json.loads((ROOT/"platform-p35-operating-effectiveness-plan.json").read_text())

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    # Remediation triage must be structurally complete.
    rem=d/"rem.json"
    run([sys.executable,str(REM),"--out",str(rem)])
    rr=json.loads(rem.read_text())
    assert rr["status"]=="pass"
    assert rr["deficienciesCovered"]==7
    assert rr["rlsNoPolicyDisposition"].startswith("intentional_deny_pattern")
    assert rr["securityDefinerDisposition"].startswith("intentional_authenticated_rpc_pattern")

    # Build a valid 30-calendar-day internal evidence period.
    start=datetime(2026,1,1,tzinfo=timezone.utc)
    end=start+timedelta(days=29)
    period={"periodId":"oe-30d","periodStart":start.isoformat().replace("+00:00","Z"),"periodEnd":end.isoformat().replace("+00:00","Z"),"expectedChangeIds":["chg-1","chg-2"]}
    period_file=d/"period.json"; period_file.write_text(json.dumps(period))
    records=[]
    daily=PLAN["evidenceCadence"]["daily"]["requiredControls"]
    per=PLAN["evidenceCadence"]["perChange"]["requiredControls"]
    weekly=PLAN["evidenceCadence"]["weekly"]["requiredChecks"]
    monthly=PLAN["evidenceCadence"]["monthly"]["requiredChecks"]

    for day in range(30):
        ts=(start+timedelta(days=day,hours=8)).isoformat().replace("+00:00","Z")
        for cid in daily:
            records.append({"timestamp":ts,"controlId":cid,"testId":"daily-"+cid,"status":"pass","evidenceRefs":["hash:"+cid+":"+str(day)],"source":"daily","periodId":"oe-30d"})
    for change in ("chg-1","chg-2"):
        ts=(start+timedelta(days=2 if change=="chg-1" else 15,hours=10)).isoformat().replace("+00:00","Z")
        for cid in per:
            records.append({"timestamp":ts,"controlId":cid,"testId":"change-"+cid,"status":"pass","evidenceRefs":["hash:"+change+":"+cid],"source":"per_change","periodId":"oe-30d","changeId":change})
    # One set of weekly checks per ISO week touched.
    seen=set()
    for day in range(30):
        dt=start+timedelta(days=day)
        w=(dt.isocalendar().year,dt.isocalendar().week)
        if w in seen: continue
        seen.add(w)
        ts=dt.replace(hour=9).isoformat().replace("+00:00","Z")
        for check in weekly:
            records.append({"timestamp":ts,"controlId":"TH-GV-03","testId":check,"status":"pass","evidenceRefs":["hash:"+check+":"+str(w)],"source":"weekly","periodId":"oe-30d"})
    ts=(start+timedelta(days=28,hours=9)).isoformat().replace("+00:00","Z")
    for check in monthly:
        records.append({"timestamp":ts,"controlId":"TH-RC-02","testId":check,"status":"pass","evidenceRefs":["hash:"+check],"source":"monthly","periodId":"oe-30d"})

    journal=d/"journal.jsonl"
    journal.write_text("\n".join(json.dumps(x,separators=(",",":")) for x in records)+"\n")
    oe_out=d/"oe.json"
    run([sys.executable,str(OE),str(period_file),str(journal),"--out",str(oe_out)])
    oe_result=json.loads(oe_out.read_text())
    assert oe_result["status"]=="pass"
    assert oe_result["calendarDays"]==30
    assert oe_result["expectedChanges"]==2

    # Short period fails.
    short=dict(period);short["periodId"]="short";short["periodEnd"]=(start+timedelta(days=9)).isoformat().replace("+00:00","Z")
    short_file=d/"short.json";short_file.write_text(json.dumps(short))
    run([sys.executable,str(OE),str(short_file),str(journal),"--out",str(d/"short-out.json")],1)

    # Missing daily evidence for two consecutive days fails.
    bad_records=[r for r in records if not (r["controlId"]==daily[0] and r["timestamp"][:10] in ((start+timedelta(days=5)).date().isoformat(),(start+timedelta(days=6)).date().isoformat()))]
    bad_j=d/"bad-journal.jsonl";bad_j.write_text("\n".join(json.dumps(x,separators=(",",":")) for x in bad_records)+"\n")
    run([sys.executable,str(OE),str(period_file),str(bad_j),"--out",str(d/"bad-daily.json")],1)

    # Missing one per-change control fails.
    missing_change=[]
    dropped=False
    for r in records:
        if not dropped and r.get("changeId")=="chg-2" and r.get("controlId")==next(iter(per)):
            dropped=True;continue
        missing_change.append(r)
    miss_j=d/"miss-change.jsonl";miss_j.write_text("\n".join(json.dumps(x,separators=(",",":")) for x in missing_change)+"\n")
    run([sys.executable,str(OE),str(period_file),str(miss_j),"--out",str(d/"miss-change-out.json")],1)

    # Unexplained failed control record fails.
    fail_records=list(records)+[{"timestamp":(start+timedelta(days=10)).isoformat().replace("+00:00","Z"),"controlId":"TH-DE-01","testId":"advisor","status":"fail","evidenceRefs":["hash:fail"],"source":"daily","periodId":"oe-30d"}]
    fail_j=d/"fail.jsonl";fail_j.write_text("\n".join(json.dumps(x,separators=(",",":")) for x in fail_records)+"\n")
    run([sys.executable,str(OE),str(period_file),str(fail_j),"--out",str(d/"fail-out.json")],1)

    # Valid dry-run package.
    artifacts={
      "remediation":str(ROOT/"platform-p35-remediation-plan.json"),
      "oe-plan":str(ROOT/"platform-p35-operating-effectiveness-plan.json"),
      "p34-catalog":str(ROOT/"platform-p34-control-catalog.json")
    }
    sections={x:{"status":"present"} for x in json.loads((ROOT/"platform-p35-audit-dry-run-plan.json").read_text())["requiredSections"]}
    dry_manifest={
      "statement":"Internal dry-run only; no external certification or attestation is claimed.",
      "externalAttestation":False,"periodDays":30,"operatingEffectivenessStatus":"pass","unexplainedFailures":0,
      "sections":sections,"artifacts":artifacts,
      "deficiencies":[{"id":"P34-D002","state":"open"}]
    }
    mf=d/"dry.json";mf.write_text(json.dumps(dry_manifest))
    dry_out=d/"dry-out.json"
    run([sys.executable,str(DRY),str(mf),"--out",str(dry_out)])
    dr=json.loads(dry_out.read_text())
    assert dr["status"]=="pass" and dr["dryRunCertified"] is True and dr["externalAttestation"] is False

    # Unsupported external-compliance language fails.
    bad=dict(dry_manifest);bad["statement"]="THIEPN is SOC 2 certified."
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"claim.json")],1)

    # Closed deficiency without retest fails.
    bad=json.loads(json.dumps(dry_manifest));bad["deficiencies"]=[{"id":"P34-D002","state":"closed"}]
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"closed.json")],1)

print("P35 remediation, operating-effectiveness and audit dry-run contracts passed.")
