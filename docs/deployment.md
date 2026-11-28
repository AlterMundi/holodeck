# Shared deployment

Holodeck uses its own protected Home service capability and stable `/holodeck/`
entrance. It does not replace the existing workshop or another application's slot.
The receiving origin, service grant, private access and exact receipts remain in
its operator record. Source publication, runtime selection, real native effects,
browser/device acceptance and human acceptance are separate observations.

## Preserve a live visit during releases

Publish each requested change or significant qualified batch so it can be
tried in the live world. Continue these releases while progressively
removing avoidable visit interruptions.

The selected Home executor currently restarts one Node service when it
activates a package. Its MML presence and world-document connections live
inside that process, which closes them when it stops. Durable room and
session recovery preserve only part of an active visit. A connected browser
can still return to entry or fail to recover. A persisted world or a healthy
new process alone does not qualify uninterrupted rollout.

1. Use the existing revisioned resource and room writers for ordinary
   publication, exhibit placement and room edits. Push confirmed updates to
   both projections through the existing clients. These operations need no
   engine deployment.
2. Put client and art bytes behind immutable release URLs. Let existing tabs
   keep their compatible release while new tabs choose the selected one.
   Close the retention bound through actual connected version use. An
   incompatible version must reach an explicit recovery screen rather than
   silently fetching a new bundle into an old scene.
3. Keep the live world socket owner stable across compatible releases.
   Prepare and check the successor before selecting it. Transfer session
   claims, world sequence and unacknowledged operation IDs through the
   existing owner. If a successor must replace the world process, briefly
   fence new mutations, checkpoint and verify the new reader, switch the
   writer once, then resume or roll back. A second writable copy is unsafe.
4. If a change genuinely requires interruption, the connected client should
   get a notice before the switch and preserve location, camera, room,
   unsent draft and unresolved operation IDs. Show an explicit reconnect
   or useful recovery action while resuming at the same place.

Qualification uses two independently authorized visitors already in different
rooms, including one actively writing. Run a content change, a compatible
client release and a bounded world-process handoff. Measure socket survival,
time without input, lost or replayed commands, preservation of draft and
camera, room identity, access and transition notice. Exercise rollback and
a failed successor. Keep this release work scoped to Holodeck and its own
Home receiver.

## Release indicator and planned updates

Pass the prepared Home deployment request through
`deployment/release-with-notice.sh --request <request.json>` on the
receiving host. The paired human selected by `releaseControllerRef` in
`receiving.json` owns the central HUD flag. Take its exact actor ref from the
existing `daimon-home human` result. The flag applies across their tabs and
survives a reload. Other visitors cannot change it.

The operator reads the live flag and waits in the foreground for up to four
minutes if DND is on. A pending request highlights the same flag. If the
human releases it, a 12-second warning precedes the cutover. If DND returns
during that warning, the cutover waits again. After the final check, a
restart in progress is already committed. If the wait expires, keep the
exact request for the next foreground attempt. A status error halts the
command before submission. Use `--status` to inspect the receiver state.

Use `--announce-live` before a coordinated in-place update that preserves the
visit. Such an update does not need to wait for DND. Ordinary actions in the
world need no notice. For the first installation only, a receiver predating
DND must use its previously selected publication procedure. Once DND is live,
use this wrapper for every package cutover.

The bottom-left code is the installed page release, abbreviated from its
package SHA-256. An existing tab keeps that code until its page changes and
indicates when a newer release is available. The notice does not force a reload.
A tab opened before this feature was installed needs to open the updated page
once to receive announcements.

## Holodeck package and history size

The current Holodeck builder, Home gateway and executor accept archives
through 40 MiB. The operator can raise the Holodeck allocation in all three
places when a qualified release needs more room. Other Home services retain their ordinary 32 MiB archive limit.
The host still verifies the exact package manifest, checksum, predecessor and
unchanged file limits. The state filesystem has its own separate allocation.
Keep at most three retained code archives in the ordinary rotation under
120 MiB, including the selected package and its exact rollback. Use the
existing Home retire-version writer only for a superseded archive.

## Paired Questbook canary

The existing exterior entry can expose one private project's journal. Use
the owning release and native bridge selectors together. The Holodeck
`questbook` entry supplies `project`, the installed DaimonCards `binary`
and `paired: true`. The bridge's `questbook_access` entry supplies the
same `project` and `paired: true`. The browser and daimon use their
existing Home and own-native identities. Every operation rechecks the
current pairing, and the initialized card store belongs under the
Holodeck service's existing `STATE_DIR`.

A paired entry may select one existing Home publication with
`publication: {repository, commit, artifact, version}`. Use the exact Git
repository UUID and full commit, and the Home artifact ID and immutable
version from the existing publisher. In its topic room, the project table
links to that version through the same Home sign-in entry as the web.
The link requires the current room/project access and a matching current
or historical project revision. Later drafts do not advance it. Home
continues to authorize the published bytes independently of room access.

