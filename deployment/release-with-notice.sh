#!/usr/bin/env bash
set -euo pipefail

control=/var/lib/daimon-home-services/holodeck-control
state=/var/lib/daimon-home-services-state/holodeck
current=$(sudo -n jq -er '.digest | select(test("^[a-f0-9]{64}$"))' "$control/current.json")
if [[ $# == 2 && $1 == --request ]]; then
    request=$2
    target=$(jq -er --arg current "$current" '
        select(.schema == "dm.home-service-deploy/v1" and .service == "holodeck" and .previous == $current)
        | .package.sha256 | select(test("^[a-f0-9]{64}$"))' "$request")
    kind=restart
elif [[ $# == 1 && $1 == --announce-live ]]; then
    target=$current
    kind=live
else
    echo "Usage: $0 --request DEPLOYMENT.json | --announce-live" >&2
    exit 2
fi

stage=$(sudo -n mktemp "$state/.release-notice.XXXXXXXX")
trap 'sudo -n rm -f -- "$stage"' EXIT
expiry=$(( ($(date +%s) + 180) * 1000 ))
jq -cn --arg from "$current" --arg to "$target" --arg kind "$kind" --argjson expires "$expiry" \
    '{from:$from,to:$to,kind:$kind,expires:$expires}' | sudo -n tee "$stage" >/dev/null
sudo -n chmod 0644 "$stage"
sudo -n mv -fT -- "$stage" "$state/release-notice.json"
if [[ $kind == restart ]]; then
    sleep 12
    timeout 150s "$HOME/.local/bin/daimon-home-service" --request "$request"
fi
