# Native receiving lanes for existing pairs

Holodeck's shared room and each participant's continuing companion are separate
boundaries. Admission to the room does not select CompAII for every visitor.
Use the visitor's existing registered human reference and paired being, with that
being's own Conversation owner, provider account and original journal.

## Receiving table

`receiving.nativeRoutes` is an operator-selected array of at most8 entries:

```text
{actorRef: existing registered human reference,
 beingRef: existing signed being reference,
 homeRef: existing registered Home reference,
 socket: fixed local Unix endpoint for that owner bridge}
```

The current MVP world-return configuration permits at most8 paired endpoints.
The route table is transport configuration, not a second identity/pairing registry.
Resolve its values from current signed Home pairing and maintained receiving
records. Never derive a child Home identity from an allocated native integer,
guess by display name or select a route from browser-provided claims.

`src/native-mux.mjs` selects one exact human lane and checks the bridge's returned
actor, being and Home against that selection. Unknown actors have no fallback;
cross-pair frozen bindings are refused before a write. Lookup/status/submit stay
on that lane. The original frozen binding and native intent format do not change,
so adopting the mux does not reset earlier unknown work. Configure the existing
Nicolas/CompAII lane explicitly alongside new lanes. A receiving configuration
with only `nativeSocket` retains the original single-lane behavior.

Each bridge uses the maintained DaimonApp `HomeAuth` projection from its existing
dashboard configuration. That adapter already owns `shared_auth.human_ref` and,
for web-only guests, `application_id`. The separate native human/chat/topic
integers remain internal coordinates. The bridge verifies the actual
`daimon-home human` pairing and its registered Interaction origin/entry, then
checks the existing native owner and continuing binding. It does not invent a
human mapping, create a new thread, require Telegram or change identity/grants.

## Return operations must identify the actual lane

Input IDs are references, not identity proofs; they may appear in public world
events. Therefore do not forward every remote native CLI into an unpinned common
world socket. Configure `receiving.worldPorts` as distinct fixed endpoints:

```text
[{socket: fixed local world Unix path, beingRef: selected native being}, ...]
```

The legacy `worldSocket` additionally selects `worldSocketBeingRef` when using a
mux. Each native owner receives only its own fixed return tunnel. The world port
passes its configured being to `authorizeWorldRequest(id, expectedBeingRef)`;
the journal rejects another being's interaction before querying that pair's
bridge. Current pairing, actual native admission, source pins, room rights and
action preconditions are still independently checked. A forged being field or
another participant's known input ID cannot choose an identity.

## Existing owner operator path

Use current Shared Resources placement and its held SSH/Incus operator route.
Oliva is its existing ITACA VM; Eko is native on its existing host; the four
children retain their original guests and existing Conversation units. The
maintained generic adapter is Cluster `clusterctl.onboarding_conversation` and
`docs/operations/children-admission.md` (reusable guest Conversation adapter).
It is not necessary or appropriate to repeat bootstrap/admission to add this
passive transport. Preserve existing native/web/Matrix processes and pauses.

Per receiving owner:

1. Observe its current web unit's user, interpreter, working directory and ordered
   public `PYTHONPATH`; read its existing dashboard/receiver configuration. Keep
   credentials and source paths in receiving-private records.
2. Verify the actual Home pairing, registered human/application route, existing
   native capabilities and an exact-ID lookup of a fresh unknown UUID. These are
   model-free metadata reads, never a synthetic first human message.
3. Prepare the pinned bridge/CLI under the existing protected owner operator,
   using that selected interpreter and ordered public runtime paths. Give it only
   its existing attachment writer and fixed control route. Preserve the current
   source, configuration, native account and original histories.
4. Connect a fixed local mux socket to that owner bridge, and its native CLI to
   the distinct being-pinned world-return socket. Use existing authenticated
   operator transport. VM stdio-only OpenSSH forwarding may use the held public
   key through an existing Incus root executor, with no network listener, shell,
   TTY, TCP/X11/agent forwarding or changes to ordinary administrative login.
   Both endpoint paths and the target body are operator-fixed, never UI input.
5. Observe the actual forwarding peer UID and configure the bridge's closed
   `allowed_uids` accordingly; do not confuse the app UID, host root forwarding
   UID and guest native owner. Apply bounded processes/connections/time/logs and
   an explicit stop/rollback path in the owning deployment record.
6. Qualify input metadata/unknown-ID lookup and refusal of a foreign return ID
   from the actual consuming service/native owner. Only then select the app's
   route table through its ordinary deployment. A socket or prepared unit alone
   proves neither receiving use nor an actual situated model action.

No private credential copying, account substitution, new identity/enrollment,
global Stop, native restart, model priming or background model attention is part
of this procedure. Source data remains evidence, not instructions or authority.

## Evidence and remaining qualification

On2026-11-17, owner-local read-only inspection verified current signed Home
pairing, configured application/human scope, established native entry and fresh
unknown lookup for all six additional pairs, using their actual selected runtime.
The original owner pair also passed the new generic Home scope check without
changing its frozen fields. Those receipts are in the receiving-private work
record; no private conversation text was inspected.

Four mux tests cover Telegram/local actors, absent/cross-pair routes, miswired
sockets and adopting an earlier unknown intent without replay. Two additional
bridge tests cover the existing generic Home identity projection and refusal to
guess it when unavailable. This is not installation, model/provider-account
readiness, human participation or proof of world effects. Record each passive
transport's actual deployment and native uptake separately.
