#!/usr/bin/env python3
import json,subprocess,sys,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/"scripts/p31-control-plane.py"
FLEET_VERSION="2026-10-04.6"
RELEASE_VERSION="2026-10-04.2"

def run(args,expect=0):
    p=subprocess.run([sys.executable,str(CLI),*args],cwd=ROOT,capture_output=True,text=True)
    assert p.returncode==expect,(p.returncode,p.stdout,p.stderr)
    return p

def intent(**kw):
    base={
      "trainId":"notes-fast-1",
      "candidateId":"candidate-123",
      "trainType":"app_fast",
      "components":["notes"],
      "scopes":["app:notes"],
      "fleetRegistryVersion":FLEET_VERSION,
      "releaseRegistryVersion":RELEASE_VERSION,
      "p29CertificateStatus":"pass",
      "p30PromotionStatus":"pass",
      "targetStage":"integration",
      "now":"2026-10-03T12:05:00Z"
    }
    base.update(kw)
    return base

with tempfile.TemporaryDirectory() as td:
    d=Path(td)

    status=d/"status.json"
    run(["status","--out",str(status)])
    s=json.loads(status.read_text())
    assert s["productionHealth"]=="green"
    assert s["releaseSafety"]=="amber"
    assert s["fleetState"]=="amber"
    assert s["coordinationMode"]=="registry_and_epoch_drift"
    assert s["observedComponentCount"]==18
    assert s["dependencyGraphNodeCount"]==18
    assert s["dependencyGraphMissingComponents"]==[]
    assert s["latestMergedGovernancePhase"]=="P36"

    valid=d/"valid.json"
    run(["validate","--out",str(valid)])
    v=json.loads(valid.read_text())
    assert v["status"]=="pass"
    assert v["registryStructurallyValid"] is True
    assert v["releaseReady"] is False
    assert v["governedGraphNodeCount"]==18
    assert v["dependencyGraphNodeCount"]==18
    assert v["observedUnmodeledComponents"]==[]
    assert not any(x.startswith("observed_unmodeled_components:") for x in v["warnings"])

    # Exact observed live state matches the current P31 registry.
    observed={
      "semanticSchemaSha256":"09d16243904c77513df9d695ed060f122e08d921de79d281905235d970e96159",
      "migrationHead":"20261004192902",
      "cronJobs":14,
      "edgeFunctionCount":12,
      "gomokuRoomVersion":50,
      "gomokuRoomSha256":"a537d0702fdb53861124849e03fb7141a8036a4ee5c692fa9bf4769c47981695",
      "registeredApps":["notes","diet","wordstrike","gomoku","semester-os","wttn","tms60"]
    }
    obs=d/"observed.json"; rec=d/"reconcile.json"
    obs.write_text(json.dumps(observed),encoding="utf-8")
    run(["reconcile",str(obs),"--out",str(rec)])
    assert json.loads(rec.read_text())["status"]=="match"

    newer=json.loads(json.dumps(observed))
    newer["gomokuRoomVersion"]=51
    obs.write_text(json.dumps(newer),encoding="utf-8")
    run(["reconcile",str(obs),"--out",str(rec)])
    r=json.loads(rec.read_text())
    assert r["status"]=="stale"
    assert "gomokuRoomVersion" in r["staleFields"]
    assert r["desiredStateRewritten"] is False

    ip=d/"intent.json"; decision=d/"decision.json"

    # Unrelated governed app_fast work may proceed.
    notes=intent()
    ip.write_text(json.dumps(notes),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)])
    dec=json.loads(decision.read_text())
    assert dec["decision"]=="allow"
    assert "published_operations_manifest_lags_control_plane" in dec["warnings"]

    # Gomoku app-fast now matches the reconciled v48 epoch and may proceed.
    gomoku=intent(
      trainId="gomoku-fast-1",components=["gomoku"],
      scopes=["app:gomoku","edge:gomoku-room"]
    )
    ip.write_text(json.dumps(gomoku),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)])
    assert json.loads(decision.read_text())["decision"]=="allow"

    # Semester OS is now governed and may use the app-fast path.
    semester=intent(
      trainId="semester-fast-1",components=["semester-os"],scopes=["app:semester-os"]
    )
    ip.write_text(json.dumps(semester),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)])
    assert json.loads(decision.read_text())["decision"]=="allow"

    # Shared/stateful release blocks while epoch and graph coverage are incomplete.
    shared=intent(
      trainId="notes-shared-1",trainType="shared_standard",
      scopes=["app:notes","database_schema"]
    )
    ip.write_text(json.dumps(shared),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)],1)
    dec=json.loads(decision.read_text())
    assert "shared_epoch_not_stable" in dec["reasons"]
    assert "fleet_dependency_coverage_incomplete" not in dec["reasons"]

    # Hosted branch path remains unavailable while its action state is failed.
    hosted=intent(integrationEnvironmentKind="supabase_branch")
    ip.write_text(json.dumps(hosted),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)],1)
    assert "observed_block:supabase-main-branch-action-failed" in json.loads(decision.read_text())["reasons"]

    # Stale registry identity cannot authorize.
    stale_registry=intent(fleetRegistryVersion="old")
    ip.write_text(json.dumps(stale_registry),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)],1)
    assert "fleet_registry_version_mismatch" in json.loads(decision.read_text())["reasons"]

    # Active scoped lease blocks; expired lease remains evidence but does not block.
    leases=d/"leases.json"
    leases.write_text(json.dumps({"leases":[{
      "id":"notes-maint","type":"maintenance","state":"active","owner":"notes",
      "reason":"maintenance","scopes":["app:notes"],
      "issuedAt":"2026-10-03T11:00:00Z","expiresAt":"2026-10-03T13:00:00Z"
    }]}),encoding="utf-8")
    ip.write_text(json.dumps(notes),encoding="utf-8")
    run(["can-release",str(ip),"--leases",str(leases),"--out",str(decision)],1)
    assert "lease_conflict:notes-maint" in json.loads(decision.read_text())["reasons"]

    leases.write_text(json.dumps({"leases":[{
      "id":"old-notes-maint","type":"maintenance","state":"active","owner":"notes",
      "reason":"old","scopes":["app:notes"],
      "issuedAt":"2026-10-03T10:00:00Z","expiresAt":"2026-10-03T12:00:00Z"
    }]}),encoding="utf-8")
    run(["can-release",str(ip),"--leases",str(leases),"--out",str(decision)])
    dec=json.loads(decision.read_text())
    assert dec["decision"]=="allow"
    assert "old-notes-maint" in dec["expiredLeases"]

    # Incident platform-global lease preempts normal release.
    leases.write_text(json.dumps({"leases":[{
      "id":"incident-1","type":"incident","state":"active","owner":"platform",
      "reason":"incident","scopes":["platform_global"],
      "issuedAt":"2026-10-03T11:00:00Z","expiresAt":"2026-10-03T13:00:00Z"
    }]}),encoding="utf-8")
    run(["can-release",str(ip),"--leases",str(leases),"--out",str(decision)],1)
    assert "incident_lease_conflict:incident-1" in json.loads(decision.read_text())["reasons"]

    # Production requires traceable approval.
    prod=intent(targetStage="production")
    ip.write_text(json.dumps(prod),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)],1)
    dec=json.loads(decision.read_text())
    assert "manual_production_approval_required" in dec["reasons"]
    assert "production_approval_reference_required" in dec["reasons"]

    prod["manualProductionApproval"]={"approved":True,"approvalRef":"operator-approval:test"}
    ip.write_text(json.dumps(prod),encoding="utf-8")
    run(["can-release",str(ip),"--out",str(decision)])
    assert json.loads(decision.read_text())["decision"]=="allow"

print("P31 fleet status, reconciliation, governance, leases and release-decision contracts passed.")
