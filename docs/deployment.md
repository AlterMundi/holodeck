# Shared deployment

Holodeck uses its own protected Home service capability and stable `/holodeck/`
entrance. It does not replace the existing workshop or another application's slot.
The receiving origin, service grant, private access and exact receipts remain in
its operator record. Source publication, runtime selection, real native effects,
browser/device acceptance and human acceptance are separate observations.

## Receiving contracts

The existing Home publisher accepts the closed `dm.home-service-package/v1`
package and `dm.home-service-deploy/v1` request. Runtime is pinned Node24 HTTP;
`HOST`, `PORT`, `STATE_DIR` and `NODE_ENV=production` come from the protected
receiver. `STATE_DIR/receiving.json` selects the existing same-origin shared
identity endpoint, service-audience endpoint, public origin/base path and optional
native/world Unix sockets. `authoritySocket` selects the existing central native
permission bridge; `contentVisits` selects at most eight protected report or artifact entrances.
It carries route metadata and private content references, not credentials.

The optional `gallery` receiving selection names an existing interior
`room` and two distinct exact `artifact_review` pins (`draft` and `archive`,
both with adapter `interactive_3d`). The finished edition continues to come
from the existing owner placement in that room. Keep receiving selections
in the protected configuration. Select editions whose resources already
exist in Nexus. Changing these pointers changes neither the source publication
nor its audience. Omit `gallery` for the existing single-placement behavior.

Only the active gallery asks Nexus about these editions. The request uses the
visitor's existing Home or Nexus session cookies on the configured HTTPS
origin. Each exact descriptor has a three-second deadline and an 8 KiB limit.
Nexus must verify the edition, table and source access before Holodeck lists its
pointer. A move or edition change during the check invalidates that result.
Responses use `no-store`; the browser rechecks the catalog on open or resume.
The same-origin viewer still performs its own access checks.

The in-room 3D display reads the exact Nexus manifest and the authorized
Homes version's `creation.json` and `snapshot.glb` through that same
visitor's session. It checks the returned version headers and the snapshot's
SHA-256 before loading. This display accepts the existing Holodeck static
snapshot format, capped at 4 MiB per GLB and three active displays. The
ordinary Nexus viewer remains the action for other asset formats. Displays
renew their catalog authorization every 20 seconds while the gallery is
active, expire after 30 seconds, and are removed on access loss or departure.
No protected GLB goes into the deployable package or room preload cache.

Caddy's maintained service writer preserves `/holodeck/` on both HTTP and
WebSocket requests. Its forward-auth checks the selected current service audience
before proxying; incoming identity headers and Authorization are stripped.
Holodeck separately resolves the existing browser session identity and rechecks
current service access at world operations. It issues no alternative login.

The App audience is an explicit snapshot of current signed tribe members and
those members' actual Home-paired humans. The current global human-reader roster
is not changed to grant this App. Future membership changes require the supported
App audience refresh from the owning membership writer; no per-pair onboarding or
background watcher is introduced.

The application runs under a dedicated nologin service identity. It cannot read
the Conversation owner's private configuration. A bounded Unix bridge, running
as the existing Conversation owner, exposes only selected inspect/submit/
status/lookup operations (plus central read-only world-access) to that exact
application UID. Its fixed provider/source,
configuration and CLI routes are operator-selected. Native world actions use a
separate application-owned world port, matched to the actual retained interaction
and current room permission. Neither socket is a generic command executor.

## Reproducible package

Build the ordinary client, then the fully vendored receiving package:

```sh
node tools/build.mjs
node deployment/build-package.mjs "$PWD/.state/deploy-stage"
python3 deployment/archive.py .state/deploy-stage .state/holodeck-package.tar
```

The stage is replaceable and has no credentials/state/history. Its USTAR contains
only inventory-pinned regular files, no directories, symlinks, install hooks or
runtime downloads. The builder preserves JSDOM's stylesheet and synchronous-XHR
worker as shared bundle resources, plus dependency notices. Server-side HTML
Canvas is omitted: upstream JSDOM explicitly supports the optional dependency's
absence, and this MVP's server-authored MML does not use HTML Canvas. Browser
WebGL/Three rendering is independent and remains available. Qualify a real server
Canvas dependency only when a later creation needs that capability.

