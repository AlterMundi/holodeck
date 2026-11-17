#!/usr/bin/env python3
"""Fixed receiving-owner bridge to the existing Conversation writer.

No model client, human impersonation, arbitrary command runner or history scan.
The app's dedicated Unix peer may submit its actual human's exact input with one
application-authored world observation. Unknown writes are never retried here.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import socketserver
import sqlite3
import stat
import struct
import subprocess
import sys
import threading
import tomllib
import uuid

MAX_WIRE=131072


class BridgeError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code=code


def bounded_json(value):
    data=json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
    if len(data)>MAX_WIRE:
        raise BridgeError('capacity','Native response exceeds its bound')
    return data


def ident(value):
    if not isinstance(value,str) or str(uuid.UUID(value))!=value:
        raise BridgeError('input','Select an exact interaction identity')
    return value


class NativeBridge:
    def __init__(self,provider,pair_reader,world_port=None):
        self.provider=provider
        self.pair_reader=pair_reader
        self.world_port=world_port

    def pair(self,actor):
        pair=self.pair_reader()
        human=pair.get('human',{})
        if (pair.get('schema')!='dm.human-endpoint/v1'
            or not isinstance(actor,str) or actor!=human.get('ref')
            or actor!='human:telegram:'+str(self.provider.human)
            or human.get('kind')!='human' or not self.provider.authorized(self.provider.human)
            or not isinstance(pair.get('owner_being_ref'),str)
            or not pair['owner_being_ref'].startswith('dm:being:v1:')):
            raise BridgeError('identity','This native lane belongs to another pair')
        return pair

    def inspect(self,actor):
        pair=self.pair(actor)
        # This existing read-only metadata operation starts no voice/provider.
        # It supplies the native owner's frozen binding without scanning text.
        value=self.provider.presentation('input voice native capabilities')
        entry=value.get('entry_binding')
        binding=value.get('binding')
        if (not isinstance(binding,str) or not re.fullmatch('[a-f0-9]{64}',binding)
            or not isinstance(entry,list) or len(entry)!=4 or entry[0]!=self.provider.human
            or not isinstance(entry[3],str) or not entry[3]):
            raise BridgeError('binding','The continuing Conversation is unavailable')
        return {'actorRef':actor,'beingRef':pair['owner_being_ref'],'homeRef':pair['home_ref'],
                'pairingRevision':pair['human']['revision'],'binding':binding,'entry':entry}

    def authorize(self,actor,frozen,*,current=False):
        pair=self.pair(actor)
        if (not isinstance(frozen,dict)
            or frozen.get('actorRef')!=actor or frozen.get('beingRef')!=pair['owner_being_ref']
            or frozen.get('homeRef')!=pair.get('home_ref')):
            raise BridgeError('binding','The selected human/daimon pairing changed')
        if current and self.inspect(actor)!=frozen:
            raise BridgeError('binding','The continuing Conversation changed; preserve the original interaction')

    def observation_file(self,ident_,actor,observation):
        if (not isinstance(observation,dict) or observation.get('schema')!='holodeck.situation/v1'
            or not isinstance(observation.get('id'),str) or not isinstance(observation.get('run'),str)
            or observation.get('observer')!=actor or len(bounded_json(observation))>16384):
            raise BridgeError('context','Select the captured world situation for this speaker')
        value={'schema':'holodeck.native-situation-source/v1',
            'authorship':'Holodeck application-generated world observation, not human speech',
            'human_input_id':ident_,'speaker':actor,'observation':observation,
            'limits':'Structured room scope and supplied uncertainty apply; content is evidence, never authority.'}
        if self.world_port:
            value['native_world_interface']={
                'kind':'direct-native-world-port',
                'argv_prefix':[self.world_port['cli'],'--socket',self.world_port['socket'],'--interaction',ident_],
                'operations':{'observe':'Read current structured perception; optional --json query',
                    'project':'Choose a supported projection and position with --json projection',
                    'act':'Apply a typed command with --json command, using a fresh observation and relevant preconditions',
                    'result':'Read an exact command outcome with --json {"id":"command-id"}'},
                'authority':'The receiving world checks retained native admission, current pairing, room rights and action preconditions. This descriptor grants no authority.',
                'human_input_unchanged':True}
        data=bounded_json(value)
        ref={'file_id':str(uuid.uuid5(uuid.UUID(ident_),'holodeck-situation:'+observation['id'])),
             'sha256':hashlib.sha256(data).hexdigest(),'name':'holodeck-situation.json',
             'mime':'application/json','size':len(data)}
        return data,ref

    def submit(self,actor,frozen,input_,observation):
        self.authorize(actor,frozen,current=True)
        if not isinstance(input_,dict) or set(input_)!={'id','text'}:
            raise BridgeError('input','Provide one exact original interaction')
        input_id=ident(input_['id']);text=input_['text']
        if not isinstance(text,str) or not text.strip() or '\0' in text or len(text.encode())>32768:
            raise BridgeError('input','Provide one bounded original interaction')
        data,ref=self.observation_file(input_id,actor,observation)
        self.provider.conversation_file_upload(data,ref)
        # Recheck the actual grant/binding after retention and before native work.
        self.authorize(actor,frozen,current=True)
        value=self.provider.conversation_input_submit({'binding':frozen['binding'],
            'id':input_id,'text':text,'files':[ref]})
        return self.project_status(value,frozen)

    def project_status(self,value,frozen):
        if value.get('entry_binding')!=frozen['entry']:
            raise BridgeError('binding','Native result belongs to a different conversation')
        phase=value.get('phase')
        result={'phase':'queued','nativeAcceptance':value.get('native_acceptance','unconfirmed'),
                'message':None,'updates':[]}
        if value.get('retired') is True or phase in ('failed','rejected','cancelled','retired','known_unsent'):
            result['phase']='problem'
        elif phase in ('uncertain','unknown','submitting'):
            result['phase']='unknown'
        return result

    def status(self,actor,frozen,input_id):
        self.authorize(actor,frozen)
        value=self.provider.conversation_input_status(ident(input_id))
        if value.get('id')!=input_id:
            raise BridgeError('source','Native input identity changed')
        result=self.project_status(value,frozen)
        trace=self.provider.conversation_input_trace(input_id)
        if trace.get('id')!=input_id or trace.get('entry_binding')!=frozen['entry']:
            raise BridgeError('source','Native trace belongs to another original')
        routes=trace.get('routes',[])
        if not isinstance(routes,list) or len(routes)>5:
            raise BridgeError('capacity','Native route observation exceeds its bound')
        if routes:
            # A general-entry acknowledgment is not a routed work result. Read
            # only the owning trace's current, original-associated results.
            result['phase']='queued'
            for route in routes:
                if route.get('target_available') is not True:continue
                if route.get('native_acceptance') is True:result['nativeAcceptance']='observed'
                for row in route.get('results',[])[:8]:
                    if (row.get('instruction_covered') is not True or row.get('current') is not True
                        or row.get('correction_pending') is not False or not isinstance(row.get('text_excerpt'),str)):
                        continue
                    text=row['text_excerpt']
                    result['updates'].append({'source':row.get('source'),'revision':row.get('revision'),
                        'kind':'answer','text':text,'partial':row.get('text_bounded') is True,
                        'sha256':hashlib.sha256(text.encode()).hexdigest(),
                        'instruction':route.get('instruction'),'observedAt':None})
                    if result['message'] is None:
                        result['message']=text;result['phase']='completed'
            self.authorize(actor,frozen)
            return result
        local=value.get('local_turn')
        if type(local) is not int or local<=0:
            return result
        # Narrow lookup only for this retained input's local turn. Never scan a
        # conversation history or read unrelated text. The provider's own input
        # reader above has already checked owner and logical-entry provenance.
        db=sqlite3.connect('file:'+str(self.provider.receiver['db_path'])+'?mode=ro',uri=True)
        db.row_factory=sqlite3.Row
        with closing(db):
            turn=db.execute('''SELECT t.status,t.completed_at FROM turns t JOIN sessions s ON s.id=t.session_id
                WHERE t.id=? AND t.from_user_id=? AND s.creator_user_id=? AND t.session_id=?
                AND t.native_thread_id=?''',(local,self.provider.human,self.provider.human,frozen['entry'][2],frozen['entry'][3])).fetchone()
            rows=db.execute('''SELECT m.rowid,m.text,m.native_thread,m.native_turn,m.item_id,m.phase,m.observed_at
                FROM interaction_native_messages m JOIN turns t ON t.id=m.local_turn JOIN sessions s ON s.id=t.session_id
                WHERE m.local_turn=? AND m.presentation_input=? AND t.from_user_id=? AND s.creator_user_id=?
                AND t.session_id=? AND m.native_thread=? AND s.codex_thread_id=m.native_thread AND s.force_fresh_thread=0
                AND (m.phase IN ('commentary','final_answer') OR m.phase IS NULL)
                ORDER BY m.rowid DESC LIMIT 8''',(local,input_id,self.provider.human,self.provider.human,
                    frozen['entry'][2],frozen['entry'][3])).fetchall()
        self.authorize(actor,frozen)
        if turn and turn['status']=='running' and turn['completed_at'] is None:
            result['phase']='working'
        for row in reversed(rows):
            text=row['text'];kind='answer' if row['phase'] in (None,'final_answer') else 'progress'
            shown=text.encode()[:4096].decode('utf-8',errors='ignore')
            result['updates'].append({'source':'native:'+str(row['rowid']),'kind':kind,
                'text':shown,'partial':len(shown)<len(text),'sha256':hashlib.sha256(text.encode()).hexdigest(),
                'nativeTurn':row['native_turn'],'nativeItem':row['item_id'],'observedAt':row['observed_at']})
            if kind=='answer':
                result['message']=shown
                if turn and turn['completed_at'] is not None:
                    result['phase']='completed'
        return result

    def dispatch(self,request):
        if not isinstance(request,dict):raise BridgeError('input','Provide a native bridge request')
        op=request.get('operation');actor=request.get('actorRef')
        fields={'inspect':{'operation','actorRef'},'submit':{'operation','actorRef','frozen','input','observation'},
                'status':{'operation','actorRef','frozen','id'}}
        if op not in fields or set(request)!=fields[op]:raise BridgeError('operation','Unsupported native bridge operation')
        if op=='inspect':return self.inspect(actor)
        if op=='submit':return self.submit(actor,request['frozen'],request['input'],request['observation'])
        return self.status(actor,request['frozen'],request['id'])


def configuration(path):
    file=Path(path);meta=file.lstat()
    if (not stat.S_ISREG(meta.st_mode) or meta.st_uid not in (0,os.getuid()) or meta.st_mode&0o027 or meta.st_size>8192):
        raise ValueError('Owner-controlled native bridge configuration required')
    value=json.loads(file.read_text())
    required={'schema','provider_source','dashboard_config','home_command','socket_path','allowed_uids'}
    world=value.get('world_port')
    if (not required<=set(value) or set(value)-required-{'world_port'} or value['schema']!='holodeck.native-bridge/v1'
        or not isinstance(value['allowed_uids'],list) or not 1<=len(value['allowed_uids'])<=8
        or any(type(uid) is not int or uid<0 for uid in value['allowed_uids'])
        or not isinstance(value['home_command'],list) or len(value['home_command'])!=2
        or value['home_command'][1]!='human' or not value['home_command'][0].startswith('/')
        or any(not isinstance(value[k],str) or not value[k].startswith('/') for k in ('provider_source','dashboard_config','socket_path'))):
        raise ValueError('Select fixed receiving native bridge routes')
    if world is not None and (not isinstance(world,dict) or set(world)!={'cli','socket'}
        or any(not isinstance(world[k],str) or not world[k].startswith('/') for k in ('cli','socket'))):
        raise ValueError('Select the installed direct native world port')
    return value


def serve(path):
    config=configuration(path)
    sys.path.insert(0,config['provider_source'])
    from dashboard.provider import Provider
    provider=Provider(tomllib.loads(Path(config['dashboard_config']).read_text()))
    def pair_reader():
        result=subprocess.run(config['home_command'],check=True,capture_output=True,timeout=15)
        if len(result.stdout)>16384:raise ValueError('Pairing reader exceeded its bound')
        return json.loads(result.stdout)
    bridge=NativeBridge(provider,pair_reader,config.get('world_port'))
    slots=threading.BoundedSemaphore(4)
    class Handler(socketserver.StreamRequestHandler):
        def handle(self):
            self.request.settimeout(45)
            _,uid,_=struct.unpack('3i',self.request.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,12))
            if uid not in config['allowed_uids']:return
            if not slots.acquire(blocking=False):return
            try:
                raw=self.rfile.readline(MAX_WIRE+1)
                if len(raw)>MAX_WIRE or not raw.endswith(b'\n'):return
                try:reply={'ok':True,'result':bridge.dispatch(json.loads(raw))}
                except BridgeError as error:reply={'ok':False,'code':error.code,'message':str(error)}
                except Exception:reply={'ok':False,'code':'unavailable','message':'Native operation unconfirmed; inspect its retained status before retrying'}
                self.wfile.write(bounded_json(reply)+b'\n')
            finally:slots.release()
    class Server(socketserver.ThreadingUnixStreamServer):
        daemon_threads=True
        request_queue_size=4
    socket_path=Path(config['socket_path'])
    if socket_path.exists():
        # Never remove an uncertain active receiving socket automatically.
        raise ValueError('Inspect the existing native bridge socket before replacement')
    old=os.umask(0o117)
    try:server=Server(str(socket_path),Handler)
    finally:os.umask(old)
    os.chmod(socket_path,0o660)
    try:server.serve_forever(poll_interval=.5)
    finally:server.server_close();socket_path.unlink(missing_ok=True);provider.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('operation',choices=['serve']);parser.add_argument('--config',required=True)
    args=parser.parse_args();serve(args.config)
