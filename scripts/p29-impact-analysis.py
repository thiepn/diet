#!/usr/bin/env python3
import argparse,json
from collections import defaultdict,deque
from pathlib import Path

TRANSITIVE={"provider_breaking","infrastructure_contract"}
DIRECT={"provider_additive"}
OWNER_PLATFORM={"data_migration_no_contract","operational_job"}
SELF={"consumer_only"}

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def topo(nodes,edges):
    nodes=set(nodes)
    # provider -> consumer for release ordering
    out=defaultdict(set); indeg={n:0 for n in nodes}
    for e in edges:
        p=e["provider"]; c=e["consumer"]
        if p in nodes and c in nodes and c not in out[p]:
            out[p].add(c); indeg[c]+=1
    q=deque(sorted(n for n,d in indeg.items() if d==0))
    order=[]
    while q:
        n=q.popleft(); order.append(n)
        for c in sorted(out[n]):
            indeg[c]-=1
            if indeg[c]==0:q.append(c)
    if len(order)!=len(nodes):
        raise SystemExit("dependency cycle detected in affected release set")
    return order

def consumers(graph):
    direct=defaultdict(set)
    for e in graph["edges"]:
        direct[e["provider"]].add(e["consumer"])
    return direct

def transitive(start,direct):
    seen=set(); q=deque([start])
    while q:
        p=q.popleft()
        for c in direct.get(p,()):
            if c not in seen:
                seen.add(c); q.append(c)
    return seen

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("change_manifest")
    ap.add_argument("--graph",default="platform-p29-dependency-graph.json")
    ap.add_argument("--out",default="p29-impact-analysis.json")
    args=ap.parse_args()
    graph=load(args.graph); change=load(args.change_manifest)
    if change.get("graphVersion") not in (None,graph["graphVersion"]):
        raise SystemExit("change manifest graphVersion does not match dependency graph")

    node_ids={n["id"] for n in graph["nodes"]}
    direct=consumers(graph)
    impacted=set(); changed=set(); reasons=defaultdict(list)
    required_scopes=set()
    breaking=False
    release_epoch_invalidated=False

    for item in change.get("changes",[]):
        comp=item.get("component"); cls=item.get("class")
        if comp not in node_ids: raise SystemExit(f"unknown component: {comp}")
        if cls not in TRANSITIVE|DIRECT|OWNER_PLATFORM|SELF:
            raise SystemExit(f"unknown change class: {cls}")
        changed.add(comp); impacted.add(comp)
        reasons[comp].append(f"changed:{cls}")
        if cls in TRANSITIVE:
            breaking=True
            for c in transitive(comp,direct):
                impacted.add(c); reasons[c].append(f"transitive-consumer-of:{comp}")
            required_scopes.update(["provider_contract","all_affected_consumers","cross_app_smoke","security_integrity"])
        elif cls in DIRECT:
            for c in direct.get(comp,()):
                impacted.add(c); reasons[c].append(f"direct-consumer-of:{comp}")
            required_scopes.update(["provider_contract","direct_consumers","cross_app_smoke"])
        elif cls in OWNER_PLATFORM:
            impacted.add("platform_control")
            reasons["platform_control"].append(f"operational-validation-for:{comp}")
            required_scopes.update(["owner","platform_control","operational_health"])
        else:
            required_scopes.add("changed_component")

        if item.get("changesSharedSchema") or item.get("changesIdentityContract") or item.get("changesEdgeContract") or item.get("changesCronInventory"):
            release_epoch_invalidated=True
            impacted.add("platform_control")
            reasons["platform_control"].append(f"release-epoch-validation-for:{comp}")
            required_scopes.add("platform_control")

    order=topo(impacted,graph["edges"])
    waves={
      "W0":["freeze_baseline","capture_schema_edge_cron_inventory","calculate_impact"],
      "W1":[n for n in order if n in changed and graph_node(graph,n)["releaseRole"] in ("provider","provider_consumer")],
      "W2":["provider_health_and_backward_compatibility"],
      "W3":[n for n in order if n not in changed or graph_node(graph,n)["releaseRole"]=="consumer"],
      "W4":["full_affected_compatibility_matrix"],
      "W5":["remove_deprecated_contracts_only_if_all_consumers_pass"] if breaking else [],
      "W6":["issue_immutable_release_certificate"]
    }
    out={
      "schemaVersion":1,"phase":"P29","graphVersion":graph["graphVersion"],
      "changeId":change.get("changeId"),"breaking":breaking,
      "changedComponents":sorted(changed),"affectedComponents":order,
      "affectedCount":len(impacted),"reasons":{k:sorted(v) for k,v in sorted(reasons.items())},
      "requiredScopes":sorted(required_scopes),"releaseEpochInvalidated":release_epoch_invalidated,
      "releaseWaves":waves
    }
    Path(args.out).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(out,separators=(",",":")))

def graph_node(graph,node_id):
    return next(n for n in graph["nodes"] if n["id"]==node_id)

if __name__=="__main__": main()