This receiving composition leaves room-specific project catalogs to the
separate topic-room integration. The currently selected toroidal terrain
hides the traditional workshop bridge. Use a mission the selected
terrain actually exposes for real participant acceptance. The traditional
workshop fixture can still test credit from an exact bridge action.
Keep the current receiver, archive digest, compatible predecessor and
existing room, transport and appearance selections in the operator record.

## Receiving contracts

The existing Home publisher accepts the closed `dm.home-service-package/v1`
package and `dm.home-service-deploy/v1` request. Runtime is pinned Node24 HTTP;
`HOST`, `PORT`, `STATE_DIR` and `NODE_ENV=production` come from the protected
receiver. `STATE_DIR/receiving.json` selects the existing same-origin shared
identity endpoint, service-audience endpoint, public origin/base path and optional
native/world Unix sockets. `authoritySocket` selects the existing central native
permission bridge; `contentVisits` selects at most eight protected report or artifact entrances.
It carries route metadata and private content references, not credentials.

### Questbook pilot

The optional `questbook` selection accepts one project object or a list of
distinct project objects. Each names its project UUID, the absolute `binary`
path of the owner-side DaimonCards writer, and the project's `viewEndpoint`
and `editEndpoint` routes at the configured loopback Home receiver. Card
state in `STATE_DIR/questbook.sqlite` is scoped by project. The exterior
workshop opens the first configured project. A topic-room project opens its
own journal only while the visitor has both the current room repository link
and that project's view grant. Select each audience explicitly. General
Holodeck access does not grant card access. A project writer can create its first mission
from an empty questbook. In the exterior workshop, open **Misiones** to display the
project journal in the existing Proyección spatial HUD. The section includes
keyboard and screen-reader controls from that same renderer.

The authenticated `GET api/questbook` opens the first entry and reports
whether the current actor can create a mission, including on an empty board.
`POST api/questbook/create` uses the same typed create command as the own-native
writer with a new card UUID and a stable operation UUID. A lost response is
reconciled through `GET api/questbook/receipt` for the original actor and
operation. The browser keeps up to eight unconfirmed creations in bounded
tab-session storage before sending. Each record retains the actor, project,
room and repository when present, title, card UUID and operation UUID.
Reloading the same tab restores the choice once the same actor opens the
same authorized journal. Opening the journal reads only; selecting
**Comprobar misión** reads the original receipt before allowing an exact
idempotent retry for a confirmed missing receipt. An unavailable receipt
keeps the operation pending. The writer refuses recovery against a changed
actor or default project. Successful confirmation clears the local copy.
Closing the tab ends this local recovery path; the canonical card and
receipt remain in the writer. Other journals remain usable.
The optional
`selected` and `after` parameters address a card and page. `POST api/questbook/action` handles acceptance or completion with the
observed card revision and the original operation ID.
`POST api/questbook/objective` takes `operation`, `card`, `revision`,
`objective` and `originalCommand`. It reads the current actor's existing
Room outcome and linked event. It never calls the Room command again. The
bridge-state pilot confirms the authorized player's matching transition when
they have selected an active quest. Opening a journal or selecting a mission
only reads the project. The workshop bridge action is the ordinary Room action.
A missing, rejected, mismatched or retired Room receipt leaves the objective
pending. Once credited, the card retains that exact evidence and its
idempotent receipt across Room resets.

For daimon access, the existing central native bridge may select a
`questbook_access` object or list of distinct project entries with their
`project` UUID and registered `view_service_key` and `edit_service_key`.
These are the same Home audiences used
by the browser endpoints. The bridge reads current actor-specific access through
the installed `daimon-home service-access` route. Install the matched bridge
revision and retain the existing UID guard and identity-pinned world ports.
The app checks both world admission and project access. General world admission
does not authorize card reads, writes or recovery.

For a private paired project, select `{project, binary, paired: true}` in
the Holodeck receiver and `{project, paired: true}` in the bridge's
`questbook_access`. The existing Home session authenticates the browser,
and the existing world lane authenticates the daimon. The bridge compares
the actor to the current registered human/daimon pair for every access.
This selection uses no additional Home service registrations. It is
project-specific and cannot be combined with explicit audience endpoints
or keys. A pairing or receiver binding change closes access until the
current pair verifies again. Use registered view and edit audiences for
projects that include other participants.

Use the existing `world_port.py --own questbook --json ...` entrypoint through
the calling body's own configured socket. It accepts `list`, `read`, `apply`
and `receipt` in the typed JSON `type` field. Include the exact `project`
UUID to address its journal. Omitting it opens the same default as the
exterior workshop. A `receipt` read uses the original
`operation` UUID and never repeats the action. To credit an authorized native
world action, `confirm_objective` takes the same fields as the HTTP objective
request and reads the acting being's exact Room outcome.

Run the protected HTTP fixture against the exact candidate writer:

```sh
DAIMON_CARDS_BIN=/path/to/daimon-cards node --test test/questbook-room-http.test.mjs
```

