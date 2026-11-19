"""Draft publisher bounds/identity/recovery; fixtures are not a shared trial."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('review_draft', Path(__file__).parents[1] / 'tools/publish-review-draft.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReviewDraftContracts(unittest.TestCase):
    def test_creation_handoff_strips_private_situation_and_refuses_mismatched_geometry(self):
        with tempfile.TemporaryDirectory() as temporary:
            snapshot = Path(temporary) / 'snapshot.glb';snapshot.write_bytes(b'Controlled source fixture')
            observation = {'schema': 'holodeck.situation/v1', 'id': 'fixture-observation',
                           'run': 'fixture-run', 'edition': 'fixture-edition', 'source': {'through': 4},
                           'participants': ['private fixture'], 'inputAssociation': {'text': 'private fixture'},
                           'entities': {'bridge': {'id': 'bridge', 'raised': True, 'revision': 1, 'privateField': 'private fixture'}}}
            source = {'run': observation['run'], 'edition': observation['edition'], 'semanticSequence': 4,
                      'snapshotSha256': module.digest(snapshot), 'sourceUnits': 'm', 'displayUnits': 'mm',
                      'displayFromWorld': [], 'parts': [{'part': 'bridge-part', 'entity': 'bridge', 'revision': 1}],
                      'scenerySha256': 'a' * 64, 'authoredProjectionSha256': 'b' * 64}
            scene = {'units': 'mm', 'parts': [{'id': 'bridge-part'}], 'holodeckSource': source}
            selected = module.creation_source(observation, scene, snapshot, 'c' * 64)
            self.assertEqual(set(selected), module.CREATION_FIELDS)
            self.assertNotIn('private fixture', json.dumps(selected))
            self.assertEqual(selected['entities']['bridge']['revision'], 1)
            with self.assertRaises(ValueError):
                module.creation_source({**observation, 'run': 'another-run'}, scene, snapshot, 'c' * 64)
            snapshot.write_bytes(b'Different bytes')
            with self.assertRaises(ValueError):
                module.creation_source(observation, scene, snapshot, 'c' * 64)

    def test_history_counts_shared_immutable_inodes_once_and_refuses_missing_history(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = Path(temporary)
            first, second = 'a' * 32, 'b' * 32
            for ident in [first, second]:
                (store / 'objects' / ident).mkdir(parents=True)
            source = store / 'objects' / first / 'source'
            source.write_bytes(b'original fixture')
            os.link(source, store / 'objects' / second / 'source')
            (store / 'objects' / second / 'extra').write_bytes(b'new')
            entry = {'object': second, 'versions': [{'object': first}]}
            self.assertEqual(module.history_bytes(store, entry), len(b'original fixture') + 3)
            self.assertEqual(module.stage_bytes(store), len(b'original fixture') + 3)
            with self.assertRaises(ValueError):
                module.history_bytes(store, {'object': 'c' * 32})

    def test_draft_uses_exact_existing_world_readers_and_cannot_expand_an_existing_draft(self):
        world = {'id': 'world', 'visibility': 'individual', 'recipients': ['human:one', 'being:two']}
        renderer = {'id': 'renderer', 'visibility': 'individual', 'recipients': ['human:one', 'being:two', 'human:other']}
        self.assertEqual(module.audience([world, renderer], 'world', 'renderer', None), world['recipients'])
        for changed in [{**world, 'visibility': 'public'}, {**world, 'recipients': []}, {**world, 'recipients': ['human:one', 'human:one']}]:
            with self.assertRaises(ValueError):
                module.audience([changed, renderer], 'world', 'renderer', None)
        with self.assertRaises(ValueError):
            module.audience([world, {**renderer, 'recipients': ['human:one']}], 'world', 'renderer', None)
        with self.assertRaises(ValueError):
            module.audience([world, renderer], 'world', 'renderer', {'visibility': 'individual', 'recipients': ['human:one']})

    def test_uncertain_retained_publication_never_calls_the_writer_again(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            site, store = root / 'site', root / 'store'
            site.mkdir();store.mkdir()
            (root / 'draft-publication.intent.json').write_text('{}')
            binding = root / 'binding.json';binding.write_text(json.dumps({'store': str(store)}))
            entries = [{'id': ident, 'visibility': 'individual', 'recipients': ['human:fixture']}
                       for ident in ['holodeck', 'shared-3d-viewer']]
            (store / 'state.json').write_text(json.dumps({'entries': entries}))
            argv = ['publisher', str(site), '--binding', str(binding), '--decision', 'Controlled fixture only']
            # The actual gallery contract is covered below and by the real builder.
            with patch('sys.argv', argv), patch.object(module, 'files_in', return_value=[]), patch.object(module.subprocess, 'run') as writer:
                with self.assertRaisesRegex(ValueError, 'uncertain'):
                    module.main()
                writer.assert_not_called()

    def test_prepared_artifact_rejects_participant_context_and_unselected_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            site = Path(temporary)
            (site / 'index.html').write_text('Controlled publisher fixture')
            (site / 'snapshot.glb').write_bytes(b'Not geometry qualification')
            (site / 'gallery.json').write_text('{"scenes":[]}')
            (site / 'review-live.json').write_text(json.dumps({'schema': 'dm.review-live/v1', 'gallery': 'gallery.json', 'sha256': module.digest(site / 'gallery.json')}))
            creation = {key: None for key in module.CREATION_FIELDS}
            creation.update(schema='holodeck.creation-source/v1', snapshotSha256=module.digest(site / 'snapshot.glb'),
                            entities={'bridge': {'id': 'bridge', 'raised': False, 'revision': 0}},
                            parts=[{'part': 'bridge-deck-1', 'entity': 'bridge', 'revision': 0}])
            path = site / 'creation.json'
            path.write_text(json.dumps(creation))
            self.assertEqual(len(module.files_in(site)), 5)
            for changed in [{**creation, 'participants': ['private fixture']},
                            {**creation, 'excludedEnvironment': [{'part': 'scenery-part', 'material': 'water', 'reason': 'Backdrop', 'conversation': 'private fixture'}]},
                            {**creation, 'entities': {'bridge': {**creation['entities']['bridge'], 'conversation': 'private fixture'}}}]:
                path.write_text(json.dumps(changed))
                with self.assertRaises(ValueError):
                    module.files_in(site)
            path.write_text(json.dumps(creation))
            (site / 'situation.json').write_text('Unselected private input')
            with self.assertRaises(ValueError):
                module.files_in(site)
