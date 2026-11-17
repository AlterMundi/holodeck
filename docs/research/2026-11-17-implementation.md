# Holodeck: selected runtime and controlled implementation findings

Author: CompAII. Date: 2026-11-17. This extends
`holodeck-situated-20261117-v1`, preserving its literature and open experiments.
Audience: configured collective-research participants. Public technical sources
only; no private conversations, identity bindings, credentials or topology.

## Research question and selection

How can humans and continuing AI companions share a changing situation while
using different native interfaces? The first implementation selects MML3D Web
Experience0.28.0 over Three.js0.182.0, with Node24 in the receiving service.
DeltaNet handles presence/movement; Networked DOM handles the visible authored
content. A small Room authority owns semantic game state/events. These domains
are explicitly distinct: client locomotion/collision is not server evidence of
physical presence, and shared graphics do not establish attention/understanding.

This is a locally implemented web candidate, not evidence that it is universally
better than Unity, Godot, Ubiq or Microverse. The initial investigation's research
systems still inform the situated-activity and co-creation tests. The practical
reason for selection is reuse of existing controls/networking plus a direct
companion observation/action boundary, with PC/mobile browser entry.

## Findings from implementation

1. **Reuse the runtime without duplicating authority.** The server's semantic
   changes project one way into MML. High-rate presence does not invalidate a
   command whose relevant entity preconditions still hold. Content edition,
   room/run, event sequence and entity revision remain separate references.

2. **Native participation requires its own interface.** The companion receives
   structured authored-world perception and uses observe/project/act/result;
   it does not simulate a human keyboard, camera or browser login. The continuing
   Conversation retains exact human originals with immutable, explicitly
   application-authored situation attachments. Identity/admission, native uptake,
   expression and actual world effect remain separate evidence.

3. **Retry behavior is product behavior.** Controlled tests found and corrected
   permanent UI blocking after a request never reached the server. Recovery now
   checks retained results and offers explicit same-original retries, preserving
   IDs/text/view/capture time. A generic404 never triggers automatic replay.
   Closing tracking explicitly does not cancel or undo a possibly pending effect.
   Bounded terminal metadata retirement uses canonical original/source lookup;
   unknown writes are not discarded to admit more work.

4. **Atomic rename does not eliminate commit uncertainty.** If directory fsync
   fails after replacement, restoring old in-memory state can overwrite a newer
   checkpoint on the next write. The implementation fences further writes and
   readback, preserving the possible commit until recovery. Regression tests
   inject this actual boundary rather than only testing pre-write failure.

5. **Handshake authorization is insufficient for a live shared room.** Existing
   geometry/presence sockets are reauthorized while connected, and semantic
   geometry publication checks access again. Exact browser Origin is required
   for protected upgrades. Controlled tests cover revocation after connection;
   ordinary HTTP denial alone did not prove that a socket stopped receiving.

6. **Qualify optional dependencies against the actual use case.** The inspected
   JSDOM backend treats server Canvas as optional. Standalone Node24 qualification
   with two MML peers, two Networked DOM streams, a shared mutation and exact
   retry passed with Canvas physically absent. Removing its unnecessary native
   binary reduced this receiving archive from about30.5MB to17.3MB and removed
   decompression/bootstrap work. Browser WebGL is independent. This does not
   qualify server HTMLCanvas authoring as an available feature.

7. **Separate the live creation from its review projection.** A bounded GLB
   snapshot exporter preserves creation entity IDs/revisions and separate source
   hashes for existing3D viewers/static review. Such a projection is not running
   world replay, a captured human frame or a new canonical release registry.
   Selected publication and review permissions remain with Homes/Nexus.

## What was actually checked

The composed runtime/client/native suite passes32Node and12Python checks.
Two additional snapshot-export tests include loading through the real Three.js
GLTFLoader. Real browser qualification covers ground collision, WASD movement,
emulated touch movement, preview/accept/undo, composer typing and failure/reload/
explicit-retry behavior. Native response fixtures are labeled as fixtures.
Read-only owner metadata and an exact unknown-original lookup were qualified;
no fabricated human original or model write was used to claim native uptake.

The protected runtime started, but gateway publication was not yet confirmed at
this report's cutoff. Physical-device/human acceptance, the first actual situated
native action/result and the complete creation/review/promotion cycle remain open.
A compiled adapter, passing test or attractive frame does not close those items.

## Reproducible primary sources

- Selected runtime source and tests:
  https://github.com/AlterMundi/holodeck/tree/7c11967
- Native source/context boundary:
  https://github.com/AlterMundi/holodeck/blob/7c11967/docs/native-integration.md
- Authority, state and operation ownership:
  https://github.com/AlterMundi/holodeck/blob/7c11967/docs/architecture.md
- Packaging and qualification, including optional Canvas removal:
  https://github.com/AlterMundi/holodeck/tree/7c11967/deployment
- Snapshot exporter and its explicit evidence limits:
  https://github.com/AlterMundi/holodeck/tree/10724b6
- Initial MML source inspection:
  https://github.com/mml-io/3d-web-experience/tree/b3fed99f3bae267a23c66e195794ac22e2b81107

This report is selected engineering evidence and interpretation, not independent
replication of the cited human–AI studies or proof of other participants' adoption.
