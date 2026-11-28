// The Holodeck host resolves project access and reads the Room's receipts.
// Only the owner-side card writer receives either of those authorities.
import {execFile} from 'node:child_process';
import {isAbsolute,join} from 'node:path';
import {homeIdentityResolver} from './home-identity.mjs';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const commandId = value => typeof value === 'string' && /^[\w-]{8,80}$/.test(value);
const labels = Object.freeze({
  claim: 'Aceptar misión', mark_done: 'Completar misión', open: 'Disponible',
  in_progress: 'En curso', done: 'Completada', assigned: 'Asignada', unassigned: 'Sin asignar',
});

// Use the registered Home audiences selected in receiving configuration.
export function configuredQuestbook(receiving, stateDir) {
  const selected = receiving?.questbook;
  if (selected === undefined) return null;
  if (!selected || !stateDir || Object.keys(selected).sort().join(',') !== 'binary,editEndpoint,project,viewEndpoint') {
    throw Error('Select the existing questbook project audiences and writer');
  }
  const home = {publicOrigin:receiving.origin,authHost:receiving.authHost,identityEndpoint:receiving.authEndpoint};
  const view = homeIdentityResolver({...home,authorizeEndpoint:selected.viewEndpoint});
  const edit = homeIdentityResolver({...home,authorizeEndpoint:selected.editEndpoint});
  return {
    project:selected.project, binary:selected.binary, store:join(stateDir,'questbook.sqlite'),
    async authorize(actor, _project, request, write) {
      if (actor.kind !== 'human' || !request) return null;
      const [reader, editor] = await Promise.all([view(request), write ? edit(request) : null]);
      return {read:reader?.id===actor.id,write:editor?.id===actor.id};
    },
  };
}

export function createQuestbook(room, {project, binary, store, authorize}) {
  if (!uuid(project) || typeof binary !== 'string' || !isAbsolute(binary)
    || typeof store !== 'string' || !isAbsolute(store) || typeof authorize !== 'function') {
    throw Error('Select an owner-bound questbook project and writer');
  }

  const execute = (actor, canWrite, input) => new Promise((resolve, reject) => {
    const child = execFile(binary, [store], {timeout: 7000, maxBuffer: 256 * 1024}, (error, output) => {
      if (error) return reject(Error('Card operation could not be confirmed'));
      try { resolve(JSON.parse(output)); }
      catch { reject(Error('Card writer returned an invalid response')); }
    });
    // A child that exits before accepting input is handled by execFile.
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({project, actor, can_write:canWrite, input}));
  });

  async function access(actor, write, request) {
    if (!actor?.rights?.includes('observe') || !['human','daimon'].includes(actor.kind)) return null;
    const grant = await authorize(actor, project, request, write);
    if (!grant?.read || (write && (!grant.write || !actor.rights.includes('edit')))) return null;
    return {kind:actor.kind, subject:actor.id};
  }

  return {
    async view(actor, {selected = null, after = null}, request) {
      const caller = await access(actor, false, request);
      if (!caller) return {ok:false, code:'access'};
      if ((selected !== null && !uuid(selected)) || (after !== null && !uuid(after))) return {ok:false, code:'invalid'};
      const writer = await access(actor, true, request);
      return execute(caller, !!writer, {type:'mount_questbook', selected, after, labels,
        journal:'Diario de misiones', missions:'Misiones'});
    },

    async action(actor, {operation, card, event}, request) {
      const caller = await access(actor, true, request);
      if (!caller) return {ok:false, code:'access'};
      if (!uuid(operation) || !uuid(card) || event?.surfaceId !== 'questbook-'+project
        || event?.context?.card !== card || !['claim','done'].includes(event?.name)
        || !Number.isSafeInteger(event.context.revision) || event.context.revision < 1) {
        return {ok:false, code:'invalid'};
      }
      return execute(caller, true, {type:'apply_surface', operation, mounted_card:card,
        event:{surfaceId:event.surfaceId, name:event.name, context:{card, revision:event.context.revision}}});
    },

    async confirmObjective(actor, {operation, card, revision, objective, originalCommand}, request) {
      const caller = await access(actor, true, request);
      if (!caller) return {ok:false, code:'access'};
      if (!uuid(operation) || !uuid(card) || !uuid(objective) || !Number.isSafeInteger(revision)
        || revision < 1 || !commandId(originalCommand)) return {ok:false, code:'invalid'};

      const snapshot = await execute(caller, true, {type:'read', card});
      if (!snapshot.ok) return snapshot;
      if (!snapshot.result) return {ok:false, code:'missing'};
      const target = snapshot.result.objectives.find(item => item.objective.id === objective);
      if (!target) return {ok:false, code:'missing'};

      // A prior accepted operation already has its exact Room evidence.
      // Re-read that effect from the card writer even if Room has since reset.
      const prior = target.receipt;
      const receipt = prior?.command === originalCommand && prior.actor === actor.id
        ? prior : room.objectiveReceipt(actor, originalCommand, target.objective);
      if (!receipt) return {ok:false, code:'unresolved'};
      // Recheck current access after the asynchronous card read.
      if (!await access(actor, true, request)) return {ok:false, code:'access'};
      return execute(caller, true, {type:'record_world', command:{operation, card,
        expected_revision:revision, action:{type:'record_world', objective, receipt}}});
    },
  };
}
