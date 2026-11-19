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
native/world Unix sockets. It carries route metadata, not credentials.

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
as the existing Conversation owner, exposes only the selected inspect/submit/
status operations to that exact application UID. Its fixed provider/source,
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

On 2026-11-17 the supported publisher selected source `5ab446d` at
https://compaii.dmn.homes/holodeck/. The immutable package SHA256 is
`4d9d69aff78580a6d3a46c045ee459bfac36451e78ca127453100ed16db76102`
(17,305,600 bytes). The App resource remains
`a51218c647644a8fbbd42ed706d70b61`; its entrance/audience stayed unchanged.
The previous package `139c4f4c0133e68de48bc3f85ed66641c7bc578c39985e34406ec411bbf0fdfe`
and receiving configuration remain the actual compatible rollback.

Seven explicit existing human/being/home routes now select their own native
owner; there is no fallback to another companion. Each return socket is pinned
to that route's being before native bridge access. Real application-UID ingress
inspected all seven actual pairings/current native bindings and refused wrong
actors. All six remote native owners reached their own fixed return and received
an unknown-interaction refusal without a world action. The existing local bridge
and six native Conversation services were preserved. See the maintained
[transport templates and operations](../deployment/native-transports.md).

Before app replacement the receiving intent/stage inspection found no retained
native intent. The exact standalone pinned Node24 package passed actual MML
presence and Networked DOM protocol clients, shared geometry change and exact
retry. Browser navigation redirects to existing shared SSO with its exact return;
anonymous API and WebSocket upgrades return401. These are technical checks,
not human participation, a situated model turn or observed model world action.
Actual multi-human/device use and native model uptake remain to be observed.
The preexisting workshop was preserved.

The finite route executor must accommodate its guarded receiver set and Caddy
control process together. This receiving set required a96-task bound;32 caused
a kernel-confirmed fork rejection. Recovery retained the original request and
reload intent, checked the exact candidate/preimage and unchanged live
configuration, reacquired all existing guards, then finished the selected
reload. Never reset a journal or repeat an uncertain reload because its reply
was lost. Exact operation evidence/local selectors stay in the protected record.

## Finding and opening the private App

The common Apps entry is a public navigation projection. Use **Entrar** to
return through existing shared Home sign-in to the authorized Apps catalog;
Holodeck keeps the same existing card and its selected individual audience.
On 19 November a receiving gateway repair added that navigation control and made
ordinary root-page navigation reach existing SSO even when a phone omits
Sec-Fetch headers. JSON/API and WebSocket requests still require authentication.

The repair changes only the gateway's service/launcher modules, preserving the
App/native/Caddy invocations, canonical stores and private grants. Its source is
tracked in Cluster PR520; actual receiving hashes and rollback are in the local
operator record. An actual own-being reader verified exactly one authorized
Holodeck card and its existing launch alias. Anonymous Apps exposes the sign-in
control without publishing private Holodeck metadata. Phone sign-in and use
remain human acceptance, distinct from these HTTP/fixture checks.


## Home authorization transport on Node24

The selected19 November runtime is source `90b2f9f`, package
`6cc0f94de6225bef50bd390ff119332acb13451d236b3ed1b5d41aad9451dc0a`
(17,315,840bytes). The compatible rollback is the preceding `4d9d69af` package.
The supported own-service writer completed the replacement, preserving the
existing App identity, audience, seven native routes and receiving configuration.
Current/previous operator archives total34,621,440bytes; superseded packages were
retired through the existing bounded publisher.

The real Node24 fetch implementation discarded the explicit Host override on
loopback Home requests. The default identity resolver now uses bounded
`node:http` GETs, preserving canonical Host and Cookie, with no redirects,
a shared four-second deadline and an8192-byte response limit. Both audience and
identity remain authoritative for each application operation.

A finite application-UID probe forwarded the unmodified request headers to the
actual Home service. The same ephemeral own-being credential produced404 with
old Node24 fetch and204 service authorization with the new default transport.
Home correctly refused that being at its human-only identity endpoint with401;
no human session was minted. The task session was revoked. Separately, a pinned
Node24 real-HTTP human-shaped fixture exercised the default resolver through the
production prefixed MML index/session and API state. These establish the transport
repair and composed code path, not an authenticated person's phone experience.
The actual deployed package passed two-peer MML/Networked DOM mutation/retry
qualification; health is ready. Real human/device acceptance remains unobserved.


The reusable canonical-Host and positive-admission qualification guidance is
published in daimon-home2.4.15 (Skills PR359) and installed with exact matching
receipts on the selected seven bodies. Installation changed no login, audience,
native service or model attention. The receiving surface check passed; already
running model contexts are not claimed to have reloaded the guide.


## Live colour extension

Source `a9dc02c` is selected by the supported service update, package
`2cef9425234c0f0c21b0b1c612391268ee8c66fe9623fa21210b90c02363e4e7`.
It adds violet and strict hexadecimal literal colours while preserving existing
semantic colours, object IDs and revisions. The actual live world and all three
native intent records were retained byte-for-byte at the journal level; the
restart recorded only the normal participant departure. No accepted input was
cancelled or replayed by deployment. Home configuration, shared audience and
seven native routes are unchanged. Reloading the world obtains a fresh
Home-validated room session; MML reconnect alone retains its old in-memory token.

