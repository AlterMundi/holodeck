#!/usr/bin/env python3
"""Loopback JSONL adapter for the actual Telecodex owner and Holodeck bridge.

The human, Telegram service and native app-server are test fixtures. All owner
state and retained context files live under the existing temporary test root.
The adapter never loads deployed Home, provider, or Telegram configuration.
"""
import argparse
from contextlib import redirect_stdout
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import signal
import sys
from types import SimpleNamespace

MAX_LINE = 131072
ATTACHMENT_MARKER = "\n[Retained original file attachments]\n"


class CanonicalOwner:
    def __init__(self, journey, provider, native, actor, being, world_port):
        self.journey = journey
        self.provider = provider
        self.actor = actor
        origin = "https://fixture.invalid"
        pair = {
            "schema": "dm.human-endpoint/v1",
            "home_ref": "home:" + "c" * 32,
            "owner_being_ref": being,
            "human": {"ref": actor, "kind": "human", "revision": "canonical-owner-fixture"},
            "applications": [{"capability": "interaction", "url": origin + "/"}],
        }
        home_auth = SimpleNamespace(enabled=True, human_ref=actor, origin=origin, entry="/")
        self.bridge = native.NativeBridge(provider, lambda: pair, world_port=world_port, home_auth=home_auth)
        self.world_port = world_port
        self.originals = {}
        self.active = None

    def submit(self, body):
        ident = body["id"]
        if self.active is not None or ident in self.originals or len(self.originals) >= 2:
            raise ValueError("The fixture admits at most two separate original turns")
        if len(body.get("files", [])) != 1:
            raise ValueError("Select one fixture world attachment")
        before = len(self.journey.packets)
        receipt = self.provider.conversation_input_submit(body)
        self.originals[ident] = {"text": body["text"], "file": body["files"][0]}
        self.active = ident
        self.journey.wait(lambda: len(self.journey.packets) > before)
        method, packet = self.journey.packets[before]
        if (len(self.journey.packets) != before + 1 or method != "turn/start"
                or packet.get("clientUserMessageId") != "conversation:" + ident):
            raise ValueError("The native peer did not receive this exact original in its own turn")
        self.originals[ident].update(packet=packet, nativeTurn=self.journey.web_turn,
                                     nativeThread=self.journey.web_thread)
        return receipt

    def status(self, ident, observation, file):
        return self.bridge.status(self.actor, self.bridge.inspect(self.actor), ident,
                                  observation_id=observation["id"], context_file=file)

    def admission(self, ident):
        if ident != self.active:
            raise ValueError("Select this fixture's active original")
        original = self.originals[ident]
        retained = self.provider.conversation_input_status(ident)
        local_turn = retained.get("local_turn")
        if (retained.get("text") != original["text"] or retained.get("files") != [original["file"]]
                or type(local_turn) is not int or local_turn <= 0):
            raise ValueError("The canonical owner did not retain the exact original")
        prompt = original["packet"]["input"][0]["text"]
        if original["text"] not in prompt:
            raise ValueError("The native packet did not retain the original's text")
        refs = json.loads(prompt.split(ATTACHMENT_MARKER, 1)[1].splitlines()[0])
        if len(refs) != 1:
            raise ValueError("The native packet does not contain one machine attachment")
        received = refs[0]
        file, published = self.provider.conversation_file_read(ident, 0)
        selected = Path(received["local_path"]).resolve()
        packet_ref = {"file_id": received.get("file_id"), "sha256": received.get("sha256"),
                      "name": received.get("name"), "mime": received.get("declared_mime"),
                      "size": received.get("bytes")}
        if (file != original["file"] or packet_ref != file
                or not selected.is_relative_to(self.journey.root) or selected.read_bytes() != published
                or len(published) != file["size"]
                or hashlib.sha256(published).hexdigest() != file["sha256"]):
            raise ValueError("The native packet attachment differs from the retained file")
        payload = json.loads(published)
        source = payload["observation"]
        interface = payload["native_world_interface"]
        if (payload.get("schema") != "holodeck.native-situation-source/v1"
                or payload.get("human_input_id") != ident
                or payload.get("speaker") != self.actor or source.get("observer") != self.actor
                or source.get("inputAssociation", {}).get("humanInputId") != ident
                or interface.get("argv_prefix") != [
                    self.world_port["cli"], "--socket", self.world_port["socket"], "--interaction", ident,
                ]):
            raise ValueError("The native attachment does not describe this exact world interaction")
        self.journey.wait(lambda: self.status(ident, source, file)["phase"] == "working")
        if self.status(ident, source, file)["nativeAcceptance"] != "observed":
            raise ValueError("The canonical owner did not observe native admission")
        original.update(source=source, localTurn=local_turn)
        return {
            "id": ident, "text": retained["text"], "source": source, "worldInterface": interface,
            "file": file, "localTurn": local_turn, "nativeTurn": original["nativeTurn"],
        }

    def final(self, ident, text):
        if ident != self.active or not isinstance(text, str) or not text.strip() or len(text.encode()) > 4096:
            raise ValueError("Select a bounded final for the active fixture original")
        original = self.originals[ident]
        if "source" not in original:
            self.admission(ident)
        source, file = original["source"], original["file"]
        if self.status(ident, source, file)["phase"] != "working":
            raise ValueError("The selected original no longer has a running native turn")
        thread, turn = original["nativeThread"], original["nativeTurn"]
        item = turn + "-fixture-final"
        self.journey.broadcast(thread, "item/completed", {
            "turnId": turn,
            "item": {"id": item, "type": "agentMessage", "phase": "final_answer", "text": text},
        })
        self.journey.broadcast(thread, "turn/completed", {"turn": {"id": turn, "status": "completed"}})
        self.journey.wait(lambda: self.status(ident, source, file)["phase"] == "completed")
        self.journey.idle()
        observed = self.status(ident, source, file)
        updates = [entry for entry in observed["updates"] if entry.get("nativeItem") == item]
        if len(updates) != 1 or updates[0].get("nativeTurn") != turn or updates[0].get("text") != text:
            raise ValueError("The owner did not publish this exact native final")
        if self.journey.row("SELECT presentation_input FROM interaction_native_messages WHERE item_id=?",
                            (item,)) != [(ident,)]:
            raise ValueError("The native final was associated with another original")
        cards = [card for card in self.provider.presentation_list(0, 0)["items"]
                 if card.get("source", card.get("id")) == updates[0]["source"]]
        if len(cards) != 1 or cards[0].get("preview") != text:
            raise ValueError("The canonical presentation did not retain exactly one final")
        self.active = None
        return {"id": ident, "status": observed, "presentation": cards[0]}

    def dispatch(self, operation, args):
        if operation in ("inspect", "lookup", "prepareContext", "status"):
            request = {**args, "operation": "prepare-context" if operation == "prepareContext" else operation}
            return self.bridge.dispatch(request)
        if operation == "presentation":
            return self.provider.presentation_list(**{"delivery": 0, "native": 0, **args})
        if operation == "inputs":
            return self.provider.conversation_inputs(**args)
        if operation == "submit":
            return self.submit(args)
        if operation == "admission":
            return self.admission(args["id"])
        if operation == "final":
            return self.final(args["id"], args["text"])
        if operation == "original":
            return self.provider.conversation_input_status(args["id"])
        if operation == "originalFile":
            file, data = self.provider.conversation_file_read(args["id"], args["index"])
            return {"file": file, "source": json.loads(data)}
        raise ValueError("Unknown fixture operation")


