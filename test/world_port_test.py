"""Actual CLI wire envelopes, without a native owner, human or model."""
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
import uuid

CLI = Path(__file__).parents[1] / 'integrations/world_port.py'


class WorldPortCLI(unittest.TestCase):
    def call(self, source, operation='observe', parameters=None):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / 'world.sock')
            with socket.socket(socket.AF_UNIX) as listener:
                listener.bind(path)
                listener.listen(1)
                listener.settimeout(5)
                requests = []

                def receive():
                    with listener.accept()[0] as connection:
                        raw = bytearray()
                        while b'\n' not in raw:
                            raw.extend(connection.recv(4096))
                        requests.append(json.loads(raw.split(b'\n', 1)[0]))
                        connection.sendall(b'{"ok":true,"result":{"fixture":true}}\n')

                worker = threading.Thread(target=receive)
                worker.start()
                result = subprocess.run([sys.executable, str(CLI), '--socket', path,
                                         *source, operation, '--json', json.dumps(parameters or {})],
                                        capture_output=True, text=True, timeout=5)
                worker.join(5)
                self.assertFalse(worker.is_alive())
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertTrue(json.loads(result.stdout)['ok'])
                return requests[0]

    def test_own_native_wire_has_no_original_or_caller_identity(self):
        value = self.call(['--own'], 'act', {'id': str(uuid.uuid4())})
        self.assertEqual(set(value), {'ownNative', 'operation', 'args'})
        self.assertIs(value['ownNative'], True)
        self.assertEqual(set(value['args']), {'id'})

    def test_existing_interaction_wire_retains_exact_reference(self):
        original = str(uuid.uuid4())
        value = self.call(['--interaction', original], 'act', {'id': str(uuid.uuid4())})
        self.assertEqual(set(value), {'interactionId', 'operation', 'args'})
        self.assertEqual(value['interactionId'], original)
        self.assertEqual(value['args']['nativeRequest'], original)

    def test_mixed_modes_and_borrowed_original_are_refused_before_socket_write(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / 'world.sock')
            with socket.socket(socket.AF_UNIX) as listener:
                listener.bind(path)
                for source in [['--own', '--interaction', str(uuid.uuid4())], ['--own']]:
                    result = subprocess.run([sys.executable, str(CLI), '--socket', path,
                                             *source, 'act', '--json', json.dumps({'nativeRequest': str(uuid.uuid4())})],
                                            capture_output=True, text=True, timeout=5)
                    self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
