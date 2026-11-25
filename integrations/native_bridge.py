#!/usr/bin/env python3
"""Fixed receiving-owner bridge to the existing Conversation writer.

No model client, human impersonation, arbitrary command runner or history scan.
The app's dedicated Unix peer may submit its actual human's exact input with one
application-authored world observation. Unknown writes are never retried here.
"""
import argparse
from contextlib import closing
import hashlib
import importlib.util
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
# A full bounded room (entities, participants, explicit indications and client
# view) fits 32KiB. Keep source-envelope headroom without widening the wire cap.
MAX_OBSERVATION=32768
MAX_SITUATION_SOURCE=49152


class BridgeError(Exception):
    def __init__(self, code, message, known_not_submitted=False):
        super().__init__(message)
        self.code=code
        self.known_not_submitted=known_not_submitted


def bounded_json(value):
    data=json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
    if len(data)>MAX_WIRE:
        raise BridgeError('capacity','Native response exceeds its bound')
    return data


def unique_json_object(pairs):
    value={}
    for name,item in pairs:
        if name in value:raise ValueError('Duplicate native bridge field')
        value[name]=item
    return value


def ident(value):
    if not isinstance(value,str) or str(uuid.UUID(value))!=value:
        raise BridgeError('input','Select an exact interaction identity')
    return value


def routed_execution(route):
    """Accept only the owner's active observation for this exact instruction."""
    proof=route.get('active_execution')
    instruction=route.get('instruction')
    if (route.get('native_acceptance') is not True or route.get('target_available') is not True
        or route.get('transport_phase')!='accepted' or not isinstance(proof,dict)
        or proof.get('status')!='running' or proof.get('instruction')!=instruction
        or type(proof.get('local_turn')) is not int or proof['local_turn']<=0
        or not isinstance(instruction,str)):
        return None
    try:
        if str(uuid.UUID(instruction))!=instruction:return None
    except ValueError:
        return None
    return {'status':'running','instruction':instruction,'local_turn':proof['local_turn']}