The fixture uses the real Room, HTTP middleware, project audience adapter
and Rust writer with synthetic Home identity. It submits a player's A2UI
claim and a daimon's native claim against the same revision. Only one
assignment is recorded. Both readers see the accepted revision, and the
winning operation is recoverable only by its original actor. To exercise the
mounted browser journey, build the client and set `HOLODECK_PLAYWRIGHT` to the installed
Playwright Core module. The loopback browser test accepts a quest through the
rendered HUD, actuates the bridge and verifies the same outcome in a second
narrow browser after a typed writer operation. Live selection and native daimon
authorization remain separate.


The optional `artProfile: "compaii-atelier-v1"` selects the packaged
Blender commons, parcel walk, garden, facade, foyer, gallery, listening tower
and Beacon chamber. It binds to the
existing west parcel and exact ordered room graph. Gallery art follows the
visitor's current lab passage permission. The lab and both gallery
variants travel through the existing room-scoped asset route. Files under
`public/room-art` are outside the application's static asset mount. Each
selected export is verified against its packaged hash at startup. The profile
writes no Room checkpoint. Omit the selector to use the existing world art
with the same data and route permissions. The selected owner can explicitly
adopt the original plan through the native world port. Its bounded
`atelier-layout` checkpoint is separate from ordinary plans, and the
receiving graph remains the compatible fallback. A rollback predating
adoption continues to serve those same four rooms and leaves the adopted
plan and receipt on disk. Reinstating an adoption-capable package reads the
receipt again. Current receiving access lists still govern these rooms.
Before the first expansion, activate the release that can already read
the added room and its design, exhibit, game and visit saves. Select that
reader's exact deployed digest as the predecessor of the expansion writer.
Use the compatible reader for rollback once an added room holds state.
The original guest lists still come from receiving configuration, and
the actor-scoped art route serves the new fitting only with passage access.
The optional gallery source pins
are independent of the art profile. The foyer supports two appended portal fittings while keeping the original gallery door and each previously assigned slot. The gallery and tower meshes contain
passive portal fittings. Each live scene adds the destination plaque and
light only for links in that actor's current passage list. The static mesh
can remain mounted after a destination is revoked.

The atelier profile includes Spatializer and Weaver bench handoffs to the
existing same-origin `/harmonic_lab/` App. Select the owning panel build
that supports `?service=audio` and `?service=body` for direct instrument
selection. Earlier panel builds still open their overview. The active
workstation opens the same-origin panel in a modal while keeping the world
renderer and player position. The panel must allow same-origin embedding
and owns its audience, readiness and explicit start controls. It links to
the instrument on the configured workstation once ready. **Consultar estado**
at a nearby bench makes one direct browser GET to the existing panel with
the visitor's same-origin session. It displays a short service summary for
that instrument. No host identifiers, device URLs or panel credentials are
retained. The summary expires after 30 seconds and disappears when the visitor
leaves the bench. The panel supplies service readiness. Actual device output is a separate
observation. The Holodeck server does not
proxy panel requests or actuate instruments.

The installed Guitar station requests the existing panel's Guitar
projection. Once the panel confirms the selected receiver, the station
closes that frame and subscribes directly to its read-only A2UI stream
with the same visitor session. It presents the controller's state next
to the selected Home review edition. The mechanism, power switch and
neck support each select the exact scene and part from that edition.
Continue to use the device-local controller for writes to the board.
Weaver and Shaper reuse the same body receiver through their respective
surfaces. Their live controls mutate the same confirmed preset.
Shaper presents mix controls. Weaver also presents body and video
controls. Spatializer starts or reuses its own audio service and
requires a confirmed OSC projection before the table opens its controls.
Weaver's **Abrir Ruteos** link selects the independent Stage receiver in
the same panel. It reuses a ready service and offers startup when enabled
for the selected workstation. If the profile disables the service, the
table explains that state and leaves startup unavailable.

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
The viewer uses the launch URL returned by the exact Nexus descriptor and
performs its own access checks. Its frame stays hidden and inert until the
viewer reports that same pin through both the ready and describe messages.

The in-room 3D display reads the exact Nexus manifest and the authorized
Homes version's `creation.json` and `snapshot.glb` through that same
visitor's session. It checks the returned version headers and the snapshot's
SHA-256 before loading. This display accepts the existing Holodeck static
snapshot format, capped at 4 MiB per GLB and three active displays. The
ordinary Nexus viewer remains the action for other asset formats. Displays
renew their catalog authorization every 20 seconds while the gallery is
active, including when no editions are visible. Models expire after 30
seconds. The wayfinding plaques and corresponding choices follow the same
authorized catalog as the models and are removed on access loss or departure.
A plaque shows the stage and the title supplied by the authorized exact
descriptor. Its short in-world line fits the plaque, while the exhibition list
retains the full title. Clicking either line selects the same pinned edition.
No protected GLB goes into the deployable package or room preload cache.

