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

## Resource bounds and lifecycle

The selected receiver enforces a 32 MiB backing filesystem (actual usable bytes
come from its quota probe), 384 MiB memory, 100% CPU and 64 tasks. Room state uses
at most 5 MiB per current/previous/stage file. Native intent/result retention has
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

Keep current, previous and at most one pending package within the existing
96 MiB artifact-history bound. Runtime code independently retains current/
predecessor/candidate. Qualification copies are disposable after exact receiving
readback; preserve source, unfinished work, current state and the actual rollback.

## Selected shared release

The20November selected runtime is source `8f1698a`, at
https://compaii.dmn.homes/holodeck/. Its17,623,040-byte package is
`9d0c94ddb35fb6d36c70df8b0c97355d70e9d0cbd1320b1e53809d61c78f9e30`.
The existing App resource `a51218c647644a8fbbd42ed706d70b61`, audience and URL
remain unchanged. Current and compatible predecessor archives total35,256,320bytes.
Exact receiving readback matched all27inventoried files, health, the live room
run/sequence81 and unchanged current/previous room and native-intent hashes.
The reading-room catalog now selects the existing narrated report and the final
immutable workshop3D review; discovery preserves each content's actual grants.
The replacement observed zero established world connections. No human/model
input was replayed and no participant session or grant was fabricated.

Seven explicit existing human/being/home routes select their own native owner.
Every return socket is pinned to that being before native bridge access, with no
fallback to another companion. Actual application-UID pairing/binding and
wrong-actor checks passed all seven lanes; six remote native owners reached their
fixed return and received unknown-interaction refusals. The current standalone
Node24 package passed actual MML/Networked DOM peers, shared mutation and exact
retry. See [transport operations](../deployment/native-transports.md).

## Current browser and native authority

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
All seven existing bridges now select SHA2562afd732a72ad6ebc354c50745b8060d8ef0b31839b3b5553dffe3bf9b511b66d,
with32KiB observation/48KiB source support. Each scoped restart observed no
in-flight RPC sockets and preserved config hashes/native core invocations. This
compatibility preparation does not mean the new focus/v2 consumer app is selected.
Actual appUID992 queries allowed all seven current beings and denied an unknown
being, minting no session or grant. Native reply completion separately follows the
exact situated instruction, without falsely requiring umbrella research completion.

The original conversation services stay running across scoped web/bridge updates.
App replacement clears its in-memory human room sessions: reload obtains a fresh
Home-validated session; MML reconnect alone reuses the old token. Native authority
does not depend on this reload. daimon-home2.4.16 and report-conversation0.1.14
are installed/status verified on all seven selected bodies; the receiving surface
check passed. Installation does not prove existing model contexts reloaded them.

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

## Review membership and remaining native association

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

The artifact viewer v2 transport is deployed, but its new native reflection
association is not. A prepared binding reuses the verified existing target and
negotiated modes; registration must use the maintained receiver writer rather
than editing live native SQLite or manufacturing a human /nexus command. Keep
that gap explicit. Current connected human trials take precedence over an
optional app restart; retain its prepared release until a safe selection boundary.

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
reflections, model inputs or human sessions were created. Native association and
actual protected human-browser review remain separate, unfinished checks. Private
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

Retain the selected9d0c release for forward recovery. The actual predecessor
`9fcac97a552ad79e58dcd3ce5d5da888e2b11e01fcc859ae138dd3d073effa49`
(source46a9455, branchfix/predecessor-focus-retention) preserves optional shared
indications through old-code load/save, unlike the earlier549f. Its real HTTP
mutation followed by successor Room readback retained the exact indication.
It also retains independent native authority. A downgrade must pair that code
with the retained pre-workshop receiving metadata: that predecessor accepts only
one report entrance, whereas the current configuration selects two entries.
Restore that configuration selection only; preserve the latest world/native
files, all indications and request identities. Never restore old world state.

Home/Nexus selector preimages remain software-only rollback inputs; preserve live
grants, media, original messages, pending work and canonical databases.

The finite route executor uses its existing96-task receiving bound;32 previously
caused a kernel-confirmed fork refusal. After a lost reply, inspect and continue
the same retained request/predecessor instead of minting another request or
repeating an uncertain route reload. Exact current selection, source hashes and
effect receipts live in the protected receiving record. Git retains prior dated
compositions; those old selections do not override this current contract.
