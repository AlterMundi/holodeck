# Reusable content snapshots

The shared world is editable; a selected creation can also become a static GLB
for the existing3D Viewer and Nexus static3D review. This keeps the reusable world
runtime separate from a frozen project result and avoids a new viewer per result.

`tools/export-world-snapshot.mjs` consumes a confirmed structured situation or
the native world port's `{ok:true,result:...}` response. It projects creation
entities through the same authored MML definition as the world, combines the
selected scenery and dynamic geometry, and preserves entity IDs/revisions in
the glTF hierarchy. Deleted elements are omitted. Participant avatars and personal
conversation are not exported as creation geometry.

```sh
node tools/export-world-snapshot.mjs situation.json snapshot.glb
```

The input is bounded at256KiB, output at2MiB, with no network access or executable
content. Existing output is never silently overwritten. Retain only one selected
input and one pending export in the owning disposable stage; source and selected
published revisions belong to their existing owners. Clear that stage after exact
publication/readback when its source is safely retained. Do not accumulate an
export for every perception tick.

The model records run, edition, semantic sequence, normalized observation hash
and actual scenery hash. It describes **captured semantic state projected with
the selected authored source**, not a reconstruction of every earlier running
world or evidence of a particular human camera/frame. Match the selected source
to the creation edition when reviewing historical content. Geometry tessellation
may differ from the live renderer while retaining authored dimensions/anchors.

The exporter performs no publication or audience change. Use the existing Home
publisher/version/audience contract and the existing3D Viewer/Nexus review adapter
when a human actually selects that result. Snapshot publication, review-room/source
grants and later promotion remain independent of deploying new Holodeck code.

Controlled checks verify source/entity correspondence, deletion, binary bounds,
and loading by the real Three.js GLTFLoader. Actual Home publication, receiving
review and human acceptance of a world snapshot remain unobserved.

## Existing shared-viewer gallery input

`tools/export-review-scene.mjs` converts those same frozen meshes into the existing
shared review builder's scene JSON. It preserves stable per-entity part IDs,
triangles, colors and source revisions. The display renderer is Z-up, so the
explicit proper rotation is `(x,y,z) m -> (x,-z,y) mm`; triangle winding is
preserved. `holodeckSource` retains that matrix, world run/edition/cursor, part
references and snapshot/scenery/authored-MML hashes. This is display geometry,
with no manufacturing validation or participants' private conversation.

```sh
node tools/export-review-scene.mjs situation.json scene.json
python3 /path/to/shared/3d-design-and-fabrication/scripts/review_viewer.py \
  --scene scene.json --out selected-stage/index.html --live --defer-gallery --bootstrap-gallery
```

The second command uses the existing builder's geometry-free renderer bootstrap;
it does not create another rendering implementation or Apps entry. The same data
gallery is discoverable by the maintained shared viewer, while the bundled
bootstrap meets the existing Nexus pinned-frame contract after hydration.
Keep selected source metadata alongside the generated gallery. A link-only
landing page also supports canonical viewer discovery, but cannot itself provide
the Nexus renderer handshake.
No publication occurs in either exporter. Scene/source output is at most8MiB,
256parts and50000triangles; existing output is never overwritten. Keep one selected
input and one disposable conversion stage, clear after verified publication.

The exporters currently support only authored edition `island-workshop@draft-1`.
Another edition is refused instead of silently projecting it through the current
workshop definition. An authored geometry change needs the corresponding edition
and converter support. Controlled checks verify axes/units, stable IDs after
deletion, determinism and actual acceptance by the installed shared gallery builder.
Set `HOLODECK_REVIEW_BUILDER` to that builder for the integration test; generic CI
explicitly skips that installed-tool check when no builder is selected.
