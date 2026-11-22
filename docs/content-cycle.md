# Durable creation cycle: supported route and remaining seams

Initial read-only source inspection, 2026-11-17, followed by the bounded real
creation delivery below on2026-11-19. The initial audit qualified plan step4;
receiving publication/review and human acceptance remain distinct.
The existing [snapshot exporter](content-snapshots.md) freezes creation geometry;
a save, a static snapshot, a review edition and a published selection are distinct.

## Current draft and independently published selection —22November

The same model resource5764af7b14a041a68eb35db248ed5417 now has review draft
`e66a4961ac675945f4f89baaf8d18f0ad2f8fa26fb558152df5d99c83912240a`,
model `holodeck-workshop`/`2fc5dceff4ea08575964c32238d2609aac41893cc0d08b14db47cc75522e2cfb`.
It freezes the redesigned archipelago at the explicitly selected observation
seq127, rather than claiming the running world has remained unchanged. The
109-part static model and sanitized activity source retain two node definitions
(one cooperative game and one declared result). Activity metadata is not an
executable world replay or a grant to the referenced result.

All five immutable HTTPS files match their publication hashes. The actual hosted
viewer hydrated109parts, toggled108/109 and made no automatic current-version
lookup. The old pinned viewer still hydrated106parts with exact historical bytes.
The independent published entrance57e5fe25924a42d2b1df869fff81cac3 still redirects
to539aeebd…; it was not promoted or relabeled. All retain the same fourteen readers.
History uses14,378,815B of the200MiB budget. The temporary own-being reader was
revoked after verification. These are technical receiving observations, not a
new human review. The successor [Nexus room](https://compaii.dmn.homes/nexus/?table=holodeck-workshop-e66a4961ac675945) now has seven exact human invitations/Home selections and fourteen allowed model-reader policy decisions. The previous38Home mappings, old table and published node are unchanged. Its native association and a distinct in-world draft entrance remain unfinished; the published node continues to pin the old edition. The older delivery sections below retain their dated evidence.

## Existing supported operations

**Homes publication.** The installed `daimon-home` writer is
`daimon-home/scripts/home.py` from the shared skill. `publish SOURCE --id ID`
with explicit title, summary, visibility and decision creates/updates one artifact.
Updates keep its resource identity and retain immutable earlier versions.
`--expected-current VERSION` checks the exact predecessor under the writer lock;
`--reuse-identical` reuses unchanged bytes. Resolve actual recipients with `targets`;
authentication or Holodeck membership alone does not grant a model resource.
There is one current `version_ref`, not independent draft/published selections.
Do not publish an experimental revision over a selected result and call it a draft.

The stable artifact entrance is `/view/RESOURCE?display=work`; pin an edition with
`/view/RESOURCE?display=work&version=PUBLICATION_VERSION`. Historical file reads use
`/works/RESOURCE/PUBLICATION_VERSION/FILE`. Both current and original audience
must allow a historical read. Use the shared SSO return to that relative viewer
path when needed; temporary isolated `/r/...` contexts are not bookmarks.
Retain actual publication receipts and served file hashes. If local publication
committed but authority sync failed, inspect retained state and use `sync`, not
another publish to conceal uncertainty.

**Shared3DViewer.** Reuse the existing Apps entry and its permission-filtered
project selector. The maintained receiving record explicitly supports independently
bounded data galleries with a link-only `index.html`, `gallery.json` and
`review-live.json`; no renderer/App clone is required. The shared builder is
`3d-design-and-fabrication/scripts/review_viewer.py`. Its `build` takes normalized
scene JSON, and `--live` emits the fixed gallery and digest manifest together.
Scenes require explicit millimeter units, stable scene/part IDs, vertices and
triangle faces. The builder accepts scene JSON, not arbitrary GLB as that contract.
Historical pinned views do not subscribe to live updates. Inspect the current
negotiated gateway capability rather than the older portable paragraph saying
the ordinary gateway lacks the review bridge.

**Nexus review.** The concrete owner writer is:

```sh
python -m backend.operator --state SELECTED_NEXUS_STATE import-artifact-review manifest.json
```

Use the maintained receiving interpreter/state, not the command's default or a
second database. The importer accepts at most128KiB and calls
`ArtifactReviewStore.install`. It requires an existing fresh review table;
create that table through the existing owner `import` bundle route when necessary.
The static manifest pins `review_id`, `revision`, `table_id`, title,
`adapter: interactive_3d`, `source: {resource, publicationVersion, id, version}`,
unique `part_ids` (at most256), gallery SHA256 and renderer HTML SHA256.
One table retains one immutable edition. A successor uses another table in the
same review family; existing discussion is never relabeled as the new edition.
The import grants no room/model access and starts no native model turn.
The current `grant-table` CLI targets an already-verified Telegram participant;
do not infer that every admitted child already has that receiving grant route.
There is also an existing generic owner route: `invite TABLE AUTHOR_REF NAME
--output PRIVATE_FILE --days N` creates a1–90day invitation, and the maintained
`nexus.home-grants/v1` owner configuration selects its hash for an exact verified
Home human actor. `HomeAuth.participant` supports such existing local/application
humans without requiring Telegram; it checks the selected invitation's table,
expiry/revocation and the current Home session on every request. Preserve the
actual author reference, selected audience and existing mappings; never derive
an identity from a name or silently grant room admission. This route is documented
in Nexus `docs/backend-operations.md`, and was rechecked against upstream
`5c8db5e` after fetching main. Its source support does not establish any child's
actual Nexus grant or successful browser participation.
Model/source permission remains separate. Existing review retrieval is
`GET /api/tables/TABLE/artifact-review`; the frontend supports `/tables/TABLE`
under its configured base path (also `?table=TABLE`).

Data-gallery discovery is not by itself a Nexus renderer handshake. The current
Homes `review_source` selects the pinned artifact's own HTML entrypoint as its
isolated frame, while a data-only gallery's link-only entrypoint contains no
adapter. Its gallery filenames alone do not establish a usable review source.
The existing builder's `--live --defer-gallery --bootstrap-gallery` route supplies
its maintained, geometry-free renderer beside the gallery in that project
resource. Use this existing renderer contract for the MVP: no new renderer
implementation or Apps entry, and no landing-page hash masquerading as renderer
evidence. The current Nexus `ArtifactExperience` already waits finitely for the
expected model after hydration. Source checks and actual builder output confirm
the bootstrap is geometry-free; the published frame/adapter round trip still
requires actual receiving qualification. Separating the renderer into a different
canonical resource may need a future adapter extension; it is not an MVP blocker.

## Smallest honest cycle for a selected creation

1. Retain one bounded editable save independently of deployment. Select a
   confirmed creation situation and authored source; export the bounded snapshot.
   Preserve source/run/edition/entity correspondence, not participants' private
   conversation. The current GLB export is useful source material, not proof of
   shared-viewer compatibility.
2. Use the deterministic `tools/export-review-scene.mjs` conversion from those
   same authored meshes:
   meters to millimeters explicitly, stable semantic entity/part IDs, positions,
   material colors and checked triangles. World Y-up maps to display Z-up by
   `(x,y,z)m -> (x,-z,y)mm`, with a retained source matrix. Build the existing viewer's data-gallery
   format with `--live --defer-gallery --bootstrap-gallery` when that artifact
   must itself serve the existing pinned Nexus frame. Ordinary canonical viewer
   discovery remains available; no new Apps entry is added. Retain the source snapshot/GLB alongside selected display content where
   useful; never pretend the static gallery reconstructs a running game.
3. After explicit result/audience selection, publish that data gallery under one
   stable artifact ID using the Home writer. Preflight project history plus one
   temporary stage; the human ceiling is200MiB per3D project, not an allocation to
   fill. Verify immutable bytes, digest, filtered discovery and receiving renderer.
4. Import the exact pinned Nexus review manifest into a separately authorized
   table. Revisit that edition and its discussion after another draft is tried.
   A pinned old URL remains usable only while its content and permissions remain.
   Preserve published targets and Nexus-pinned editions in the project's protected
   version set. The Home `retire-version` writer protects current/previous and
   explicit `--protect-version` selections; it does not discover inbound links.
   No retirement is needed or selected for this first bounded cycle.
5. Keep subsequent unselected drafts in the bounded owning workspace. Repeating
   an explicit Home publication can advance the stable current entrance while
   preserving earlier editions, but this is a new publication selection, not a
   separately reviewable draft promoted without affecting a published pointer.

This manual cycle supports local drafts, explicit publication and exact
historical review. The qualified link entrance below can select a pinned edition
while review content advances under the same compatible resource audience. It
does not supply the broader private-candidate/public-release lifecycle.

## Shared-capacity export derivative

The entity ceiling is read from the same `src/world-capacity.json` as Room and
projection: currently32 total entities, including bridge and31 lights. Snapshot
and publisher guards consume this value rather than another literal limit. The
2MiB GLB,8MiB scene,256 parts/50,000 triangles,16MiB complete preparation stage and
200MiB retained project-history ceilings are unchanged.

New static snapshots tessellate spheres at12 longitude ×8 latitude segments,
without changing their analytic radius, centre, colour, semantic entity/part IDs
or source/projection hashes. GLB extras retain those analytic sphere parameters
and declare the export-only mesh approximation; review-source metadata carries
the same declaration. Actual GLTFLoader checks retain axis bounds and outward
winding. Measured maximum radial face deviation is5.143% of sphere radius,
within the declared6% bound. This triangle derivative is not bitwise MML renderer
geometry; the captured editable parameters remain authoritative. Cylinders keep
the existing16-segment export derivative. Historical published bytes are untouched.

The current506528-byte scenery and actual32-entity fixtures with maximum-length
light IDs were qualified for both bridge states through the real installed
review builder and publisher file validator. Lowered:1,273,604-byte GLB,
2,930,245-byte scene,115 parts/16,244 triangles and7,230,457-byte complete prep.
Raised:1,318,596-byte GLB,3,032,097-byte scene,125 parts/16,780 triangles and
7,479,671-byte complete prep. The five-file sites occupy4,281,606/4,428,779 bytes.
Activity recipes remain outside static geometry and are retained in creation.json.
These are bounded controlled format/builder checks, not a shared human trial.

The proposed64-entity count was not selected because its complete canonical
native context exceeded the existing32KiB bound. Its successful export-only
measurement is retained as audit evidence, not runtime/recovery support. Current
entity/restore capacity remains32; this exporter change requires no64-capacity
recovery selection and never restores old world data to force software rollback.

## Editable activity source alongside the static review

The bounded publisher now adds optional `activity` inside the existing
`creation.json` when the same selected immutable situation contains `nodes`:

```json
{"schema":"holodeck.activity-source/v1","layoutVersion":"captured-layout@2","nodes":{}}
```

It retains at most eight node definitions/16KiB: stable ID, revision, tombstone,
authored title, shape, position, exact-revision links and either a signal-garden
recipe or `{pin,verification:"creator-declared"}`. The declared result pin must be
present in that observation and match its captured selection hash. Missing or
mismatched pins fail explicitly; source capture does not invent a result or assert
publication/read permission. Layout comes only from captured place metadata;
historical missing layout is explicitly null, never today's global code.

Extraction whitelists editable fields, excluding owners, participant rosters,
conversation/originals, editor stamps, progress, credentials and private bindings.
Only the source pointer already shared in the world is retained; it grants no
access to the referenced Nexus/Home content. Publication retains the same exact
world/model audience gate and existing200MiB project history/16MiB stage bounds.
The five-file gallery/GLB/creation bundle, ModelPin and Nexus viewer are unchanged.
There is no new registry or source-of-truth store.

Publishing activity requires the existing `--observation` and `--scene` inputs.
The producer checks the entire expected creation source against that same frozen
capture before publication; edited/retargeted activity is refused. The optional
field has its own closed schema/byte validation in the staged-file reader. Old
v1 geometry-only source without activity remains accepted unchanged; absence is
not a claim that the historical world had no activities. Current viewers do not
consume this metadata, while an older strict publisher may refuse the new field.

This preserves editable definitions, not authority or a running-world replay.
Static3D review still omits visit/game geometry by design. The private Room save
remains the live world state; importing source, reassigning ownership or applying
edits would require existing current native world operations and their actual
permissions, observations and revisions. No restore/apply operation or simulation
history is supplied by this publication increment.

## Stable entrance source follow-up

Current upstream Cluster03b6a7d was inspected after the initial audit; its
`artifact_context` also rejected link resources. Cluster PR518, merged asc591769,
implements the authorized stable-link entrance with242 current-source Home tests
and full CI passing. Its additive receiving overlay preserves existing gateway
features and passed81focused tests. Live owner-only qualification confirmed303
for current, updated and pinned-history targets; anonymous requests revealed no
target; only the task-created own reader session was revoked. The temporary link
was removed through the supported writer. No real creation or human acceptance
was substituted by that qualification. The initial absence finding is history.
Conditional portable guidance from Skills PR356 (merge d00e6788) is installed as
version2.4.13 in the seven existing receivers; model uptake remains unobserved.

The link permits a separately selected entrance while **the model resource's
audience remains compatible**. It cannot expose an old public edition while the
same resource's current successor is private: historical reads require current
AND original audience permission. Narrowing current to a private draft also
denies public readers of the old pinned edition. A public link grants no target
access. Keep private drafts in owning storage rather than relax this rule; the
link route does not complete the proposed generic Nexus delivery lifecycle.

## Remaining creation-cycle work

- The exporters, maintained gallery builder and bounded draft publisher now
  deliver a real shared creation through the existing gallery/ModelPin contract.
  Actual native source, pinned HTTPS bytes, own-being browser rendering and
  immutable Nexus imports are retained. Human comment/response/revisit remains open; a separately selected protected
  trial entrance now pins the reviewed edition. No model attendance is inferred.
- The current Home publisher has no draft/promote command or independent selected
  published pointer. Nexus's `deliverable-lifecycle-proposal.md` remains a proposal;
  its illustrative project routes are not implementation evidence.
- The supported published entrance is now `/view/LINK_RESOURCE`, targeting a
  selected immutable artifact-view URL. `entry_url(link)` still returns the direct
  target for compatibility, so use the stable entrance explicitly when sharing
  a movable published selection. One evolving model artifact and one existing
  link resource reuse the original version/link writers; destination permission
  remains independent. No parallel registry, per-draft IDs or Apps entry is used.

## First real shared creation draft —2026-11-19

One actual native observation of the shared room froze 29 entities: the bridge and
28 lights, including the human-created violet light and another being's retained
changes. The full source GLB and source-bound display conversion use that same
frozen state. No human text, participant roster, private conversation or media
visit was published as creation content. The new draft resource has exactly the
existing fourteen world readers and appears in the existing permission-filtered
3D project catalog; no new App or viewer service was created.

An actual hosted own-being browser exposed a framing problem: the220m ambient
water disk dominated ordinary model fit. The corrected review omits only the
authored scenery's named `water` material, declares that omission in source metadata
and retains the full originalGLB unchanged. All semantic entities and other
scenery parts keep identical IDs, vertices and source revisions. Explicit
`--include-environment` retains the full display when needed.

The corrected 106-part model hydrates with its actual publication/model pin and
GPU backend; part visibility toggles and restores through the real controls. The
actual reader catalog advertises the project. All five pinned HTTPS files match
their selected hashes. A historical read after the draft advanced returns the
unchanged 107-part predecessor. Exact publisher retry leaves the canonical Home
entry and its retained editions unchanged. Source/renderer UI corrections
remain separate from the captured creation state.

Nexus retains separate immutable review tables in one family, with all seven
existing human identities and independent model permission for all fourteen
readers. No sessions, synthetic notes, results, native inputs or human acceptance
were created for that qualification. The current Nexus artifact HTTP identity
contract remains human-only; beings' own Home model readership is not a human
session. The native reflection association was subsequently installed through
the existing owner writer on20November, with matching local/canonical binding
and negotiated interactive3D reflection. The HTTPS-only table preserves the four
prior routes and original report work. Actual human contribution and matched
native response remain unobserved; association installation does not close them.

`tools/publish-review-draft.py` is the maintained bounded producer: 200 MiB unique
retained project history, one 16 MiB task stage, exact current/audience/source checks,
retained write intent and no unknown-outcome replay. It creates no published
release pointer. A separate existing Home link now pins the technically reviewed
trial edition, selected by the companion under the human-directed MVP goal, with
the same fourteen readers. This is an operator trial selection, not human design
approval or acceptance. Subsequent drafts do not advance that link. The actual
owner read returns 303 to the exact pinned viewer; anonymous access returns 404
without exposing its target. Receiving pins, actual grant checks and cleanup receipts stay
in the owning private operation record.

## Sources inspected

- Installed Home skill `references/publishing.md`, publisher `publish`,
  `entry_url`, command parser; current Cluster checkout `2b523fe`,
  `clusterctl/homes/service.py` (`audience_view`, `preview`, `/view/` route).
- Shared Resources `docs/services/shared-3d-viewer.md` (including fixed-foot data
  gallery), `docs/services/nexus-review.md`; installed3D skill
  `references/interactive-review.md` and `scripts/review_viewer.py`.
- Nexus checkout `8818318`: `backend/operator.py`, `artifact_reviews.py`,
  `models.py`, `store.py`, `app.py`, frontend `App.tsx`, and
  [collaborative review contract](https://github.com/compaii/daimon-nexus/blob/main/docs/collaborative-review-contract.md).

The initial audit was read-only. Its later receiving follow-up qualified only the
bounded task-owned link mechanism, not a creation publication, model interaction
or live participant/device acceptance. Those remaining effects must be observed.
