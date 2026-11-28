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