class NativeBridge:
    def __init__(self,provider,pair_reader,world_port=None,home_auth=None,world_access_reader=None,review_ownership_reader=None,
                 machine_sources=False):
        self.provider=provider
        self.pair_reader=pair_reader
        self.world_port=world_port
        self.world_access_reader=world_access_reader
        self.review_ownership_reader=review_ownership_reader
        self.machine_sources=machine_sources
        self.human_ref='human:telegram:'+str(provider.human)
        self.home_origin=None
        self.home_entry=None
        if home_auth is not None:
            if home_auth.enabled is not True:
                raise ValueError('Select the existing registered shared Conversation authority')
            # The maintained generic adapter owns human_ref/application_id;
            # allocated native integers are NOT Telegram or Home identities.
            configured=getattr(home_auth,'human_ref',None)
            if configured is None and 'application_id' in provider.config:
                raise ValueError('The installed generic Home adapter must expose its registered human reference')
            if configured is not None:self.human_ref=configured
            self.home_origin=home_auth.origin
            self.home_entry=home_auth.entry
        if not isinstance(self.human_ref,str) or not re.fullmatch(r'human:[A-Za-z0-9:._/-]{1,240}',self.human_ref):
            raise ValueError('Select the registered receiving human reference')

    def pair(self,actor):
        pair=self.pair_reader()
        human=pair.get('human',{})
        if (pair.get('schema')!='dm.human-endpoint/v1'
            or not isinstance(actor,str) or actor!=human.get('ref')
            or actor!=self.human_ref
            or human.get('kind')!='human' or not self.provider.authorized(self.provider.human)
            or not isinstance(pair.get('owner_being_ref'),str)
            or not pair['owner_being_ref'].startswith('dm:being:v1:')):
            raise BridgeError('identity','This native lane belongs to another pair')
        if self.home_origin is not None:
            expected=self.home_origin+self.home_entry
            if not any(app.get('capability')=='interaction' and app.get('url')==expected
                for app in pair.get('applications',[]) if isinstance(app,dict)):
                raise BridgeError('identity','The registered Home route does not match this Conversation receiver')
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
        if current:
            if self.inspect(actor)!=frozen:
                raise BridgeError('binding','The continuing Conversation changed; preserve the original interaction')
            return
        pair=self.pair(actor)
        if (not isinstance(frozen,dict)
            or frozen.get('actorRef')!=actor or frozen.get('beingRef')!=pair['owner_being_ref']
            or frozen.get('homeRef')!=pair.get('home_ref')):
            raise BridgeError('binding','The selected human/daimon pairing changed')

    def surface(self,actor):
        frozen=self.inspect(actor)
        if self.home_origin is None or self.home_entry is None:
            raise BridgeError('surface-unavailable','No registered shared Conversation entrance is selected')
        return {'schema':'holodeck.conversation-surface/v1','actorRef':actor,
                'beingRef':frozen['beingRef'],'homeRef':frozen['homeRef'],
                'binding':frozen['binding'],'url':self.home_origin+self.home_entry}

    def observation_file(self,ident_,actor,observation):
        if (not isinstance(observation,dict) or observation.get('schema')!='holodeck.situation/v1'
            or not isinstance(observation.get('id'),str) or not isinstance(observation.get('run'),str)
            or observation.get('observer')!=actor or len(bounded_json(observation))>MAX_OBSERVATION):
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
                    'activity':'Read recent public world events; optional --json {"limit":20} or exact run/through/before cursors',
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
        original_absent=False
        try:
            self.authorize(actor,frozen,current=True)
            if not isinstance(input_,dict) or set(input_)!={'id','text'}:
                raise BridgeError('input','Provide one exact original interaction')
            input_id=ident(input_['id']);text=input_['text']
            if not isinstance(text,str) or not text.strip() or '\0' in text or len(text.encode())>32768:
                raise BridgeError('input','Provide one bounded original interaction')
            existing=self.lookup(actor,input_id,hashlib.sha256(text.encode()).hexdigest())
            if existing['state']=='retained':return existing['native']
            original_absent=True
            data,ref=self.observation_file(input_id,actor,observation)
            self.provider.conversation_file_upload(data,ref)
            # Recheck the actual grant/binding after retention and before native work.
            self.authorize(actor,frozen,current=True)
        except BridgeError as error:
            error.known_not_submitted=original_absent
            raise
        except Exception as error:
            raise BridgeError('preflight-unavailable',
                'Native work was not submitted; retained source preparation needs recovery' if original_absent else
                'The original native outcome is unconfirmed; preparation submitted no new input',original_absent) from error
        value=self.provider.conversation_input_submit({'binding':frozen['binding'],
            'id':input_id,'text':text,'files':[ref]})
        return self.project_status(value,frozen)

    def prepare_context(self,actor,frozen,input_id,observation):
        """Retain only machine context; Conversation owns the original writer.

        The world service must freeze and retain its situation before calling.
        This operation never submits text, audio or an original, nor grants world
        access. A later real canonical input must retain this exact file/source.
        """
        self.authorize(actor,frozen,current=True)
        input_id=ident(input_id)
        data,ref=self.observation_file(input_id,actor,observation)
        with closing(sqlite3.connect('file:'+str(self.provider.receiver['db_path'])+'?mode=ro',uri=True)) as db:
            row=db.execute('SELECT human_id FROM conversation_inputs WHERE id=?',(input_id,)).fetchone()
        if row is not None:
            if row[0]!=self.provider.human:
                raise BridgeError('id-reuse','This original belongs to another human')
            original=self.provider.conversation_input_status(input_id)
            if (original.get('entry_binding')!=frozen['entry']
                or not any(all(candidate.get(key)==value for key,value in ref.items())
                    for candidate in original.get('files',[]) if isinstance(candidate,dict))
                or self.retained_observation(actor,input_id,original)!=observation):
                raise BridgeError('id-reuse','The retained original has another situation; preserve it')
        else:
            result=self.provider.conversation_file_upload(data,ref)
            if (not isinstance(result,dict) or any(result.get(key)!=value for key,value in ref.items())
                or result.get('media')!='retained' or result.get('work_admitted') is not False):
                raise BridgeError('source','The context file acknowledgment is unconfirmed')
        self.authorize(actor,frozen,current=True)
        return {'schema':'holodeck.prepared-conversation-context/v1','id':input_id,
                'binding':frozen['binding'],'entry_binding':frozen['entry'],
                'observation_id':observation['id'],'file':ref,'work_admitted':False}

    def machine_source_capability(self, actor, frozen):
        """The opt-in bridge and the actual owner journal must agree."""
        if not self.machine_sources or self.world_access_reader is None:
            raise BridgeError('context-capability','The owner journal context route is unavailable')
        self.authorize(actor,frozen,current=True)
        if self.world_access_reader(frozen['beingRef']) is not True:
            raise BridgeError('forbidden','The paired daimon needs current world access')
        value=self.provider.conversation_machine_source_capabilities()
        if (value.get('machine_source')!='owner-journal/v1' or value.get('binding')!=frozen['binding']
                or value.get('entry_binding')!=frozen['entry']):
            raise BridgeError('context-capability','The owner journal context route changed')

    def prepare_machine_context(self, actor, frozen, input_id, observation):
        self.machine_source_capability(actor,frozen)
        input_id=ident(input_id)
        data,ref=self.observation_file(input_id,actor,observation)
        observation_id=ident(observation['id'])
        if observation.get('inputAssociation',{}).get('humanInputId')!=input_id:
            raise BridgeError('source','The world context must name this exact original')
        with closing(sqlite3.connect('file:'+str(self.provider.receiver['db_path'])+'?mode=ro',uri=True)) as db:
            row=db.execute('SELECT human_id FROM conversation_inputs WHERE id=?',(input_id,)).fetchone()
        if row is not None:
            if row[0]!=self.provider.human:
                raise BridgeError('id-reuse','This original belongs to another human')
            value,selected=self.read_machine_observation(actor,frozen,input_id)
            if selected!=observation:
                raise BridgeError('id-reuse','The retained original has another situation; preserve it')
            checksum=value['source_sha256']
        else:
            value=self.provider.reserve_conversation_machine_source(binding=frozen['binding'],ident=input_id,
                observation_id=observation_id,data=data,file=ref)
            checksum=ref['sha256']
        receipt=self.verify_machine_source(value,frozen,input_id,observation_id,checksum)
        self.machine_source_capability(actor,frozen)
        return {'schema':'holodeck.prepared-machine-context/v1','id':input_id,
                'binding':frozen['binding'],'entry_binding':frozen['entry'],
                'observation_id':observation_id,'receipt':receipt,'source_sha256':checksum,
                'retained_original':value['retained_original'],'submitted_by_prepare':False}

    @staticmethod
    def verify_machine_source(value,frozen,input_id,observation_id,checksum):
        if (value.get('schema')!='telecodex.conversation-machine-source/v1' or value.get('id')!=input_id
                or value.get('observation_id')!=observation_id or value.get('source_sha256')!=checksum
                or type(value.get('retained_original')) is not bool
                or value.get('storage')!='owner-journal' or value.get('entry_binding')!=frozen['entry']):
            raise BridgeError('source','The world context acknowledgment is unconfirmed')
        return ident(value.get('receipt'))

    def read_machine_observation(self,actor,frozen,input_id):
        value=self.provider.read_conversation_machine_source(binding=frozen['binding'],ident=input_id)
        observation=json.loads(value['observation_json'])
        if (value.get('retained_original') is not True or not isinstance(observation,dict)
                or observation.get('schema')!='holodeck.situation/v1'
                or observation.get('id')!=value.get('observation_id') or observation.get('observer')!=actor
                or observation.get('inputAssociation',{}).get('humanInputId')!=input_id
                or not isinstance(value.get('source_sha256'),str) or not re.fullmatch('[a-f0-9]{64}',value['source_sha256'])):
            raise BridgeError('source','The retained world context names another original')
        self.verify_machine_source(value,frozen,input_id,ident(observation['id']),value['source_sha256'])
        return value,observation

    def attached_machine_source(self,input_id):
        if not self.machine_sources:return None
        value=self.provider.retained_conversation_machine_source(input_id)
        if (value.get('schema')!='telecodex.conversation-retained-machine-source/v1' or value.get('id')!=input_id
                or value.get('original_retained') is not True or type(value.get('machine_source_retained')) is not bool):
            raise BridgeError('source','The native original source is unconfirmed')
        return ident(value.get('receipt')) if value['machine_source_retained'] else None

    def machine_context_status(self,actor,frozen,input_id,observation_id,receipt,checksum):
        self.machine_source_capability(actor,frozen)
        input_id=ident(input_id);observation_id=ident(observation_id);receipt=ident(receipt)
        if not isinstance(checksum,str) or not re.fullmatch('[a-f0-9]{64}',checksum):
            raise BridgeError('source','Select one immutable world context')
        value,_=self.read_machine_observation(actor,frozen,input_id)
        if self.verify_machine_source(value,frozen,input_id,observation_id,checksum)!=receipt:
            raise BridgeError('source','The original does not retain this world context')
        status=self.status(actor,frozen,input_id)
        self.machine_source_capability(actor,frozen)
        return status

    def project_status(self,value,frozen):
        if value.get('entry_binding')!=frozen['entry']:
            raise BridgeError('binding','Native result belongs to a different conversation')
        phase=value.get('phase')
        result={'phase':'queued','nativeAcceptance':value.get('native_acceptance','unconfirmed'),
                'message':None,'updates':[],'retainedOriginal':True,'retryable':False,
                'tracking':True,'knownNotSubmitted':False}
        if value.get('retired') is True or phase in ('failed','rejected','cancelled','retired','known_unsent'):
            result['phase']='problem'
            result['tracking']=False
        elif phase in ('uncertain','unknown','submitting'):
            result['phase']='unknown'
        elif phase=='answered':
            result.update(phase='completed',tracking=False)
        return result

    def lookup(self,actor,input_id,text_sha256=None):
        """Exact-ID canonical dedup/recovery, never work or a history scan."""
        frozen=self.inspect(actor)
        input_id=ident(input_id)
        if text_sha256 is not None and (not isinstance(text_sha256,str) or not re.fullmatch('[a-f0-9]{64}',text_sha256)):
            raise BridgeError('input','Select the exact original text checksum')
        with closing(sqlite3.connect('file:'+str(self.provider.receiver['db_path'])+'?mode=ro',uri=True)) as db:
            row=db.execute('SELECT human_id FROM conversation_inputs WHERE id=?',(input_id,)).fetchone()
        self.authorize(actor,frozen)
        if row is None:return {'state':'absent','frozen':frozen}
        if row[0]!=self.provider.human:raise BridgeError('id-reuse','This interaction identity is already in use')
        value=self.provider.conversation_input_status(input_id)
        text=value.get('text')
        if not isinstance(text,str):raise BridgeError('source','The retained original text is unavailable')
        checksum=hashlib.sha256(text.encode()).hexdigest()
        if text_sha256 is not None and checksum!=text_sha256:
            raise BridgeError('id-reuse','Interaction ID already contains another original')
        entry=value.get('entry_binding')
        if not isinstance(entry,list) or len(entry)!=4 or entry[0]!=self.provider.human:
            raise BridgeError('binding','The retained original belongs to another owner')
        # Historical status may remain readable after native rebinding. Its old
        # entry cannot pass the current world-action authorizer or be resubmitted.
        if receipt:=self.attached_machine_source(input_id):
            self.machine_source_capability(actor,frozen)
            proof,selected=self.read_machine_observation(actor,frozen,input_id)
            if proof['receipt']!=receipt:
                raise BridgeError('source','The native original source changed')
        else:
            selected=self.retained_observation(actor,input_id,value)
        frozen={**frozen,'entry':entry}
        native=self.status(actor,frozen,input_id)
        if receipt:self.machine_source_capability(actor,frozen)
        return {'state':'retained','frozen':frozen,'textSha256':checksum,
                'observation':selected,'native':native}

    def retained_observation(self,actor,input_id,value):
        for index,ref in enumerate(value.get('files',[])[:8]):
            if ref.get('name')!='holodeck-situation.json' or ref.get('mime')!='application/json' or ref.get('size',MAX_WIRE)>MAX_SITUATION_SOURCE:continue
            _,data=self.provider.conversation_file_read(input_id,index)
            source=json.loads(data)
            if (source.get('schema')=='holodeck.native-situation-source/v1' and source.get('human_input_id')==input_id
                and source.get('speaker')==actor and isinstance(source.get('observation'),dict)
                and len(bounded_json(source['observation']))<=MAX_OBSERVATION):
                return source['observation']
        raise BridgeError('id-reuse','This original has no retained Holodeck situation source')

    def status(self,actor,frozen,input_id,text_sha256=None,observation_id=None,context_file=None):
        self.authorize(actor,frozen,current=context_file is not None)
        value=self.provider.conversation_input_status(ident(input_id))
        if value.get('id')!=input_id:
            raise BridgeError('source','Native input identity changed')
        if context_file is not None:
            if self.attached_machine_source(input_id):
                raise BridgeError('source','Select the retained machine context for this original')
            if (not isinstance(context_file,dict)
                or set(context_file)!={'file_id','sha256','name','mime','size'}
                or not isinstance(context_file.get('file_id'),str)
                or not isinstance(context_file.get('sha256'),str) or not re.fullmatch('[a-f0-9]{64}',context_file['sha256'])
                or context_file.get('name')!='holodeck-situation.json' or context_file.get('mime')!='application/json'
                or type(context_file.get('size')) is not int or not 0<context_file['size']<=MAX_SITUATION_SOURCE
                or not any(isinstance(candidate,dict) and all(candidate.get(key)==expected
                    for key,expected in context_file.items()) for candidate in value.get('files',[]))):
                raise BridgeError('source','The native original does not retain the prepared context file')
        if text_sha256 is not None and (not isinstance(value.get('text'),str)
            or hashlib.sha256(value['text'].encode()).hexdigest()!=text_sha256):
            raise BridgeError('id-reuse','Native original text does not match the retained app intent')
        if observation_id is not None:
            if self.attached_machine_source(input_id):
                self.machine_source_capability(actor,frozen)
                _,selected=self.read_machine_observation(actor,frozen,input_id)
            else:selected=self.retained_observation(actor,input_id,value)
            if selected.get('id')!=observation_id:
                raise BridgeError('id-reuse','Native situation source does not match the retained app intent')
        result=self.project_status(value,frozen)
        if value.get('phase')=='answered':
            self.authorize(actor,frozen,current=context_file is not None)
            return result
        trace=self.provider.conversation_input_trace(input_id)
        if trace.get('id')!=input_id or trace.get('entry_binding')!=frozen['entry']:
            raise BridgeError('source','Native trace belongs to another original')
        routes=trace.get('routes',[])
        if not isinstance(routes,list) or len(routes)>5:
            raise BridgeError('capacity','Native route observation exceeds its bound')
        if routes:
            # A general-entry acknowledgment is not a routed work result. Read
            # only the owning trace's current, original-associated results.
            original_phase=result['phase'];states=[]
            evidence=[route for route in routes if route.get('active_execution') is not None]
            selected=evidence[0] if len(evidence)==1 else None
            running=routed_execution(selected) if selected is not None else None
            running_state=None
            for route in routes:
                state={'instruction':route.get('instruction'),'phase':'queued'}
                if (route.get('target_available') is not True or route.get('transport_phase') in
                    ('failed','rejected','cancelled','retired','unavailable','known_unsent')):
                    state['phase']='problem';states.append(state);continue
                if route.get('native_acceptance') is True:result['nativeAcceptance']='observed'
                for row in route.get('results',[])[:8]:
                    # `current` covers every instruction of the umbrella
                    # request, not just this situated conversation turn. A
                    # declared reply covering this exact instruction remains
                    # its reply when other context work is still unfinished.
                    if (row.get('instruction_covered') is not True or row.get('declared') is not True
                        or row.get('correction_pending') is not False or not isinstance(row.get('text_excerpt'),str)):
                        continue
                    text=row['text_excerpt']
                    result['updates'].append({'source':row.get('source'),'revision':row.get('revision'),
                        'kind':'answer','text':text,'partial':row.get('text_bounded') is True,
                        'sha256':hashlib.sha256(text.encode()).hexdigest(),
                        'instruction':route.get('instruction'),'observedAt':None,
                        'scope':'situated-instruction','parentRequestCurrent':row.get('current'),
                        'parentRequestCompleted':row.get('completed')})
                    if result['message'] is None:
                        result['message']=text
                    state['phase']='completed'
                    break
                if route is selected and running and state['phase']=='queued':
                    running_state=state
                states.append(state)
            result['routes']=states
            result['tracking']=any(state['phase']=='queued' for state in states)
            if original_phase not in ('problem','unknown'):
                if any(state['phase']=='problem' for state in states):
                    result['phase']='problem'
                elif running_state is not None:
                    running_state['phase']=result['phase']='working'
                    result['activeExecution']=running
                else:
                    result['phase']='queued' if result['tracking'] else 'completed'
            self.authorize(actor,frozen,current=context_file is not None)
            return result
        local=value.get('local_turn')
        if type(local) is not int or local<=0:
            if context_file is not None:self.authorize(actor,frozen,current=True)
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
        self.authorize(actor,frozen,current=context_file is not None)
        if result['phase'] not in ('problem','unknown') and turn and turn['status']=='running' and turn['completed_at'] is None:
            result['phase']='working'
        for row in reversed(rows):
            text=row['text'];kind='answer' if row['phase'] in (None,'final_answer') else 'progress'
            shown=text.encode()[:4096].decode('utf-8',errors='ignore')
            result['updates'].append({'source':'native:'+str(row['rowid']),'kind':kind,
                'text':shown,'partial':len(shown)<len(text),'sha256':hashlib.sha256(text.encode()).hexdigest(),
                'nativeTurn':row['native_turn'],'nativeItem':row['item_id'],'observedAt':row['observed_at']})
            if kind=='answer':
                result['message']=shown
                if result['phase'] not in ('problem','unknown') and turn and turn['completed_at'] is not None:
                    result['phase']='completed'
                    result['tracking']=False
        if (value.get('phase')=='matrix_requested' and result['message'] is None
            and result['phase'] not in ('problem','unknown') and turn and turn['completed_at'] is not None):
            ended=self.ended_execution(actor,frozen,input_id,local)
            if ended:
                # The execution ended; semantic completion and missing reply
                # attribution remain unresolved. Never borrow the unscoped text.
                result.update(phase='problem',tracking=False,execution=ended,
                    message='El turno terminó, pero no pude recuperar aquí su respuesta. Tu mensaje se conserva.')
        if context_file is not None:self.authorize(actor,frozen,current=True)
        return result

    def ended_execution(self,actor,frozen,input_id,local):
        # Read the exact recorded physical boundary through the maintained owner.
        # A final from another publication lifetime never becomes this reply.
        try:
            value=self.provider.presentation('input terminal '+ident(input_id))
        except Exception:return None
        execution=value.get('execution',{})
        if (value.get('schema')!='telecodex.conversation-terminal/v1'
            or value.get('entry_binding')!=frozen['entry'] or value.get('state')!='observed'
            or value.get('terminal') is not True or value.get('status') not in ('completed','failed','interrupted')
            or execution.get('input')!=input_id or execution.get('local_turn')!=local
            or execution.get('native_thread')!=frozen['entry'][3]
            or not isinstance(execution.get('native_turn'),str) or not 1<=len(execution['native_turn'])<=128):return None
        self.authorize(actor,frozen)
        ended={'state':'observed','status':value['status'],'nativeThread':execution['native_thread'],
               'nativeTurn':execution['native_turn'],'replyAssociation':'unavailable'}
        return ended

    def dispatch(self,request):
        if not isinstance(request,dict):raise BridgeError('input','Provide a native bridge request')
        if request.get('operation')=='review-ownership':
            if (set(request)!={'operation','beingRef','pin'} or
                not isinstance(request['beingRef'],str) or
                not re.fullmatch(r'dm:being:v1:[A-Za-z0-9_-]{43}',request['beingRef']) or
                not isinstance(request['pin'],dict)):
                raise BridgeError('identity','Select the verified native being and exact review')
            if self.review_ownership_reader is None:
                raise BridgeError('authority-unavailable','Current review ownership is unavailable')
            owned=self.review_ownership_reader(request['beingRef'],request['pin'])
            if type(owned) is not bool:
                raise BridgeError('authority-unavailable','Current review ownership is unconfirmed')
            return {'schema':'holodeck.review-ownership/v1','beingRef':request['beingRef'],
                    'pin':request['pin'],'owned':owned}
        if request.get('operation')=='world-access':
            if set(request)!={'operation','beingRef'} or not isinstance(request['beingRef'],str) or not re.fullmatch(r'dm:being:v1:[A-Za-z0-9_-]{43}',request['beingRef']):
                raise BridgeError('identity','Select the verified native being')
            if self.world_access_reader is None:raise BridgeError('authority-unavailable','Current world authority is unavailable')
            allowed=self.world_access_reader(request['beingRef'])
            if type(allowed) is not bool:raise BridgeError('authority-unavailable','Current world authority is unconfirmed')
            return {'schema':'holodeck.world-access/v1','beingRef':request['beingRef'],'allowed':allowed}
        op=request.get('operation');actor=request.get('actorRef')
        fields={'inspect':{'operation','actorRef'},'surface':{'operation','actorRef'},'submit':{'operation','actorRef','frozen','input','observation'},
                'prepare-context':{'operation','actorRef','frozen','id','observation'},
                'prepare-machine-context':{'operation','actorRef','frozen','id','observation'},
                'machine-context-status':{'operation','actorRef','frozen','id','observationId','receipt','sourceSha256'},
                'status':{'operation','actorRef','frozen','id','textSha256','observationId'},'lookup':{'operation','actorRef','id','textSha256'}}
        legacy_status=op=='status' and set(request)=={'operation','actorRef','frozen','id'}
        context_status=op=='status' and set(request)==fields['status']|{'contextFile'}
        if op not in fields or set(request)!=fields[op] and not legacy_status and not context_status:raise BridgeError('operation','Unsupported native bridge operation')
        if op=='inspect':return self.inspect(actor)
        if op=='surface':return self.surface(actor)
        if op=='lookup':return self.lookup(actor,request['id'],request['textSha256'])
        if op=='submit':return self.submit(actor,request['frozen'],request['input'],request['observation'])
        if op=='prepare-context':return self.prepare_context(actor,request['frozen'],request['id'],request['observation'])
        if op=='prepare-machine-context':return self.prepare_machine_context(actor,request['frozen'],request['id'],request['observation'])
        if op=='machine-context-status':return self.machine_context_status(actor,request['frozen'],request['id'],
            request['observationId'],request['receipt'],request['sourceSha256'])
        return self.status(actor,request['frozen'],request['id'],request.get('textSha256'),request.get('observationId'),request.get('contextFile'))


