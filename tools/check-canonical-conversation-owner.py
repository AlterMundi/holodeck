#!/usr/bin/env python3
"""Actual Telecodex owner, dashboard Provider and Holodeck NativeBridge in isolation.

Synthetic human/peer and fixture final. No installed authority, external network,
or production database. Run with isolated source checkout locations and binary.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--telecodex-source", required=True, type=Path)
    parser.add_argument("--telecodex-binary", required=True, type=Path)
    args = parser.parse_args()
    telecodex = args.telecodex_source.resolve()
    sys.path[:0] = [str(telecodex), str(telecodex / "tests")]
    from conversation_input_control_io import Inputs
    from dashboard.provider import Provider

    source = Path(__file__).resolve().parents[1] / "integrations" / "native_bridge.py"
    spec = importlib.util.spec_from_file_location("holodeck_native_bridge", source)
    native = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(native)
    j = Inputs(str(args.telecodex_binary.resolve()))
    try:
        j.start()
        j.admit("Initialize fixture-owned conversation.", topic=1)
        j.wait(lambda: j.has("Initial goal turn delivered.", 1))
        j.idle()
        j.wait_control_socket(j.socket)
        provider = Provider({"receiver_config": str(j.config), "native_home": str(j.root / "codex-home")})
        human_ref = "human:telegram:100"
        pair = {
            "schema": "dm.human-endpoint/v1",
            "home_ref": "home:test-holodeck-fixture",
            "owner_being_ref": "dm:being:v1:" + "a" * 43,
            "human": {"ref": human_ref, "kind": "human", "revision": "canonical-owner-probe"},
        }
        port = {"cli": str(source.with_name("world_port.py")), "socket": str(j.root / "probe-world.sock")}
        binding = native.NativeBridge(provider, lambda: pair, world_port=port)
        frozen = binding.inspect(human_ref)
        original_id = str(uuid.uuid4())
        situation = {
            "schema":"holodeck.situation/v1", "id":"fixture-observation",
            "observer":human_ref, "run":"fixture-run", "scope":"structured-interior-room",
            "place":{"id":"fixture-foyer","activity":{"signals":["mint"],"contributors":1}},
        }
        assert binding.lookup(human_ref, original_id)["state"] == "absent"
        prepared = binding.prepare_context(human_ref, frozen, original_id, situation)
        assert prepared["work_admitted"] is False
        assert binding.lookup(human_ref, original_id)["state"] == "absent"
        assert not j.packets, "Machine context must never admit an original"
        body = {
            "id":original_id, "binding":frozen["binding"], "files":[prepared["file"]],
            "text":"Can you join me in the room and finish the garden? 🪴",
        }
        provider.conversation_input_submit(body)
        j.wait(lambda: j.row("SELECT phase FROM conversation_inputs WHERE id=?", (original_id,)) == [("accepted",)])
        assert len(j.packets) == 1
        method, packet = j.packets[0]
        assert method == "turn/start"
        assert packet["clientUserMessageId"] == "conversation:" + original_id
        prompt = packet["input"][0]["text"]
        assert body["text"] in prompt
        attachments = json.loads(prompt.split("\n[Retained original file attachments]\n", 1)[1].splitlines()[0])
        assert len(attachments) == 1
        received = attachments[0]
        retained = provider.conversation_input_status(original_id)
        assert retained["text"] == body["text"]
        assert retained["files"] == [prepared["file"]]
        ref, file_bytes = provider.conversation_file_read(original_id, 0)
        assert ref == prepared["file"]
        assert hashlib.sha256(file_bytes).hexdigest() == ref["sha256"]
        assert received["file_id"] == ref["file_id"] and received["sha256"] == ref["sha256"]
        retained_path = Path(received["local_path"]).resolve()
        assert retained_path.is_relative_to(j.root) and retained_path.read_bytes() == file_bytes
        packet_source = json.loads(file_bytes)
        assert packet_source["observation"] == situation
        assert packet_source["native_world_interface"]["argv_prefix"] == [
            port["cli"], "--socket", port["socket"], "--interaction", original_id,
        ]

        def status():
            return binding.status(human_ref, frozen, original_id, None, situation["id"], prepared["file"])
        j.wait(lambda: status()["phase"] == "working")
        assert status()["nativeAcceptance"] == "observed"
        try:
            binding.status(human_ref, frozen, original_id, None, situation["id"], {**ref, "sha256":"0" * 64})
        except native.BridgeError as error:
            assert error.code == "source"
        else:
            raise AssertionError("Foreign file was allowed")
        text = "Synthetic peer final for this isolated canonical owner probe."
        j.broadcast(j.web_thread, "item/completed", {
            "turnId":j.web_turn,
            "item":{"id":"holodeck-fixture-native-final","type":"agentMessage","phase":"final_answer","text":text},
        })
        j.broadcast(j.web_thread,"turn/completed",{"turn":{"id":j.web_turn,"status":"completed"}})
        j.wait(lambda: status()["phase"] == "completed")
        result = status()
        assert not result["tracking"] and result["nativeAcceptance"] == "observed"
        assert len(result["updates"]) == 1 and result["message"] == text
        update = result["updates"][0]
        assert update["kind"] == "answer" and update["nativeTurn"] == j.web_turn
        assert update["nativeItem"] == "holodeck-fixture-native-final"
        assert update["sha256"] == hashlib.sha256(text.encode()).hexdigest()
        page = provider.presentation_list(0, 0)
        observed = [item for item in page["items"] if item.get("source",item.get("id")) == update["source"]]
        assert len(observed) == 1 and observed[0]["preview"] == text, page
        assert j.row("SELECT presentation_input FROM interaction_native_messages WHERE item_id=?", (update["nativeItem"],)) == [(original_id,)]
        assert len(j.packets) == 1 and not j.errors, j.errors
        print(json.dumps({
            "actual_telecodex_owner":True, "actual_native_bridge":True,
            "actual_dashboard_provider":True, "synthetic_foreground_and_native_peer":True,
            "production_calls":0, "model_calls":0, "exact_context_sha256":ref["sha256"],
            "admissions":len(j.packets), "native_acceptance":result["nativeAcceptance"],
            "active_phase":"working", "terminal_phase":result["phase"], "native_item":update["nativeItem"],
            "final_sha256":update["sha256"], "canonical_presentation_copies":len(observed),
            "exact_original_association":True, "wrong_file_denied":True,
            "native_packet_reference_exact":True, "world_descriptor_scoped":True,
        }, sort_keys=True))
    finally:
        j.close()


if __name__ == "__main__":
    main()
