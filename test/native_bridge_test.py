"""Controlled bridge contracts only: no real originals, model or device calls."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
import uuid

spec=importlib.util.spec_from_file_location('holodeck_native_bridge',Path(__file__).parents[1]/'integrations/native_bridge.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
PAIR={'schema':'dm.human-endpoint/v1','home_ref':'home:test-fixture','owner_being_ref':'dm:being:v1:test-fixture',
      'human':{'ref':'human:telegram:1','kind':'human','revision':'fixture-revision'}}
ENTRY=[1,{'chat_id':1,'thread_id':2},3,'fixture-native']

class Provider:
    human=1
    def __init__(self,path):self.receiver={'db_path':path};self.allowed=True;self.uploads=[];self.inputs=[];self.input_id=None;self.routes=[];self.originals={};self.phase='accepted';self.entry=copy.deepcopy(ENTRY)
    def authorized(self,human):return self.allowed and human==1
    def presentation(self,command):
        assert command=='input voice native capabilities'
        return {'binding':'a'*64,'entry_binding':copy.deepcopy(ENTRY)}
    def conversation_file_upload(self,data,ref):
        assert hashlib.sha256(data).hexdigest()==ref['sha256'];self.uploads.append((data,ref))
    def conversation_input_submit(self,value):
        self.inputs.append(value);self.input_id=value['id'];self.originals[value['id']]=copy.deepcopy(value)
        with sqlite3.connect(self.receiver['db_path']) as db:db.execute('INSERT OR IGNORE INTO conversation_inputs VALUES(?,?)',(value['id'],1))
        return self.conversation_input_status(value['id'])
    def conversation_input_status(self,ident):return {'id':ident,'phase':self.phase,'native_acceptance':'observed','entry_binding':copy.deepcopy(self.entry),'local_turn':4,
        'text':self.originals.get(ident,{}).get('text','fixture'),'files':self.originals.get(ident,{}).get('files',[])}
    def conversation_input_trace(self,ident):return {'id':ident,'entry_binding':copy.deepcopy(ENTRY),'routes':self.routes}
    def conversation_file_read(self,ident,index):
        ref=self.originals[ident]['files'][index]
        return ref,next(data for data,stored in self.uploads if stored['sha256']==ref['sha256'])

class BridgeContracts(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.provider=Provider(str(Path(self.temp.name)/'fixture.sqlite'))
        db=sqlite3.connect(self.provider.receiver['db_path'])
        db.executescript('''CREATE TABLE sessions(id INTEGER,creator_user_id INTEGER,codex_thread_id TEXT,force_fresh_thread INTEGER);
          CREATE TABLE conversation_inputs(id TEXT PRIMARY KEY,human_id INTEGER);
          CREATE TABLE turns(id INTEGER,status TEXT,completed_at TEXT,session_id INTEGER,from_user_id INTEGER,native_thread_id TEXT);
          CREATE TABLE interaction_native_messages(text TEXT,native_thread TEXT,native_turn TEXT,item_id TEXT,phase TEXT,observed_at TEXT,local_turn INTEGER,presentation_input TEXT);
          INSERT INTO sessions VALUES(3,1,'fixture-native',0);
          INSERT INTO turns VALUES(4,'running',NULL,3,1,'fixture-native');''');db.close()
        self.bridge=module.NativeBridge(self.provider,lambda:copy.deepcopy(PAIR),{'cli':'/installed/holodeck-world','socket':'/run/fixture/world.sock'})
        self.actor=PAIR['human']['ref'];self.frozen=self.bridge.inspect(self.actor)
        self.observation={'schema':'holodeck.situation/v1','id':str(uuid.uuid4()),'run':str(uuid.uuid4()),'observer':self.actor,'source':{'through':2}}
    def test_original_is_unchanged_and_world_facts_are_separate_application_source(self):
        ident=str(uuid.uuid4());text='  Original fixture\ncon espacios.  '
        result=self.bridge.submit(self.actor,self.frozen,{'id':ident,'text':text},self.observation)
        self.assertEqual(result['phase'],'queued');self.assertEqual(self.provider.inputs[0]['text'],text)
        payload=json.loads(self.provider.uploads[0][0]);self.assertEqual(payload['human_input_id'],ident)
        self.assertIn('not human speech',payload['authorship'])
        self.assertEqual(payload['native_world_interface']['argv_prefix'][-1],ident)
    def test_foreign_human_or_changed_native_binding_cannot_submit(self):
        with self.assertRaises(module.BridgeError):self.bridge.inspect('human:telegram:2')
        changed={**self.frozen,'binding':'b'*64}
        with self.assertRaises(module.BridgeError):self.bridge.submit(self.actor,changed,{'id':str(uuid.uuid4()),'text':'fixture'},self.observation)
        self.assertEqual(self.provider.uploads,[])
    def test_status_reads_only_this_originals_native_messages(self):
        ident=str(uuid.uuid4());db=sqlite3.connect(self.provider.receiver['db_path'])
        for original,text in [(ident,'Selected fixture result'),(str(uuid.uuid4()),'Unrelated private fixture')]:
            db.execute('INSERT INTO interaction_native_messages VALUES(?,?,?,?,?,?,?,?)',(text,'fixture-native','fixture-turn','item-'+original,'final_answer','fixture-time',4,original))
        db.execute("UPDATE turns SET status='completed',completed_at='fixture-time'");db.commit();db.close()
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'completed');self.assertEqual(result['message'],'Selected fixture result')
        self.assertEqual(len(result['updates']),1)
    def test_device_or_arbitrary_operation_is_not_available(self):
        with self.assertRaises(module.BridgeError):self.bridge.dispatch({'operation':'exec','actorRef':self.actor,'command':'fixture'})
    def test_general_acknowledgment_does_not_complete_routed_work(self):
        ident=str(uuid.uuid4())
        self.provider.routes=[{'target_available':True,'native_acceptance':True,'instruction':'fixture-instruction','results':[]}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'queued');self.assertIsNone(result['message'])
        self.provider.routes[0]['results']=[{'source':'delivery:fixture','revision':'b'*64,'instruction_covered':True,
            'current':True,'correction_pending':False,'text_excerpt':'Actual routed fixture result','text_bounded':False}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'completed');self.assertEqual(result['message'],'Actual routed fixture result')
    def test_multibyte_native_updates_fit_the_wire_bound(self):
        ident=str(uuid.uuid4());db=sqlite3.connect(self.provider.receiver['db_path'])
        for index in range(8):
            db.execute('INSERT INTO interaction_native_messages VALUES(?,?,?,?,?,?,?,?)',('界'*10000,'fixture-native','fixture-turn',str(index),'commentary','fixture-time',4,ident))
        db.commit();db.close()
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertLess(len(module.bounded_json({'ok':True,'result':result})),module.MAX_WIRE)
        self.assertTrue(all(update['partial'] for update in result['updates']))
    def test_partial_multi_route_results_keep_tracking_until_every_route_is_terminal(self):
        ident=str(uuid.uuid4())
        answer={'source':'delivery:fixture','revision':'b'*64,'instruction_covered':True,'current':True,
                'correction_pending':False,'text_excerpt':'Route A completed fixture','text_bounded':False}
        self.provider.routes=[{'instruction':'a','target_available':True,'native_acceptance':True,'results':[answer]},
            {'instruction':'b','target_available':True,'native_acceptance':True,'results':[]}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'queued');self.assertTrue(result['tracking'])
        self.assertEqual(result['message'],'Route A completed fixture');self.assertEqual(len(result['updates']),1)
        self.provider.routes[1]['results']=[{**answer,'source':'delivery:fixture-b','text_excerpt':'Route B completed fixture'}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'completed');self.assertFalse(result['tracking']);self.assertEqual(len(result['updates']),2)
    def test_native_problem_is_not_overwritten_by_partial_or_completed_route(self):
        ident=str(uuid.uuid4());self.provider.phase='failed'
        self.provider.routes=[{'instruction':'a','target_available':True,'native_acceptance':True,'results':[]}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'problem');self.assertTrue(result['tracking'])
        self.provider.routes[0]['results']=[{'source':'delivery:fixture','revision':'b'*64,'instruction_covered':True,
            'current':True,'correction_pending':False,'text_excerpt':'Actual fixture result','text_bounded':False}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'problem');self.assertFalse(result['tracking'])
    def test_exact_canonical_lookup_restores_original_observation_without_new_submission(self):
        ident=str(uuid.uuid4());checksum=hashlib.sha256(b'  exact fixture  ').hexdigest()
        self.assertEqual(self.bridge.lookup(self.actor,ident,checksum)['state'],'absent')
        self.bridge.submit(self.actor,self.frozen,{'id':ident,'text':'  exact fixture  '},self.observation)
        restored=self.bridge.lookup(self.actor,ident,checksum)
        self.assertEqual(restored['state'],'retained');self.assertEqual(restored['observation'],self.observation)
        self.assertEqual(len(self.provider.inputs),1)
        with self.assertRaises(module.BridgeError):self.bridge.lookup(self.actor,ident,'c'*64)
    def test_binding_error_after_native_write_is_not_claimed_known_unsent(self):
        submit=self.provider.conversation_input_submit
        def changed(value):
            result=submit(value);result['entry_binding']=[*ENTRY[:3],'changed-after-write'];return result
        self.provider.conversation_input_submit=changed
        with self.assertRaises(module.BridgeError) as caught:
            self.bridge.submit(self.actor,self.frozen,{'id':str(uuid.uuid4()),'text':'fixture'},self.observation)
        self.assertFalse(caught.exception.known_not_submitted);self.assertEqual(len(self.provider.inputs),1)
    def test_exact_retry_recovers_native_original_after_installed_tool_descriptor_changes(self):
        ident=str(uuid.uuid4());original={'id':ident,'text':'  original fixture  '}
        self.bridge.submit(self.actor,self.frozen,original,self.observation)
        self.bridge.world_port={'cli':'/new/installed/tool','socket':'/run/new/world.sock'}
        result=self.bridge.submit(self.actor,self.frozen,original,self.observation)
        self.assertEqual(result['phase'],'working');self.assertEqual(len(self.provider.inputs),1)
        self.assertEqual(len(self.provider.uploads),1)
    def test_status_requires_the_original_text_and_observation_pins(self):
        ident=str(uuid.uuid4());text='exact fixture original'
        self.bridge.submit(self.actor,self.frozen,{'id':ident,'text':text},self.observation)
        checksum=hashlib.sha256(text.encode()).hexdigest()
        self.assertEqual(self.bridge.status(self.actor,self.frozen,ident,checksum,self.observation['id'])['phase'],'working')
        with self.assertRaises(module.BridgeError):self.bridge.status(self.actor,self.frozen,ident,'c'*64,self.observation['id'])
        with self.assertRaises(module.BridgeError):self.bridge.status(self.actor,self.frozen,ident,checksum,str(uuid.uuid4()))

if __name__=='__main__':unittest.main()
