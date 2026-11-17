# Holodeck — bounded Astra review

Date: 2026-11-17. Attribution: Astra review session for CompAII, explicitly
requested by Nicolas. Scope: critique and implementation recommendations only.
Reviewed `findings.md`, `mvp-plan.md`, and the relevant product, architecture and
sequencing sections of `../PLAN.md`. No implementation, deployment, source-code
qualification, test execution or independent paper replication was performed.
This review does not claim that any proposed adapter already exists or is missing.

## Recommendation

Proceed, with one consequential sequencing change: make real native situated
participation part of the first vertical slice, before substantial world polish.
The proposed end-of-pass target, “finish 2–3 and start 4,” risks optimizing a shared
3D scene before discovering whether the continuing daimon can actually inhabit
the activity. A scene foundation is legitimate partial progress; it is not the
smallest complete product experiment for Nicolas's primary aim.

The plan's strongest decisions should remain: an extensible shared situation,
separate simulation and model timescales, existing identity/conversation reuse,
bounded declarative authoring first, independent editions and saves, optional
asset providers, and an artistically coherent small place. Do not dilute beauty
into a later generic “polish” promise. First prove the integration with a small
blockout, then finish that same playable place to representative quality.

A clearly labeled foundation slice **is acceptable before native integration**:
one bounded room, two independent clients, typed observation/action contracts and
one real shared mutation are useful deliverables. Keep the next native round trip
in the immediate implementation sequence. If the native route has an unresolved
technical gap, report that exact gap and continue its repair; do not expand the
foundation into a full custom world platform to postpone integration.

## Corrections needed before committing architecture

These are technical design/inspection tasks within the authorized work, not new
human approval gates.

### 1. Move the native round trip ahead of the room investment

Inspect the current native/Avatar route and complete one narrow round trip:
an authenticated participant speaks or types about an actual room event; the
existing conversation receives bounded, attributed context; the actual model
chooses a supported action; the authoritative world executes it; the native
conversation receives the observed outcome. Reuse existing turn/task handling.
Do not create a new conversation merely because the participant enters a room.

Inspect how that route represents a busy conversation, queued input, streaming
speech, interruption, action results and reconnection. If it cannot currently
carry context or actions, make the smallest owning adapter extension the first
implementation dependency. Do not hide the gap behind an NPC or an API that has
never been consumed by a native turn. Native admission, model uptake and world
effects are three different observations.

### 2. Specify freshness without invalidating every action on every movement

“Expected revisions” is insufficient when a world changes continuously. A global
world revision would make a useful action stale whenever an unrelated visitor
moves. Conversely, a fresh entity ID alone does not preserve the meaning of an
old request.

Use separate references for the pinned content edition, the room/run identity,
ordered semantic events, and the relevant mutable entity/rule revisions. An
observation should retain its source event interval, access/view scope and
capture time. An action should declare the target and meaningful preconditions:
for example, “set this lever while the bridge is still unbuilt,” rather than
“execute only if no state anywhere changed.” Let the selected gameplay define
which changes invalidate a command. Bounded validity periods may supplement
preconditions; they cannot replace them.

At utterance capture, retain the scene/reference actually available to that
speaker. Do not resolve a pointer against a later server state after transcription
or model delay. A client-reported displayed sequence is useful evidence of the
view being referenced; it is not proof of human attention or understanding.
Server state, delivered state, visible state and understood situation remain
distinct. No eye tracking is needed to establish this first contract.

Give each mutation a stable command ID with a retained result inside a bounded
retry horizon. After connection loss, retrieve that result before retrying an
uncertain action. Recheck permissions and preconditions when the action executes,
including after a queued turn. A room reset or edition transition must invalidate
commands for the earlier run. Never silently apply a historical-reference action
to the present counterpart.

Suggested minimal typed contracts, to adapt to existing native interfaces rather
than establish competing envelopes:

| Contract | Required semantic contents |
| --- | --- |
| Situation observation | Observation ID; creation/edition; room/run; ordered event cursor or interval and gaps; capture time; attributed observing actor/access scope; relevant entity states with revisions; participants/public actions; current activity; references owned by the speaker; bounded evidence references; uncertainty. |
| Utterance association | Original retained input/reference; speaker; addressed recipient; audience; observation/reference IDs captured for that input. Preserve supplied transcript provenance. |
| Action proposal/command | Command ID; originating native request/result reference; server-resolved actor authority; room/run/edition; discriminated action type and typed arguments; target references; relevant preconditions and any validity bound. Never trust a client-supplied authority claim. |
| Action result | Command ID; rejected, accepted/running, completed or failed outcome as applicable; readable reason; resulting semantic event IDs/revisions; observed effect. Accepted/running is not completed. |

