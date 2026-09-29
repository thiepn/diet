#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <encrypted-backup.cms> <private-key.pem> <output.json>" >&2
  exit 64
fi

encrypted="$1"
private_key="$2"
output="$3"
cert="$(cd "$(dirname "$0")/.." && pwd)/ops/p15-backup-recovery-cert.pem"
root="$(cd "$(dirname "$0")/.." && pwd)"

test -f "$encrypted"
test -f "$private_key"
test -f "$cert"

umask 077
openssl cms -decrypt -binary -inform DER   -in "$encrypted"   -recip "$cert"   -inkey "$private_key"   -out "$output"

python3 "$root/scripts/p15-verify-offsite.py" "$output"
echo "P15 backup decrypted and verified: $output"
