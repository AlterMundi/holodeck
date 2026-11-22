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
rechecks current admission; situated native world actions recheck the retained
source and pairing. Explicit own-native mode requires the selected private
receiving lane and fresh current being grant, independently of a human original
or browser. It is enabled only after receiver socket isolation is qualified; see
[deployment](deployment.md) and [creator quickstart](native-creation-quickstart.md).
Both modes use current room rights and the same canonical state. Perceptual scope
is explicit.

See deployment.md for package, selected receiver, health, upgrade and rollback.
The independent Holodeck slot preserves the existing Harmonic Lab service.
Ordinary service deployment is not project-content publication or native uptake.

## Bounds and retention

- One room/run; eight simultaneous development/network sessions; 32 authored
  elements including deletion tombstones. No recycled entity identity.
- 256 semantic events; 256 exact command outcomes; at most128 captured
  observations and2MiB of serialized read-cache. New reads and legacy loads
  discard expired/oversized captures and evict the oldest disposable captures
  within those limits. Default observations fit32KiB; explicit omissions retain
  all canonical entities/node definitions and the speaker/paired indications.
  Optional client-reported view details can be omitted with an explicit marker
  when necessary; this never establishes visual perception. An evicted capture
  requires a fresh observation for a new action; an already completed exact
  command retry still resolves its retained result before capture lookup.
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

## Existing content entrances

Configure selected existing sources through the receiving private `contentVisits`
array described in [content-visits.md](content-visits.md). Do not commit its real
private table/report references or participant mappings. Discovery is not a grant.
Keep one mounted viewer and preserve its dirty/capture/processing state when
returning to the world. Changing source selection does not rewrite saved notes,
a report edition, or the world's published result.

## Native room authority and initial projection

Select `receiving.authoritySocket` as the existing central Home owner bridge.
Only that bridge receives its fixed `world_service_key`; remote paired native
bridges retain their existing custody. After original/input/pair and return-port
verification, the service queries the current being's own service permission.
The owner operation checks the real runtime capability, selected App version
and audience. It creates no session or grant. A selected authority's denial,
timeout or malformed result never falls back to a human cookie. Older receivers
without this selection retain only their documented compatibility behavior.
The query admits at most8KiB of response and has an eight-second deadline.

The initial server startup and subsequent projection queue await the real
upstream DOM snapshot; see [world-document.md](world-document.md). Initial failure
does not start a ready service. A later fenced representation rejects new game
edits/projections while preserving the Room's committed state and readable native
observations/results. Acknowledged upstream state is not human-visible pixels.

## Recent world activity

`GET api/activity` is an authenticated, on-demand read of the existing Room's
256-event ring. It requires current `observe` rights and does not create a Room
observation, command outcome, subscription, model input or another history store.
The ordinary session/authentication boundary is unchanged. Uncertain checkpoints
return503; historical reads never bypass current admission.

The first request can supply `limit=1..20` and an optional expected `run`. Older
pages supply all three `run`, `through` and `before`; `through` is the first
response's frozen sequence ceiling and `before` is an exclusive sequence cursor.
Unknown/duplicate/malformed query fields return400. A different run returns409
with `code: stale-run`; reopen the current history rather than merge runs.
Responses contain at most20 newest-first records and32768 serialized UTF-8 bytes,
including the envelope. `nextBefore` is the oldest returned sequence when more
retained records exist, otherwise null. A byte-limited page returns fewer items
and `byteLimited: true`; its cursor still advances without skipping a record.

The `holodeck.activity/v1` response contains:

- `run`, `edition`, frozen `through`, `currentThrough` and `capturedAt`. Current
  comparisons use the same synchronous read at `currentThrough`; later edits do
  not rewrite an earlier record or its frozen history cursor.
- `retention: {limit, count, firstSequence, lastSequence, earlierUnavailable}`
  and `gaps: {earlierUnavailable, cursorEvicted, missingSequences}`. Reset changes
  the run; count eviction removes earlier events. A cursor whose retained window
  was lost returns an empty page with the explicit gap. No24-hour or full-history
  promise, replay, rewind or preimage is implied.
- `items[]` with exact `sequence`, nullable `time`, closed `type`,
  `author: {ref, name, nameSource, isSelf}`, nullable `target`/`eventRevision`,
  `detailStatus`, nullable `recorded` post-state and
  `current: {revision, state, status, actionable}`. Current status is `current`,
  `revised`, `deleted` or `unavailable`; no historical state is filled from today's
  snapshot. `actionable` only describes a retained live target, not an authority
  grant: indicating it must use the existing fresh-observation/current-revision
  action, and a racing change still rejects.

Public state is allowlisted separately for lights, bridge, nodes, explicit
indication, public projection and room presence. A node may include its bounded
public game definition and links; private result pins, selection hashes/URLs,
`nativeRequest`, original/input identifiers, conversation/provider payload and
arbitrary event detail never pass through. Unknown event types return
`type: unavailable`/`detailStatus: unavailable`, retaining only known public
sequence/time/author fields. Presence/projection does not prove physical presence
or model attention. Coordinates have their recorded meaning; they are not
retroactively assigned today's scenery names.

Names currently return null with null provenance: legacy journal names can be a
generic `Explorador` fallback, and neither that label nor a nickname establishes a
trusted historical profile name. Exact recorded actor references remain present
when valid; `isSelf` uses exact authenticated actor-ID equality. Do not infer a
human pairing or silently backfill a historical name. The product may describe
unknown details plainly without claiming a historical source or whole scene was
reopened. Keep only the current page and selected detail in browser memory; this
route installs no poller or client persistence.
