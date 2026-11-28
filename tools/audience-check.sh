#!/usr/bin/env bash
set -euo pipefail

# Exact Skills PR #408 checker. Keep public CI independent of access to Skills.
checker=$(dirname "$0")/audience-check.py
digest=384d01a0a2f3ad838a89cab8f50c4123f7c3ff9455d46ba560bbce25e8db67f7
printf '%s  %s\n' "$digest" "$checker" | sha256sum --check --status
exec python3 "$checker" "$@"
