#!/usr/bin/env python3
"""Direct first-class native world operations, scoped to a retained interaction."""
import argparse
import json
from pathlib import Path
import socket
import stat
import sys
import uuid


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--socket',required=True)
    parser.add_argument('--interaction',required=True)
    parser.add_argument('operation',choices=['observe','project','act','result'])
    parser.add_argument('--json',default='{}',dest='arguments')
    args=parser.parse_args()
    if str(uuid.UUID(args.interaction))!=args.interaction:
        raise ValueError('Select the retained native interaction identity')
    path=Path(args.socket)
    if not path.is_absolute() or not stat.S_ISSOCK(path.lstat().st_mode):
        raise ValueError('The receiving native world port is unavailable')
    parameters=json.loads(args.arguments)
    if not isinstance(parameters,dict):raise ValueError('Provide one typed operation object')
    if args.operation=='act':
        if parameters.get('nativeRequest') not in (None,args.interaction):
            raise ValueError('The action belongs to another retained interaction')
        parameters['nativeRequest']=args.interaction
    request={'interactionId':args.interaction,'operation':args.operation,'args':parameters}
    raw=json.dumps(request,allow_nan=False,separators=(',',':')).encode()+b'\n'
    if len(raw)>16384:raise ValueError('World operation exceeds its bound')
    with socket.socket(socket.AF_UNIX) as stream:
        stream.settimeout(45);stream.connect(str(path));stream.sendall(raw)
        reply=bytearray()
        while b'\n' not in reply:
            chunk=stream.recv(min(4096,131073-len(reply)))
            if not chunk or len(reply)+len(chunk)>131072:
                raise ValueError('World outcome unconfirmed; retrieve its exact result before retrying')
            reply.extend(chunk)
    value=json.loads(reply.split(b'\n',1)[0])
    print(json.dumps(value,ensure_ascii=False,allow_nan=False))
    return 0 if value.get('ok') is True else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception as error:
        print(json.dumps({'ok':False,'message':str(error)},ensure_ascii=False))
        sys.exit(1)
