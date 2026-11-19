#!/usr/bin/env python3
"""Publish one prepared Holodeck draft through the existing Home writer.

No app entry, published-release pointer, audience expansion or native model input.
The existing Home catalog remains the only publication/version authority.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

HISTORY_LIMIT = 200 * 1024 * 1024
STAGE_LIMIT = 16 * 1024 * 1024
CREATION_FIELDS = {'schema', 'run', 'edition', 'sourceObservation', 'semanticSequence',
                   'sourceUnits', 'displayUnits', 'displayFromWorld', 'parts', 'entities',
                   'snapshotSha256', 'scenerySha256', 'authoredProjectionSha256', 'sceneSha256', 'scope'}
OPTIONAL_CREATION_FIELDS = {'excludedEnvironment'}


def load(path, limit):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > limit:
        raise ValueError('Select a bounded regular source')
    return json.loads(path.read_text())


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def select(entries, ident):
    matches = [entry for entry in entries if entry['id'] == ident]
    if len(matches) != 1:
        raise ValueError('Select one existing resource')
    return matches[0]


def audience(entries, source_id, renderer_id, previous):
    source, renderer = select(entries, source_id), select(entries, renderer_id)
    recipients = source.get('recipients', [])
    if (source['visibility'] != 'individual' or not 1 <= len(recipients) <= 32
            or not all(isinstance(ref, str) and 1 <= len(ref) <= 256 for ref in recipients)
            or len(set(recipients)) != len(recipients)):
        raise ValueError('Select the existing individual world audience')
    if renderer['visibility'] != 'individual' or not set(recipients) <= set(renderer.get('recipients', [])):
        raise ValueError('The selected world audience must already reach the shared renderer')
    if previous and (previous['visibility'] != 'individual' or set(previous.get('recipients', [])) != set(recipients)):
        raise ValueError('A draft update cannot silently change its selected audience')
    return recipients


def history_bytes(store, entry):
    objects = {version.get('object') for version in [entry, *entry.get('versions', [])]} if entry else set()
    unique = {}
    for obj in objects - {None}:
        if not re.fullmatch(r'[a-f0-9]{32}', obj):
            raise ValueError('Invalid retained Home object identity')
        root = store / 'objects' / obj
        if root.is_symlink() or not root.is_dir():
            raise ValueError('Retained publication history is unavailable')
        for path in root.rglob('*'):
            if path.is_symlink():
                raise ValueError('History must contain regular owned files')
            if path.is_file():
                stat = path.stat()
                unique[(stat.st_dev, stat.st_ino)] = stat.st_size
    return sum(unique.values())


def files_in(site):
    if site.is_symlink() or not site.is_dir():
        raise ValueError('Select the prepared gallery directory')
    files = list(site.iterdir())
    if {path.name for path in files} != {'index.html', 'gallery.json', 'review-live.json', 'snapshot.glb', 'creation.json'}:
        raise ValueError('Publish only the selected gallery, snapshot and creation source')
    if any(path.is_symlink() or not path.is_file() for path in files):
        raise ValueError('Publish regular files only')
    if sum(path.stat().st_size for path in files) > STAGE_LIMIT:
        raise ValueError('The selected review stage exceeds16MiB')
    manifest = load(site / 'review-live.json', 16384)
    if manifest.get('schema') != 'dm.review-live/v1' or manifest.get('gallery') != 'gallery.json' or manifest.get('sha256') != digest(site / 'gallery.json'):
        raise ValueError('The gallery does not match its fixed review manifest')
    creation = load(site / 'creation.json', 131072)
    if (set(creation) - OPTIONAL_CREATION_FIELDS != CREATION_FIELDS or creation.get('schema') != 'holodeck.creation-source/v1'
            or creation.get('snapshotSha256') != digest(site / 'snapshot.glb')
            or not isinstance(creation['entities'], dict) or not 1 <= len(creation['entities']) <= 32
            or not isinstance(creation['parts'], list) or not 1 <= len(creation['parts']) <= 256):
        raise ValueError('The creation source does not match its frozen snapshot')
    for entity in creation['entities'].values():
        if not isinstance(entity, dict) or set(entity) - {'id', 'revision', 'raised', 'x', 'z', 'color', 'deleted'}:
            raise ValueError('Only editable creation parameters belong in this artifact')
    for part in creation['parts']:
        if not isinstance(part, dict) or set(part) != {'part', 'entity', 'revision'}:
            raise ValueError('Select source-bound creation parts, not participant context')
    excluded = creation.get('excludedEnvironment', [])
    if (not isinstance(excluded, list) or len(excluded) > 16
            or any(not isinstance(part, dict) or set(part) != {'part', 'material', 'reason'}
                   or part['material'] != 'water'
                   or not all(isinstance(value, str) and len(value) <= 200 for value in part.values())
                   for part in excluded)):
        raise ValueError('Retain only the explicitly excluded ambient backdrop metadata')
    return files


def creation_source(observation, scene, snapshot, scene_sha256):
    source = scene.get('holodeckSource', {})
    if (observation.get('schema') != 'holodeck.situation/v1' or scene.get('units') != 'mm'
            or source.get('run') != observation.get('run') or source.get('edition') != observation.get('edition')
            or source.get('semanticSequence') != observation.get('source', {}).get('through')
            or source.get('snapshotSha256') != digest(snapshot)
            or {part['id'] for part in scene.get('parts', [])} != {part['part'] for part in source.get('parts', [])}):
        raise ValueError('Select the same frozen creation, display source and snapshot')
    parameters = {ident: {key: value for key, value in entity.items()
                         if key in {'id', 'revision', 'raised', 'x', 'z', 'color', 'deleted'}}
                  for ident, entity in observation['entities'].items()}
    selected = {'schema': 'holodeck.creation-source/v1', 'run': source['run'], 'edition': source['edition'],
            'sourceObservation': observation['id'], 'semanticSequence': source['semanticSequence'],
            'sourceUnits': source['sourceUnits'], 'displayUnits': source['displayUnits'],
            'displayFromWorld': source['displayFromWorld'], 'parts': source['parts'], 'entities': parameters,
            'snapshotSha256': source['snapshotSha256'], 'scenerySha256': source['scenerySha256'],
            'authoredProjectionSha256': source['authoredProjectionSha256'],
            'sceneSha256': scene_sha256,
            'scope': 'Static creation geometry and editable world parameters; no participants, conversation or running-world replay.'}
    if source.get('excludedEnvironment'):
        selected['excludedEnvironment'] = source['excludedEnvironment']
    return selected


def stage_bytes(root):
    unique = {}
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('Use one regular task-owned stage')
        if path.is_file():
            stat = path.stat()
            unique[(stat.st_dev, stat.st_ino)] = stat.st_size
    return sum(unique.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site', type=Path)
    parser.add_argument('--binding', type=Path, required=True)
    parser.add_argument('--audience-from', default='holodeck')
    parser.add_argument('--renderer', default='shared-3d-viewer')
    parser.add_argument('--id', default='holodeck-workshop-review')
    parser.add_argument('--observation', type=Path, help='Optional confirmed observation to prepare creation-only metadata')
    parser.add_argument('--scene', type=Path, help='Matching source document produced by export-review-scene.mjs')
    parser.add_argument('--decision', required=True)
    args = parser.parse_args()
    os.umask(0o077)
    if not args.decision.strip() or len(args.decision.encode()) > 4096 or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', args.id):
        raise ValueError('Retain the explicit draft/audience decision')
    with (args.site.parent / 'draft-publication.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if bool(args.observation) != bool(args.scene):
            raise ValueError('Select both frozen observation and matching review scene')
        if args.observation:
            value = load(args.observation, 256 * 1024)
            if value.get('ok') is False:
                raise ValueError('The source observation is unconfirmed')
            selected = creation_source(value.get('result', value.get('observation', value)),
                                       load(args.scene, 8 * 1024 * 1024), args.site / 'snapshot.glb', digest(args.scene))
            creation_path = args.site / 'creation.json'
            if creation_path.exists():
                if load(creation_path, 131072) != selected:
                    raise ValueError('Preserve the pending creation; use the next bounded stage after exact readback')
            else:
                creation_path.write_text(json.dumps(selected, separators=(',', ':'), ensure_ascii=False) + '\n')
        files = files_in(args.site)
        if stage_bytes(args.site.parent) + 16384 > STAGE_LIMIT:
            raise ValueError('The complete task stage exceeds16MiB including receipt headroom')
        binding = load(args.binding, 131072)
        store = Path(binding['store'])
        state = load(store / 'state.json', 16 * 1024 * 1024)
        matches = [entry for entry in state['entries'] if entry['id'] == args.id]
        if len(matches) > 1:
            raise ValueError('Draft resource identity is ambiguous')
        previous = matches[0] if matches else None
        if args.id in {args.audience_from, args.renderer} or previous and (previous.get('kind') != 'artifact' or previous.get('application')):
            raise ValueError('Preserve the existing application and renderer resources')
        readers = audience(state['entries'], args.audience_from, args.renderer, previous)
        retained, incoming = history_bytes(store, previous), sum(path.stat().st_size for path in files)
        intent_path = args.site.parent / 'draft-publication.intent.json'
        receipt_path = args.site.parent / 'draft-publication.receipt.json'
        if intent_path.exists():
            if not receipt_path.exists():
                raise ValueError('Publication outcome is uncertain; inspect Home state and sync without replaying')
            retained_receipt = load(receipt_path, 131072)
            retained_intent = load(intent_path, 131072)
            if not previous or retained_receipt.get('publicationVersion') != previous['version_ref'] or retained_receipt.get('resource') != previous['artifact_ref']:
                raise ValueError('The retained draft selection changed; inspect its current publication')
            selected_files = {path.name: digest(path) for path in files}
            if retained_receipt.get('files') == selected_files and retained_intent.get('decision') == args.decision:
                print(json.dumps(retained_receipt))
                return
        # Conservative: count all incoming bytes even when the Home writer can
        # hard-link unchanged files. This cannot understate retained history.
        if retained + incoming > HISTORY_LIMIT:
            raise ValueError('Draft publication would exceed the200MiB project ceiling; history is preserved')
        if intent_path.exists():
            # One previous receipt is enough here: Home retains canonical version
            # history. Never rotate an uncertain operation or accumulate stages.
            intent_path.replace(args.site.parent / 'draft-publication.previous-intent.json')
            receipt_path.replace(args.site.parent / 'draft-publication.previous-receipt.json')
        intent = {'schema': 'holodeck.draft-publication-intent/v1', 'id': args.id,
                  'expectedCurrent': previous['version_ref'] if previous else None,
                  'recipients': readers, 'decision': args.decision,
                  'files': {path.name: digest(path) for path in files},
                  'historyLimitBytes': HISTORY_LIMIT, 'retainedBytes': retained, 'incomingBytes': incoming,
                  'meaning': 'Review draft only; no published selection or native model input'}
        intent_path.write_text(json.dumps(intent, indent=2) + '\n')
        command = ['daimon-home', '--binding', str(args.binding), 'publish', str(args.site), '--id', args.id,
                   '--title', 'Holodeck · creación compartida', '--summary', 'Borrador de la isla, el puente y las luces para recorrer y revisar.',
                   '--visibility', 'individual', '--decision', args.decision, '--reuse-identical']
        if previous:
            command += ['--expected-current', previous['version_ref']]
        for reader in readers:
            command += ['--recipient', reader]
        result = subprocess.run(command, capture_output=True, timeout=60, check=True)
        outcome = json.loads(result.stdout)
        current = select(load(store / 'state.json', 16 * 1024 * 1024)['entries'], args.id)
        root = store / 'objects' / current['object']
        if set(current.get('recipients', [])) != set(readers) or any(digest(root / name) != value for name, value in intent['files'].items()):
            raise ValueError('Publication readback differs; preserve the retained intent')
        receipt = {'schema': 'holodeck.draft-publication-receipt/v1', 'outcome': outcome,
                   'resource': current['artifact_ref'], 'publicationVersion': current['version_ref'],
                   'files': intent['files'], 'historyBytes': history_bytes(store, current),
                   'historyLimitBytes': HISTORY_LIMIT, 'servedReadback': 'not-yet-verified',
                   'publishedSelection': None}
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps(receipt))


if __name__ == '__main__':
    main()
