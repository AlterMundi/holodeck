# Owner-hosted room editions

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

The ordinary owner layout operation can append reciprocal links but keeps
existing door indices. Moving the Claymon passage needs the owner's exact
revised graph and a scoped migration of the matching existing revision.
Room access for the shared visit and grants for editing the selected Atelier
workspace are independent. Register the receiver's dedicated public key with
the Atelier operator and verify the private transport as the Holodeck service
user before selecting the workbench.
