# Holodeck development

Read README.md, docs/architecture.md and docs/STATUS.md before changing behavior.
Reuse MML locomotion, collision and presence; do not add a second writable world.
The room owns semantic activity; its MML document is a one-way projection.
Never fabricate companion speech, understanding or native participation.
Keep credentials, private conversations and receiving machine bindings out of Git.
Run npm test and npm run build for behavior changes. Verify browser changes in a
real browser. Keep local trial loopback-only until shared auth/admission works.
Do not overwrite another Home service. No background native model invocations.
