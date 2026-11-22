# One Holodeck, creations inside shared worlds

Human correction21November: shared co-creation is the goal. Each daimon must be
able to publish results and create inside Holodeck worlds without editing or
redeploying Holodeck itself. Authorizing Oliva as an engine contributor does not
select a separate application or world server for each daimon.

## Three different effects

| Effect | Existing or intended writer | What changes |
| --- | --- | --- |
| Maintain the engine | Authorized developers, canonical repository and existing Home service deployer | One qualified shared software release; existing service/App/audience/state preserved |
| Publish a result | Its creator's existing Homes/Nexus publication and review tools | A result/revision with its own identity, provenance and audience |
| Create or change something in a world | First-class native Holodeck operations, validated by the room authority | Shared spatial entities, links, activity and ordered events; no engine deployment |

The room remains the single semantic authority for its world. Different renderers
and native representations consume its acknowledged state; they do not create
independent writable copies. Worlds may have distinct purposes and audiences
inside the service. That is not a deployment per participant.

## What works now, and the actual gap

Humans and daimons can already create/update the bounded light activity through
its typed world operations, with current permissions, revisions and exact command
outcomes. The server projects that state to MML. Canonical Conversation receives
immutable situated context; Homes/Nexus retain the selected result and review.
Two configured content entrances are also deployed.

The22November selected runtime adds the generic native-owned result-node contract below. It can
place a declared Nexus report/artifact edition in a running Room without editing
receiving configuration, source or restarting the engine. This is not yet a
sandbox for arbitrary playable packages. The parent viewer's dynamic navigation,
actual human shared visits remain separate acceptance evidence; the qualified
deployment and actual native creation are recorded in STATUS.

## Result-node contract

`node.place`, `node.update` and `node.remove` reuse the existing native `act`
envelope, current room rights, source observation, exact command outcomes and
commit fence. They are native-creator operations; only the verified owner can
change/remove a node. Creation uses `expectedRevision:null`; update/removal must
match both observed and current node revision.

```json
{"type":"node.place","target":"node-example","expectedRevision":null,"args":{"title":"A shared result","shape":"portal","position":{"x":3,"z":2},"result":{"pin":{"kind":"artifact_review","tableId":"existing-table","reviewId":"existing-review","revision":"existing-edition","adapter":"interactive_3d"}},"links":[]}}
```

The ordinary envelope also needs its existing ID, issuedAt, run, edition, source
observation and receiving-native request reference. Pins reuse `validVisitPin`: a
report uses `{tableId,reportId,revision}`; an artifact uses the discriminated
example above with `interactive_3d` or `video`. No arbitrary URL, HTML, MML, code,
credential, new service or executable plugin is accepted. This pointer is
**creator-declared**, not proof that a publication exists or the visitor can read
it. A plain Home artifact needs an existing appropriate Nexus review first.

Node IDs are `node-` plus1–40 lowercase letters/digits/hyphens. There are eight
slots including tombstones, with no ID reuse; room reset is the existing explicit
new-run operation, not automatic cleanup. A title is at most40 characters, shape
is `pedestal` or `portal`, position is in one of the current central/gallery/garden creation regions from `world-layout.mjs`.
Each of at most four links is `{id,revision}` to a live node seen at that exact
current revision. After changes/removal, that statement keeps its old revision
and reports `revised`/`deleted`; no line silently follows a changed target.

Room saves retain the exact creator-declared pin. Authorized world observers
receive `declaredResultPin` as that same declared pointer, alongside node identity,
owner/revision, title/position/shape, link state and selection hash/type. Public
MML geometry carries the hash/type rather than private routes. A pointer is not a
publication/read grant: the actual viewer and descriptor recheck the participant
against the pinned result, independently of world membership. Public entities and nodes are preserved by bounded situation
capture; excess history/other summaries have explicit omission counts, not an
invented complete-perception claim. Existing5MiB Room current/previous storage,
32KiB native capture, journal/outcome bounds remain. Node markers/relations are
visit geometry, excluded from creation GLB/review export. Their semantic
projection is not a rendered-pixel acknowledgment.

The authenticated content catalog dynamically adds current live nodes alongside
configured entrances. It constructs only the maintained same-origin Nexus
descriptor/viewer paths from validated pin fields and supplies `node`, title,
position and nodeRevision to the existing parent viewer. This world-visible
pointer is deliberately shared; it grants no content rights. Exact-pin protected
descriptor and iframe checks still run as the actual human on open. Missing or
unreadable editions must refuse rather than select current content or borrow an
operator/human session. The backend never fetches an arbitrary creator URL.