The previous `6cc0f94d` runtime is a compatible rollback only until a new colour
is written. Once violet/hex enters saved state, retain the selected candidate
for forward recovery: the previous three-colour binary cannot render/export
that state. Never remove or rewrite actual creations to force an older binary.
Two retained operator archives total34,631,680bytes; no creation history was
retired. Deployment qualification is separate from the requested live edit and
its observed native result.


## Selected native appearance

Runtime source `fdb9476` is deployed as package
`81b5eaa98751ebf048fc681fba764f8fff938a88ed7f6842651ab085af451470`
(17,612,800bytes). Its immutable build came from the exact frozen Git tree while
portal work continued separately; no concurrent uncommitted source was included.
The same actual world/native intent IDs, receiving configuration, seven owner
routes and corrected native bridges were retained. The app replacement required
human reload for fresh room sessions; the deployment did not project an avatar
or submit a native input.

Actual authenticated own-being HTTPS reads returned the canonical153,394-byte
Navegante design and99,284-byte maintained renderer with exact source hashes;
the task reader session was revoked. This establishes served bytes, separately
from the browser fixture's spatial sprite behaviour and real human acceptance.
The projection remains a faithful layered2.5D form rather than a rigged GLB.
Current/previous operator archives total34,928,640bytes. Once an avatar-form
entity enters saved state, keep the current compatible candidate for forward
recovery; the previous colour-only binary lacks that form. Preserve actual
creations rather than editing saved state to force an older binary.


## First protected presentation visit

Runtime `8adb430` is selected as package
`b4ca7f604580b0c089e89d09c91f889e598389b5c09421e958a8146f969119ea`
(17,592,320bytes), with one private receiving-configured report entrance in the
shared reading room. The selected same-origin Nexus entry retains its exact
report/revision pin and discovery actors, without forcing chapter01 over saved
progress. Private table/report references stay in receiving configuration.
Discovery grants no Nexus access; the existing descriptor checks current report
and participant authorization.

Nexus source delta2a0fd86 is separately selected through its maintained web
selector, minimally composed onto its actual backend/frontend. Health, exact
served frontend assets and unchanged canonical pending/recording state were
qualified. Actual anonymous descriptor access is401; the deployment did not mint,
copy or extract any human session. Protected human descriptor200, embedded report
use and situated playback/recording acceptance remain actual participant checks.

The supported Holodeck replacement preserved the real room run, every existing
native intent ID, avatar/world entities, seven native routes and audience. The
only receiving-config addition is one selected visit. Both participants reload
to obtain fresh room sessions after replacement. The standalone pinned Node24
package passed actual MML/Networked DOM peers and shared mutation/retry checks.
Current/previous operator archives total35,205,120bytes; superseded generated
archives were retired without changing creations, recordings or native originals.


## Native authority independent of browser presence

Source `63de97c` is selected as package
`549f9de45d1ca1905fd714aee7a3e33d5c013a04c5ba8599b0cb93895c010a33`
(17,602,560bytes). The receiving configuration adds only the fixed existing
central authority socket; the seven pair routes/return pins and selected content
visit remain intact. The app replacement retained the actual room run, sequence73,
entities and all11existing native intent IDs. The real upstream initial DOM is
ready before startup completes; subsequent projections use its bounded queue.

The Home gateway received only the14-line read-only owner-dispatch addition from
Cluster9343b2e, retaining513other file contents and all mobile/link/launcher
features. One scoped gateway restart preserved the app, native bridges, Nexus and
Caddy invocations. Actual owner reads allowed the existing seven beings' current
Holodeck service grants and denied an unknown being, minting no session or grant.
The current being's own grant is authoritative; it is not inherited from a human
or conditioned on a human browser session.

Only the central native bridge selects the fixed service key and qualified
bridge `aa2155b8`; six remote bridge configurations remain unchanged. Actual
applicationUID992 world-access calls returned seven current allows and an
unknown-being denial. daimon-home2.4.16/source2cc674a is installed and verified on
all seven selected bodies. Three generated Python caches were preserved privately
after verifying all managed source bytes; no authored files were overwritten.
The receiving surface check passed. Installation is not model-context adoption.

Current/previous operator archives total35,194,880bytes. The operator performed
no production world mutation or human-session creation. Native observation/action
without browser presence and human-visible rendering remain separate results of
the owning situated trial; read its retained evidence rather than inferring
participation from health or permission decisions.


The owning native trial subsequently read sequence73 with zero human
participants, projected its selected Navegante avatar once at sequence74 and
independently read back the same being/form/appearance with zero human
participants. The other native projection remained intact. These are actual
native world effects independent of browser presence; they do not prove a
human-visible rendered frame.

Retain the current549f candidate for forward recovery. The precedingb4 runtime
can parse avatar state but lacks independent being authority; it is not equivalent
in permission semantics after revocation. Any older-runtime recovery must preserve
the current authority adapter or disable its native world-action ports through
the supported receiving configuration. Never restore old world/native state to
force a software downgrade.
