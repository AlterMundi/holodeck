"""Add the Casa Linterna route to an exact predecessor of Oliva's workshop."""

import argparse
import importlib.util
import json
from pathlib import Path
import re


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('archive', 'selection', 'assets', 'workshop-tools', 'output'):
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--previous', required=True)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('workshop_packager', args.workshop_tools)
    packager = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packager)
    manifest, files = packager.read_archive(args.archive, args.previous)
    selection = json.loads(args.selection.read_text())
    if (set(selection) != {'resource', 'version', 'humanRef'}
            or not re.fullmatch('[a-f0-9]{32}', selection['resource'])
            or not re.fullmatch('[a-f0-9]{64}', selection['version'])
            or not re.fullmatch('human:telegram:[1-9][0-9]*', selection['humanRef'])):
        raise ValueError('Select the protected publication and the paired human')
    if (manifest['entry'] != 'sculpt-workshop-entry.cjs'
            or manifest['runtime'] != 'node24-http' or 'home-auth.mjs' not in files
            or {'linterna-entry.cjs', 'linterna-selection.json'} & set(files)):
        raise ValueError('Select the matching existing workshop predecessor')
    selection['files'] = {}
    for name in ('index.html', 'linterna.js', 'linterna.css'):
        contents = (args.assets / name).read_bytes()
        if not 0 < len(contents) <= 1024**2:
            raise ValueError(f'Invalid published size for {name}')
        selection['files'][name] = packager.sha(contents)
    preserved = {name: packager.sha(raw) for name, raw in files.items() if name != 'service.json'}
    files['linterna-entry.cjs'] = Path(__file__).with_name('entry.cjs').read_bytes()
    files['linterna-selection.json'] = json.dumps(selection, sort_keys=True, separators=(',', ':')).encode()
    manifest['entry'] = 'linterna-entry.cjs'
    manifest['files'] = [dict(path=name, sha256=packager.sha(raw))
                         for name, raw in sorted(files.items()) if name != 'service.json']
    files['service.json'] = json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()
    archive = packager.write_archive(files)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'workshop.tar').write_bytes(archive)
    print(json.dumps({'sha256': packager.sha(archive), 'bytes': len(archive), 'preserved': len(preserved)}))


if __name__ == '__main__':
    main()