The archive remains below the existing 32 MiB limit and its declared unpacked
inventory below 128 MiB. Validate the exact archive using the maintained receiving
package verifier before publication. Publish the package as one stable private
operator artifact, not an App card; deploy it through the ordinary owner command.
Every release reuses the existing App/resource/URL and retains actual predecessor
and pending request identity. Never rerun an uncertain deployment with a new ID.

The pinned MML0.28 server adaptation in
`tools/mml-server-auth-context.mjs` forwards the actual server-side WebSocket
through both existing authentication callbacks. The room checks the handshake
session's actor against the fresh Home-authorized socket actor, and revalidates
using that socket's cookie. Another actor's valid Home connection cannot borrow
a disconnected visitor's token. Same-actor tokens may differ between tabs without
changing ownership. Missing socket context refuses access.

The maintained postinstall applies only four exact version/hash-pinned dependency
files (two runtime callsites and their declarations), preserving upstream MIT
licenses and the browser protocol. Both build paths verify the installed delta;
unknown dependency bytes refuse before any patch is written. Requalify these pins
when updating MML. This narrow adaptation does not create another world engine,
transport, login or source of permissions.

The client build also adapts the pinned `@mml-io/mml-web-threejs@0.26.1`
model resource. Leaving a room can unmount its last model handle and cancel
an in-flight load. The constructor handles that request's cancellation.
Other model errors remain observable. The build checks the dependency hash
and exact callsites and leaves installed modules untouched.

## Resource bounds and lifecycle

The selected receiver enforces a 32 MiB backing filesystem (actual usable bytes
come from its quota probe), 384 MiB memory, 100% CPU and 64 tasks. Room state uses
at most 5 MiB per current/previous/stage file. Protected room-session bindings
use at most8records and8KiB each for their current/atomic-stage file; the existing
32MiB backing filesystem bounds them together with world/native state. Native intent/result retention has
its separate small bound; original source attachments stay with the existing
bounded native attachment writer rather than being copied into app history.

No native library is expanded or downloaded at startup, and the application
produces no temporary media payload. The existing receiver's private temporary
namespace is inherited; do not claim its declarative 32 MiB option is enforced
when PrivateTmp overmounts it on this host. Actual current/previous/stage state
budgets and process limits remain enforced. If a later capability introduces a
temporary producer, qualify its real bound before enabling it.

The application world-socket runtime directory is managed by systemd. Its fixed
operator metadata grants the native Conversation owner traversal; application
shutdown closes its listener and systemd cleans only that directory. The native
bridge has its own bounded, private runtime directory and stop path. Stopping
these two selected services stops Holodeck and its bridge; it does not stop a
native conversation, another app or a device capture. No timer, model poller,
inbox reader, autonomous attention or global Stop is installed.

Keep current, publisher-protected previous, one necessary compatible recovery
and at most one candidate within the existing96MiB total artifact-history bound.
Usually current/previous suffice; retain the third role only while the immediate
predecessor cannot read current state. Reassess and retire it through the writer
once a compatible predecessor is selected. Runtime code independently retains current/
predecessor/candidate. Qualification copies are disposable after exact receiving
readback; preserve source, unfinished work, current state and the actual rollback.

## Selected shared release

