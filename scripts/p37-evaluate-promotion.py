#!/usr/bin/env python3
import argparse,json
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def all_checks_success(row):
    checks=row.get("checks") or []
    return bool(checks) and all(x.get("conclusion")=="success" for x in checks)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("certification")
    ap.add_argument("state")
    ap.add_argument("--manifest",default="contracts/p37-governance-promotion-manifest.json")
    ap.add_argument("--out",default="p37-promotion-decision.json")
    args=ap.parse_args()

    cert=load(args.certification)
    state=load(args.state)
    manifest=load(args.manifest)
    errors=[]

    if cert.get("decision")!="certified":
        errors.append("p25_generation2_not_certified")

    expected=manifest["phases"]
    rows={x.get("phase"):x for x in state.get("phases") or []}
    merged=[]
    candidate=None
    last_post=state.get("promotionStartMainSha")

    for item in expected:
        phase=item["phase"]
        row=rows.get(phase)
        if row is None:
            errors.append("missing_phase_state:"+phase)
            break
        if row.get("prNumber")!=item["prNumber"]:
            errors.append("pr_number_mismatch:"+phase)
            break
        if row.get("branch")!=item["branch"]:
            errors.append("branch_mismatch:"+phase)
            break
        if row.get("headSha")!=item["expectedHeadSha"]:
            errors.append("head_sha_mismatch:"+phase)
            break

        if row.get("merged") is True:
            if not row.get("preMergeMainSha") or not row.get("mergeCommitSha") or not row.get("postMergeMainSha"):
                errors.append("missing_merge_receipt:"+phase)
                break
            if last_post is not None and row.get("preMergeMainSha")!=last_post:
                errors.append("merge_receipt_chain_break:"+phase)
                break
            last_post=row.get("postMergeMainSha")
            merged.append(phase)
            continue

        candidate=(item,row)
        break

    if not errors and candidate is not None:
        candidate_index=next(i for i,x in enumerate(expected) if x["phase"]==candidate[0]["phase"])
        later_merged=[
          x["phase"] for x in expected[candidate_index+1:]
          if (rows.get(x["phase"]) or {}).get("merged") is True
        ]
        if later_merged:
            errors.append("out_of_order_merged:"+",".join(later_merged))

    if not errors and candidate is None and len(merged)==len(expected):
        decision={
          "schemaVersion":1,"phase":"P37","decision":"stack_complete",
          "mergedPhases":merged,"nextPhase":None,"errors":[]
        }
    elif errors:
        decision={
          "schemaVersion":1,"phase":"P37","decision":"blocked",
          "mergedPhases":merged,"nextPhase":candidate[0]["phase"] if candidate else None,
          "errors":errors
        }
    else:
        item,row=candidate
        cerrors=[]
        if row.get("state")!="open":
            cerrors.append("candidate_not_open")
        if row.get("mergeable") is not True:
            cerrors.append("candidate_not_mergeable")
        if row.get("syncedToMainSha")!=state.get("currentMainSha"):
            cerrors.append("candidate_not_synced_to_current_main")
        if merged and state.get("currentMainSha")!=last_post:
            cerrors.append("current_main_does_not_match_last_receipt")
        if not all_checks_success(row):
            cerrors.append("candidate_checks_not_all_success")
        if row.get("draft") is not True and row.get("readyForMerge") is not True:
            cerrors.append("candidate_review_state_invalid")
        decision={
          "schemaVersion":1,"phase":"P37",
          "decision":"ready_to_promote_one" if not cerrors and not errors else "blocked",
          "mergedPhases":merged,
          "nextPhase":item["phase"],
          "prNumber":item["prNumber"],
          "branch":item["branch"],
          "headSha":item["expectedHeadSha"],
          "requiredAction":"mark_ready_then_squash_merge" if row.get("draft") is True else "squash_merge",
          "errors":errors+cerrors
        }

    Path(args.out).write_text(json.dumps(decision,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(decision,separators=(",",":")))
    if decision["decision"]=="blocked":
        raise SystemExit(1)

if __name__=="__main__":
    main()
