# Holodeck development

Read README.md, docs/architecture.md and docs/STATUS.md before changing behavior.
Reuse MML locomotion, collision and presence; do not add a second writable world.
The room owns semantic activity; its MML document is a one-way projection.
Never fabricate companion speech, understanding or native participation.
Keep credentials, private conversations and receiving machine bindings out of Git.
Run npm test and npm run build for behavior changes. Verify browser changes in a
real browser. Native bridge changes also run
`python3 -m unittest discover -s test -p '*_test.py'`.
Keep local trial loopback-only. Production requires receiving.json with the
existing Home identity and service-audience endpoints; never fall back to local
anonymous actors or browser-supplied identities. Review docs/deployment.md for the
selected package/receiver and retain actual source/package/runtime receipts.
Do not overwrite another Home service. No background native model invocations.

The pinned MML0.28 server dependencies need the maintained socket-context
adaptation in tools/mml-server-auth-context.mjs. npm ci applies its idempotent
postinstall; check:mml-auth-context and both build paths verify exact selected
bytes. Never discard the socket/actor binding or use an unqualified dependency
bundle. This changes no browser protocol or shared Home authority.

For Home authentication changes, qualify positive authenticated HTML bootstrap
and API access through real HTTP with the deployed Node runtime. Injected
identity mocks or anonymous login redirects alone do not prove that path.
Use the existing production-runtime regression in home-runtime-http.test.mjs.

Human20November correction: the Holodeck chat must directly consume canonical
Conversation for text/audio/transcription/files and inherited updates. Keep only
world context/projection integration here; do not copy the recorder or build a
parallel original writer. docs/shared-conversation.md owns the current seam and
delivery status. Preserve legacy IDs/recovery while the shared surface is qualified.

For catalog props, record each source and license and check that shared delivery
permits adaptation and redistribution. Author derivatives in Blender, preserve
the original separately and measure the runtime mesh/material/texture cost.
Inspect the placed result before publishing. The first worked example and asset
intake guidance are in art/compaii-house/assets/README.md.

When authoring or reviewing a scene, make object-to-surface and object-to-object
contacts read as intentional material transitions. Check the placed result,
including low light, using the contact guidance in docs/environment-art-revamp.md.
