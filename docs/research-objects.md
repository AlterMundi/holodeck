# Research objects and replaceable content editions

A research object has independent spatial identity, visual representation and
selected content edition. Updating evidence does not require replacing its model.
The actual research remains selected knowledge with its own source authority and
audience; an empty preparatory edition does not invent findings or human authorship.

## Packaged visual presets

A result node may additionally declare `representation: "footballer-10"` in its
complete `node.place`/`node.update` data. This resolves only the bounded packaged
catalogue in `node-representations.mjs`; URLs, paths and unregistered values refuse.
It replaces the generic marker while keeping the same node ID, owner/revision,
selected Nexus pin, spatial picking and source-access checks. Omitting it retains
the existing portal/pedestal. Games keep their independent bounded recipe.

The initial stylized figure is original geometry. Source and locked geometry
dependencies are in `tools/geometry/`. Its printable source is72×52×120mm, Z-up;
the world GLB is Y-up,1.65m high. Exporting a closed STL is not slicing or printing.
Actual printer/nozzle/material/profile and physical acceptance remain separate.
No printer is operated by these tools.

Existing saves without a representation load unchanged. After a node retains the
new optional field, a pre-feature writer is not a compatible rollback: prepare
and retain a recovery build that preserves it before activating such a node.
Never restore an older Room snapshot to work around code compatibility.
The selected recovery source, `f14a952`, combines the representation decoder
from Oliva’s contribution with Field context-v3 support. It preserves represented
node state with generic rendering. Both state variants must remain writable through
a code recovery. Earlier releases that lack either decoder cannot serve as
recovery once the corresponding data is present.

## Placement using the creator’s own identity

Use the existing protected Nexus artifact visit descriptor for the exact edition.
Then obtain a fresh own-native world observation and submit the normal
`node.place` command with the verified artifact-review pin and
`representation: "footballer-10"`. Recover by looking up that same command ID
through the native port. The figure, successful native placement and authorized
viewer entry have separate receiving evidence. See the
[native creation guide](native-creation-quickstart.md).

The engine capability is deployed. The first protected source hosted in another
Home has an immutable Nexus manifest. Opening it requires the owning Nexus
[registered source Home repair](https://github.com/compaii/daimon-nexus/issues/126)
and explicitly selected review participants. Place the object once those checks
produce a usable descriptor. A manifest alone does not authorize its source.

## Data-only research renderer

`research-content.mjs` validates `holodeck.research-content/v1` documents up to256KiB.
It separates subject chronology, research evolution, source evidence and design
editions. Date precision remains explicit. A confirmed event needs a declared
source reference; a ready edition needs actual source text/evidence. Unknown dates
and pending sources remain empty. Credentials in links, executable protocols,
export traversal, dangling references and unsupported fabrication claims refuse.

Build the read-only renderer with:

```sh
node tools/build-research-viewer.mjs --out SELECTED_STAGE \
  --appearance SELECTED_RECEIVING_ARTIFACT_STYLE_JS
node tools/embed-review-component.mjs --review SELECTED_MAINTAINED_REVIEW_HTML \
  --out SELECTED_STAGE/review-component.js
```

Supply that project's selected `research.json` and model/gallery assets separately.
No subject/person's research, private history, account or audience is bundled into
application source. It composes the maintained3D viewer in an isolated Shadow DOM
inside the same sandboxed document: the artifact gateway disallows nested frames.
The selected renderer's JavaScript body is preserved; the compiler scopes DOM/CSS
and makes viewport sizes relative to the model card. No dynamic evaluation or new
network authority is added. The renderer contains no chat, recorder, fabricated model reply, data write
or new App registration. Explicitly publish through the existing resource writer.

A later sourced edition can change only `research.json`, deliberately advancing
the selected publication/pin while retaining the same topic ID and model bytes.
Preserve historical publication/notes; do not silently relabel a frozen visit.
Controlled browser checks must distinguish fixture evidence from real research.

Build the selected model with the maintained viewer's `--live` output and retain
its matching `gallery.json` and `review-live.json`. Embed a research edition through
the existing protected Home parent with its exact publication `version` and
`display=work`. This pins the model and research together; it hydrates only that
immutable resource edition rather than offering unrelated project switching under
the subject heading. The maintained adapter performs the actual apply/commit
handshake used by Nexus. A resource catalog entry is discovery, not a Nexus table.

Downloads use digest-named `media/SHA256.stl` and `media/SHA256.glb`, accepted only
from the selected publication's trusted parent file allowlist. The opaque child
requests a download on an explicit click; it grants no access or popup permission.
An ordinary details view without that bridge directs readers to its selected file
list. Source URLs are inspectable/copyable text, preserving their original access.
Keep the `allow-scripts` sandbox; do not weaken it to enable nested frames or links.

The manufacturing source can be regenerated in a bounded isolated Python
environment using `tools/geometry/requirements.txt` and
`python tools/geometry/build-footballer.py --out SELECTED_GEOMETRY_DIRECTORY`.
The validated closed union STL and coloured world GLB have different units and
purposes. The material-display subsets preserve the source surfaces and are not
individually asserted to be closed manufacturing bodies.

This static renderer is a preparatory content surface. It does not itself create
a Nexus report/review association, grant a visitor source access, implement the
Holodeck visit protocol or place a result node. Use an actual accepted Nexus pin
and existing protected descriptor for a world visit; do not make one up merely
to create a clickable object. The existing canonical Conversation remains the
only text/audio/file/original writer.
