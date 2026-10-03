#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REM=ROOT/"scripts/p35-assess-remediation.py"
AUTH=ROOT/"scripts/p35-authorize-period.py"
OE=ROOT/"scripts/p35-evaluate-operating-effectiveness.py"
DRY=ROOT/"scripts/p35-audit-dry-run.py"
P34=ROOT/"scripts/p34-assess-controls.py"
OEPLAN=json.loads((ROOT/"platform-p35-operating-effectiveness-plan.json").read_text())
DRYPLAN=json.loads((ROOT/"platform-p35-audit-dry-run-plan.json").read_text())

def run(cmd,expect=0):
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

def z(dt): return dt.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    rem_out=d/"remediation.json"
    run([sys.executable,str(REM),"--out",str(rem_out)])
    rem=json.loads(rem_out.read_text())
    assert rem["status"]=="pass"
    assert rem["deficienciesCovered"]==8
    assert rem["deficienciesClosedByP35"]==0
    assert rem["advisorDriftSinceP34"]=={
      "rlsEnabledNoPolicy":2,
      "authenticatedSecurityDefinerExecutable":4,
      "authRlsInitplan":2
    }
    assert rem["operatingPeriodReady"] is False

    # Current gate remains blocked.
    blocked={
      "periodId":"oe-real-001","mode":"operating","observedAt":"2026-10-03T22:55:16Z",
      "scopedEpochStableMinutes":0,"criticalOpen":0,
      "highDeficiencyStates":{"P34-D001":"decision_required","P34-D002":"authorization_review_ready","P34-D005":"governance_onboarding_required"},
      "p32Mode":"warn","p33LedgerVerified":True,"controlCatalogFrozen":True,"evidenceCollectorContractPass":True,
      "explicitAuthorization":False,"p34CatalogVersion":"2026-10-03.1","p34SnapshotVersion":"2026-10-03.1",
      "p33HeadHash":"a"*64,"p33AnchorSha256":"b"*64,"controlCatalogSha256":"c"*64,"p34SnapshotSha256":"d"*64,
      "requestedBy":"platform","authorizedBy":"reviewer"
    }
    gf=d/"blocked-gate.json"; gf.write_text(json.dumps(blocked))
    go=d/"blocked-decision.json"
    run([sys.executable,str(AUTH),str(gf),"--out",str(go)])
    g=json.loads(go.read_text())
    assert g["decision"]=="block" and g["canStart"] is False and g["periodClockStarted"] is False
    run([sys.executable,str(AUTH),str(gf),"--out",str(d/"blocked-required.json"),"--require-allow"],1)

    # A fully satisfied independently authorized gate can issue an authorization, but never starts the clock itself.
    allowed=dict(blocked)
    allowed.update({
      "scopedEpochStableMinutes":60,"explicitAuthorization":True,
      "highDeficiencyStates":{"P34-D001":"accepted_temporarily","P34-D002":"remediating","P34-D005":"ready_for_retest"}
    })
    gf.write_text(json.dumps(allowed))
    run([sys.executable,str(AUTH),str(gf),"--out",str(go),"--require-allow"])
    g=json.loads(go.read_text())
    assert g["decision"]=="allow" and g["canStart"] is True
    assert len(g["startAuthorizationId"])==64
    assert g["periodClockStarted"] is False

    self_auth=dict(allowed); self_auth["authorizedBy"]="platform"
    gf.write_text(json.dumps(self_auth))
    run([sys.executable,str(AUTH),str(gf),"--out",str(d/"self.json"),"--require-allow"],1)

    stale=dict(allowed); stale["p34CatalogVersion"]="old"
    gf.write_text(json.dumps(stale))
    run([sys.executable,str(AUTH),str(gf),"--out",str(d/"stale.json"),"--require-allow"],1)

    # Build a 30-calendar-day synthetic evidence population.
    start=datetime(2026,1,5,12,0,tzinfo=timezone.utc)
    end=start+timedelta(days=29)
    period={
      "periodId":"oe-sim-30d","mode":"simulation","periodStart":z(start),"periodEnd":z(end),
      "expectedChangeIds":["chg-1","chg-2"],"expectedIncidentIds":[],"expectedExceptionIds":[]
    }
    pf=d/"period.json"; pf.write_text(json.dumps(period))

    records=[]
    daily=OEPLAN["evidenceCadence"]["daily"]["requiredControls"]
    per=OEPLAN["evidenceCadence"]["perChange"]["requiredControls"]
    weekly=OEPLAN["evidenceCadence"]["weekly"]["requiredChecks"]
    monthly=OEPLAN["evidenceCadence"]["monthly"]["requiredChecks"]

    def rec(when,control,test,source,**extra):
        x={"timestamp":z(when),"controlId":control,"testId":test,"status":"pass","evidenceRefs":["hash:"+(test or control)],
           "source":source,"periodId":period["periodId"],"evidenceKind":"synthetic_test"}
        x.update(extra); records.append(x)

    for i in range(30):
        day=start+timedelta(days=i)
        for cid in daily: rec(day,cid,"daily:"+cid,"daily")

    for change,offset in [("chg-1",2),("chg-2",17)]:
        day=start+timedelta(days=offset)
        for cid in per: rec(day,cid,"change:"+cid,"per_change",changeId=change)

    touched={}
    for i in range(30):
        day=start+timedelta(days=i)
        iso=day.date().isocalendar()
        touched.setdefault((iso.year,iso.week),day)
    for _,day in sorted(touched.items()):
        for check in weekly: rec(day,"TH-DE-01",check,"weekly")

    for check in monthly: rec(end,"TH-RC-02",check,"monthly")
    rec(end,"TH-RS-01","incident_response_drill","drill")
    rec(end,"TH-RC-01","restore_recovery_drill","drill")
    rec(end,"TH-GV-03","exceptions_zero_population","exception")

    journal=d/"journal.jsonl"
    journal.write_text("\n".join(json.dumps(x,separators=(",",":")) for x in records)+"\n")
    oe_out=d/"oe.json"
    run([sys.executable,str(OE),str(pf),str(journal),"--out",str(oe_out)])
    oe=json.loads(oe_out.read_text())
    assert oe["status"]=="pass"
    assert oe["simulationPass"] is True
    assert oe["operatingEffectivenessPass"] is False
    assert oe["operatingEffectivenessProven"] is False
    assert oe["calendarDays"]==30
    assert oe["expectedChanges"]==2

    # Synthetic data cannot masquerade as a real operating period.
    operating=dict(period); operating["mode"]="operating"; operating["startAuthorizationId"]="e"*64
    opf=d/"operating.json"; opf.write_text(json.dumps(operating))
    run([sys.executable,str(OE),str(opf),str(journal),"--out",str(d/"operating-out.json")],1)

    # Real operating mode also requires an explicit start authorization.
    noauth=dict(operating); del noauth["startAuthorizationId"]
    opf.write_text(json.dumps(noauth))
    run([sys.executable,str(OE),str(opf),str(journal),"--out",str(d/"noauth.json")],1)

    short=dict(period); short["periodId"]="short"; short["periodEnd"]=z(start+timedelta(days=9))
    sf=d/"short.json"; sf.write_text(json.dumps(short))
    run([sys.executable,str(OE),str(sf),str(journal),"--out",str(d/"short-out.json")],1)

    # Two consecutive missing daily samples fail.
    miss_dates={z(start+timedelta(days=5))[:10],z(start+timedelta(days=6))[:10]}
    bad=[r for r in records if not (r["controlId"]==daily[0] and r["timestamp"][:10] in miss_dates)]
    bj=d/"bad-daily.jsonl"; bj.write_text("\n".join(json.dumps(x) for x in bad)+"\n")
    run([sys.executable,str(OE),str(pf),str(bj),"--out",str(d/"bad-daily-out.json")],1)

    # Missing per-change control fails.
    missing=[]; dropped=False
    for r in records:
        if not dropped and r.get("changeId")=="chg-2" and r.get("controlId")==per[0]:
            dropped=True; continue
        missing.append(r)
    mj=d/"missing-change.jsonl"; mj.write_text("\n".join(json.dumps(x) for x in missing)+"\n")
    run([sys.executable,str(OE),str(pf),str(mj),"--out",str(d/"missing-change-out.json")],1)

    # Unexplained failure fails.
    fail=list(records)+[{
      "timestamp":z(start+timedelta(days=10)),"controlId":"TH-DE-01","testId":"advisor",
      "status":"fail","evidenceRefs":["hash:fail"],"source":"daily","periodId":period["periodId"],"evidenceKind":"synthetic_test"
    }]
    fj=d/"fail.jsonl"; fj.write_text("\n".join(json.dumps(x) for x in fail)+"\n")
    run([sys.executable,str(OE),str(pf),str(fj),"--out",str(d/"fail-out.json")],1)

    # Explained failure still needs a later passing retest.
    explained=list(records)+[{
      "timestamp":z(start+timedelta(days=10)),"controlId":"TH-DE-01","testId":"advisor-special",
      "status":"fail","evidenceRefs":["hash:fail"],"source":"daily","periodId":period["periodId"],"evidenceKind":"synthetic_test",
      "linkedIssue":"P34-D002","resolutionRef":"remediation-1"
    }]
    ej=d/"explained.jsonl"; ej.write_text("\n".join(json.dumps(x) for x in explained)+"\n")
    run([sys.executable,str(OE),str(pf),str(ej),"--out",str(d/"explained-out.json")],1)
    explained.append({
      "timestamp":z(start+timedelta(days=11)),"controlId":"TH-DE-01","testId":"advisor-special",
      "status":"pass","evidenceRefs":["hash:retest"],"source":"daily","periodId":period["periodId"],"evidenceKind":"synthetic_test"
    })
    ej.write_text("\n".join(json.dumps(x) for x in explained)+"\n")
    run([sys.executable,str(OE),str(pf),str(ej),"--out",str(d/"resolved-out.json")])

    # Required zero-population evidence and recovery/incident drills are real gates.
    for test_id in ("incident_response_drill","restore_recovery_drill","exceptions_zero_population"):
        trimmed=[r for r in records if r.get("testId")!=test_id]
        tj=d/(test_id+".jsonl"); tj.write_text("\n".join(json.dumps(x) for x in trimmed)+"\n")
        run([sys.executable,str(OE),str(pf),str(tj),"--out",str(d/(test_id+"-out.json"))],1)

    # Generate P34 and remediation assessments for dry-run package.
    p34_out=d/"p34.json"
    run([sys.executable,str(P34),"--out",str(p34_out)])
    run([sys.executable,str(REM),"--out",str(rem_out)])

    sections={x:{"status":"present"} for x in DRYPLAN["requiredSections"]}
    manifest={
      "mode":"simulation",
      "statement":"Internal simulation only; no external certification or attestation is claimed.",
      "externalAttestation":False,
      "operatingEffectivenessResultPath":str(oe_out),
      "p34AssessmentResultPath":str(p34_out),
      "remediationAssessmentPath":str(rem_out),
      "deficiencyRegisterPath":str(ROOT/"platform-p34-deficiency-register.json"),
      "p33LedgerPath":str(ROOT/"platform-p33-audit-ledger.jsonl"),
      "p33AnchorPath":str(ROOT/"platform-p33-ledger-anchor.json"),
      "sections":sections,
      "artifacts":{
        "p34-control-catalog":str(ROOT/"platform-p34-control-catalog.json"),
        "p35-remediation-plan":str(ROOT/"platform-p35-remediation-plan.json"),
        "p35-oe-plan":str(ROOT/"platform-p35-operating-effectiveness-plan.json"),
        "p35-dry-run-plan":str(ROOT/"platform-p35-audit-dry-run-plan.json")
      }
    }
    mf=d/"dry.json"; mf.write_text(json.dumps(manifest))
    dry_out=d/"dry-out.json"
    run([sys.executable,str(DRY),str(mf),"--out",str(dry_out)])
    dr=json.loads(dry_out.read_text())
    assert dr["status"]=="pass" and dr["dryRunPass"] is True
    assert dr["certificateType"]=="internal_simulation_only"
    assert dr["operatingEffectivenessProven"] is False
    assert dr["auditReady"] is False and dr["externalAttestation"] is False
    assert len(dr["dryRunCertificateId"])==64

    # Unsupported external-compliance language fails.
    bad=dict(manifest); bad["statement"]="THIEPN is SOC 2 certified."
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"claim.json")],1)

    # Operating dry-run cannot consume a simulation OE result.
    bad=dict(manifest); bad["mode"]="operating"
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"mode.json")],1)

    # Missing required section fails.
    bad=json.loads(json.dumps(manifest)); del bad["sections"][DRYPLAN["requiredSections"][0]]
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"section.json")],1)

    # P33 truncation fails.
    trunc=d/"ledger.jsonl"
    lines=(ROOT/"platform-p33-audit-ledger.jsonl").read_text().splitlines()
    trunc.write_text("\n".join(lines[:-1])+"\n")
    bad=dict(manifest); bad["p33LedgerPath"]=str(trunc)
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"ledger-out.json")],1)

    # Closed deficiency without retest/evidence fails.
    defs=json.loads((ROOT/"platform-p34-deficiency-register.json").read_text())
    defs["items"][0]["state"]="closed"
    df=d/"defs.json"; df.write_text(json.dumps(defs))
    bad=dict(manifest); bad["deficiencyRegisterPath"]=str(df)
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"closed.json")],1)

    # Missing artifact fails.
    bad=json.loads(json.dumps(manifest)); bad["artifacts"]["missing"]=str(d/"none")
    mf.write_text(json.dumps(bad))
    run([sys.executable,str(DRY),str(mf),"--out",str(d/"missing-artifact.json")],1)

print("P35 remediation, period authorization, operating-effectiveness and dry-run contracts passed.")
