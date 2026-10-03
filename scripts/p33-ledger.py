#!/usr/bin/env python3
import argparse,hashlib,json
from datetime import datetime,timezone
from pathlib import Path

ALLOWED_SOURCES={"github_source","supabase_live","supabase_native_audit","human_approval","derived_policy"}
FORBIDDEN_EVIDENCE_KEYS={
  "accesstoken","refreshtoken","servicerolekey","service_role_key","databasepassword",
  "password","ipaddress","ip_address","useragent","user_agent","email","useremail"
}

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")

def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()

def hash_entry(entry):
    body=dict(entry)
    body.pop("entryHash",None)
    return sha_bytes(canonical(body))

def parse_time(value):
    if not isinstance(value,str) or not value:
        raise ValueError("missing timestamp")
    v=value[:-1]+"+00:00" if value.endswith("Z") else value
    dt=datetime.fromisoformat(v)
    if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def scan_forbidden_keys(value,path="$"):
    hits=[]
    if isinstance(value,dict):
        for k,v in value.items():
            norm=str(k).replace("-","").replace(" ","").lower()
            if norm in FORBIDDEN_EVIDENCE_KEYS:
                hits.append(path+"."+str(k))
            hits.extend(scan_forbidden_keys(v,path+"."+str(k)))
    elif isinstance(value,list):
        for i,v in enumerate(value):
            hits.extend(scan_forbidden_keys(v,f"{path}[{i}]"))
    return hits

def read_ledger(path):
    p=Path(path)
    raw=p.read_bytes()
    entries=[]
    for lineno,line in enumerate(raw.decode("utf-8").splitlines(),1):
        if not line.strip(): continue
        try:
            entries.append(json.loads(line))
        except Exception as exc:
            raise SystemExit(f"invalid JSON at line {lineno}: {exc}")
    return raw,entries

