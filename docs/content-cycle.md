# Durable creation cycle: supported route and remaining seams

Read-only source inspection, 2026-11-17. This qualifies plan step4; it does not
publish a creation, grant access, resume Nexus work or establish human acceptance.
The existing [snapshot exporter](content-snapshots.md) freezes creation geometry;
a save, a static snapshot, a review edition and a published selection are distinct.

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

This limited manual cycle supports local drafts, explicit publication and exact
historical review. It does not yet satisfy independent shared candidate/release
selections under one remembered published entrance.

## Stable entrance source follow-up

Current upstream Cluster03b6a7d was inspected after the initial audit; its
`artifact_context` also rejected link resources. Cluster PR518 now implements
the authorized stable-link entrance described below, with242 current-source Home
tests passing. Source review and receiving deployment are separate; the initial
audit's absence finding describes the pre-change route, not this candidate.
Conditional portable guidance is published in Skills PR356 (merge d00e6788),
without claiming installed receiving support.

The link permits a separately selected entrance while **the model resource's
audience remains compatible**. It cannot expose an old public edition while the
same resource's current successor is private: historical reads require current
AND original audience permission. Narrowing current to a private draft also
denies public readers of the old pinned edition. A public link grants no target
access. Keep private drafts in owning storage rather than relax this rule; the
link route does not complete the proposed generic Nexus delivery lifecycle.

## Exact missing capabilities

- Holodeck has no integrated prepare/publish/review operation yet. The scene
  conversion now passes the actual installed shared gallery builder and retains
  stable part/source references; exported GLB alone still does not satisfy the
  gallery/ModelPin contract. No real Holodeck creation has been published/reviewed.
- The current Home publisher has no draft/promote command or independent selected
  published pointer. Nexus's `deliverable-lifecycle-proposal.md` remains a proposal;
  its illustrative project routes are not implementation evidence.
- An existing Home `link` cannot supply a moving stable published entrance:
  `entry_url(link)` returns its target URL, `audience_view(link)` has no preview
  URL, and `preview()` rejects every non-artifact. `/view/LINK_RESOURCE` is not a
  supported redirect. Updating a catalog link does not update an already shared
  destination bookmark.

One small owning extension to investigate is an authorized stable Home
link entrance resolving a selected pinned artifact-view URL. One evolving model
artifact could then hold review editions, while one existing link resource selects
the published edition. Destination authorization must remain independent; changing
the link must never grant access or expose private destination metadata. Inspect
shared-view authentication and receiving delivery before selecting this approach;
qualify the route in Homes before relying on it. This would reuse resource/version
and link writers; no Holodeck release registry, per-draft resource IDs or new Apps
entries are necessary. Nexus continues to own exact-edition discussion.

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

These are source and maintained receiving-record findings. This audit performed
no service/source deployment, publication, identity grant, input/model call or
live participant/device acceptance check.
