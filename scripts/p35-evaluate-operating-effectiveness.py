#!/usr/bin/env python3
import argparse,json,math
from collections import defaultdict
from datetime import datetime,timedelta,timezone
from pathlib import Path

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def ts(v): return datetime.fromisoformat(v.replace("Z","+00:00"))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("period")
    ap.add_argument("journal")
    ap.add_argument("--plan",default="platform-p35-operating-effectiveness-plan.json")
    ap.add_argument("--out",default="p35-operating-effectiveness-result.json")
    args=ap.parse_args()
    plan=load(args.plan); period=load(args.period)
    errors=[]
    start=ts(period["periodStart"]); end=ts(period["periodEnd"])
    duration=(end-start).total_seconds()/86400
    calendar_days=(end.date()-start.date()).days+1
    min_days=plan["evidencePeriod"]["internalDryRunMinimumDays"]
    if calendar_days < min_days: errors.append("evidence_period_too_short")
    period_id=period["periodId"]
    records=[]
    for i,line in enumerate(Path(args.journal).read_text(encoding="utf-8").splitlines(),1):
        if not line.strip(): continue
        r=json.loads(line)
        if r.get("periodId")!=period_id: continue
        if not (start<=ts(r["timestamp"])<=end): continue
        records.append(r)
    if not records: errors.append("no_period_evidence")

    failures=[r for r in records if r.get("status")=="fail"]
    for r in failures:
        if not r.get("linkedIssue"): errors.append("unlinked_control_failure:"+r.get("testId","unknown"))

    # All declared changes need all per-change controls passing.
    per_controls=set(plan["evidenceCadence"]["perChange"]["requiredControls"])
    expected_changes=set(period.get("expectedChangeIds",[]))
    by_change=defaultdict(set)
    for r in records:
        if r.get("status")=="pass" and r.get("changeId"):
            by_change[r["changeId"]].add(r.get("controlId"))
    for change in sorted(expected_changes):
        missing=sorted(per_controls-by_change.get(change,set()))
        if missing: errors.append("per_change_coverage:"+change+":"+",".join(missing))

    # Daily controls: each control must meet coverage threshold, and no >1 consecutive missed day.
    daily_controls=plan["evidenceCadence"]["daily"]["requiredControls"]
    threshold=plan["evidenceCadence"]["daily"]["minimumSuccessfulDaysPct"]/100
    max_missed=plan["evidenceCadence"]["daily"]["maximumConsecutiveMissedDays"]
    day_count=calendar_days
    dates=[(start.date()+timedelta(days=i)).isoformat() for i in range(day_count)]
    pass_days=defaultdict(set)
    for r in records:
        if r.get("status")=="pass" and r.get("controlId") in daily_controls:
            pass_days[r["controlId"]].add(ts(r["timestamp"]).date().isoformat())
    for cid in daily_controls:
        good=sum(1 for d in dates if d in pass_days[cid])
        if good/len(dates) < threshold:
            errors.append(f"daily_coverage:{cid}:{good}/{len(dates)}")
        streak=0
        for d in dates:
            if d in pass_days[cid]: streak=0
            else:
                streak+=1
                if streak>max_missed:
                    errors.append(f"daily_consecutive_miss:{cid}")
                    break

    # Weekly checks: each touched ISO week must have each required check pass.
    weekly=plan["evidenceCadence"]["weekly"]["requiredChecks"]
    weeks=set()
    d=start.date()
    while d<=end.date():
        iso=d.isocalendar();weeks.add((iso.year,iso.week));d+=timedelta(days=1)
    weekly_seen=defaultdict(set)
    for r in records:
        if r.get("status")=="pass" and r.get("testId") in weekly:
            x=ts(r["timestamp"]).date().isocalendar()
            weekly_seen[(x.year,x.week)].add(r["testId"])
    for w in sorted(weeks):
        missing=sorted(set(weekly)-weekly_seen.get(w,set()))
        if missing: errors.append(f"weekly_coverage:{w[0]}-W{w[1]}:"+",".join(missing))

    monthly=plan["evidenceCadence"]["monthly"]["requiredChecks"]
    monthly_seen={r.get("testId") for r in records if r.get("status")=="pass" and r.get("testId") in monthly}
    missing_monthly=sorted(set(monthly)-monthly_seen)
    if missing_monthly: errors.append("monthly_coverage:"+",".join(missing_monthly))

    out={
      "schemaVersion":1,"phase":"P35","periodId":period_id,
      "status":"pass" if not errors else "fail",
      "durationDays":round(duration,4),"calendarDays":calendar_days,"records":len(records),
      "expectedChanges":len(expected_changes),"failedRecords":len(failures),
      "externalCertificationClaim":False,"errors":errors
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()
