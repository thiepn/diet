#!/usr/bin/env python3
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/"scripts/p31-control-plane.py"

def run(args,expect=0):
    p=subprocess.run([sys.executable,str(CLI),*args],cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    status=d/"status.json"
    run(["status","--out",str(status)])
    s=json.loads(status.read_text())
    assert s["fleetState"]=="amber"
    assert s["releaseEpochState"]=="moving"
    assert s["activePhase"]["id"]=="P25"
    assert s["nextStagedPhase"]["id"]=="P26"

    valid=d/"valid.json"
    run(["validate","--out",str(valid)])
    v=json.loads(valid.read_text())
    assert v["status"]=="pass"
    assert v["fleetComponents"]==17
    assert v["graphComponents"]==17

    # Reconciliation: exact observation matches.
    fleet=json.loads((ROOT/"platform-p31-fleet-registry.json").read_text())
    exact={
      "semanticSchemaSha256":fleet["releaseEpoch"]["semanticSchemaSha256"],
      "migrationHead":fleet["releaseEpoch"]["migrationHead"],
      "cronJobs":fleet["releaseEpoch"]["cronJobs"],
      "gomokuRoomVersion":fleet["releaseEpoch"]["edge"]["gomokuRoom"]["version"],
      "gomokuRoomSha256":fleet["releaseEpoch"]["edge"]["gomokuRoom"]["sha256"]
    }
    obs=d/"observed.json";rec=d/"reconcile.json"
    obs.write_text(json.dumps(exact),encoding="utf-8")
    run(["reconcile",str(obs),"--out",str(rec)])
    assert json.loads(rec.read_text())["status"]=="match"

    newer=dict(exact);newer["migrationHead"]="20261001170000_future_change"
    obs.write_text(json.dumps(newer),encoding="utf-8")
    run(["reconcile",str(obs),"--out",str(rec)])
    r=json.loads(rec.read_text())
    assert r["status"]=="stale"
    assert "migrationHead" in r["staleFields"]

    # Shared train is blocked while release epoch moves and no preview exists.
    intent=d/"intent.json";decision=d/"decision.json"
    shared={
      "trainId":"shared-1","trainType":"shared_standard","components":["notes"],
      "scopes":["app:notes","database_schema"],
      "p29CertificateStatus":"pass","p30PromotionStatus":"pass",
      "targetStage":"integration","now":"2026-10-01T16:15:00Z"
    }
    intent.write_text(json.dumps(shared),encoding="utf-8")
    run(["can-release",str(intent),"--out",str(decision)],1)
    dec=json.loads(decision.read_text())
    assert "release_epoch_not_stable" in dec["reasons"]
    assert "stateful_promotion_environment_not_healthy" in dec["reasons"]

    # Gomoku app-fast is blocked because current moving scopes intersect.
    gomoku={
      "trainId":"gomoku-fast","trainType":"app_fast","components":["gomoku"],
      "scopes":["app:gomoku"],"p29CertificateStatus":"pass","p30PromotionStatus":"pass",
      "targetStage":"integration","now":"2026-10-01T16:15:00Z"
    }
    intent.write_text(json.dumps(gomoku),encoding="utf-8")
    run(["can-release",str(intent),"--out",str(decision)],1)
    assert "observed_block:shared-epoch-moving" in json.loads(decision.read_text())["reasons"]

    # Unrelated Notes app-fast may proceed in logical integration.
    notes={
      "trainId":"notes-fast","trainType":"app_fast","components":["notes"],
      "scopes":["app:notes"],"p29CertificateStatus":"pass","p30PromotionStatus":"pass",
      "targetStage":"integration","now":"2026-10-01T16:15:00Z"
    }
    intent.write_text(json.dumps(notes),encoding="utf-8")
    run(["can-release",str(intent),"--out",str(decision)])
    dec=json.loads(decision.read_text())
    assert dec["decision"]=="allow"
    assert "active_phase_requires_restart" in dec["warnings"]

    # Active scoped lease blocks; expired lease is evidence only.
    locks=d/"locks.json"
    locks.write_text(json.dumps({"locks":[
      {"id":"notes-maint","state":"active","owner":"notes","reason":"maintenance",
       "scopes":["app:notes"],"expiresAt":"2026-10-01T17:00:00Z"}
    ]}),encoding="utf-8")
    run(["can-release",str(intent),"--locks",str(locks),"--out",str(decision)],1)
    assert "lock_conflict:notes-maint" in json.loads(decision.read_text())["reasons"]

    locks.write_text(json.dumps({"locks":[
      {"id":"old-notes-maint","state":"active","owner":"notes","reason":"old",
       "scopes":["app:notes"],"expiresAt":"2026-10-01T16:00:00Z"}
    ]}),encoding="utf-8")
    run(["can-release",str(intent),"--locks",str(locks),"--out",str(decision)])
    dec=json.loads(decision.read_text())
    assert dec["decision"]=="allow"
    assert "old-notes-maint" in dec["expiredLocks"]

    # Unresolved resource blocks a release touching it.
    unresolved=dict(notes);unresolved["resources"]=["public.change_log"]
    intent.write_text(json.dumps(unresolved),encoding="utf-8")
    run(["can-release",str(intent),"--out",str(decision)],1)
    assert any(x.startswith("unresolved_governance:") for x in json.loads(decision.read_text())["reasons"])

    # Production requires explicit approval.
    prod=dict(notes);prod["targetStage"]="production";prod["manualProductionApproval"]=False
    intent.write_text(json.dumps(prod),encoding="utf-8")
    run(["can-release",str(intent),"--out",str(decision)],1)
    assert "manual_production_approval_required" in json.loads(decision.read_text())["reasons"]

print("P31 control-plane status, reconciliation, lock and release-decision contracts passed.")
