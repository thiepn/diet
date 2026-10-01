#!/usr/bin/env python3
import argparse, hashlib, json
from pathlib import Path

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")

def hash_entry(entry):
    body=dict(entry)
    body.pop("entryHash",None)
    return hashlib.sha256(canonical(body)).hexdigest()

def read_ledger(path):
    entries=[]
    for lineno,line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(),1):
        if not line.strip(): continue
        try: entries.append(json.loads(line))
        except Exception as e: raise SystemExit(f"invalid JSON at line {lineno}: {e}")
    return entries

def verify(entries):
    errors=[];ids=set();previous=None
    for i,e in enumerate(entries):
        if e.get("sequence")!=i: errors.append(f"sequence:{i}")
        eid=e.get("eventId")
        if not eid or eid in ids: errors.append(f"eventId:{i}")
        ids.add(eid)
        if i==0:
            if e.get("previousHash") is not None: errors.append("genesis_previous_hash")
        elif e.get("previousHash")!=previous:
            errors.append(f"previousHash:{i}")
        actual=hash_entry(e)
        if e.get("entryHash")!=actual:
            errors.append(f"entryHash:{i}")
        previous=e.get("entryHash")
    return {"status":"pass" if not errors else "fail","entries":len(entries),"headHash":previous,"errors":errors}

def main():
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest="cmd",required=True)
    p=sub.add_parser("verify");p.add_argument("ledger");p.add_argument("--out")
    p=sub.add_parser("append");p.add_argument("ledger");p.add_argument("event");p.add_argument("--out")
    args=ap.parse_args()
    entries=read_ledger(args.ledger)
    if args.cmd=="verify":
        result=verify(entries)
        if args.out: Path(args.out).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
        print(json.dumps(result,separators=(",",":")))
        if result["status"]!="pass": raise SystemExit(1)
        return
    current=verify(entries)
    if current["status"]!="pass": raise SystemExit("refusing append to invalid ledger")
    event=json.loads(Path(args.event).read_text(encoding="utf-8"))
    event.pop("entryHash",None)
    event["schemaVersion"]=1
    event["sequence"]=len(entries)
    event["previousHash"]=current["headHash"]
    if not event.get("eventId") or not event.get("timestamp") or not event.get("eventType"):
        raise SystemExit("eventId, timestamp and eventType required")
    event["entryHash"]=hash_entry(event)
    target=Path(args.out or args.ledger)
    existing="".join(json.dumps(e,separators=(",",":"),ensure_ascii=False)+"\n" for e in entries)
    target.write_text(existing+json.dumps(event,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps(event,separators=(",",":")))

if __name__=="__main__": main()
