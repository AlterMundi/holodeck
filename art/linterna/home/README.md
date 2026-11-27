# Casa Linterna on its own Home

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

## Standalone review

The walkable standalone review starts at Atlas. It is published separately
as a protected review. Its app links take the visitor to their canonical
sites. The live Atelier table uses its existing room-workspace connector.

```sh
node art/linterna/precinct/build-review.mjs --home ASSET_DIR SITES_JSON
```

Publish only the three generated files under the Home audience selected
for the house. Supply the exact immutable artifact resource, version and
paired human to the package builder in a private selection JSON file.

```sh
python3 art/linterna/home/package.py --archive PREDECESSOR_TAR \
  --previous PREDECESSOR_SHA --selection SELECTION_JSON --assets ASSET_DIR \
  --workshop-tools ATELIER_APP/scripts/refresh-camera-ui.py --output OUTPUT_DIR
```

The builder preserves the existing workshop payload and adds a route to
the same package. The route checks the paired Home session and reads only
the three pinned files. Its production path is
`/taller-oliva/casa-linterna/`. Use the existing managed workshop grant,
audience, capacity and predecessor guard if selecting the standalone route.