The Beacon prototype workbench is selected at source `5e90de1`,
package `a1ec8c4e05db`, with `538da75a94c9` as the immediate predecessor.
All 31 runtime files and authenticated HTTPS asset hashes matched. The
station reuses the existing exact Nexus/Home review. The receiving
configuration and native journal matched their pre-activation readings.
See the [room-local workstation](../art/compaii-house/README.md#first-playable-mounting).

Indoor Conversation is selected at source `3e15eb6`, package
`538da75a94c9`, with `a7cf9e539e70` retained as the immediate compatible
predecessor. Installed inventory, authenticated HTTPS asset hashes, current
room configuration and the private native turn journal matched the selected
staging and pre-activation checks. The fixed source format and existing
canonical route remain in use. See [indoor source contract](shared-conversation.md#indoor-source-contract).

The first Blender room-art mounting is selected at source `6f01e67`,
package `a7cf9e539e70`, with `952322c1e9d7` as the compatible predecessor.
All 31 runtime files and authenticated HTTPS health/assets matched.
The authored Beacon room asset has its own content digest and is read
under the existing active-room authority. Actual protected browser use
remains separate from controlled Chromium images and motion. No saved
schema, access grant or project operation changed.

The illustrated room crossing is selected at source `84921a8`, package
`952322c1e9d7`, with `b8cdbed1536f` as the selected predecessor. All 30
installed runtime files and authenticated serving checks matched. The exact
package passed Chromium doorway, gallery, and exterior return checks, plus a
narrow viewport with reduced motion. The receiving configuration and the
house, exhibit, and native turn checkpoints matched the prior release.

Seamless room circulation is selected at source `b4f0dee`, package
`b8cdbed1536f`, at https://compaii.dmn.homes/holodeck/. All 30 installed
runtime files and authenticated HTTPS asset hashes matched. Receiving
configuration and the private native journal remained byte-identical.
The signed owner observed the same run, 30 entities and four exterior nodes.
The existing gallery exhibit retained its source node and pinned revision.
The installed predecessor `c9d7e09d` read the same checkpoint layout in a
disposable recovery without modifying its room or exhibit checkpoint.

The exact package kept the Chromium document and renderer across the house
entrance, gallery crossings and exterior return. Cold gallery arrival took
779 ms with neighbor preparation disabled. Six cached interior arrivals
took 232–954 ms from E to playable geometry with the avatar. The gallery
preserved its visit and same-position return, while separate restricted
identities received no forbidden room scene or Nexus frame. Timings are
controlled loopback browser observations. Production HTTPS serves the same
client and assets. The first load of the client remains 1.61 MB over gzip.

The room exhibit release is source `d8ac213`, package `c9d7e09d`, at
https://compaii.dmn.homes/holodeck/. Installed inventory and authenticated
served asset hashes matched. Receiving configuration and the private native
journal remained byte-identical. The actual Casa de CompAII owner placed
exhibit revision 1 in the gallery through its own native lane, referencing
the existing published workshop and its exact Nexus edition. The live Nexus
manifest, the paired human's existing table and source grants, and the
publisher's signed source renderer were independently checked.

The packaged Chromium test entered through the house door, used the pinned
viewer, returned to the same room and position, and exercised denied and
revoked reads with separate fixture identities. Those fixtures did not
authenticate a real person to Nexus. Actual human exhibit use remains to be
observed. Owner update, foreign refusal and retained exact result lookup
passed through the native surface. The actual predecessor `64cea411` serves
the existing rooms without changing the separate exhibit checkpoint.

The physical interior passages release is source `95b9970`, package
`64cea4117c0b`, at https://compaii.dmn.homes/holodeck/. The runtime
inventory and authenticated served assets matched the exact package.
The receiving configuration and private native journal stayed byte-identical.
The live owner used the linked door, staircase, portal and public return
with the existing run, entities, nodes and authored house. The packaged
Chromium qualification exercised exact room arrival, grounded steps in both
directions, the portal round trip, reload, denied lab entry and threshold
return with separate controlled owner and guest identities. Native room
transitions retain their original server authorization and checkpoint.

The actual selected predecessor `ca7e57db` loaded and preserved the same
house and location checkpoint in a disposable recovery. Its older navigation
panel is available during a code rollback. No world reset or data migration
is needed. Nicolás's live report covers the physical exterior door, foyer and
exit. It does not represent a human run of the new interior links.

The first owned doorway is selected at source `90722a3`, package
`ca7e57dbbd8b`, at https://compaii.dmn.homes/holodeck/. The signed CompAII
owner published house revision 1 on parcel-west-1. The protected configuration
selects four rooms and preserves the existing App audience and eight native
routes. The CompAII own-native port visited all four rooms in the shared world
and returned outside. The paired human's Home App and room grants were read back.
Nicolás later confirmed entering the house, seeing the foyer and exiting.

A controlled Chromium test walked to the door with two separate fixture
identities. The visitor entered the gallery, reloaded there, received a denial
for the lower lab and returned to the surveyed exterior threshold. The owner
traversed the lower lab and upper room. The exact vendored build passed this
route. The selected predecessor `42729a49` loaded the house and active room
from the retained schema in a disposable recovery run without changing that
checkpoint. No world reset is needed for code recovery.

The 22 November room-boundary release is source `d542e3e`, package
`42729a496cc4`, at https://compaii.dmn.homes/holodeck/. It serves the
same 30-file runtime, 15 protected App audience entries and eight native routes.
All installed file hashes matched. Authenticated operator static reads returned
the selected client, scenery, research figure and health. The own-native
observer returned the original run and 30 entities/four nodes. Receiving config,
house/Room contents and the native turn journal were preserved. No pilot
interior is selected in production. The prior estate build `64b6a856` is the
actual selected predecessor. A disposable run of its installed bytes wrote the
legacy Room and preserved both space checkpoints byte for byte.

The preceding 22 November estate runtime is source `2c2d82b`, package `64b6a856`, at
https://compaii.dmn.homes/holodeck/. The 18,401,280-byte archive contains 30
runtime files plus manifest. Authenticated HTTPS readback matched health,
client, island scenery and footballer GLB. The same App retained its 15 audience
entries and eight fixed native routes. The live world kept its run, 30 entities
and four prior nodes. Production native observation returned eight empty
parcels. The foreign-owner and crossing-footprint publication probes refused.

The previous package is `7b24c1a1`, source `b33b8c8`. The actual previous source
was tested against disposable legacy and house state. It can write the legacy
room without touching the separate house checkpoint. During a rollback it
does not render the housing district, and returning to house-capable code
recovers its exact addresses and revisions. Current and previous archives
total 36,792,320 bytes. Do not restore an older world or native journal as part
of code rollback. See [houses and parcels](houses.md).

See [research objects](research-objects.md) for the creator route and the
remaining protected Nexus source dependency.

Earlier browser/native evidence below remains attributed to its dated checkpoint;
it does not replace current actual human/device acceptance.

## Retained browser and native evidence

The selected release retains the earlier qualified restart-recovery and
utterance-capture corrections. The dated b1d017c2 predecessor described in
earlier checkpoints is historical; use the actual current/predecessor above. Already open clients adopt changed client
bytes on ordinary reload; no forced reload is installed.

The public Apps projection offers **Entrar** through existing Home SSO, returning
to authorized Apps without exposing private cards. Ordinary `/holodeck/` page
navigation reaches that same SSO even if a phone omits Sec-Fetch headers;
JSON/API/WebSocket requests retain authentication. Loopback browser-identity calls
use bounded node:http with explicit canonical Host/Cookie: actual Node24 fetch
discarded the Host override. The composed real-HTTP fixture verifies positive
human mapping through production MML/session/API routes; an own-being technical
reader must still be refused by Home's human-only identity endpoint.

Native world rights use the current being's own Home service grant, independently
of a human browser session. After source/input/run/pair and return-port checks,
the app queries the existing UID-guarded central bridge. Only that bridge selects
the fixed `world_service_key`; six remote configurations receive no owner custody.
The installed owner CLI calls read-only `check-service-access`, reusing existing
service capability, current actor, audience and exact selected App checks.
Timeouts/unknown/malformed authority deny without a human-cookie fallback.

The qualified Home dispatcher overlay changes only14lines in service.py
(SHA256aad74810b792f349424850a691e1aaf1fd7f7a941fed8eb22981b4b7e34e9548),
retaining513other file contents, mobile/link/launcher features and existing stores.
The earlier seven-bridge checkpoint selected9ae435c6; the current compatible
shared-Conversation successor is d0dc7f1e on all seven lanes,
with32KiB observation/48KiB source support. Each scoped restart observed no
in-flight RPC sockets and preserved config hashes/native core invocations. This
compatibility preparation preceded the separately verified focus/v2 app selection.
Actual appUID992 queries allowed all seven current beings and denied an unknown
being, minting no session or grant. Native reply completion separately follows the
exact situated instruction, without falsely requiring umbrella research completion.

The original conversation services stay running across scoped web/bridge updates.
Protected room-session ownership now survives replacement within the existing
fixed30minute lifetime: persist only SHA256(app token), actorRef and original
creation time. Never persist Home cookies, names, grants or rights. Restored
bindings are inert until the request revalidates the same current Home actor and
service audience; native authority remains independent. Presence/geometry reuse
the existing MML reconnect path and original token. API recovery reads existing
command/native results and never automatically resubmits an action.

The first upgrade cannot reconstruct preexisting unrecorded session bindings;
those tabs need one ordinary reload. Unknown or expired tokens are never adopted
from a current Home identity. Expired Home access still requires the existing
sign-in, and expiry is not extended by reconnection. A later application downgrade
to a release without binding recovery retains world/native state but requires
reload. Keep the at-most8-record bindings file private and bounded; it is
application state, not another login or an independent source of rights. daimon-home2.4.16 and report-conversation0.1.14
are installed/status verified on all seven selected bodies; the receiving surface
check passed. Installation does not prove existing model contexts reloaded them.

## Ended native execution and honest return recovery

The owning native source now keeps a human return lifetime after downstream
Matrix selection and retains native acknowledgment separately from that selection.
Only the actual internal acknowledgment callback can record native acceptance;
old records are not backfilled. The read-only owner `input terminal UUID` operation
can identify a uniquely scoped, ended physical turn without returning unrelated
text. Ambiguous/rebound/retired/unavailable evidence stays held.

All seven native listeners and bridges adopted this correction. Root preserves its
Nexus-owner composition; the six other receivers preserve their existing common
profile. Actual configs, Core processes, goals, accounting and originals remain
unchanged. One retained original now reads as observed completed execution with
its answer association unavailable: no old final was relabeled or borrowed.
The world releases only that verified ended tracking and displays a plain notice,
retaining the original, next draft and progress. Semantic downstream work is not
cancelled. No result is cached across a changed input boundary.

96Node/25Python checks, build and a real isolated browser qualified disabled Send,
unknown-state waiting, observed-end release, retained draft/progress, subsequent
typing and movement. The staged standalone package passed two MML/two DOM peers,
shared mutation and exact retry. Root native source passed723tests with4explicit
package ignores; the compatible six-receiver composition passed688text tests with
1ignore. These are technical checks, not human conversation acceptance.

## Appearance, presentation and observed effects

The fixed native appearance registry serves the actual Navegante layered design
and maintained renderer as a2.5D spatial sprite, not a rigged GLB. Actual authorized
HTTPS reads matched the153,394-byte design and99,284-byte renderer. Qualification
readers were revoked; no human identity was minted or borrowed.

One private receiving-selected report/revision entrance appears in the reading
room. Its same-origin Nexus entry preserves saved progress rather than forcing
chapter01. Discovery is not access: the existing descriptor checks current report
and participant authorization. Nexus composes report-v1/artifact-v2 and the PR122 visit-lifecycle repair onto its
actual receiving backend/seed-bank selection. The selected release is
`holodeck-visits-close-efdf449-composed`:15served files match and43canonical DB
tables, HBC original/bindings and native/Telegram/bridge processes are unchanged.
The existing player, notes, capture and native review are reused. Private pins,
actors and selector preimages remain in the operator record.

The human confirmed two participants walking and seeing the same violet light.
The owning native trial later observed sequence73 with zero human participants,
projected its Navegante avatar once at sequence74, and independently read the
same being/form/appearance back with zero human participants. Another native
projection remained intact. These are real native effects independent of browser
presence; human-visible avatar pixels and actual protected report/iframe use are
separate observations. Anonymous selected descriptor access is401. No operator
human cookie, browser lease or model-input replay was used.

The initial real upstream DOM snapshot is awaited before startup completes;
subsequent projections use its bounded queue. A representation failure fences
new writes/projections while preserving committed room state and readable
observations/results. An applied snapshot is not proof of human-visible pixels.

## Review membership and native association

The supported merged owner renew-membership writer renewed only the same expired,
non-revoked verified participant memberships for the existing report/artifact
rooms. It rotated bounded invitation hashes while preserving old invitations,
sessions, HBC binding bytes and the exact queued/undetermined original. The
artifact room's existing same-actor Home mapping selects its fresh hash; all other
mapping bytes are unchanged. Actual held-owner model policy and current room
selections permit the intended existing viewers, without claiming a human HTTP200.

The retained queued report exchange keeps its exact pending/unknown state.
A server-retained native wait alone now permits safe close/content replacement,
without cancelling or replaying the request. Local drafts, uncertain submissions,
recording, upload and transcription still prevent unsafe replacement. Returning
retrieves the retained discussion; walking keeps the same viewer mounted. The
actual legacy request and bindings were unchanged across this correction.

The artifact viewer v2 transport and the final workshop review's native reflection
association are deployed. The maintained owner writer associated the existing
verified target once; local/canonical binding revision1 and negotiated interactive3D
artifact reflection match. The new table uses its HTTPS Home entrance only,
without inheriting another table's Telegram launch selector. Four prior routes,
HBC original/binding, native physical turns, goals and accounting were preserved
across a listener-only replacement; existing collectors reattached without input
replay or goal Resume. Actual human-authored contribution/native return remains
separate, unfinished acceptance.

## Shared world draft review

The actual shared workshop snapshot is retained as a private Home draft under
one stable artifact identity, with the same fourteen selected world readers.
The corrected interactive presentation has106parts; its full GLB retains all
geometry while the review presentation excludes only the ambient water horizon
from fitting. The first107part edition remains immutable and is superseded for
framing; the intermediate106part edition is retained before the final presentation
update hiding technical model labels. No new App or human approval is implied by an edition.

Nexus has a new immutable table in the same review family for the corrected
Home publication/model pin. Seven existing human identities have exact Home
mappings to active review grants; all prior room mappings remain intact. Actual
owner policy checks allow current and historical model access for all fourteen
readers. Nexus's artifact API currently requires human shared-Home authentication;
being model readership is not a being Nexus-session claim. No synthetic notes,
reflections, model inputs or human sessions were created. The native association is now installed; actual protected human-browser review
and matched model return remain separate, unfinished checks. Private
receiving records retain the exact pins, grant receipts and predecessor edition.

A stable authorized Home link now selects the final pinned edition for the shared
MVP trial. CompAII made this technical selection under the retained human trial
delegation; it is not a new human approval or acceptance. The same fourteen world
readers are selected. A later model draft does not move this link automatically;
changing the trial edition requires another explicit selection. Actual own-reader
303 target match and anonymous404/no target disclosure were qualified, then the
own reader was revoked. Historical first-edition browser loading retained its old
pin/model/GPU result without silently selecting current content. The generic
Nexus deliverable-lifecycle proposal remains unimplemented.

The shared 3D package is clean3.10.53 on ITACA and five remote bodies. Eko's
pre-existing modified3.9 package retains its Bambu guidance and receives only the
two compatible template deltas (global hidden styling and hidden version span),
with no new JavaScript. Its actual builder generated a bounded triangle fixture
successfully; clean package convergence is not claimed. Home separately selects
its one-file hidden-provenance overlay: all513other file hashes are unchanged,
and only Home web restarted. Node, Caddy, Nexus and native bridge invocations and
session storage were preserved; served Apps metadata is retained but hidden.

## Recovery

Retain selected `4663b463` for forward recovery. Actual rollback is
`68a24c5e`/source `9f57a35`, compatible with current world/native state,
shared indications, session recovery, configured visits and runtime-created nodes.
Rollback loses the source-retry repair and control/feedback polish; it preserves
canonical events, activity UI/API and the save schema. Roll back code only;
never replace room, bindings, originals or pending work. Current/previous request
and archive identities are held in the protected operator record.

Home/Nexus selector preimages remain software-only rollback inputs; preserve live
grants, media, original messages, pending work and canonical databases.

The finite route executor uses its existing96-task receiving bound;32 previously
caused a kernel-confirmed fork refusal. After a lost reply, inspect and continue
the same retained request/predecessor instead of minting another request or
repeating an uncertain route reload. Exact current selection, source hashes and
effect receipts live in the protected receiving record. Git retains prior dated
compositions; those old selections do not override this current contract.


### Earlier shared-light delivery —22November

Source b16313e/package cc350710 added shared-light editing and bounded captures.
Its29-file receiving proof and unchanged run/config evidence remain historical;
it is superseded by the selected shared-history release above. Git retains the
qualification and protected retirement receipts retain actual archive effects.

## Operator readback details

The ordinary package publisher prints status and URL, not the complete immutable
entry. Resolve its exact publication version from the committed own publication
receipt before writing the deployment request; the archive digest and publication
version are different identities. Retain a complete request before invoking the
service writer. Missing local request input is known unsent, not a remote effect.

The service gateway deliberately strips Authorization before forward-auth. An
operator's existing exact-origin own-being reader can check health/static bytes
using its supported Home session cookie; revoke that task-created reader after
readback. This is not a human session, and the app's human-only identity endpoint
correctly refuses it. Do not change authentication to accommodate an operator probe.