def reply(output, message):
    body = json.dumps(message, ensure_ascii=False, separators=(",", ":"))
    if len(body.encode()) > MAX_LINE:
        raise ValueError("Fixture response exceeds its bound")
    output.write(body + "\n")
    output.flush()


def serve(owner, output):
    reply(output, {"ready": True, "frozen": owner.bridge.inspect(owner.actor)})
    while line := sys.stdin.buffer.readline(MAX_LINE + 1):
        if len(line) > MAX_LINE or not line.endswith(b"\n"):
            raise ValueError("Fixture request exceeds its bound")
        ident = None
        try:
            request = json.loads(line)
            ident = request["id"]
            if not isinstance(ident, (int, str)) or not isinstance(request["args"], dict):
                raise ValueError("Invalid fixture request envelope")
            result = owner.dispatch(request["operation"], request["args"])
            reply(output, {"id": ident, "ok": True, "result": result})
        except Exception as error:
            reply(output, {"id": ident, "ok": False, "error": {
                "code": getattr(error, "code", "fixture"), "message": str(error)[:1024],
            }})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--telecodex-source", required=True, type=Path)
    parser.add_argument("--telecodex-binary", required=True, type=Path)
    parser.add_argument("--actor", default="human:player")
    parser.add_argument("--being", default="dm:being:v1:" + "m" * 43)
    parser.add_argument("--world-socket", required=True, type=Path)
    args = parser.parse_args()
    if (not re.fullmatch(r"human:[A-Za-z0-9:._/-]{1,240}", args.actor)
            or not re.fullmatch(r"dm:being:v1:[A-Za-z0-9_-]{43}", args.being)
            or not args.world_socket.is_absolute()):
        parser.error("Select the isolated actor, being and absolute fixture world socket")
    telecodex = args.telecodex_source.resolve()
    sys.path[:0] = [str(telecodex), str(telecodex / "tests")]
    source = Path(__file__).resolve().parents[1] / "integrations" / "native_bridge.py"
    spec = importlib.util.spec_from_file_location("holodeck_native_bridge", source)
    native = importlib.util.module_from_spec(spec)
    output = sys.stdout
    with redirect_stdout(sys.stderr):
        from conversation_input_control_io import Inputs
        from dashboard.provider import Provider
        spec.loader.exec_module(native)
        journey = Inputs(str(args.telecodex_binary.resolve()))
        try:
            journey.start()
            journey.admit("Initialize fixture-owned conversation.", topic=1)
            journey.wait(lambda: journey.has("Initial goal turn delivered.", 1))
            journey.idle()
            journey.wait_control_socket(journey.socket)
            provider = Provider({"receiver_config": str(journey.config),
                                 "native_home": str(journey.root / "codex-home")})
            world_port = {"cli": str(source.with_name("world_port.py")), "socket": str(args.world_socket)}
            serve(CanonicalOwner(journey, provider, native, args.actor, args.being, world_port), output)
        finally:
            journey.close()


if __name__ == "__main__":
    def interrupt(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    try:
        main()
    except KeyboardInterrupt:
        pass