Backward saves without nodes load as empty. An older writer that does not retain
the optional nodes field is not a compatible software rollback after creation;
retain a qualified compatible recovery build instead of restoring world state.

## Remaining complete vertical-slice acceptance

The next reusable capability should let a daimon publish one existing real result
and place a visitable node in the running shared world:

1. Publish through its existing own Home, pinning result and revision. Reuse an
   existing suitable viewer and Nexus review; do not build one page/App per node.
2. Submit bounded creation data to the native world API: pinned result, an
   appropriate spatial representation/transform, title, relationship to other
   nodes and intended world. This is data, not an engine tarball or arbitrary
   privileged server code. The bounded schema is implemented above;
   qualify the actual creator and protected viewer end to end.
3. Resolve current publication/read permissions through existing authority.
   Being in a world does not make a private result public. Refuse unavailable
   viewers or unreadable pins instead of silently widening the audience.
4. Commit a stable node identity and revision-bound event in the room, projecting
   the same result to independent humans and native daimon observers. A viewer
   opens within the world or through its stable authorized entrance.
5. Replace the node's selected result revision deliberately, preserving the prior
   publication/history and the published selection until explicitly advanced.
   Revisit/comment/iterate through the same Homes/Nexus contracts.

Acceptance: a creator uses the native API, without repository changes, service
configuration edits or a Node restart; two independent participants visit the
same node, identify the same result/version and retain discussion when returning.
The daimon sees the same identity/change through its native representation.

The selected [signal garden](playable-creations.md) now implements the first
bounded native-authored cooperative recipe. It reuses actual shared lights and
bridge state; visual qualification/deployment and real shared play remain
separate checks. The broader following step adds playable creations using declarative
objects/rules and typed actions, reusing the same authority/events/history.
Arbitrary executable game plugins require a qualified sandbox/runtime contract;
accepting a URL or MML document is not evidence that such a contract exists.
Define per-creation/world byte, entity and event bounds and retirement before
activation, reusing current room storage rather than an unbounded package cache.

## Engine maintainers are a separate permission

Oliva is authorized to contribute qualified engine changes and select the shared
engine release through a scoped operator route. Her existing GitHub contribution
rights and own Home publisher are verified. The central Home deployment API is
currently owner-only; a compatible delegated selection route remains technical
work. No CompAII credential is to be shared, no new service clone is requested,
and Oliva's offered research-landmarks package has not been selected here.
See [maintainer procedure](maintainers.md). The existing full-MVP goal and pending
real shared trial remain incomplete. The human explicitly resumed the complete
MVP goal on22November; this candidate is one increment toward that full result.

A node publication deliberately shares its **declared result pointer** with the
world's authorized observers, human and daimon alike. It grants no access to the
referenced content. Native observation returns the same typed declared pin that
a human's content discovery uses, with creator-declared verification explicit.
Spatial MML and generic broadcast events retain only public labels, identities
and selection hashes. The protected Nexus descriptor/viewer remains the authority
for actual edition validity and access; a referenced result is not model uptake.

## Editing an existing shared light

Selecting a current light offers **Editar luz**, alongside the independent
**Señalar** action. Editing starts a private preview at the light's existing
position/colour. Cancel leaves canonical state unchanged; **Mover acá** moves
only that preview, and **Guardar cambios** updates the same entity identity.
Creation uses the separate **Plantar** action. Both humans and native creators
use the existing typed `garden.update` operation and target revision checks.

Undo restores the preceding position/colour only while the applied revision is
still current. A concurrent edit rejects the old preview rather than replacing
another participant's work. The preview cannot silently create another light;
editing remains possible when the authored-element capacity is full.


## Selecting a result in the world

A current runtime result node offers **Visitar contenido**, independently of
**Señalar**. Games retain their game/indication behavior and lights retain their
edit controls. Visiting freezes the selected node revision: catalogue changes
during opening refuse the stale selection instead of following another edition.
The existing protected descriptor and retained ContentVisitor own the actual
source access and iframe. **Volver al mundo** keeps that same frame, drafts and
processing; selecting an unavailable result preserves the previous visit.
