# Runtime operations and bounds

## Development

`npm start` binds 127.0.0.1:18940; optional PORT selects another loopback port.
Stop with Ctrl-C. No native model turn or background polling service starts merely
from loading the room. Local actors are development-only, not tribal identities.
Without STATE_DIR the development room is transient. With STATE_DIR, its run,
entities, captured observations and exact command outcomes survive process loss.

## Shared receiving runtime

Production requires NODE_ENV=production, STATE_DIR and its operator-selected
`receiving.json` (schema holodeck.receiving/v1). This selects prefix, HTTPS origin,
the existing Home identity and service-audience routes, and optional installed
native/world Unix sockets. Missing auth fails startup; no anonymous fallback.
The runtime remains loopback-only behind the existing gateway. Every API action
rechecks current admission; native world actions recheck the retained native
source, pairing and current room rights. Perceptual scope is explicit.

See deployment.md for package, selected receiver, health, upgrade and rollback.
The independent Holodeck slot preserves the existing Harmonic Lab service.
Ordinary service deployment is not project-content publication or native uptake.

## Bounds and retention

- One room/run; eight simultaneous development/network sessions; 32 authored
  elements including deletion tombstones. No recycled entity identity.
- 256 semantic events; 256 exact command outcomes; 128 captured observations.
  Retry validity five minutes. An expired request is rejected, never re-authored.
  Missing event windows report gaps. Movement uses MML's separate presence path.
- API body48KiB, with stricter per-operation validation; four writes/second/session.
  Native world port16KiB request/128KiB response, four concurrent requests.
- Room checkpoint5MiB maximum per file: current, previous and stage <=15MiB.
  Atomic durable state/outcome precedes projected updates. Pre-commit failures roll
  back semantic changes; post-replacement uncertainty fences further writes and
  result readback until recovery. Corrupt current state is preserved.
- Native intent journal32 full records plus128 compact terminal references; live
  + stage <=3.6MiB. Confirmed terminal metadata can retire while canonical native
  originals remain recoverable by exact ID/source checks. Unknown writes are kept
  and inspected, never silently retried. Canonical human originals/attachments
  belong to the existing native owner's separate bounded storage. Capacity stops
  new work explicitly; there is no unbounded local conversation archive.
- Build/dependencies budget350MiB; reuse one build and selected package stage.
  Deployment's exact archive/runtime bounds live in deployment.md.
  No growing room log files, autonomous sensor feeds or model attention per event.

The service's operational stop does not cancel retained native work or authorize
coordinated Stop. Preserve published pins and source; state checkpoints are not
an archive of past published creations. Device/media and 3D project-publication
history retain their existing independent owners and limits.
