# Sensory integration: reuse Daimon Integrators

Human-selected dependency, 2026-11-17:
https://github.com/AlterMundi/daimon-integrators .
Inspected published revision: `517d27160f9e6b37d5ec965ee9d9f298f84300d5`.
Sources: README, docs/device-discovery.md, docs/observation.md and
tools/device_discovery.py. This is source inspection, not receiving deployment
or sensor qualification. The local checkout has independent unfinished work;
Holodeck does not modify it.

## Existing useful boundary

Daimon Integrators owns local perceptor/actuator hubs, observed camera/microphone
use, visible managed capture/input controls and local device feedback. Matrix owns
identity/semantic authority; Cluster owns resource lifecycle, operation grants and
observed effects. Holodeck consumes selected evidence and represents its place,
time and meaning within shared situations. It must not create a competing device
manager, infer ownership from reachability or operate sensors through human UI
emulation.

The existing `dm.integrator-discovery/v1` projection includes resource_ref,
observed_at, freshness, coverage, camera/microphone state, managed phase and
selected system metrics. It is bounded and strips private paths/process/native
history. Its perceptor observations explicitly have media_read=false and do not
infer recording or model perception. The exposed actuator is panel-view, not a
generic remote device executor or literal native Matrix scope RPC.

Thus it can ground a representation of available/active/stale devices, but it
does not supply camera frames, recognized QR stations, a reconstructed room,
object poses or evidence that a daimon actually perceived a sample. Existing
managed capture and WiggleControl components have separate receiving contracts.

## Holodeck integration to implement

1. Resolve the existing selected device/resource and its actual receiving route.
   Consume the discovery schema without inventing a parallel resource registry.
2. Relate its device/source identity to a Holodeck anchor/entity. Preserve source
   timestamp, observation scope, freshness/coverage and current audience. A stale
   device observation cannot become a fresh scene fact.
3. For media, QR recognition, mapping or tracking, use the actual qualified
   producer's evidence and retained sample/reference. Keep device status,
   acquired sample, derived interpretation and native model uptake distinct.
4. Publish a shared semantic update only from the corresponding observed result.
   Humans and native daimon representations consume that same entity/event state;
   estimates, simulations and recordings remain visibly distinguishable.
5. Execute supported physical controls through the existing device owner/grant
   writer and return observed outcomes. Holodeck projections do not confer device
   control, change capture bounds or replace visible local controls.

This dependency belongs to physical augmentation and later embodied inputs; it
does not remove the initial walkable-3D or situated-turn acceptance requirement.
No device capture, inference process, control, background attention or deployment
was started by this integration note.

## Taller Sensorial receiving boundary

Casa de CompAII has a furnished Taller Sensorial and an authorized foyer
portal. The [existing bench operations record](https://github.com/AlterMundi/shared-resources-storage-retention/blob/main/docs/services/cuevanico-sensorial-bench.md)
describes a restricted operator terminal, with a private owner repository
and separate institutional editorial intake. Neither path supplies a
shared Sensorial dashboard or an existing exact Homes/Nexus edition for
the room. The protected camera recorder has its own owner and permissions.
The room may use the existing edition-bound exhibit and Conversation
workflow when the Sensorial owner selects a compatible distribution.
There is no terminal relay, data copy or device control in Holodeck.
