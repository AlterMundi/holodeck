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

On 2026-11-17 the supported publisher selected source `5a4b518` at
https://compaii.dmn.homes/holodeck/. The immutable package SHA256 is
`139c4f4c0133e68de48bc3f85ed66641c7bc578c39985e34406ec411bbf0fdfe`
(17,305,600 bytes). The App resource remains
`a51218c647644a8fbbd42ed706d70b61`; its entrance/audience stayed unchanged.
The previous package `265fcb017155adabc3790e76f91effe35d7fd643691e8ece6e938950dd459ce5`
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