The optional `matterCollection` receiving selection names one existing interior
`room` and up to six ordered shelf `projects`. Each project has a stable
`id` and one to three distinct Home `resources`. A project can group
complementary 3D reviews without copying their editions. The optional
`art: "matter-workshop-v1"` mounts the original qualified Blender shell.
`art: "matter-workshop-orbital-v1"` selects its orbital PBR materials and
compatible light rig on the same shell. Both profiles use the same authored
door openings, collision volumes, shelf and table anchors, archive platform,
and room permissions. Select the profile only in the protected receiving
configuration. Rooms with stairs keep their ordinary art. The room art
endpoint serves the selected exact GLB only during authorized room presence.
To restore the original appearance, select `matter-workshop-v1`.

The Explorador review belongs in the existing Matter project selection as
`{"id":"explorador","resources":["b099d9e71bc44267a3bdb80d37cac732"]}`.
Its live descriptor stays Home-authorized. A compatible client projects the
complete skinned GLB with its original texture and animation clips. Each
worktable viewer can choose the clip with the existing A2UI Animación control.

For an appearance-only rollout, the optional root-level
`matterAppearance` names the existing Collection room and a qualified
`profile`. The receiver applies it to that room while preserving the
original `matterCollection.art` field. The preceding package ignores
the optional root field and loads its existing art. This allows code
rollback without changing the durable layout, world state or archive.

`GET api/space/collection` uses the current visitor's Home session on the
same HTTPS origin. It intersects the selected project resources with Home's
current authorized 3D Viewer catalog. For each visible resource it requires
the exact version header and canonical review manifest before returning its
title, immutable edition and gallery digest. Where available, it also returns
the validated scene-index digest. Movement or admission change cancels the
projection. The response uses `no-store`, and the source requests have a
shared deadline and byte bounds. Archive curation eligibility is checked in
parallel with a 1.4-second cancelable native read. A slow curation check
omits the optional archive controls. The curation write still requires its
normal fresh authority check. The compatible configuration can remain
unselected while a room or thumbnail preparation is ongoing. The selected room
keeps the worktable operable during a temporary catalog failure and shows retry
status while unverified editions and their geometry are cleared. A denied room
read removes the controls. The archive requires available source editions. The
room exposes a bounded event stream
that signals table and shelf changes without sending project details or
geometry. The browser uses the normal authenticated catalog to resolve a
refresh. The 12-second catalog refresh also picks up saved Home editions and
recovers missed notifications. Streams close on room departure and expire
after 25 seconds so each open visitor periodically reauthorizes.

The Matter worktable can pass a selected model or part to the existing
Conversation surface. The preparation checks the room, the current speaker
session, and the exact Home manifest and scene or part. The prepared
`referredWorktable` contains the edition, scene, scene version, optional part,
and the ordinary Home viewer link. When the review has a scene index,
preparation checks that index's digest without transferring the full model.
The legacy gallery path checks the gallery digest. The paired being needs
current room access. Following the viewer link requires the reader's own
Home access. A missing or revoked reference leaves the draft in Conversation.

An optional `matterCollection.archive` selects up to six explicitly named
retained editions, with `resource`, immutable `version` and display `label`.
Each archive entry needs both current catalog access and permission to read
the historical Home manifest. A pin already on a current shelf appears only
on the shelf. The room sends the eligible archive metadata in the same
scoped collection response. The cabinet animates the indexed platform and
renders one archived miniature at a time. Restoring a version uses the existing
Home read scope and the room owner's authority, directly or through the paired
human with room edit rights. The exact archived pin occupies a free shelf, and
its position is shared by all visitors who can still read it. Holodeck keeps the
placements in a dedicated 2 KiB checkpoint with the current, previous and
bounded staging writer. The earlier receiver can serve the same room and
preserves the placement checkpoint during rollback. Home retains the immutable
editions and their actual publication state. A restored edition is also a
worktable choice and can be shared as an exact pin. Both the share writer and
the existing Conversation source preparation recheck the relevant Home
edition and room authority. During compatible rollback, the earlier reader
treats a pinned historical selection as an empty table and preserves the
checkpoint for the current reader.

The optional `collection-representatives/index.json` under protected state
binds exact viewer editions to Blender shelf derivatives. The index schema is
`holodeck.collection-representatives/v1`. Each entry has `resource`,
`version`, `scene` and `sha256`. Each file named `<sha256>.glb` belongs
beside the index. Stage the checked GLBs first and select the index as one
complete file at activation. The process reads the selected index at startup.
Keep at most 18 entries and retire stale derivative files when advancing the
index. The index uses at most 16 KiB, with each GLB at most 384 KiB and 4,800
indexed triangles. There are no textures or external buffers. Source
publication history and access grants stay in Homes.

The client draws at most three nearby shelf thumbnails and one cabinet model. It refreshes the scoped
catalog every 12 seconds while the room is active. The thumbnail response
requires a new exact-edition access check. The client verifies the bytes and
releases nearby models on movement, revocation or room departure. If the
current edition lacks a miniature, its authorized title and exact viewer
link remain available. The viewer opens as a separate tab so the world
position and controls remain in place. No derivative enters the application
package, browser persistent storage, or public room geometry.


