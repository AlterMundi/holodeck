#!/usr/bin/env bash
set -euo pipefail

revision=97f23f270330e33b9849a2014cc5f9d82dadb827
digest=384d01a0a2f3ad838a89cab8f50c4123f7c3ff9455d46ba560bbce25e8db67f7
checker=$(mktemp)
trap 'unlink "$checker"' EXIT

curl --fail --silent --show-error --proto '=https' --max-time 25 \
  "https://raw.githubusercontent.com/AlterMundi/Skills/$revision/scripts/audience_check.py" \
  --output "$checker"
printf '%s  %s\n' "$digest" "$checker" | sha256sum --check --status
python3 "$checker" "$@"
