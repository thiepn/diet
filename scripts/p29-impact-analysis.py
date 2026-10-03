#!/usr/bin/env python3
import argparse,hashlib,json
from collections import defaultdict,deque
from pathlib import Path

TRANSITIVE={"provider_breaking","infrastructure_contract"}
DIRECT={"provider_additive"}
OWNER_PLATFORM={"data_migration_no_contract","operational_job"}
SELF={"consumer_only"}
KNOWN=TRANSITIVE|DIRECT|OWNER_PLATFORM|SELF

def load_bytes(path):
    p=Path(path); raw=p.read_bytes()
    return json.loads(raw.decode("utf-8")),hashlib.sha256(raw).hexdigest()

def canonical_sha(obj):
    return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def direct_consumers(graph):
    d=defaultdict(set)
    for e in graph["edges"]: d[e["provider"]].add(e["consumer"])
    return d

def transitive(start,direct):
    seen=set(); q=deque([start])
    while q:
        p=q.popleft()
        for c in sorted(direct.get(p,())):
            if c not in seen:
                seen.add(c); q.append(c)
    return seen

def topo(nodes,edges):
    nodes=set(nodes); out=defaultdict(set); indeg={n:0 for n in nodes}
    for e in edges:
        p,c=e["provider"],e["consumer"]
        if p in nodes and c in nodes and c not in out[p]:
            out[p].add(c); indeg[c]+=1
    q=deque(sorted(n for n,d in indeg.items() if d==0)); result=[]
    while q:
        n=q.popleft(); result.append(n)
        for c in sorted(out[n]):
            indeg[c]-=1
            if indeg[c]==0:q.append(c)
    if len(result)!=len(nodes): raise SystemExit("dependency cycle detected in affected release set")
    return result

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("change_manifest")
    ap.add_argument("--graph",default="platform-p29-dependency-graph.json")
    ap.add_argument("--out",default="p29-impact-analysis.json")
    args=ap.parse_args()
    graph,graph_sha=load_bytes(args.graph)
    change= json.loads(Path(args.change_manifest).read_text(encoding="utf-8"))
    change_sha=canonical_sha(change)

    if change.get("graphVersion") not in (None,graph["graphVersion"]):
        raise SystemExit("change manifest graphVersion does not match dependency graph")
    nodes={n["id"]:n for n in graph["nodes"]}
    direct=direct_consumers(graph)
    impacted=set(); changed=set(); reasons=defaultdict(list); scopes=set()
    breaking=False; epoch_invalidated=False; quiet=False; classes=set()

    changes=change.get("changes") or []
    if not changes: raise SystemExit("change manifest contains no changes")
    for item in changes:
        comp=item.get("component"); cls=item.get("class")
        if comp not in nodes: raise SystemExit(f"unknown component: {comp}")
        if cls not in KNOWN: raise SystemExit(f"unknown change class: {cls}")
        classes.add(cls); changed.add(comp); impacted.add(comp); reasons[comp].append(f"changed:{cls}")
        if cls in TRANSITIVE:
            breaking=True; quiet=True
            for c in transitive(comp,direct):
                impacted.add(c); reasons[c].append(f"transitive-consumer-of:{comp}")
            scopes.update(["provider_contract","all_affected_consumers","cross_app_smoke","security_integrity"])
        elif cls in DIRECT:
            for c in sorted(direct.get(comp,())):
                impacted.add(c); reasons[c].append(f"direct-consumer-of:{comp}")
            scopes.update(["provider_contract","direct_consumers","cross_app_smoke"])
        elif cls in OWNER_PLATFORM:
            impacted.add("platform_control"); reasons["platform_control"].append(f"operational-validation-for:{comp}")
            scopes.update(["owner","platform_control","operational_health"])
        else:
            scopes.add("changed_component")

        changes_epoch=any(item.get(k) for k in (
          "changesSharedSchema","changesIdentityContract","changesEdgeContract","changesCronInventory"
        ))
        if changes_epoch:
            epoch_invalidated=True
            impacted.add("platform_control"); reasons["platform_control"].append(f"release-epoch-validation-for:{comp}")
            scopes.add("platform_control")
        if cls in TRANSITIVE or (cls=="provider_additive" and changes_epoch) or (cls=="operational_job" and item.get("changesCronInventory")):
            quiet=True

    order=topo(impacted,graph["edges"])
    providers=[n for n in order if n in changed and nodes[n]["releaseRole"] in ("provider","provider_consumer")]
    consumers=[n for n in order if n not in providers]
    waves={
      "W0":["freeze_graph_change_epoch","calculate_impact"],
      "W1":providers,
      "W2":["provider_health_and_old_consumer_compatibility"] if providers else [],
      "W3":consumers,
      "W4":["full_affected_compatibility_matrix"],
      "W5":["deprecated_contract_cleanup_after_explicit_authorization"] if breaking else [],
      "W6":["issue_immutable_compatibility_certificate"]
    }
    out={
      "schemaVersion":2,"phase":"P29","graphVersion":graph["graphVersion"],"graphSha256":graph_sha,
      "changeManifestSha256":change_sha,"changeId":change.get("changeId"),
      "changeClasses":sorted(classes),"breaking":breaking,
      "changedComponents":sorted(changed),"affectedComponents":order,"affectedCount":len(order),
      "reasons":{k:sorted(v) for k,v in sorted(reasons.items())},
      "requiredScopes":sorted(scopes),"releaseEpochInvalidated":epoch_invalidated,
      "requiresQuietWindow":quiet,"requiredQuietWindowMinutes":60 if quiet else 0,
      "releaseWaves":waves,"productionPromotionAllowed":False
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

if __name__=="__main__": main()