The worktable follows the selected readable project while the same room
remains active. Its worker reads the exact current Home version and validates
the response version and checksum before decoding. It uses the compact scene
index and selected scene file when the publisher supplies them, or the
bounded gallery file otherwise. The existing packed and plain Viewer formats
carry full review triangles. The worker accepts at most 25 MiB per geometry
response and 300,000 triangles in a scene. Closing the room terminates pending
jobs. The browser keeps one mounted worktable model and no persistent copy.

The table's scene, rotation, cut plane and visibility controls are local to
each visitor. The 12-second collection refresh follows a saved publication
without changing the player's position. If staging fails, the prior model
remains visible only while its exact version is still authorized in Home.
Room departure or loss of source access clears the model and controls.
The worktable and archive introduce no writes to the publication registry.

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

The existing world connection also carries optional scoped avatar pose hints.
The live space response advertises support. Peer poses travel only over
authenticated room connections. The pose update route uses the normal browser
session and room/origin checks, plus a revision-bound proof from the originating
tab. There are no new credentials, sockets, durable fields or MML animation
codes. Earlier clients keep the ordinary SDK rendering. A code rollback
leaves the world data and browser-local theme preferences available.

The optional `receiving.atelierWorkshop` selection binds one published room to
one Atelier workspace. Its `room`, `workspace`, `socket` and `signingKey` values
select a current own-native room, the Atelier workspace UUID, a fixed private
Unix transport path and a service-owned Ed25519 signing key file. The Atelier
receiver operator selects the matching public key and independent workspace
grants. Use an admitted private route between the two service identities.
Holodeck checks the actor's current room and permissions before forwarding
`read`, `smooth` or `result`. Atelier owns edit validation and the stored
revision.

For the browser worktable, select `receiving.atelierWorkshop.projection` with the
paired human's `humanRef`, the exact authored room-object ID as `anchor`, and
`htmlSha256` and `scriptSha256` from the selected Atelier package's unpacked
`index.html` and `workshop.js`. Enable `native.humanProjection` on that Atelier
receiver. Use the same paired human and workspace on both receiving selections.
The projected frame runs on Holodeck's origin. Holodeck serves only the two
verified assets and the selected workspace's read, select and Smooth routes.
Current Home session, room and write origin are checked at the same API boundary
as other space actions. Atelier rechecks the paired-human workspace grant and
owns both the selected point and the confirmed mesh revision. The workspace has
one storage and revision lineage across the two surfaces.

## Reproducible package

Install the lockfile-selected Proyección package in the build checkout.
A directory linked from another Holodeck worktree can contain an older
renderer and silently remove its optical controls. The client build checks
the installed renderer version against the lockfile.

Build the fully vendored receiving package. The package builder rebuilds
the browser assets from the selected checkout before assembling the package.

