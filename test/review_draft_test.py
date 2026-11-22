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


class ActivitySourceContracts(unittest.TestCase):
    def capture(self):
        import hashlib
        pin = {'kind': 'artifact_review', 'tableId': 'selected-table', 'reviewId': 'selected-review', 'revision': 'edition-1', 'adapter': 'interactive_3d'}
        base = {'id': 'node-game', 'revision': 2, 'deleted': False, 'title': 'Jardín compartido', 'shape': 'pedestal',
                'position': {'x': 22, 'z': 4}, 'links': [{'id': 'node-result', 'revision': 1, 'status': 'revised', 'currentRevision': 3}],
                'owner': 'private-being', 'progress': {'contributors': 2}, 'conversation': 'private utterance', 'arbitraryExtra': 'private binding',
                'play': {'schema': 'signal-garden/v1', 'targets': [{'x': 19, 'z': -1, 'radius': .8, 'color': 'mint'}], 'minContributors': 2, 'requiredBridgeRaised': True}}
        result = {**base, 'id': 'node-result', 'revision': 3, 'deleted': True, 'links': [], 'title': 'Pinned result'}
        del result['play']
        result.update(declaredResultPin=pin, result={'selection': hashlib.sha256(json.dumps(pin, sort_keys=True, separators=(',', ':')).encode()).hexdigest(), 'verification': 'creator-declared'})
        return {'nodes': {'node-game': base, 'node-result': result}, 'place': {'layoutVersion': 'captured-layout@2'},
                'participants': ['private participant'], 'entityEditors': {'private editor': 1}, 'inputAssociation': {'text': 'private original'}}

    def test_definitions_preserve_recipe_result_pin_links_and_tombstones_without_private_runtime_state(self):
        capture = self.capture()
        source = module.activity_source(capture)
        self.assertEqual(source['layoutVersion'], 'captured-layout@2')
        game, result = source['nodes']['node-game'], source['nodes']['node-result']
        self.assertEqual(game['play'], capture['nodes']['node-game']['play'])
        self.assertEqual(game['links'], [{'id': 'node-result', 'revision': 1}])
        self.assertEqual(result['revision'], 3);self.assertTrue(result['deleted'])
        self.assertEqual(result['result'], {'pin': capture['nodes']['node-result']['declaredResultPin'], 'verification': 'creator-declared'})
        for forbidden in ['private', 'owner', 'progress', 'contributors', 'entityEditors', 'participants', 'inputAssociation', 'currentRevision', 'arbitraryExtra']:
            self.assertNotIn(forbidden, json.dumps(source))
        capture['nodes']['node-game']['play']['targets'][0]['x'] = 0
        self.assertEqual(game['play']['targets'][0]['x'], 19, 'source bytes cannot retarget after later capture edits')
        unknown = self.capture();unknown.pop('place')
        self.assertIsNone(module.activity_source(unknown)['layoutVersion'])

    def test_ambiguous_capture_kind_is_not_silently_rewritten(self):
        capture = self.capture()
        capture['nodes']['node-game']['result'] = capture['nodes']['node-result']['result']
        with self.assertRaisesRegex(ValueError, 'one captured'):
            module.activity_source(capture)

    def test_missing_or_mismatched_declared_pin_refuses_instead_of_inventing_a_reference(self):
        for change in ['missing', 'changed', 'credential']:
            capture = self.capture();node = capture['nodes']['node-result']
            if change == 'missing':node.pop('declaredResultPin')
            elif change == 'changed':node['declaredResultPin']['revision'] = 'another-edition'
            else:node['declaredResultPin']['cookie'] = 'private credential'
            with self.assertRaises(ValueError):module.activity_source(capture)

    def test_closed_format_and_eight_node_sixteen_kib_bounds(self):
        from copy import deepcopy
        valid = module.activity_source(self.capture())
        for mutate in [lambda a:a.update(owner='private'), lambda a:a['nodes']['node-game'].update(progress={}),
                       lambda a:a['nodes']['node-game']['position'].update(cookie='private'),
                       lambda a:a['nodes']['node-game']['links'][0].update(status='current'),
                       lambda a:a['nodes']['node-game']['play'].update(code='execute'),
                       lambda a:a['nodes']['node-result']['result'].update(grant=True),
                       lambda a:a['nodes']['node-result']['result']['pin'].update(url='https://private.invalid'),
                       lambda a:a['nodes']['node-game'].update(revision=True)]:
            bad = deepcopy(valid);mutate(bad)
            with self.assertRaises(ValueError):module.validate_activity(bad)
        bad = deepcopy(valid);bad['layoutVersion'] = 'x' * 16384
        with self.assertRaisesRegex(ValueError, '16KiB'):module.validate_activity(bad)
        eight = deepcopy(valid);eight['nodes'] = {f'node-{i}': {**deepcopy(valid['nodes']['node-game']), 'id': f'node-{i}'} for i in range(8)}
        self.assertEqual(len(module.validate_activity(eight)['nodes']), 8)
        self.assertLess(len(json.dumps(eight).encode()), 16384)
        eight['nodes']['node-extra'] = {**deepcopy(valid['nodes']['node-game']), 'id': 'node-extra'}
        with self.assertRaises(ValueError):module.validate_activity(eight)

    def prepared(self, root):
        site = root / 'site';site.mkdir()
        for name, data in [('index.html', 'Controlled renderer fixture'), ('snapshot.glb', 'Controlled frozen source'), ('gallery.json', '{"scenes":[]}')]:
            (site / name).write_text(data)
        (site / 'review-live.json').write_text(json.dumps({'schema': 'dm.review-live/v1', 'gallery': 'gallery.json', 'sha256': module.digest(site / 'gallery.json')}))
        observation = {**self.capture(), 'schema': 'holodeck.situation/v1', 'id': 'controlled-source', 'run': 'run', 'edition': 'edition', 'source': {'through': 9}, 'entities': {'bridge': {'id': 'bridge', 'revision': 1, 'raised': True}}}
        source = {'run': 'run', 'edition': 'edition', 'semanticSequence': 9, 'snapshotSha256': module.digest(site / 'snapshot.glb'),
                  'sourceUnits': 'm', 'displayUnits': 'mm', 'displayFromWorld': [], 'parts': [{'part': 'bridge-deck', 'entity': 'bridge', 'revision': 1}],
                  'scenerySha256': 'a' * 64, 'authoredProjectionSha256': 'b' * 64}
        scene = {'units': 'mm', 'parts': [{'id': 'bridge-deck'}], 'holodeckSource': source}
        (root / 'observation.json').write_text(json.dumps({'ok': True, 'result': observation}))
        (root / 'scene.json').write_text(json.dumps(scene))
        selected = module.creation_source(observation, scene, site / 'snapshot.glb', module.digest(root / 'scene.json'))
        (site / 'creation.json').write_text(json.dumps(selected))
        return site, selected

    def test_optional_activity_uses_same_capture_and_five_files_with_no_extra_registry(self):
        with tempfile.TemporaryDirectory() as temporary:
            site, selected = self.prepared(Path(temporary))
            self.assertEqual(set(selected) - module.CREATION_FIELDS, {'activity'})
            self.assertEqual(selected['sourceObservation'], 'controlled-source')
            self.assertEqual(selected['semanticSequence'], 9)
            self.assertEqual(len(module.files_in(site)), 5)
            selected['activity']['nodes']['node-game']['owner'] = 'private actor'
            (site / 'creation.json').write_text(json.dumps(selected))
            with self.assertRaises(ValueError):module.files_in(site)

    def test_publication_refuses_valid_but_retargeted_activity_or_missing_original_capture_without_writer_call(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary);site, selected = self.prepared(root)
            argv = ['publisher', str(site), '--binding', str(root / 'unused-binding.json'), '--decision', 'Controlled source fixture']
            with patch('sys.argv', argv), patch.object(module.subprocess, 'run') as writer:
                with self.assertRaisesRegex(ValueError, 'confirmed observation'):module.main()
                writer.assert_not_called()
            selected['activity']['nodes']['node-game']['title'] = 'Retargeted source'
            (site / 'creation.json').write_text(json.dumps(selected))
            argv += ['--observation', str(root / 'observation.json'), '--scene', str(root / 'scene.json')]
            with patch('sys.argv', argv), patch.object(module.subprocess, 'run') as writer:
                with self.assertRaisesRegex(ValueError, 'pending creation'):module.main()
                writer.assert_not_called()
            captured = json.loads((root / 'observation.json').read_text());captured['result']['source']['through'] = 10
            (root / 'observation.json').write_text(json.dumps(captured))
            with patch('sys.argv', argv), patch.object(module.subprocess, 'run') as writer:
                with self.assertRaisesRegex(ValueError, 'same frozen creation'):module.main()
                writer.assert_not_called()


