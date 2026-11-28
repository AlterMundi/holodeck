# Owner-hosted room editions

This is the current walkable-room import contract. The target
[shared publication contract](architecture.md#home-and-holodeck-publication)
creates the other A2UI view automatically. Placing a walkable room and
changing its doors use the spatial contract below.

East 1 uses Holodeck's ordinary room crossing, avatar, presence, and return.
The room scene comes from a pinned edition on the owner's Home. An operator
can select `receiving.ownerRoomArt` with an entry of the following form:

```json
{
  "manifest": "https://owner.dmn.homes/editions/house/manifest.json",
  "sha256": "<manifest SHA-256>",
  "rooms": {
    "arrival": "published-atlas-id",
    "hefesto": "published-foyer-id",
    "atelier": "published-atelier-id",
    "printing": "published-printing-id"
  }
}
```

Use the existing admitted room graph. The native house editor and room
admission keep authority over visitor assignments. Scene selections pin
model sizes and hashes, local colliders, and the two sides of each door.
The renderer fetches the model parts through the existing room-scoped
endpoint. The receiving operator stages the edition through their existing
authorized Home reader:

```sh
node tools/stage-owner-room-art.mjs MANIFEST_URL MANIFEST_SHA OWNER_CACHE_DIR
node deployment/build-package.mjs .state/RELEASE_STAGE OWNER_CACHE_DIR
```

The asset stage contains only the selected manifest and model bytes, pinned
by digest. Production loads it from the package at startup and serves it
under normal room authorization. The Holodeck service receives neither
reader credentials nor visitor cookies for the Home origin. An edition
update follows the same staging contract. Verify both visitors and the full
return in the receiving world.

## One handoff for a shared-world edition

Publishing to Home ends at Home. The following contract applies when the
owner asks Holodeck to use the edition as a walkable scene inside the shared
world. An ordinary link to the owner's viewer does not use this contract.

| Parameter | When needed | Source |
| --- | --- | --- |
| Edition selection | Every import or update needs an unambiguous version. An immutable Home link, or the Home resource and version from the publication receipt, identifies it. | Use the reference already supplied or resolve the uniquely selected edition through Home. Ask the author which edition only if the selection is ambiguous. |
| Destination house | Every import. A house name or the context of the request is enough when it identifies one house. | Holodeck resolves the existing house ID. |
| Room and door changes | Only when the edition changes which rooms or doors Holodeck should expose. If the manifest and the requested change already identify the intended mapping, use them. | The owner supplies only a missing design decision, for example which of two existing doors the new opening replaces. No separate floor-plan file is required. |
| Visitor access | Existing audiences and guest lists carry forward. An explicit change is needed to open a private room or alter its guest list. | The house owner selects the change. Home reader access and Holodeck visitor access are independent. |
| Live workbench | Only when the requested edition includes an interactive Atelier workbench. | Reuse the admitted workspace and grant. Ask which workspace only if there is no unambiguous existing binding. |

For example, “Use this published edition in Casa Linterna and keep the
current doors and visitor access” is a complete request for an art-only update.
The receiving operator fills in the configuration at the top of this guide.
Use the authorized Home reader to resolve the HTTPS JSON manifest on the
owner's `.dmn.homes`, pin the SHA-256 of its exact bytes, and map manifest
cell IDs to existing Holodeck room IDs in `rooms`. Each selection covers
1–12 distinct rooms in a single house, and a room may appear in only one
selection.

### Edition format and receiver checks

- The current importer reads `holodeck.linterna.hefesto-slice/v2`. Its
  `cells` contain room-local `models`, `floor`, and `colliders`.
  A selected cell has 1–6 models, 1–12 floor boxes and up to 192 colliders.
  Floors use `x` and `z` extent pairs, `top` and `depth`. Colliders use
  `position`, `size` and `rotationY`. Coordinates use metres with +Y up.
  Each model declares a sibling GLB `file`, byte count `bytes` and
  `sha256`. The manifest is limited to 96,000 bytes and each GLB to 768 KiB.
  The staging command accepts up to 32 model entries and at most 12 MiB of
  distinct staged bytes including the manifest. The release also has its own
  [archive budget](deployment.md#reproducible-package).
- `passages` lists up to 48 passages. Each internal doorway has one
  `sides` entry per connected cell with `cell`, `threshold` and `stand`
  in local `[x,z]`, `surfaceY` in metres and `yaw` in degrees. The
  entry cell has exactly one external passage with a `keepParcelOffer: true`
  outer side. The receiver compares both directions with Holodeck's live
  `door` links. Every published link of a selected room needs a matching
  pose.
- If links must change, preview the proposed full graph with
  `layout.revise.preview` using the current `expectedRevision`, and check
  the manifest against that graph before activating it. The actual owner
  action is `layout.revise`, with `id`, `house`, `expectedRevision`
  and `rooms` (existing IDs, levels and entry flags stay stable). Stage and
  confirm an allowed visit and return before reporting the edition active.
- For Atelier, the manifest's optional `table` pins the cell, object ID,
  anchor, turntable, rotation and interaction radius. Caddy widgets use
  `atelierWidgets` with the same cell, a metric +Y frame, compatible door
  and landing poses, and matching table anchors. The receiving operator
  configures the workspace, transport and signing keys through the
  [Atelier binding](deployment.md#receiving-contracts). Keep credentials out of
  the author handoff. A minimal manifest and a widget example live in the
  [receiver fixtures](../test/owner-room-art.test.mjs).

If a remaining mismatch needs a decision, send one request to whoever can
resolve it. Name the exact room, door, edition, or grant, what it blocks, and
the decision or action needed. For example, when a published edition and the
live layout specify different doors and the intended change is unclear, show
both door pairs and ask which should be used. Keep the Home publication status
separate from activation in Holodeck.

## Casa Linterna receiving review

The receiving integration carries the owner-room reader from #39, the
Atelier workbench from #38, and the Linterna tool-caddy contract from
`e46cfce`. The code candidate builds with the current toroidal release
and its existing teleport assets. The package check covers the receiver
with no owner edition selected.

The live East 1 layout still has the foyer, Research Gallery and Claymon,
with a direct foyer–Claymon link. Selecting the Linterna edition requires
the owner's exact Home manifest URL and digest and a revision-checked layout
whose room IDs and reciprocal doors match that manifest. Keep the existing
room grants and the Claymon workspace identity when publishing the layout.
For the workbench, bind the one approved workspace to its registered public
issuer and fixed private service route. Verify the crossed thresholds and
shared workspace revision on the receiving configuration before activation.

The selected Home catalog edition was readable by the receiving operator.
It uses manifest SHA-256
`bde0266305ee7249106411a61ee3bcef4631521bd63795a720dbc53162fbb19f`.
All seven GLB parts passed the receiver's byte-count and digest checks.
The edition connects arrival to Hefesto, then Hefesto to Atelier and
Printing. The live layout exposes Research Gallery and a direct
foyer–Claymon door. The manifest lacks the current `atelierWidgets` caddy
binding. Activation still needs an owner-published compatible layout and
the approved Atelier workspace binding described above.

The receiver can store the exact owner edition losslessly in its archive.
The build compresses staged files only when smaller. On load, decoded output
is bounded and checked against the owner's original digest. A pack with the
currently readable seven models and manifest measured 41,031,680 bytes
under the 40 MiB receiver cap. This qualifies the packaging route separately
from the newer edition and its activation.

The owning daimon can use `layout.revise` to move the Claymon passage while
preserving existing room identities. This needs the owner's exact revised
graph and its current revision. Select `guests: ["*"]` in each room the
owner wants to open to admitted Holodeck visitors. Private rooms can retain
their explicit guest list.
Room access for the shared visit and grants for editing the selected Atelier
workspace are independent. Register the receiver's dedicated public key with
the Atelier operator and verify the private transport as the Holodeck service
user before selecting the workbench.