```sh
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

The server build compacts identifiers, syntax and whitespace and preserves
runtime function and class names. The selected client bundle, art payloads
and runtime dependency notices follow the same inventory.

The stage stores the browser bundle once at `runtime/client.js.br`. The
existing `client/client.js` URL negotiates Brotli and streams the same
decoded bytes for identity clients. Match served decoded bytes against
the ordinary build during receiving readback. The uncompressed build
remains available to the development server.

Selected atelier GLBs and the five pinned MML locomotion clips with a
smaller Brotli representation are stored once
under `runtime/art`, outside the static asset mount. The builder checks
their original SHA-256. Startup checks the bounded decoded bytes against the
same pinned digest. The existing asset URLs negotiate Brotli or identity.
Exterior byte ranges use the identity representation, and encoding-specific
validators are sent with `Vary: Accept-Encoding`. Both exterior and room art
retain the existing `no-store` policy. The room route applies the current
actor, room, passage and revision checks before serving either representation.
Development and rollback packages may use the original uncompressed exports.

The atelier exposes an arrival variant on the existing exterior world socket
with `dressing=arrival`. It has the same authenticated scope and world state.
Only the source attributes of the facade, miniature if present and garden
dressing differ. The current client requests those models after the local
avatar exists. Earlier clients and the return from an interior use the
ordinary projection. No receiving selection or state migration is needed.



The Holodeck builder, Home gateway and executor accept archives up to 40 MiB.
Other Home services retain the 32 MiB archive limit. The individual file limit
remains 32 MiB and the aggregate unpacked limit remains 128 MiB. Validate the exact archive using the maintained receiving
package verifier before publication. Publish the package as one stable private
operator artifact, not an App card; deploy it through the ordinary owner command.
Every release reuses the existing App/resource/URL and retains actual predecessor
and pending request identity. Never rerun an uncertain deployment with a new ID.

The orbital reflection candidate's compacted archive is 32,890,880 bytes,
with 76 regular files including the manifest. The installed receiver
validator accepted the exact USTAR. Node 24.21.0 booted the packed entry,
admitted a controlled Home-authorized HTTP actor, and refused the same
session after revocation. The standalone MML check verified two presence
and two Networked DOM clients, a projected mutation and exact retry.
The staged comparison included the separate continuous-valley work.
The appearance-only build excludes that change and retains the
deployed exterior, with its own qualification and package selection.

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

The optional `mosaicCompanion` receiver selection activates the companion
mosaic edition from `navegante-mosaic.glb` in the service state directory.
Keep the source artwork under its existing audience. Use
`tools/avatar-motion/merge-companion-motion.mjs` to preserve the qualified
N-3X skeletal tracks with the new mesh. The receiver checks the selected
asset's SHA-256 and bounds and serves it through the signed-in world route.
The default continues to use the built-in N-3X when this selector is absent
or the edition is unavailable. Its assets and the existing studio versions
remain separate from the mosaic edition.

The optional `privatePersonalAvatar` receiver selection pins a paired Home
release by `resource` and exact `version`. It resolves
`assets/explorer-hero-proposal.glb` inside a paired Human publication. Verify
the exact served bytes before selection. The personal default then uses the
existing authenticated appearance route. The paired visitor receives the
private Home edition and other signed-in participants loading that same
character description receive the bundled Explorer. Both use the existing
direct loader that preserves authored idle and landing clips. The Character Studio
continues to use the shareable study rig. No portrait or model bytes live in
the source repository, runtime archive or world state filesystem. Unselect
the edition in the receiver configuration and apply the ordinary release
operation to return the paired default to the bundled model.

Explicit human avatar choices use the existing authenticated API and MML
character-description projection. They live in a separate 8 KiB per-file
checkpoint under `human-avatar-choices`, with the same atomic current,
previous and staging writer. It retains 64 selections by most recent change;
resetting to automatic removes the preference. Only a hashed actor ID and
catalog slot are stored. The original automatic lease checkpoint stays
compatible with the previous package. That package ignores the choice
checkpoint. A temporarily unreadable choice checkpoint leaves the world
available with automatic appearances and refuses overwrites.

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
and at most one candidate within the 120 MiB total Holodeck artifact-history
bound. Use at most three retained archives in ordinary rotation.
Usually current/previous suffice; retain the third role only while the immediate
predecessor cannot read current state. Reassess and retire it through the writer
once a compatible predecessor is selected. Runtime code independently retains current/
predecessor/candidate. Qualification copies are disposable after exact receiving
readback; preserve source, unfinished work, current state and the actual rollback.

## Toroidal world qualification

The explicit `worldTerrain: "toroidal-terrain@1"` receiving selection mounts
the procedural exterior and uses CompAII's existing Atelier foyer when the
receiving graph has both the Atelier and Matter rooms. Three reciprocal doors
lead to the existing Matter room, the existing Harmonic Lab and the Character
Design Room. Matter and Lab retain their room grants. The Character Design Room
inherits Matter's guest list, and the foyer admits the combined guest lists of
the original foyer, Matter and Lab. The single Matter entrance remains available
to a receiver without the Atelier. The active doors do not rewrite the authored
graph, room identities, or stored Matter and Lab content. A predecessor that
predates the foyer can still restore the same Matter room and ignore the newer
room's position entry. The terrain edition
selects its own coordinate origin, entry pose and lighting distance.
The configured gallery editions and room-design, garden and editor
checkpoints still validate against the authored room graph. Their normal
reads and writes use the active graph. This keeps hidden rooms unavailable
in the toroidal edition while allowing those checkpoints to be read on
rollback. The exact toroidal candidate and its rollback both booted against
bounded copies of the receiving checkpoints with native lanes disabled.

## Selected shared release

The [current receiving record](STATUS.md) tracks the selected package,
source commit, runtime checks and immediate rollback. Preserve that
rollback through exact protected readback. The current terrain startup
keeps the coarse ring usable and mounts optional ground cover only
after the first atomic detailed tile commit.

The earlier protected playtest selected `601108cb255e` at source `43c39e0` with
`f46d93f436be` as its immediate rollback. The 33,464,320-byte package
includes the merged Proyección density update and the current world HUD
candidate. The protected reader verified all 78 installed payloads and the
served health, client and terrain worker bytes. The authorizing native
read returned the same run and edition, and the receiving configuration
hash matched. The first publication response was unconfirmed. The existing
request recovered to completion without another deployment identity.

The protected service selects `f46d93f436be` at source `f975275`, with
`2563afe48a8d` as the immediate rollback. The 33,443,840-byte package
adds the ceiling and camera collision correction. All 78 installed
payloads, protected HTTPS health, client and terrain worker matched.
The receiving configuration and native run and edition matched.

The preceding protected service selected package `2563afe48a8d`, source
`cc04977`, with `74f574592917` as its immediate rollback. The release
adds the movable Three.js Conversation display, mouse sensitivity,
continuous mouse orbit, exterior flight and the minimap tool. All 78
installed payloads and the exact protected client, terrain worker and
health response matched. The configuration, native run and edition
matched the previous release.

The preceding protected package selected the toroidal terrain with the Matter
worktable's A2UI HUD in package `74f574592917`, source `98a2a61`.
Its immediate rollback is `68d4eadaa3da`. The 33,433,600-byte archive kept
the complete receiving configuration. All 78 payloads, exact HTTPS health,
packed client and terrain worker matched the release. The native read still
returned the same run and edition.

The first protected toroidal release used package
`68d4eadaa3da` at source `943ca63`. The 33,198,080-byte archive passed the
installed receiver validator. All 78 payloads, the HTTPS health response,
the packed client and the terrain worker matched the qualified release.
The same authenticated native run and edition remained readable. Removing
`worldTerrain` recovers the authored layout on a compatible build. The
immediate code rollback `2009ff26ca7b` ignores the optional selector and
continues to read the same checkpoints.

The preceding Manipulación de Materia release used package `2009ff26ca7b` with
`d65e90d37ca9` as its immediate code-only rollback. The 32,348,160-byte
archive adds fine material detail, Collection distance tiers and the opaque
shell infill. It retains the deployed exterior and uses the existing
`matterAppearance` selector. The receiving host matched all 75 installed
payloads. Protected HTTPS served the exact client bytes, health passed,
and all four restricted-resource reads were denied outside their scope.
The world run, receiving configuration and monitored room checkpoints
were verified after activation. The compatible predecessor remains
available on the same state contract.

The earlier Beacon prototype workbench was selected at source `5e90de1`,
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

Direct Nexus exhibit placement uses the same central UID-guarded socket.
The selected bridge configuration has an optional `review_owner` object with
`beingRef`, `nexus_reader`, `database`, `publisher` and `binding`. Use absolute
selected files for the stdlib Nexus resolver, its database, the receiving Home
publisher and its binding. The bridge opens the Nexus database in SQLite
read-only mode. The managed service must allow SQLite's WAL and SHM coordination
in the database directory, including when Nexus has no open read connections.
The selected unit mounts the main database file read-only. The bridge accepts
the exact pin and verified native being. With `use_world_authority` selected, the bridge uses the existing
`world_service_key` and the Home proof reserved for the current Holodeck App.
Homes verifies the acting being's current App admission, canonical resource
ownership and retained edition. Companion owners use their existing verified
world lanes. The web package receives a scoped proof and retains no publisher
credential.
Recovery can use the previous package, which reads the same v1 checkpoint.

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

The shared 3D package is clean3.10.53 on the primary host and five remote bodies. The receiving body with a locally modified 3.9
package keeps its Bambu guidance and receives only the
two compatible template deltas (global hidden styling and hidden version span),
with no new JavaScript. Its actual builder generated a bounded triangle fixture
successfully; clean package convergence is not claimed. Home separately selects
its one-file hidden-provenance overlay: all513other file hashes are unchanged,
and only Home web restarted. Node, Caddy, Nexus and native bridge invocations and
session storage were preserved; served Apps metadata is retained but hidden.

## Recovery

The [miniature flight release](STATUS.md#november-25-miniature-flight-controls)
`476adaf02828` changes only the packed browser client. Immediate rollback is
`ec75cae97e47`; `bd94dc35ba06` remains in published recovery. The exact
local archive `8a2e0d75c9b4` was retained before retiring that version
from publication. Published history uses 100,515,840 bytes.

The [inner-ring overlook release](STATUS.md#november-25-inner-ring-overlook)
`ec75cae97e47` changes the packed client, terrain worker and server bundle.
The three carry the same local grade data. Keep them together when
installing or rolling back. Immediate rollback is `bd94dc35ba06`;
`8a2e0d75c9b4` remains in published recovery. The verified local archive
`2286ee700dc7` was retired from published history. Published history
uses 100,515,840 bytes.

The [touch swimming release](STATUS.md#november-25-touch-swimming)
`bd94dc35ba06` changes the packed client and entry HTML. Immediate
rollback is `8a2e0d75c9b4`; `2286ee700dc7` remains in published
recovery. The verified local archive `a76e321eb728` was retired from
published history. Published history uses 100,505,600 bytes.

The [underwater feedback release](STATUS.md#november-25-underwater-controls-and-companion-posture)
`8a2e0d75c9b4` changes the packed client and entry HTML. Use
`2286ee700dc7` as immediate rollback or `a76e321eb728` for older
published recovery. The superseded `2a4ff7ba1da6` archive was retired
from publication after verification. Published history uses
100,546,560 bytes.


The [mapped swim crossing](STATUS.md#november-25-mapped-swim-crossing)
`2286ee700dc7` changed the packed client and terrain worker. Its prior recovery
record selected `a76e321eb728` and `2a4ff7ba1da6` as the
compatible published versions at that time. The superseded `0878bc6c67fc` archive was retired
from publication after local verification. The client uses Brotli quality
11 and the existing receiver. Published history uses 100,587,520 bytes.


The [cave wayfinding release](STATUS.md#november-25-cave-wayfinding)
`a76e321eb728` changed the packed client and entry HTML. Its prior
recovery record selected `2a4ff7ba1da6` and `0878bc6c67fc` as the
compatible published versions at that time. The superseded `38a43c533c2e` archive
was retired from publication after local archive verification. Published
history uses 100,638,720 bytes.


The [meadow banks release](STATUS.md#november-25-meadow-banks)
`2a4ff7ba1da6` changed only the packed client bundle. Its prior
recovery record selected `0878bc6c67fc` and `38a43c533c2e` as the
compatible published versions at that time. The preceding conversation input archive
`7a466b1ca447` was retired from publication after exact archive
verification. Published history uses 100,638,720 bytes.


The [meadow material release](STATUS.md#november-25-meadow-material)
`0878bc6c67fc` changed only the packed client bundle. Its prior recovery
record selected `38a43c533c2e` and `7a466b1ca447` as the compatible
published versions at that time. The previous pointing archive
`41508709635f` was retired from publication after checking the exact
archive remains recoverable locally. Published history totals
100,546,560 bytes.


The [packaged Sand3D verge](STATUS.md#november-25-sand3d-verge)
`38a43c533c2e` changes the browser bundle and static art route and adds
three optional compressed models plus their attribution. Its prior recovery
record selected `7a466b1ca447` for immediate code-only rollback and
`41508709635f` as the older published recovery at that time. No checkpoint migration is needed. The publisher
retired `0425dd6d7c67` after checking its exact retained local archive.
The three published archives total 100,454,400 bytes.

The [concurrent Conversation input release](STATUS.md#november-25-world-controls-alongside-conversation)
`7a466b1ca447` changed the browser entry styles and client bundle. Its prior recovery record selected
`41508709635f` for immediate code-only rollback and `0425dd6d7c67` as
the older published recovery at that time. Preserve the live room, existing access and
canonical Conversation. The older `8260b7fcf577` publication was retired
after checking its exact local archive. The three published archives
total 100,352,000 bytes.

The [shared workpiece cue release](STATUS.md#november-25-explicit-workpiece-pointing)
`41508709635f` adds transient authenticated pointing to the existing
browser and server. The change has no additional checkpoint fields.
Restore `0425dd6d7c67` for an immediate code-only rollback or
`8260b7fcf577` for older published recovery. Preserve the world state,
auth configuration and canonical Conversation. The superseded
`326890e44863` publication was retired after verifying its local archive.

The [tabletop companion release](STATUS.md#november-25-tabletop-companion-attention)
`0425dd6d7c67` changed only the browser bundle. Use `8260b7fcf577` for the
immediate code-only rollback, with `326890e44863` as the older published
recovery. Preserve the current native room and Conversation deployment.
The `873ae82b51f6` package described below remains available as a local
verified archive.

The [selected mouth rig and consumer](STATUS.md#november-25-humanoid-mouth-rigs-and-local-microphone-consumer)
`8260b7fcf577` retains `326890e44863` as the immediate code-only rollback
and `873ae82b51f6` as compatible older recovery. Either world bundle remains
independent of the canonical Conversation provider and of live room state.
CompAII’s compatible producer is an independent three-asset web overlay.
Use the existing voice-admission guard when restoring the preceding
Conversation web composition. Preserve the Gateway, Core, native state and
the Holodeck package selectors. The six other active receivers have their
own prior web compositions. After either change, wait for the locked web
health response to identify the serving process and verify all three
asset hashes over HTTPS. A service manager reporting start does not imply
that the web listener is ready.

The [selected humanoid release](STATUS.md#november-25-humanoid-standing-idle-and-airborne-turns)
`326890e44863` changed only the browser bundle. Use `873ae82b51f6` as
the immediate rollback with the same protected Home App and current world
state. The exact older `20726f08a3e0` remains installed and published if
needed. Qualify any further rollback against the current state and access.

For the selected atelier release `27501f434aab`, the directly usable
predecessor is `c8f4eb5a011f`. Both retain the same receiving fields,
world art and browser recipe editing. The earlier `a286c3c0a36e` can load
and play editor-created gardens. Keep the exact current receiving state and
world checkpoints across a code-only rollback. The current panel selector
has its separate Home slot and can independently return to `4fdf5b8e944c`.
See [current receiving evidence](STATUS.md#selected-receiving-release).

For the earlier `4663b463` release, the recorded rollback was
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

## Introducing an owned room kit

Room design checkpoints and receipts retain kit IDs. A new kit must be
readable by the active rollback package before it enters a live design.
Deploy the kit's exact art and reader with publication disabled, then use
that package as the immediate predecessor of the enabled writer. Both
packages serve identical GLB bytes behind current room access. The reader
honors existing receipts and does not accept new publications of the kit.

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