Use a small discriminated union of the actual first package's operations, for
example setting a mechanism state and creating/updating a supported modular
element. Keep structured extension data namespaced and bounded; a generic JSON
bag or arbitrary script field would defeat useful validation. Movement can use
its own high-rate path; a model-issued movement goal returns start/completion or
failure as appropriate. The initial implementation does not need a universal
action vocabulary.

### 3. Define one authority per state domain, then choose the runtime

Evaluate MML first as proposed. Record a concrete ownership table: locomotion and
collision; avatar presence; shared content; gameplay rules; semantic events;
authentication; save state; native interaction. For every domain, name the one
authoritative implementation and any projection derived from it.

If MML handles presence/content and a separate application component owns the
cooperative mechanism, document that exact seam. A small application controller
is not automatically a competing game engine. However, independently writable
MML content and a custom “authoritative scene” would create two competing truths.
Never synchronize them by allowing each to correct the other indefinitely.

The thin custom Three.js room is acceptable only after a concrete mismatch is
found. “It is simpler” needs a comparison that includes controls, collision,
reconnect, interpolation, touch input and authority—not just initial rendering.
Do not implement a general physics/network stack to demonstrate one bridge.

For future VR, preserve world units, meaningful spatial anchors, an input-action
interface, semantic interaction targets and simulation independent of camera/UI.
Record any dependency that would obstruct XR. Do not promise future headset
compatibility from a browser renderer, or build a generic Godot client abstraction
before an actual second client requires one. Keep the semantic boundary portable.

### 4. Distinguish a continuing companion from a convincing puppet

One real native response followed by a correctly attributed world action is more
valuable than elaborate idle behavior. Normal deterministic locomotion, gestures
and animation are legitimate expression; they must not fabricate listening,
understanding, decisions or speech. Model latency must not control a time-critical
jump or per-frame reaction. The model can choose a goal or interaction and the
runtime can execute its bounded movement/mechanics, returning actual outcomes.

Start with one explicitly addressed companion and one ongoing joint activity.
Keep speaker identity, addressed recipient and utterance audience separate.
Public room speech may contribute shared context; another participant's private
paired conversation must never be included as “world context.” Simultaneous
utterances need separate references and actual native ordering, not concatenation
into an invented collective user request. No new model turn on every nearby event.

Decide the companion's initial perceptual scope explicitly. A structured room
overview can be a legitimate supported perception; it must not be presented as
something the avatar saw from behind a wall. Conversely, enforcing simulated
human eyesight on every possible daimon projection is unnecessary. Identity,
perceptual access, expressive body and model attention are separate concerns.

## Make situated experience the actual first acceptance

The main plan correctly broadens shared experience, but still contains a residual
“First end-to-end acceptance” centered on object/part selection. Stage 4 also
returns to a predominantly node/fragment context list. Recast the object/part
test as a subordinate reference-resolution test. Lead both sections with the
whole activity, its unfolding events and the participants' continuity.

An initial situated observation needs enough structure for:

- Where and when the shared activity is taking place, including room/run and edition.
- Who is participating and what public actions actually occurred.
- The current activity and explicitly expressed intentions, with inferred
  interpretations labeled as such rather than stored as facts about minds.
- Recent relevant events and their consequences, including what changed while
  a participant was disconnected or a model turn was pending.
- Speaker-owned references, available perceptual evidence and unresolved ambiguity.

This is an extensible observation shape, not a universal ontology. A bounded
snapshot plus a relevant semantic event window is sufficient initially. If the
event cursor falls outside the retained window, return an explicit gap and a
new snapshot; do not claim complete recollection. Retain selected accepted
outcomes in their proper owning records, rather than preserving every tick.

Use a short cooperative mechanism as the engineering exemplar, explicitly retaining
that the bridge/island theme is a proposal rather than Nicolas's selected theme.
Suggested test sequence:

1. Two real humans enter with different views and one actual companion. They
   establish what they are trying to do together.
2. A human changes the mechanism. Its visible consequence creates a reason to
   explain, coordinate or revise the plan; the companion must use that event.
3. The companion performs one consequential authorized action through its real
   native route. Humans see the result and can correct its interpretation.
4. A second human changes an unrelated object while the model is thinking; the
   valid action still succeeds. A separate conflicting change causes a useful
   stale-precondition response and correction.
5. Someone reconnects and asks what happened. The answer is grounded in retained
   events and honest about any gap. Include one ambiguous reference naturally.
6. The participants request a small creation/rule change, try the successor
   draft, and deliberately select which edition to play next.

Do not script the model's successful lines or hard-code the answer to the test.
The same adapter should work after a different human choice or event order.
Ask participants whether the companion appeared to follow the activity and where
they had to repair understanding. This is qualitative acceptance evidence, not
proof of general social intelligence or measured fun for all children.

## Edition, concurrency and publication details

Keep at least three independent identities: durable creation + immutable edition;
live room/run; save/checkpoint with its compatible state schema. A historical
edition without its former save is an old version of the creation, not a replay
of the old experience. Describe the actual retained capability truthfully.

