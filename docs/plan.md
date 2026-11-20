# Implementation plan

Human direction: beautiful efficient shared co-creation, playful like Minecraft
and Roblox, eventually the default Avatar surface. Research and Astra review
precede implementation. Keep the existing Avatar entrance while qualifying this.

The MVP must include a shared walkable 3D world. This is an explicit human
requirement, reaffirmed on 2026-11-17 after the QR game proposal. Test movement,
looking, collision and situated interaction with WASD on PC and standard touch
controls on phone/tablet. Humans can keep exploring during a native daimon turn.
QR stations may connect physical locations to this same world; a station-card,
scoreboard or 2D-map-only application does not meet the MVP requirement. A full
3D reconstruction of the physical environment is not required for the first world.

1. **Native situated round trip and runtime choice.** Inspect real native/auth
   interfaces; reuse MML in a small room. Capture a real utterance and its room
   situation; actual continuing model chooses an authorized operation; report the
   observed result back. Busy turns and reconnect must retain uncertain effects.
2. **One playable/editable activity.** Two participants cooperate, create a small
   addition, preview/accept/undo it, correct the companion and revisit an event.
   Conflict on a target rejects usefully; unrelated changes do not invalidate it.
3. **Representative quality and human/device trial.** Finish that same small
   place with coherent art, lighting, sound and motion. Test real desktop/mobile
   controls and ask whether the companion followed the unfolding activity.
4. **Durable creation cycle.** Existing Homes/Nexus publication, selected edition,
   audience and review; independent saves; try a draft, select a published edition
   and revisit the earlier one. No parallel canonical release registry.

The foundation is useful progress, not completion of step 1 or the MVP. Native
integration precedes substantial world expansion. Theme is provisional; visual
blockout is not evidence of the requested finished world quality.

Acceptance: two humans with different views establish a joint intention, change a
mechanism, and discuss its actual consequence with a real companion. The daimon
acts, another human corrects it, a creative change is tried, a reconnect is grounded
in retained events. Object reference resolution is one subordinate test, not the
definition of shared situated experience. No prewritten model success lines.

Later: collective map, physical sensors/materialization, arbitrary games, deeper
simulation, VR and making Avatar default. These remain product direction; this
slice does not silently switch any existing conversation or surface.
Physical sensor/device integration must reuse
[Daimon Integrators](sensory-integration.md), selected by the human, and its
actual receiving contracts rather than introduce another device manager.

## Human refinements during implementation

Initial entry is turn-based Conversation, independent of unfinished Avatar mode.
The human moves freely; an explicit situated interaction starts the continuing
daimon turn. Capture that utterance's situation once; later movement continues.
HUD reflects actual native activity/results, never invented progress. Before an
operation executes, recheck relevant changes since capture. Avatar refinement is
not a prerequisite for this path.

Daimons are first-class participants. Native observation, semantic navigation,
actions, creation and choice of projection must not emulate a human keyboard,
camera, UI or login. Different perceptual modalities share canonical references
and observed state. Presence/expression, model attention and turn execution are
separate. No automatic model turn per event. Rights come from existing identity
and room authority, with equivalent standing rather than invented human identity.

Mutual reference and every modification must be consistent across representations.
Tie references, coordinates/anchors, semantic events, entity revisions and renderer
acknowledgments to the same state. Distinguish authoritative, delivered and rendered
cursors. A simplified representation cannot invent a different object/state.
Physical observations additionally retain source/time/uncertainty separately from
simulation or inference. The initial prototype reported rendered geometry unknown. Current bounded
client applied-geometry evidence checks attached scene primitives after rendering;
it remains distinct from presented pixels or human eyesight. See applied-geometry.md.

DaemonCraft mBit is an important prior embodiment-specific perception adapter.
Current inspected source uses visual Y slices, CJK block symbols and legend;
older memory describes five retired formats. It is a precedent for compact native
perception, not a universal world schema. Its grouped category symbols and hashed
unknown fallback are not unique entity identity and can collide. Holodeck retains
exact shared identifiers regardless of spatial representation. Inspect/reuse its
appropriate parts only when a voxel field actually exists; do not fabricate voxels
from coarse room anchors and call them sensed geometry.

## Direct Conversation reuse — human correction20November

Holodeck must depend directly on canonical Conversation for text, audio capture,
transcription, original files, submission, progress and recovery. Its presentation
may differ from standalone Conversation. Do not port or fork those features into
a second chat; recording improvements such as10/5/3/2/1second cues must arrive
through the same component. Holodeck contributes immutable situated context and
native world access, without becoming another conversation owner or exposing
other pairs' private content to the shared world. Beacon is explicitly out of scope.

See [shared Conversation integration](shared-conversation.md). The original full
MVP remains blocked on its prior real acceptance; this new foreground integration
is human-authorized work, not an automatic goal Resume or completion.
