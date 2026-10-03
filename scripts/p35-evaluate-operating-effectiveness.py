#!/usr/bin/env python3
import argparse,json,hashlib
from collections import defaultdict
from datetime import datetime,timedelta,timezone
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def ts(v):
    x=v[:-1]+"+00:00" if v.endswith("Z") else v
    d=datetime.fromisoformat(x)
    if d.tzinfo is None: d=d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)
def hash_obj(v):
    return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("period")
    ap.add_argument("journal")
    ap.add_argument("--plan",default="platform-p35-operating-effectiveness-plan.json")
    ap.add_argument("--out",default="p35-operating-effectiveness-result.json")
    a=ap.parse_args()
    plan=load(a.plan); period=load(a.period); errors=[]
    mode=period.get("mode")
    if mode not in ("simulation","operating"): errors.append("invalid_period_mode")
    start=ts(period["periodStart"]); end=ts(period["periodEnd"])
    if start>end: errors.append("period_end_before_start")
    days=(end.date()-start.date()).days+1
    if days<plan["evidencePeriod"]["internalDryRunMinimumCalendarDays"]:
        errors.append("evidence_period_too_short")
    if mode=="operating" and not period.get("startAuthorizationId"):
        errors.append("operating_period_missing_start_authorization")
    if mode=="operating" and period.get("backfilled") is True:
        errors.append("operating_period_backfill_forbidden")

    pid=period["periodId"]; records=[]
    for i,line in enumerate(Path(a.journal).read_text(encoding="utf-8").splitlines(),1):
        if not line.strip(): continue
        try: r=json.loads(line)
        except Exception: errors.append("invalid_json_line:"+str(i)); continue
        if r.get("periodId")!=pid: continue
        try: when=ts(r["timestamp"])
        except Exception: errors.append("invalid_timestamp:"+str(i)); continue
        if start<=when<=end: records.append((when,r))
    if not records: errors.append("no_period_evidence")

    for _,r in records:
        kind=r.get("evidenceKind")
        if mode=="operating" and kind!="production_evidence": errors.append("synthetic_evidence_in_operating_period:"+r.get("testId","unknown"))
        if mode=="simulation" and kind!="synthetic_test": errors.append("non_synthetic_evidence_in_simulation:"+r.get("testId","unknown"))
        if not r.get("evidenceRefs"): errors.append("missing_evidence_refs:"+r.get("testId","unknown"))

    failures=[(w,r) for w,r in records if r.get("status")=="fail"]
    for when,r in failures:
        if not r.get("linkedIssue"): errors.append("unexplained_failure:"+r.get("testId","unknown"))
        if not r.get("resolutionRef"): errors.append("failure_without_resolution_ref:"+r.get("testId","unknown"))
        later=any(
          w2>when and r2.get("status")=="pass" and r2.get("controlId")==r.get("controlId") and r2.get("testId")==r.get("testId")
          for w2,r2 in records
        )
        if not later: errors.append("failure_without_subsequent_pass:"+r.get("testId","unknown"))

    per=set(plan["evidenceCadence"]["perChange"]["requiredControls"])
    expected_changes=set(period.get("expectedChangeIds") or [])
    by_change=defaultdict(set)
    for _,r in records:
        if r.get("status")=="pass" and r.get("changeId"):
            by_change[r["changeId"]].add(r.get("controlId"))
    for cid in sorted(expected_changes):
        missing=sorted(per-by_change.get(cid,set()))
        if missing: errors.append("per_change_coverage:"+cid+":"+",".join(missing))

    daily=plan["evidenceCadence"]["daily"]
    daily_controls=daily["requiredControls"]
    dates=[start.date()+timedelta(days=i) for i in range(days)]
    pass_days=defaultdict(set)
    for when,r in records:
        if r.get("status")=="pass" and r.get("controlId") in daily_controls:
            pass_days[r["controlId"]].add(when.date())
    for cid in daily_controls:
        good=sum(d in pass_days[cid] for d in dates)
        if (100*good/len(dates)) < daily["minimumSuccessfulDaysPct"]:
            errors.append(f"daily_coverage:{cid}:{good}/{len(dates)}")
        streak=0
        for d in dates:
            if d in pass_days[cid]: streak=0
            else:
                streak+=1
                if streak>daily["maximumConsecutiveMissedDays"]:
                    errors.append("daily_consecutive_miss:"+cid); break

    weekly=set(plan["evidenceCadence"]["weekly"]["requiredChecks"])
    touched=set()
    d=start.date()
    while d<=end.date():
        x=d.isocalendar(); touched.add((x.year,x.week)); d+=timedelta(days=1)
    seen=defaultdict(set)
    for when,r in records:
        if r.get("status")=="pass" and r.get("testId") in weekly:
            x=when.date().isocalendar(); seen[(x.year,x.week)].add(r["testId"])
    for w in sorted(touched):
        missing=sorted(weekly-seen.get(w,set()))
        if missing: errors.append(f"weekly_coverage:{w[0]}-W{w[1]}:"+",".join(missing))

    monthly=set(plan["evidenceCadence"]["monthly"]["requiredChecks"])
    month_seen={r.get("testId") for _,r in records if r.get("status")=="pass" and r.get("testId") in monthly}
    miss=sorted(monthly-month_seen)
    if miss: errors.append("monthly_coverage:"+",".join(miss))

    incidents=set(period.get("expectedIncidentIds") or [])
    if incidents:
        covered={r.get("incidentId") for _,r in records if r.get("status")=="pass" and r.get("incidentId")}
        miss=sorted(incidents-covered)
        if miss: errors.append("incident_population_uncovered:"+",".join(miss))
    else:
        if not any(r.get("status")=="pass" and r.get("testId")=="incident_response_drill" for _,r in records):
            errors.append("zero_incident_population_requires_drill")

    if not any(r.get("status")=="pass" and r.get("testId") in ("restore_recovery_sample","restore_recovery_drill") for _,r in records):
        errors.append("restore_or_recovery_sample_missing")

    exceptions=set(period.get("expectedExceptionIds") or [])
    if exceptions:
        covered={r.get("exceptionId") for _,r in records if r.get("status")=="pass" and r.get("exceptionId")}
        miss=sorted(exceptions-covered)
        if miss: errors.append("exception_population_uncovered:"+",".join(miss))
    else:
        if not any(r.get("status")=="pass" and r.get("testId")=="exceptions_zero_population" for _,r in records):
            errors.append("zero_exception_population_not_evidenced")

    out={
      "schemaVersion":2,"phase":"P35","periodId":pid,"mode":mode,
      "status":"pass" if not errors else "fail",
      "calendarDays":days,"records":len(records),"expectedChanges":len(expected_changes),
      "failedRecords":len(failures),
      "simulationPass":mode=="simulation" and not errors,
      "operatingEffectivenessPass":mode=="operating" and not errors,
      "operatingEffectivenessProven":mode=="operating" and not errors,
      "externalCertificationClaim":False,"errors":sorted(set(errors))
    }
    out["resultDigest"]=hash_obj({k:v for k,v in out.items() if k!="resultDigest"})
    Path(a.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