class SharedWorldCapacityContracts(unittest.TestCase):
    def test_publisher_uses_shared_capacity_and_keeps_old_sources_and_exact_byte_limits(self):
        capacity = json.loads((Path(__file__).parents[1] / 'src/world-capacity.json').read_text())['elements']
        self.assertEqual(module.MAX_WORLD_ELEMENTS, capacity)
        self.assertEqual(module.STAGE_LIMIT, 16 * 1024 * 1024)
        self.assertEqual(module.HISTORY_LIMIT, 200 * 1024 * 1024)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary);site, selected = ActivitySourceContracts().prepared(root)
            for i in range(capacity - 1):
                ident = 'garden-' + str(i).ljust(40, 'x')
                selected['entities'][ident] = {'id': ident, 'revision': 1, 'x': 22, 'z': 1, 'color': 'mint'}
            (site / 'creation.json').write_text(json.dumps(selected))
            self.assertEqual(len(selected['entities']), capacity)
            self.assertEqual(len(module.files_in(site)), 5)
            selected['entities']['garden-overflow'] = {'id': 'garden-overflow', 'revision': 1, 'x': 22, 'z': 1, 'color': 'mint'}
            (site / 'creation.json').write_text(json.dumps(selected))
            with self.assertRaises(ValueError):module.files_in(site)
