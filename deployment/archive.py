#!/usr/bin/env python3
"""Build a regular-file-only USTAR from one selected deployable stage."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import tarfile

HOLODECK_ARCHIVE_LIMIT = 40 * 1024**2


def build(stage, output):
    stage=stage.resolve()
    manifest=json.loads((stage/'service.json').read_text())
    if manifest.get('service') != 'holodeck':
        raise ValueError('Select a Holodeck deployment stage')
    files={'service.json':json.dumps(manifest,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()}
    for row in manifest['files']:
        relative=Path(row['path'])
        if relative.is_absolute() or '..' in relative.parts or '.' in relative.parts:
            raise ValueError('Invalid selected path')
        file=stage/relative
        if file.is_symlink() or not file.is_file():raise ValueError('Regular selected files only')
        data=file.read_bytes()
        if hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('Selected bytes changed')
        if len(data)>32*1024**2:raise ValueError('File exceeds receiving bound')
        files[row['path']]=data
    if len(files)>4097 or sum(map(len,files.values()))>128*1024**2:raise ValueError('Unpacked package exceeds receiving bounds')
    with tarfile.open(output,'w',format=tarfile.USTAR_FORMAT) as archive:
        for name,data in sorted(files.items()):
            member=tarfile.TarInfo(name);member.size=len(data);member.mode=0o444;member.uid=member.gid=0;member.mtime=0
            archive.addfile(member,io.BytesIO(data))
    size=output.stat().st_size
    if size>HOLODECK_ARCHIVE_LIMIT:output.unlink();raise ValueError('Archive exceeds the 40 MiB Holodeck receiving bound')
    return {'files':len(files),'bytes':size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('stage',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args()
    print(json.dumps(build(args.stage,args.output),sort_keys=True))
