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
from types import SimpleNamespace

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
        return {**ref,'media':'retained','work_admitted':False}
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
    def test_delegated_review_reader_uses_the_fixed_world_grant(self):
        actor = 'dm:being:v1:' + 'b' * 43
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resolver = root / 'resolver.py'
            resolver.write_text(
                "def resolve_owned_review(database, actor, authorize, pin):\n"
                "    selected={'resource':'a'*32,'version':'b'*64}\n"
                "    return next(iter(authorize({'actor_ref':actor,'editions':[selected]})['owned']),None)\n"
            )
            publisher = root / 'publisher.py'
            publisher.write_text(
                "def read_binding(path): return {'allowed':True,'source':path}\n"
                "def owner_request(binding, op, request):\n"
                "    assert binding['allowed'] and op=='check-holodeck-review-ownership'\n"
                "    assert request['actor_ref']=='dm:being:v1:'+'b'*43\n"
                "    assert request['service_key']=='s-'+'1'*24\n"
                "    return {'schema':'dm.holodeck-review-ownership/v1',**request,'owned':True}\n"
            )
            selection = {'nexus_reader':str(resolver),'publisher':str(publisher),
                         'database':str(root/'db'),'binding':str(root/'configured'),
                         'beingRef':'dm:being:v1:'+'a'*43,'use_world_authority':True}
            assert module.review_reader(selection,'s-'+'1'*24)(actor,{})
            assert not module.review_reader({**selection,'use_world_authority':False})(actor,{})
            with self.assertRaises(AssertionError):
                module.review_reader(selection,'s-'+'2'*24)(actor,{})

    def test_review_ownership_uses_only_the_configured_exact_reader(self):
        being = 'dm:being:v1:' + 'a' * 43
        pin = {'kind':'artifact_review','adapter':'interactive_3d',
               'tableId':'table','reviewId':'review','revision':'edition'}
        request = {'operation':'review-ownership','beingRef':being,'pin':pin}
        with self.assertRaises(module.BridgeError):
            self.bridge.dispatch(request)
        bridge = module.NativeBridge(self.provider,lambda:PAIR,
            review_ownership_reader=lambda owner,selected: owner==being and selected==pin)
        self.assertEqual(bridge.dispatch(request),{
            'schema':'holodeck.review-ownership/v1','beingRef':being,'pin':pin,'owned':True})
        self.assertFalse(bridge.dispatch({**request,'pin':{**pin,'revision':'other'}})['owned'])
        self.assertFalse(bridge.dispatch({**request,'beingRef':'dm:being:v1:'+'b'*43})['owned'])
        with self.assertRaises(module.BridgeError):
            bridge.dispatch({**request,'binding':'caller-selected'})

    def test_shared_surface_uses_only_the_registered_paired_home_entrance(self):
        with self.assertRaises(module.BridgeError):self.bridge.surface(self.actor)
        pair=copy.deepcopy(PAIR);pair['applications']=[{'capability':'interaction','url':'https://fixture.test/interaction/'}]
        home=SimpleNamespace(enabled=True,human_ref=self.actor,origin='https://fixture.test',entry='/interaction/')
        bridge=module.NativeBridge(self.provider,lambda:pair,home_auth=home)
        result=bridge.dispatch({'operation':'surface','actorRef':self.actor})
        self.assertEqual(result['url'],'https://fixture.test/interaction/');self.assertEqual(result['binding'],self.frozen['binding'])
        self.assertNotIn('entry',result);self.assertNotIn('dashboard_config',result)
        pair['applications'][0]['url']='https://other.test/interaction/'
        with self.assertRaises(module.BridgeError):bridge.surface(self.actor)

    def test_shared_context_authority_checks_the_exact_prepared_file_after_canonical_submit(self):
        ident=str(uuid.uuid4());prepared=self.bridge.prepare_context(self.actor,self.frozen,ident,self.observation)
        self.assertEqual(self.provider.inputs,[])
        # This controlled fixture explicitly models Conversation's separate sole
        # original writer. prepare_context itself never submits it.
        self.provider.conversation_input_submit({'id':ident,'text':'Synthetic canonical transcript','files':[prepared['file']]})
        selected=self.bridge.status(self.actor,self.frozen,ident,None,self.observation['id'],prepared['file'])
        self.assertEqual(selected['nativeAcceptance'],'observed')
        for change in ({'sha256':'f'*64},{'size':0},{'mime':'text/plain'},{'file_id':str(uuid.uuid4())}):
            with self.assertRaises(module.BridgeError):self.bridge.status(self.actor,self.frozen,ident,None,self.observation['id'],{**prepared['file'],**change})
        self.assertEqual(len(self.provider.inputs),1)

    def test_context_selected_status_revalidates_binding_after_observation_but_legacy_reads_survive(self):
        ident=str(uuid.uuid4());prepared=self.bridge.prepare_context(self.actor,self.frozen,ident,self.observation)
        self.provider.conversation_input_submit({'id':ident,'text':'Synthetic canonical fixture','files':[prepared['file']]})
        trace=self.provider.conversation_input_trace;presentation=self.provider.presentation
        def rebind(value):
            result=trace(value)
            self.provider.presentation=lambda _:{'binding':'b'*64,'entry_binding':copy.deepcopy(ENTRY)}
            return result
        self.provider.conversation_input_trace=rebind
        with self.assertRaises(module.BridgeError):self.bridge.status(self.actor,self.frozen,ident,None,self.observation['id'],prepared['file'])
        self.provider.presentation=presentation
        # Historical reads keep their preexisting contract: they do not grant
        # current-world authority after a change to the continuing binding.
        self.bridge.status(self.actor,self.frozen,ident,None,self.observation['id'])

    def test_shared_conversation_context_preparation_retains_only_machine_source(self):
        ident=str(uuid.uuid4())
        request={'operation':'prepare-context','actorRef':self.actor,'frozen':self.frozen,
                 'id':ident,'observation':self.observation}
        prepared=self.bridge.dispatch(request)
        self.assertEqual(prepared['schema'],'holodeck.prepared-conversation-context/v1')
        self.assertEqual(prepared['id'],ident);self.assertEqual(prepared['binding'],self.frozen['binding'])
        self.assertFalse(prepared['work_admitted']);self.assertEqual(self.provider.inputs,[])
        source=json.loads(self.provider.uploads[0][0]);self.assertEqual(source['human_input_id'],ident)
        self.assertEqual(source['observation'],self.observation)
        self.assertEqual(source['native_world_interface']['argv_prefix'][-1],ident)
        self.assertEqual(set(source['native_world_interface']['operations']),{'observe','activity','project','act','result'})
        self.assertIn('run/through/before',source['native_world_interface']['operations']['activity'])
        self.assertEqual(source['native_world_interface']['argv_prefix'][:-1],
                         [self.bridge.world_port['cli'],'--socket',self.bridge.world_port['socket'],'--interaction'])
        self.assertNotIn('native_world_interface',prepared,'private native descriptor belongs only in the canonical file')
        repeated=self.bridge.dispatch(request);self.assertEqual(repeated,prepared);self.assertEqual(self.provider.inputs,[])

    def test_generated_topic_context_keeps_the_attachment_without_a_world_action_port(self):
        ident=str(uuid.uuid4())
        observation={**self.observation,'scope':'structured-topic-room','place':{'topic':'a'*64,'title':'Ideas'}}
        result=self.bridge.prepare_context(self.actor,self.frozen,ident,observation)
        self.assertFalse(result['work_admitted'])
        uploaded=json.loads(self.provider.uploads[0][0])
        self.assertEqual(uploaded['observation']['place'],observation['place'])
        self.assertNotIn('native_world_interface',uploaded)
        self.assertEqual(self.provider.inputs,[])

    def test_shared_context_does_not_relabel_a_preexisting_original(self):
        ident=str(uuid.uuid4());self.bridge.submit(self.actor,self.frozen,{'id':ident,'text':'Exact existing fixture'},self.observation)
        before=copy.deepcopy(self.provider.originals[ident]);writes=len(self.provider.uploads)
        self.bridge.prepare_context(self.actor,self.frozen,ident,self.observation)
        self.assertEqual(len(self.provider.uploads),writes)
        changed={**self.observation,'id':str(uuid.uuid4())}
        with self.assertRaises(module.BridgeError):self.bridge.prepare_context(self.actor,self.frozen,ident,changed)
        self.assertEqual(self.provider.originals[ident],before);self.assertEqual(len(self.provider.inputs),1)

    def test_shared_context_refuses_foreign_pair_binding_size_and_changed_ack(self):
        ident=str(uuid.uuid4())
        for actor,frozen,observation in [
            ('human:telegram:other',self.frozen,self.observation),
            (self.actor,{**self.frozen,'binding':'b'*64},self.observation),
            (self.actor,self.frozen,{**self.observation,'observer':'human:telegram:other'}),
            (self.actor,self.frozen,{**self.observation,'oversized':'x'*(module.MAX_OBSERVATION+1)}),
        ]:
            with self.assertRaises(module.BridgeError):self.bridge.prepare_context(actor,frozen,ident,observation)
        self.assertEqual(self.provider.uploads,[]);self.assertEqual(self.provider.inputs,[])
        upload=self.provider.conversation_file_upload
        def changed(data,ref):return {**upload(data,ref),'sha256':'f'*64}
        self.provider.conversation_file_upload=changed
        with self.assertRaises(module.BridgeError):self.bridge.prepare_context(self.actor,self.frozen,ident,self.observation)
        self.assertEqual(self.provider.inputs,[])

    def test_world_authority_query_uses_only_the_configured_current_being_reader(self):
        being='dm:being:v1:'+'a'*43
        request={'operation':'world-access','beingRef':being}
        with self.assertRaises(module.BridgeError):self.bridge.dispatch(request)
        seen=[]
        self.bridge.world_access_reader=lambda actor:seen.append(actor) or True
        self.assertEqual(self.bridge.dispatch(request),{'schema':'holodeck.world-access/v1','beingRef':being,'allowed':True})
        self.assertEqual(seen,[being]);self.assertEqual(self.provider.inputs,[])
        self.bridge.world_access_reader=lambda _:False
        self.assertFalse(self.bridge.dispatch(request)['allowed'])
        self.bridge.world_access_reader=lambda _:'true'
        with self.assertRaises(module.BridgeError):self.bridge.dispatch(request)
        for actor in ('human:telegram:1','unknown','dm:being:v1:a'):
            with self.assertRaises(module.BridgeError):self.bridge.dispatch({**request,'beingRef':actor})

    def test_questbook_authority_binds_project_being_and_requested_mode(self):
        being='dm:being:v1:'+'a'*43
        project=str(uuid.uuid4())
        request={'operation':'questbook-access','beingRef':being,'project':project,'write':True}
        with self.assertRaises(module.BridgeError):
            self.bridge.dispatch(request)
        seen=[]
        self.bridge.questbook_access_reader=lambda *args: seen.append(args) or (True,True)
        self.assertEqual(self.bridge.dispatch(request),{'schema':'holodeck.questbook-access/v1',
            'project':project,'beingRef':being,'requestedWrite':True,'read':True,'write':True})
        for invalid in ({**request,'write':'true'}, {**request,'beingRef':'human:fixture'},
                        {**request,'view_service_key':'caller-selected'}, {**request,'project':'other'}):
            with self.assertRaises((module.BridgeError,ValueError)):
                self.bridge.dispatch(invalid)
        self.assertEqual(seen,[(project,being,True)])
        with self.assertRaises(module.BridgeError):
            self.bridge.dispatch({**request,'write':False})

    def test_topic_room_requires_current_shared_workspace_and_exact_pair(self):
        room='a'*64
        request={'operation':'topic-room','actorRef':self.actor,'room':room}
        calls=[]
        self.provider.topic_rooms=lambda selected: calls.append(selected) or {
            'schema':'daimon.topic-rooms/v1','rooms':[{'room':room,'title':'Ideas','general':False}]}
        with self.assertRaises(module.BridgeError):
            self.bridge.dispatch(request)
        self.assertEqual(calls,[])
        self.bridge.home_workspace=True
        self.assertEqual(self.bridge.dispatch(request)['title'],'Ideas')
        self.assertEqual(calls,[room])
        projects={'repositories':[]}
        self.provider.topic_rooms=lambda selected, *, include_projects: (
            calls.append((selected,include_projects)) or {
            'schema':'daimon.topic-rooms/v1','rooms':[{'room':room,'title':'Ideas','general':False,'projects':projects}]})
        self.assertEqual(self.bridge.dispatch({**request,'projects':True})['projects'],projects)
        self.assertEqual(calls[-1],(room,True))
        with self.assertRaises(module.BridgeError):
            self.bridge.dispatch({**request,'projects':1})
        self.provider.topic_rooms=lambda selected: {
            'schema':'daimon.topic-rooms/v1','rooms':[{'room':room,'title':'Ideas','general':False}]}
        with self.assertRaises(module.BridgeError):
            self.bridge.dispatch({**request,'actorRef':'human:other'})
        with self.assertRaises(module.BridgeError):
            self.bridge.dispatch({**request,'room':'b'*64})
        self.assertEqual(self.provider.inputs,[])

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
    def test_full_bounded_situation_survives_canonical_retention_and_oversize_refuses_before_upload(self):
        observation={**self.observation,'padding':''}
        observation['padding']='x'*(module.MAX_OBSERVATION-len(module.bounded_json(observation)))
        self.assertEqual(len(module.bounded_json(observation)),32768)
        ident=str(uuid.uuid4())
        self.bridge.submit(self.actor,self.frozen,{'id':ident,'text':'Exact full-room fixture'},observation)
        source,ref=self.provider.uploads[0]
        self.assertGreater(len(source),32768)
        self.assertLessEqual(len(source),module.MAX_SITUATION_SOURCE)
        self.assertEqual(ref['size'],len(source))
        self.assertEqual(self.bridge.lookup(self.actor,ident)['observation'],observation)
        oversized={**observation,'padding':observation['padding']+'x'}
        with self.assertRaises(module.BridgeError) as failed:
            self.bridge.submit(self.actor,self.frozen,{'id':str(uuid.uuid4()),'text':'Oversize fixture'},oversized)
        self.assertEqual(failed.exception.code,'context')
        self.assertTrue(failed.exception.known_not_submitted)
        self.assertEqual(len(self.provider.uploads),1)
        self.assertEqual(len(self.provider.inputs),1)

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
    def terminal_fixture(self):
        ident=str(uuid.uuid4());self.provider.phase='matrix_requested'
        self.bridge.submit(self.actor,self.frozen,{'id':ident,'text':'Terminal boundary fixture'},self.observation)
        with sqlite3.connect(self.provider.receiver['db_path']) as db:
            db.execute("UPDATE turns SET status='completed',completed_at='fixture-time'")
            db.execute('INSERT INTO interaction_native_messages VALUES(?,?,?,?,?,?,?,?)',
                ('Unrelated private final MUST NOT LEAK','fixture-native','other-lifetime','unrelated','final_answer','fixture-time',4,None))
        value={'schema':'telecodex.conversation-terminal/v1','entry_binding':copy.deepcopy(ENTRY),
            'state':'observed','terminal':True,'status':'completed',
            'execution':{'input':ident,'local_turn':4,'native_thread':'fixture-native','native_turn':'physical-fixture-turn'}}
        original=self.provider.presentation;calls=[]
        def presentation(command):
            if command.startswith('input terminal '):calls.append(command);return copy.deepcopy(value)
            return original(command)
        self.provider.presentation=presentation
        return ident,value,calls

    def test_observed_execution_end_releases_tracking_without_borrowing_unscoped_final(self):
        ident,value,calls=self.terminal_fixture()
        for status in ('completed','failed','interrupted'):
            with self.subTest(status=status):
                value['status']=status
                result=self.bridge.status(self.actor,self.frozen,ident)
                self.assertEqual(result['phase'],'problem');self.assertFalse(result['tracking'])
                self.assertEqual(result['nativeAcceptance'],'observed');self.assertTrue(result['retainedOriginal'])
                self.assertEqual(result['execution'],{'state':'observed','status':status,'nativeThread':'fixture-native',
                    'nativeTurn':'physical-fixture-turn','replyAssociation':'unavailable'})
                self.assertEqual(result['updates'],[]);self.assertNotIn('MUST NOT LEAK',json.dumps(result))
                self.assertIn('Tu mensaje se conserva',result['message'])
                self.assertEqual(self.provider.conversation_input_status(ident)['phase'],'matrix_requested')
        self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(len(calls),4);self.assertEqual(len(self.provider.inputs),1)

    def test_unknown_or_mismatched_terminal_evidence_keeps_original_tracking(self):
        ident,value,calls=self.terminal_fixture();good=copy.deepcopy(value)
        changes=[{'state':'unknown'},{'status':'inProgress'},{'terminal':False},{'schema':'foreign/v1'},
            {'entry_binding':[*ENTRY[:3],'foreign-native']},{'execution':{}},
            *[{'execution':{**good['execution'],key:wrong}} for key,wrong in
                [('input',str(uuid.uuid4())),('local_turn',5),('native_thread','foreign-native'),('native_turn','')]]]
        for change in changes:
            with self.subTest(change=change):
                value.clear();value.update(copy.deepcopy({**good,**change}))
                result=self.bridge.status(self.actor,self.frozen,ident)
                self.assertTrue(result['tracking']);self.assertNotIn('execution',result)
                self.assertIsNone(result['message']);self.assertEqual(result['updates'],[])
        value.clear();value.update(good)
        with sqlite3.connect(self.provider.receiver['db_path']) as db:
            db.execute("UPDATE turns SET from_user_id=2")
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertTrue(result['tracking']);self.assertEqual(len(calls),len(changes))

    def test_execution_terminal_always_rereads_owner_and_revalidates_current_authority(self):
        ident,value,calls=self.terminal_fixture()
        self.assertFalse(self.bridge.status(self.actor,self.frozen,ident)['tracking'])
        value.update(state='unavailable',terminal=False)
        second=self.bridge.status(self.actor,self.frozen,ident)
        self.assertTrue(second['tracking']);self.assertNotIn('execution',second)
        self.assertEqual(second['phase'],'queued');self.assertIsNone(second['message'])
        self.assertEqual(len(calls),2)
        value.update(state='observed',terminal=True)
        self.assertFalse(self.bridge.status(self.actor,self.frozen,ident)['tracking'])
        self.assertEqual(len(calls),3)
        self.provider.allowed=False
        with self.assertRaises(module.BridgeError):self.bridge.status(self.actor,self.frozen,ident)
        self.provider.allowed=True;original=self.provider.presentation
        def revoke_during_read(command):
            result=original(command)
            if command.startswith('input terminal '):self.provider.allowed=False
            return result
        self.provider.presentation=revoke_during_read
        with self.assertRaises(module.BridgeError):self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(len(calls),4)

    def test_device_or_arbitrary_operation_is_not_available(self):
        with self.assertRaises(module.BridgeError):self.bridge.dispatch({'operation':'exec','actorRef':self.actor,'command':'fixture'})
    def test_general_acknowledgment_does_not_complete_routed_work(self):
        ident=str(uuid.uuid4())
        self.provider.routes=[{'target_available':True,'native_acceptance':True,'instruction':'fixture-instruction','results':[]}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'queued');self.assertIsNone(result['message'])
        self.provider.routes[0]['results']=[{'source':'delivery:fixture','revision':'b'*64,'instruction_covered':True,
            'declared':True,'current':True,'correction_pending':False,'text_excerpt':'Actual routed fixture result','text_bounded':False}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'completed');self.assertEqual(result['message'],'Actual routed fixture result')
    def test_exact_routed_execution_is_working_until_proof_absent_or_result_completed(self):
        original=str(uuid.uuid4());instruction=str(uuid.uuid4())
        proof={'status':'running','instruction':instruction,'local_turn':12}
        route={'instruction':instruction,'target_available':True,'native_acceptance':True,
               'transport_phase':'accepted','results':[]}
        self.provider.routes=[route]
        def status():return self.bridge.status(self.actor,self.frozen,original)
        self.assertEqual(status()['phase'],'queued')
        route['active_execution']={**proof,'native_turn':'private-fixture'}
        active=status()
        self.assertEqual(active['phase'],'working')
        self.assertTrue(active['tracking'])
        self.assertEqual(active['activeExecution'],proof)
        self.assertEqual(active['routes'],[{'instruction':instruction,'phase':'working'}])
        route.pop('active_execution')
        self.assertEqual(status()['phase'],'queued')
        self.assertNotIn('activeExecution',status())
        route['active_execution']=proof
        route['results']=[{'source':'delivery:fixture','revision':'b'*64,'instruction_covered':True,
            'declared':True,'current':True,'correction_pending':False,'text_excerpt':'Routed result'}]
        completed=status()
        self.assertEqual(completed['phase'],'completed')
        self.assertFalse(completed['tracking'])
        self.assertNotIn('activeExecution',completed)

    def test_invalid_routed_execution_cannot_promote_admission_to_working(self):
        original=str(uuid.uuid4());instruction=str(uuid.uuid4())
        proof={'status':'running','instruction':instruction,'local_turn':12}
        route={'instruction':instruction,'target_available':True,'native_acceptance':True,
               'transport_phase':'accepted','active_execution':proof,'results':[]}
        for change in ({'active_execution':None},{'active_execution':'running'},
                       {'active_execution':{**proof,'instruction':str(uuid.uuid4())}},
                       {'active_execution':{**proof,'local_turn':True}},
                       {'active_execution':{**proof,'local_turn':0}},
                       {'active_execution':{**proof,'status':'completed'}},
                       {'instruction':'bad','active_execution':{**proof,'instruction':'bad'}},
                       {'native_acceptance':False},{'transport_phase':'queued'}):
            with self.subTest(change=change):
                self.provider.routes=[{**route,**change}]
                result=self.bridge.status(self.actor,self.frozen,original)
                self.assertEqual(result['phase'],'queued')
                self.assertNotIn('activeExecution',result)
        for change in ({'target_available':False},{'transport_phase':'retired'}):
            with self.subTest(change=change):
                self.provider.routes=[{**route,**change}]
                result=self.bridge.status(self.actor,self.frozen,original)
                self.assertEqual(result['phase'],'problem')
                self.assertNotIn('activeExecution',result)

    def test_routed_working_proof_is_unique_and_preserves_original_problem(self):
        original=str(uuid.uuid4());instruction=str(uuid.uuid4());other=str(uuid.uuid4())
        route={'instruction':instruction,'target_available':True,'native_acceptance':True,
               'transport_phase':'accepted','results':[],
               'active_execution':{'status':'running','instruction':instruction,'local_turn':12}}
        sibling={**route,'instruction':other,'active_execution':None}
        self.provider.routes=[route,sibling]
        def status():return self.bridge.status(self.actor,self.frozen,original)
        self.assertEqual(status()['phase'],'working')
        sibling['active_execution']={'status':'running','instruction':other,'local_turn':13}
        self.assertEqual(status()['phase'],'queued')
        self.assertNotIn('activeExecution',status())
        sibling.pop('active_execution')
        self.provider.phase='failed'
        self.assertEqual(status()['phase'],'problem')
        self.assertNotIn('activeExecution',status())

    def test_situated_reply_settles_without_completing_umbrella_context_work(self):
        ident=str(uuid.uuid4())
        answer={'source':'delivery:covered-fixture','revision':'b'*64,'instruction_covered':True,
            'declared':True,'current':False,'correction_pending':False,'completed':False,
            'text_excerpt':'Reply to this situated instruction; broader work continues.','text_bounded':False}
        sibling={**answer,'source':'delivery:sibling-fixture','instruction_covered':False,
            'completed':True,'text_excerpt':'Later sibling instruction result.'}
        self.provider.routes=[{'instruction':'context-fixture','target_available':True,
            'native_acceptance':True,'results':[sibling,answer]}]
        result=self.bridge.status(self.actor,self.frozen,ident)
        self.assertEqual(result['phase'],'completed');self.assertFalse(result['tracking'])
        self.assertEqual(result['message'],answer['text_excerpt']);self.assertEqual(len(result['updates']),1)
        self.assertIs(result['updates'][0]['parentRequestCurrent'],False)
        self.assertIs(result['updates'][0]['parentRequestCompleted'],False)
        self.assertEqual(result['updates'][0]['scope'],'situated-instruction')
        self.assertEqual(self.provider.inputs,[])
        for change in ({'declared':False},{'declared':False,'current':True},{'instruction_covered':False},{'correction_pending':True}):
            with self.subTest(change=change):
                self.provider.routes[0]['results']=[{**answer,**change}]
                pending=self.bridge.status(self.actor,self.frozen,ident)
                self.assertEqual(pending['phase'],'queued');self.assertTrue(pending['tracking'])
                self.assertEqual(pending['updates'],[])

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
        answer={'source':'delivery:fixture','revision':'b'*64,'instruction_covered':True,'declared':True,'current':True,
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
            'declared':True,'current':True,'correction_pending':False,'text_excerpt':'Actual fixture result','text_bounded':False}]
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
    def test_registered_local_human_uses_the_existing_generic_home_scope_not_native_integer_guessing(self):
        ref='human:local:10000000-0000-4000-8000-000000000002'
        self.provider.config={'application_id':'10000000-0000-4000-8000-000000000003'}
        pair=copy.deepcopy(PAIR);pair['human']['ref']=ref
        pair['applications']=[{'capability':'interaction','url':'https://fixture.dmn.homes/interaction/'}]
        auth=SimpleNamespace(enabled=True,human_ref=ref,origin='https://fixture.dmn.homes',entry='/interaction/')
        bridge=module.NativeBridge(self.provider,lambda:pair,home_auth=auth)
        value=bridge.inspect(ref)
        self.assertEqual(value['actorRef'],ref);self.assertEqual(value['entry'][0],1)
        with self.assertRaises(module.BridgeError):bridge.inspect('human:telegram:1')
        pair['applications'][0]['url']='https://another.dmn.homes/interaction/'
        with self.assertRaises(module.BridgeError):bridge.inspect(ref)
    def test_generic_receiver_without_registered_human_projection_is_not_guessed(self):
        self.provider.config={'application_id':'10000000-0000-4000-8000-000000000003'}
        auth=SimpleNamespace(enabled=True,origin='https://fixture.dmn.homes',entry='/interaction/')
        with self.assertRaises(ValueError):module.NativeBridge(self.provider,lambda:PAIR,home_auth=auth)

if __name__=='__main__':unittest.main()