def load_anchor(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def verify(path,anchor_path=None):
    raw,entries=read_ledger(path)
    errors=[]; ids=set(); previous=None

    if not entries:
        errors.append("empty_ledger")

    for i,e in enumerate(entries):
        if e.get("schemaVersion")!=2: errors.append(f"schemaVersion:{i}")
        if e.get("sequence")!=i: errors.append(f"sequence:{i}")
        eid=e.get("eventId")
        if not eid or eid in ids: errors.append(f"eventId:{i}")
        ids.add(eid)
        try: parse_time(e.get("recordedAt"))
        except Exception: errors.append(f"recordedAt:{i}")
        if e.get("sourceClass") not in ALLOWED_SOURCES: errors.append(f"sourceClass:{i}")
        if not isinstance(e.get("actor"),dict) or not e["actor"].get("type") or not e["actor"].get("id"):
            errors.append(f"actor:{i}")
        if i==0:
            if e.get("previousHash") is not None: errors.append("genesis_previous_hash")
        elif e.get("previousHash")!=previous:
            errors.append(f"previousHash:{i}")
        actual=hash_entry(e)
        if e.get("entryHash")!=actual: errors.append(f"entryHash:{i}")
        hits=scan_forbidden_keys(e.get("evidence",{}))
        if hits: errors.append(f"privacy_keys:{i}:"+",".join(hits))
        previous=e.get("entryHash")

    anchor=None
    if anchor_path:
        try:
            anchor=load_anchor(anchor_path)
        except Exception as exc:
            errors.append("anchor_invalid_json:"+str(exc))
        if anchor:
            if anchor.get("hashAlgorithm")!="SHA-256": errors.append("anchor_hash_algorithm")
            if anchor.get("entryCount")!=len(entries): errors.append("anchor_entry_count")
            expected_seq=len(entries)-1 if entries else None
            if anchor.get("headSequence")!=expected_seq: errors.append("anchor_head_sequence")
            head=entries[-1] if entries else {}
            if anchor.get("headEventId")!=head.get("eventId"): errors.append("anchor_head_event")
            if anchor.get("headHash")!=head.get("entryHash"): errors.append("anchor_head_hash")
            if anchor.get("ledgerSha256")!=sha_bytes(raw): errors.append("anchor_ledger_sha256")

    return {
      "schemaVersion":2,"phase":"P33",
      "status":"pass" if not errors else "fail",
      "anchored":anchor_path is not None,
      "entries":len(entries),
      "headHash":previous,
      "ledgerSha256":sha_bytes(raw),
      "errors":errors
    }

def append(ledger_path,anchor_path,event_path,out_path,anchor_out):
    current=verify(ledger_path,anchor_path)
    if current["status"]!="pass":
        raise SystemExit("refusing append to invalid ledger/anchor: "+",".join(current["errors"]))
    raw,entries=read_ledger(ledger_path)
    event=json.loads(Path(event_path).read_text(encoding="utf-8"))
    event.pop("entryHash",None)
    event["schemaVersion"]=2
    event["sequence"]=len(entries)
    event["previousHash"]=entries[-1]["entryHash"] if entries else None

    for field in ("eventId","recordedAt","eventType","subject","actor","sourceClass","evidence"):
        if event.get(field) in (None,"",{}):
            raise SystemExit("required event field missing: "+field)
    if event["eventId"] in {e.get("eventId") for e in entries}:
        raise SystemExit("duplicate eventId")
    try: parse_time(event["recordedAt"])
    except Exception: raise SystemExit("invalid recordedAt")
    if event["sourceClass"] not in ALLOWED_SOURCES:
        raise SystemExit("invalid sourceClass")
    hits=scan_forbidden_keys(event.get("evidence",{}))
    if hits:
        raise SystemExit("forbidden sensitive evidence keys: "+",".join(hits))
    if event.get("eventType")=="correction":
        target=(event.get("evidence") or {}).get("supersedesEventId")
        if not target or target not in {e.get("eventId") for e in entries}:
            raise SystemExit("correction must reference existing supersedesEventId")

    event["entryHash"]=hash_entry(event)
    line=json.dumps(event,separators=(",",":"),ensure_ascii=False).encode("utf-8")+b"\n"
    target_raw=raw+line
    Path(out_path).write_bytes(target_raw)

    old_anchor=load_anchor(anchor_path)
    new_anchor={
      "schemaVersion":1,"phase":"P33",
      "ledgerFile":old_anchor.get("ledgerFile","platform-p33-audit-ledger.jsonl"),
      "ledgerPolicyVersion":old_anchor.get("ledgerPolicyVersion"),
      "generatedAt":event["recordedAt"],
      "entryCount":len(entries)+1,
      "headSequence":event["sequence"],
      "headEventId":event["eventId"],
      "headHash":event["entryHash"],
      "ledgerSha256":sha_bytes(target_raw),
      "sourceMainSha":old_anchor.get("sourceMainSha"),
      "hashAlgorithm":"SHA-256",
      "anchorPurpose":old_anchor.get("anchorPurpose")
    }
    Path(anchor_out).write_text(json.dumps(new_anchor,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"event":event,"anchor":new_anchor},separators=(",",":")))

def main():
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest="cmd",required=True)
    v=sub.add_parser("verify")
    v.add_argument("ledger"); v.add_argument("--anchor"); v.add_argument("--out")
    a=sub.add_parser("append")
    a.add_argument("ledger"); a.add_argument("event"); a.add_argument("--anchor",required=True)
    a.add_argument("--out",required=True); a.add_argument("--anchor-out",required=True)
    args=ap.parse_args()

    if args.cmd=="verify":
        result=verify(args.ledger,args.anchor)
        if args.out:
            Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
        print(json.dumps(result,separators=(",",":")))
        if result["status"]!="pass": raise SystemExit(1)
    else:
        append(args.ledger,args.anchor,args.event,args.out,args.anchor_out)

if __name__=="__main__": main()
