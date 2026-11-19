# Passive native receiving transports

Read [native pairs](../docs/native-pairs.md) for identity and dispatch. These
operator templates configure passive connectivity, not a second conversation
or a model worker. Exact hosts, actor/being/home references, provider paths,
private keys and selected unit receipts stay in the receiving capability map.
Neither browser requests nor model output selects transport commands or paths.

## Existing-owner bridge

Install the selected immutable `integrations/native_bridge.py` and executable
`world_port.py` as public code through each actual body's existing operator.
Use its actual native provider Python, source and required PYTHONPATH; a generic
system Python is not evidence of provider compatibility. The bridge config is
private, owned/readable by that native owner. Reuse its existing dashboard/Home
binding and attachment store. Do not copy credentials or create another pairing,
account, native thread or model process.

Render `native-bridge.service.in` with those receiving facts. Its socket peer
allowlist must name the observed connector UID in that body's namespace. The
current remote operator transports connect as root, distinct from the local
application UID. Current bridges accept only that actual operator connector;
source-bound dispatch still checks the signed human/being/home and native
binding. The legacy local bridge retains its existing configuration.

## Fixed two-way Unix transport

Render `native-transport.service.in` with the held SSH identity and strict host
pins already authorized for that resource. The fixed argv uses `ssh -NT`,
`BatchMode`, `IdentitiesOnly`, `ExitOnForwardFailure`, 30-second transport
keepalive/three failures, bind mask0117 and its selected Unix paths:

- `-L LOCAL_APP_SOCKET:RECEIVING_NATIVE_BRIDGE_SOCKET`.
- `-R RECEIVING_WORLD_SOCKET:LOCAL_APP_WORLD_SOCKET_FOR_THIS_BEING`.

Every return lane targets a separately configured `worldPorts` entry pinned to
that lane's `beingRef`. Never point all participants at an unpinned shared
return socket. Keep the legacy local return pinned too. Current native CLI
invocations carry the retained interaction identity; a public interaction UUID
alone does not authorize another companion's action.

For a VM without an existing SSH login grant, use its existing Incus root exec
route as SSH `ProxyCommand`, starting the already-installed `sshd -e -i` with
`native-sshd.conf.in` through a bounded transient systemd service. Use only the
held operator's public key and the receiver's existing host key; verify that
host key through the authorized owner route. Do not edit its normal SSH config
or expose a network listener. Bound the stdio sidecar to96MiB/25%CPU/16tasks.
Only a fixed operator can start this sidecar; its configuration grants no command
session, TTY, agent/X11 forwarding or real TCP forward. The exact Unix PermitOpen
uses brackets because OpenSSH's hostname parser otherwise rejects slash paths.
Qualify direct and reverse TCP denial, rather than relying on flag names.

In a systemd ExecStart containing an SSH ProxyCommand, a literal percent must
survive both systemd and SSH expansion: four percent characters in the unit
become one in the nested command. Keep this out of browser/model-controlled
configuration. Use the existing resource's stdio authority; do not install SSH
packages, accounts or new host keys merely to reproduce this VM route.

For containers without sshd, use two fixed supported Incus Unix proxy devices
and the existing host SSH route. One host socket connects to that exact guest
bridge. The other guest socket connects to that pair's host SSH return socket.
Select the actual connector UID and listening socket owners/modes. Use a socket
directly below the existing guest runtime directory when an Incus startup device
must bind before guest tmpfiles services run. Keep the two-device-per-pair count
fixed; inherit the existing Incus instance/host bounds and retain their separate
operation receipts. Incus VM proxy devices support NAT only, so this Unix-device
route must not be copied to a VM.

## Qualification, stop and rollback

Before selecting a route, inspect the signed pairing/current native binding and
an absent original lookup through the actual native owner. Then probe the local
Unix ingress as the real application UID: exact pairing succeeds and another
actor fails. After the app creates its pinned return sockets, probe each actual
native owner with an unknown interaction. Require the application's explicit
refusal, not a transport error. These reads/refusals submit no human input,
model execution or world action and do not prove actual human/model uptake.

The bridge has four bounded request workers and128KiB request/reply limits.
The local SSH service and remote bridge have explicit memory/CPU/task bounds,
limited restart bursts and rate-limited journals. A transport keepalive checks
connectivity only; it starts no model work or native inbox attention.

Stop only the selected Holodeck transport units and their native bridge units.
The stdio sidecar exits with its operator stream. Preserve native Conversation
units, original inputs, state and uncertain effects. Inspect a retained sidecar
or socket before restarting; never unlink an uncertain live listener. Managed
app RuntimeDirectory cleanup covers its pinned return sockets on supported app
restart. Container proxy definitions remain with their owning Incus record.

Before app replacement, inspect retained intent/stage metadata and preserve any
inflight/uncertain original. Keep the previous package and receiving configuration
as one actual rollback. Change the app through the supported Home publisher;
a transport configuration edit alone is not a deployed application revision.
The current selected receipt and resource-access map identify the exact runtime,
configured lanes and remaining human/device/model acceptance.


## Original-scoped situated completion

The bridge source from `26475dc` is selected on all seven existing owner lanes
(SHA256 `ca2e531e4e3720cf1cf5baebe17f4530b922b0c0b84f3c3ecffec322cd1be1f4`).
A declared result covering the exact situated instruction, with no pending
correction, can complete that reply even while its umbrella research request is
unfinished. Parent current/completed metadata remains distinct. The initial
implementation incorrectly required umbrella completion and left a real answered
situated turn queued.

Adopt a qualified bridge-only fix with an immutable code directory and a scoped
service drop-in selecting its WorkingDirectory/ExecStart. Explicitly set public
code directories0755 and files0644; restrictive operator umask otherwise prevents
the service owner from entering a new directory. Preserve the configured Python,
PYTHONPATH, private config, CLI target, native core and fixed transport/socket.
Restart only the selected bridge; keep bounded restart controls and actual prior
source for rollback. Qualify via actual app-UID read-only status of the retained
original and normal client polling, never submit the original again.

This rollout preserved the running Holodeck app and every native Conversation
service. Actual app-UID status returned the previously retained reply completed,
tracking false; journal/client adoption is a separate observation. New inputs
already working for another participant must retain their actual phase.