def configuration(path):
    file=Path(path);meta=file.lstat()
    if (not stat.S_ISREG(meta.st_mode) or meta.st_uid not in (0,os.getuid()) or meta.st_mode&0o027 or meta.st_size>8192):
        raise ValueError('Owner-controlled native bridge configuration required')
    value=json.loads(file.read_text())
    required={'schema','provider_source','dashboard_config','home_command','socket_path','allowed_uids'}
    world=value.get('world_port')
    if (not required<=set(value) or set(value)-required-{'world_port','world_service_key','review_owner','machine_sources'} or value['schema']!='holodeck.native-bridge/v1'
        or type(value.get('machine_sources',False)) is not bool or value.get('machine_sources') and 'world_service_key' not in value
        or not isinstance(value['allowed_uids'],list) or not 1<=len(value['allowed_uids'])<=8
        or any(type(uid) is not int or uid<0 for uid in value['allowed_uids'])
        or not isinstance(value['home_command'],list) or len(value['home_command'])!=2
        or value['home_command'][1]!='human' or not value['home_command'][0].startswith('/')
        or any(not isinstance(value[k],str) or not value[k].startswith('/') for k in ('provider_source','dashboard_config','socket_path'))):
        raise ValueError('Select fixed receiving native bridge routes')
    if world is not None and (not isinstance(world,dict) or set(world)!={'cli','socket'}
        or any(not isinstance(world[k],str) or not world[k].startswith('/') for k in ('cli','socket'))):
        raise ValueError('Select the installed direct native world port')
    if 'world_service_key' in value and (not isinstance(value['world_service_key'],str)
            or not re.fullmatch('s-[a-f0-9]{24}',value['world_service_key'])):
        raise ValueError('Select the fixed owned world service')
    if 'review_owner' in value:
        review=value['review_owner']
        paths={'nexus_reader','database','publisher','binding'}
        if (not isinstance(review,dict) or not paths|{'beingRef'}<=set(review) or
            set(review)-paths-{'beingRef','use_world_authority'} or
            type(review.get('use_world_authority',False)) is not bool or
            review.get('use_world_authority') and 'world_service_key' not in value or
            not isinstance(review['beingRef'],str) or
            not re.fullmatch(r'dm:being:v1:[A-Za-z0-9_-]{43}',review['beingRef']) or
            any(not isinstance(review[key],str) or not Path(review[key]).is_absolute() for key in paths)):
            raise ValueError('Select a fixed Nexus owner and receiving Home binding')
    return value


