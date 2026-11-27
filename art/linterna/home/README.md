# Casa Linterna on its own Home

East 1 represents the entrance. An operator can configure
`receiving.hostedEntrances` with entries of the form
`{"room":"existing-entry-id","home":"https://owner.dmn.homes/taller/house/"}`.
An authorized crossing returns the configured HTTPS Home address without
writing an interior location to the shared world. The published house and
its existing admission checks continue to supply the entrance. The Home
authenticates the visitor separately. It receives neither the world session
nor an identity claim in the URL.

The Linterna walkthrough starts at Atlas. Its object and site links retain
the normal site grants. The standalone route offers a link back to the
shared world. This first release has a local walking view. Shared presence
and the live Atelier table require their application integrations.

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
audience, capacity and predecessor guard when selecting a package. Activate
the shared-world entrance after the protected route is serving.
