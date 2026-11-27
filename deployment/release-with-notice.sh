#!/usr/bin/env bash
set -euo pipefail

control=/var/lib/daimon-home-services/holodeck-control
state=/var/lib/daimon-home-services-state/holodeck
status_url=http://127.0.0.1:18942/holodeck/release-status
selected() {
    sudo -n jq -er '.digest | select(test("^[a-f0-9]{64}$"))' "$control/current.json"
}
if [[ $# == 1 && $1 == --status ]]; then
    curl -fsS --max-time 5 "$status_url"
    exit
fi
if [[ $# != 2 || $1 != --request ]] && [[ $# != 1 || $1 != --announce-live ]]; then
    echo "Usage: $0 --request DEPLOYMENT.json | --announce-live | --status" >&2
    exit 2
fi

# Serialize supported publication operations through the receiving operator.
exec 9>/run/lock/holodeck-release-notice.lock
flock -n 9 || { echo "Another Holodeck release operation is active." >&2; exit 75; }
current=$(selected)
stage=
trap 'if [[ -n $stage ]]; then sudo -n rm -f -- "$stage"; fi' EXIT

notice() {
    local kind=$1 seconds=$2
    local expiry=$(( ($(date +%s) + seconds) * 1000 ))
    stage=$(sudo -n mktemp "$state/.release-notice.XXXXXXXX")
    jq -cn --arg from "$current" --arg to "$target" --arg kind "$kind" --argjson expires "$expiry" \
        '{from:$from,to:$to,kind:$kind,expires:$expires}' | sudo -n tee "$stage" >/dev/null
    sudo -n chmod 0644 "$stage"
    sudo -n mv -fT -- "$stage" "$state/release-notice.json"
    stage=
}

if [[ $1 == --announce-live ]]; then
    target=$current
    notice live 180
    exit
fi

request=$2
target=$(jq -er --arg current "$current" '
    select(.schema == "dm.home-service-deploy/v1" and .service == "holodeck" and .previous == $current)
    | .package.sha256 | select(test("^[a-f0-9]{64}$") and . != $current)' "$request")
hold() {
    curl -fsS --max-time 5 "$status_url" |
        jq -er --arg version "${current:0:12}" '
            select(.version==$version and (.dnd|type)=="boolean") | .dnd|tostring'
}
deadline=$((SECONDS + 240))
while (( SECONDS < deadline )); do
    dnd=$(hold)
    if [[ $dnd == true ]]; then
        notice request 255
        echo "Holodeck is in DND. Waiting for the human to release it." >&2
        while [[ $dnd == true ]] && (( SECONDS < deadline )); do
            sleep 2
            dnd=$(hold)
        done
        if [[ $dnd == true ]]; then break; fi
    fi

    notice restart 20
    sleep 12
    if [[ $(selected) != "$current" ]]; then
        echo "The selected Holodeck release changed before deployment." >&2
        exit 75
    fi
    # The server refuses new holds after seeing 'applying'. Reading it back
    # after the atomic notice write catches a hold set before that point.
    dnd=$(hold)
    if [[ $dnd == true ]]; then continue; fi
    notice applying 175
    if ! dnd=$(hold); then
        notice request 15
        exit 75
    fi
    if [[ $dnd == true ]]; then continue; fi
    timeout 150s "$HOME/.local/bin/daimon-home-service" --request "$request"
    exit
done
echo "Holodeck was not released for this request. No deployment was submitted." >&2
exit 75
