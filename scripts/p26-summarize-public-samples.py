#!/usr/bin/env python3
import argparse, json, math
from datetime import datetime, timezone
from pathlib import Path

def parse_ts(value):
    if value.endswith("Z"):
        value=value[:-1]+"+00:00"
    dt=datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def percentile(values, p):
    if not values:
        return None
    xs=sorted(values)
    rank=max(1, math.ceil(p*len(xs)))
    return round(float(xs[rank-1]), 3)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+", help="P26 public steady-state JSON files or directories")
    ap.add_argument("--out", default="p26-public-baseline-summary.json")
    ap.add_argument("--minimum-samples", type=int, default=19)
    ap.add_argument("--minimum-span-hours", type=float, default=72.0)
    args=ap.parse_args()

    files=[]
    for raw in args.paths:
        p=Path(raw)
        if p.is_dir():
            files.extend(sorted(p.glob("**/p26-public-steady-state*.json")))
        elif p.is_file():
            files.append(p)
        else:
            files.extend(sorted(Path().glob(raw)))

    unique=[]
    seen=set()
    for p in files:
        rp=str(p.resolve())
        if rp not in seen:
            seen.add(rp)
            unique.append(p)

    samples=[]
    for p in unique:
        data=json.loads(p.read_text(encoding="utf-8"))
        if data.get("phase")!="P26":
            continue
        checked=data.get("checkedAt")
        if not checked:
            continue
        samples.append((parse_ts(checked),p,data))
    samples.sort(key=lambda x:x[0])

    if not samples:
        raise SystemExit("No valid P26 public steady-state samples found.")

    start=samples[0][0]
    end=samples[-1][0]
    span_hours=(end-start).total_seconds()/3600.0

    def check_values(name, key):
        vals=[]
        for _,_,sample in samples:
            for check in sample.get("checks",[]):
                if check.get("name")==name and isinstance(check.get(key),(int,float)):
                    vals.append(float(check[key]))
        return vals

    auth_internal=check_values("platform_health","authLatencyMs")
    db_internal=check_values("platform_health","databaseLatencyMs")
    shell_e2e=check_values("diet_shell","endToEndLatencyMs")
    auth_health_e2e=check_values("auth_health","endToEndLatencyMs")
    platform_e2e=check_values("platform_health","endToEndLatencyMs")

    passed=sum(1 for _,_,x in samples if x.get("passed") is True)
    warnings=sum(1 for _,_,x in samples if x.get("performanceWarning") is True)
    states=sorted({str(x.get("state")) for _,_,x in samples})
    releases=sorted({str(x.get("activeOperationsRelease")) for _,_,x in samples})

    qualification={
        "minimumSamples":args.minimum_samples,
        "minimumSpanHours":args.minimum_span_hours,
        "sampleCountMet":len(samples)>=args.minimum_samples,
        "spanMet":span_hours>=args.minimum_span_hours,
        "allSamplesPassed":passed==len(samples),
        "noPerformanceWarnings":warnings==0,
        "singlePhaseState":len(states)==1,
        "qualified":False,
    }
    qualification["qualified"]=all([
        qualification["sampleCountMet"],
        qualification["spanMet"],
        qualification["allSamplesPassed"],
        qualification["noPerformanceWarnings"],
        qualification["singlePhaseState"],
    ])

    report={
        "schemaVersion":1,
        "phase":"P26",
        "generatedAt":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
        "window":{
            "start":start.isoformat().replace("+00:00","Z"),
            "end":end.isoformat().replace("+00:00","Z"),
            "spanHours":round(span_hours,3),
            "sampleCount":len(samples),
            "passedSamples":passed,
            "performanceWarningSamples":warnings,
            "states":states,
            "activeOperationsReleases":releases,
        },
        "latencyMs":{
            "platformAuth":{"p50":percentile(auth_internal,.50),"p95":percentile(auth_internal,.95),"max":max(auth_internal) if auth_internal else None},
            "platformDatabase":{"p50":percentile(db_internal,.50),"p95":percentile(db_internal,.95),"max":max(db_internal) if db_internal else None},
            "dietShellE2E":{"p50":percentile(shell_e2e,.50),"p95":percentile(shell_e2e,.95),"max":max(shell_e2e) if shell_e2e else None},
            "authHealthE2E":{"p50":percentile(auth_health_e2e,.50),"p95":percentile(auth_health_e2e,.95),"max":max(auth_health_e2e) if auth_health_e2e else None},
            "platformHealthE2E":{"p50":percentile(platform_e2e,.50),"p95":percentile(platform_e2e,.95),"max":max(platform_e2e) if platform_e2e else None},
        },
        "qualification":qualification,
        "sources":[str(p) for _,p,_ in samples],
    }

    Path(args.out).write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,separators=(",",":")))
    if not qualification["qualified"]:
        raise SystemExit(2)

if __name__=="__main__":
    main()