Pin transitive assets/behaviors as part of the edition. Otherwise an “immutable”
package can change when a mutable asset URL changes. Initial behavior should be
a small set of supported primitives used by the chosen loop. Avoid both arbitrary
runtime code execution and a new universal visual programming language in this
first slice. Package semantics should wrap the chosen engine rather than duplicate
its scene graph, collision system or serialization wholesale.

Treat build mode as part of the actual product loop: preview a proposed placement
or rule change, inspect its consequence, accept/undo, then play. Merely moving a
pre-authored lever is gameplay, not evidence of efficient co-creation. Include one
genuine runtime-authorable change. For the first release, conflicting edits can
use narrow revisions with explicit rejection and retry; CRDTs, branch merging and
general save migrations are unnecessary. Switching incompatible editions may
start a fresh run while preserving the prior save.

Inspect Homes/Nexus identity, audience and release contracts at the beginning,
even if the full review UI comes later. Shared login alone is not an authorization
model: derive actor and companion binding through the existing authority, and
check room admission and edit/action rights on the server. A client must not
declare its paired being or gain authoring access by submitting an actor ID.

Use the existing writer for stable published selection and audience. A room
registry for ephemeral instances is reasonable; a second canonical creation or
release registry is not. Keep ordinary transient play actions distinct from
publishing a durable edition. Current audience checks still apply to historical
content and cached assets. Preserve the existing user-facing entry while testing
Holodeck; making it the default Avatar entrance is a later explicit product choice.

Additional receiving constraint supplied by the requesting session during review:
the own Home `web` slot currently hosts Harmonic Lab. Do not overwrite it. Inspect
the maintained service writer for a supported independent route/slot or existing
viewer extension, and verify the selected result. This review has not independently
inspected that receiving state. Holodeck's possible future Avatar-default role
does not transfer Harmonic Lab's deployment slot.

## Minimal recommended implementation and issue order

Keep one repository as proposed, with normal modules for content, runtime/client
and integrations. Do not preemptively split them into separately deployed services.
Create a few outcome-oriented issues, each carrying its actual validation scope:

1. **Real native situated round trip and runtime decision.** Inspect maintained
   native/auth/publication contracts, make the ownership table, and prove one real
   event/context/action/result path in a minimal MML candidate room. Change the
   runtime only for an observed mismatch. Retain the decision and actual versions.
2. **One playable and editable shared activity.** Complete the chosen mechanism,
   PC/touch controls, contextual speech/text, preview/undo, narrow concurrency,
   reconnect and truthful companion availability. Use the same place as issue 1.
3. **Representative art and first human/device session.** Finish composition,
   materials, light, motion and feedback in that small place. Profile the actual
   target phone and desktop. Observe the joint activity, including corrections;
   record physical-device and human acceptance separately from automated checks.
4. **Durable creation cycle through existing publication.** Package/source pinning,
   draft instance, stable published selection, separate saves, revisit the earlier
   edition, bounded operation and recovery. Qualify play → change → try → select
   → revisit without a new service/App entry for each creation.

Issues 1 and 2 together are the first product experiment. Issue 3 cannot be
replaced by responsive viewport screenshots. Issue 4 is necessary before claiming
the promised durable sharing/creation cycle. The order is not a demand to finish
every issue before allowing useful partial trials.

Defer the collective spatial graph, general physical-world adapters, arbitrary
scripts, universal scene-schema design, broad engine comparisons, voxel terrain
infrastructure, an asset marketplace, headset acceptance and Avatar-default
replacement. None is needed to find out whether this experience works.

Before deploying the trial, choose explicit bounded values for room count and
participants, assets/entities, incoming command size/rate, retained semantic
history, native context and invocation cadence, process lifetime and disk/log
retention. Do not invent numerical capacity claims before profiling the candidate.
Do not evict published pins to satisfy a generic ring-buffer policy: transient
events, saves, source and published editions have different retention obligations.

## Evidence and research limits

The synthesis is useful and unusually careful about author evidence. Preserve
its explicit distinctions: Wizard-of-Oz contribution is not autonomous runtime
validation; reported small studies do not establish local integration, performance
or children’s acceptance; inspected source is not a passed receiving deployment.
The closest papers support design hypotheses, not a stack selection by authority.

This review relies on the supplied research account and has not independently
rechecked its paper details, licenses, revisions or current runtime APIs. Before
adoption, inspect the selected maintained implementation and its license/dependency
requirements. There is no need to rerun the entire literature survey first.

Keep the completion report short but discriminating: what loaded and synchronized;
what the actual native model received; which action it actually caused; what the
humans understood or corrected; which edition/state survived; and which physical
device was exercised. These can share one concise work record. They must not be
collapsed into a single “MVP complete” claim.