def review_reader(selection, service_key=None):
    def load(path,name):
        spec=importlib.util.spec_from_file_location(name,path)
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    nexus=load(selection['nexus_reader'],'selected_nexus_owner_catalog')
    publisher=load(selection['publisher'],'selected_home_owner_publisher')
    delegated=selection.get('use_world_authority',False)
    def read(being,pin):
        if not delegated and being!=selection['beingRef']:
            return False
        binding=publisher.read_binding(selection['binding'])
        def authorize(scope):
            if not delegated:
                return publisher.owner_request(binding,'check-review-ownership',scope)
            [edition]=scope['editions']
            request={'actor_ref':being,'service_key':service_key,**edition}
            proof=publisher.owner_request(binding,'check-holodeck-review-ownership',request)
            if (not isinstance(proof,dict) or type(proof.get('owned')) is not bool or
                    proof!={'schema':'dm.holodeck-review-ownership/v1',**request,'owned':proof['owned']}):
                raise ValueError('Review authority scope changed')
            return {'schema':'dm.review-ownership/v1','actor_ref':being,
                    'owned':[edition] if proof['owned'] else []}
        return nexus.resolve_owned_review(selection['database'],being,authorize,pin) is not None
    return read


def serve(path):
    config=configuration(path)
    sys.path.insert(0,config['provider_source'])
    from dashboard.provider import Provider
    from dashboard.home_auth import HomeAuth
    dashboard_config=tomllib.loads(Path(config['dashboard_config']).read_text())
    provider=Provider(dashboard_config)
    home_auth=HomeAuth(dashboard_config,provider)
    def pair_reader():
        result=subprocess.run(config['home_command'],check=True,capture_output=True,timeout=15)
        if len(result.stdout)>16384:raise ValueError('Pairing reader exceeded its bound')
        return json.loads(result.stdout)
    def world_access_reader(being):
        observed=subprocess.run(config['home_command'][:1]+['service-access','--actor',being,
            '--service-key',config['world_service_key']],check=True,capture_output=True,timeout=15)
        if len(observed.stdout)>4096:raise ValueError('Service decision exceeded its bound')
        result=json.loads(observed.stdout)
        if (not isinstance(result,dict) or result.get('schema')!='dm.home-service-access/v1'
            or result.get('actor_ref')!=being or result.get('service_key')!=config['world_service_key']
            or type(result.get('allowed')) is not bool):raise ValueError('Service decision scope changed')
        return result['allowed']
    bridge=NativeBridge(provider,pair_reader,config.get('world_port'),home_auth=home_auth,
        world_access_reader=world_access_reader if 'world_service_key' in config else None,
        review_ownership_reader=review_reader(config['review_owner'],config.get('world_service_key')) if 'review_owner' in config else None,
        machine_sources=config.get('machine_sources',False))
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
                try:reply={'ok':True,'result':bridge.dispatch(json.loads(raw,object_pairs_hook=unique_json_object))}
                except BridgeError as error:reply={'ok':False,'code':error.code,'message':str(error),'knownNotSubmitted':error.known_not_submitted}
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
