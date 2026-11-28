import {OrthographicCamera,Raycaster,Scene,Vector2,WebGLRenderer} from 'three';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport} from 'proyeccion/spatial-hud';
import {loadIntent,saveIntent} from './client-intents.mjs';

const MAX_PENDING_CREATIONS = 8;
const creationKey = ({actorRef,project,scope}) => JSON.stringify([actorRef,project,scope.room,scope.repository]);

export class Questbook {
  constructor(document, api, storageKey) {
    this.document = document;
    this.api = api;
    this.dialog = document.querySelector('#questbook-dialog');
    this.status = document.querySelector('#questbook-status');
    this.stage = document.querySelector('#questbook-stage');
    this.canvas = this.stage.querySelector('canvas');
    this.back = document.querySelector('#questbook-back');
    this.next = document.querySelector('#questbook-next');
    this.createButton = document.querySelector('#questbook-create');
    this.createForm = document.querySelector('#questbook-create-form');
    this.createInput = document.querySelector('#questbook-create-title');
    this.createSave = this.createForm.querySelector('button[type="submit"]');
    this.createCancel = document.querySelector('#questbook-create-cancel');
    this.storageKey = storageKey;
    this.pendingCreations = new Map();
    try {
      const records = loadIntent(sessionStorage,this.storageKey);
      if (Array.isArray(records) && records.length <= MAX_PENDING_CREATIONS) {
        for (const record of records) {
          if (record?.actorRef && record.project && record.scope && record.operation && record.card && record.title) {
            this.pendingCreations.set(creationKey(record),record);
          }
        }
      }
    } catch { /* Unreadable recovery data never triggers a submission. */ }
    this.createButton.onclick = () => this.openCreation();
    this.createCancel.onclick = () => {
      if (this.pendingCreations.has(this.creationScope())) return;
      this.createForm.hidden = true;
      this.createInput.value = '';
    };
    this.createForm.onsubmit = event => {
      event.preventDefault();
      void this.createMission();
    };
    this.titleForm = document.querySelector('#questbook-title-form');
    this.titleInput = document.querySelector('#questbook-title-draft');
    this.titleSave = this.titleForm.querySelector('button[type="submit"]');
    this.titleForm.onsubmit = event => {
      event.preventDefault();
      if (!this.titleEditor || this.titleEditor.card !== this.data?.id || !this.data.canEditTitle) return;
      const title = this.titleInput.value.trim();
      if (!title || new TextEncoder().encode(title).length > 240) {
        this.status.textContent = 'Escribí un título breve para la misión.';
        return;
      }
      void this.dispatch({surfaceId:this.surface,name:'edit_title',context:{
        card:this.data.id,revision:this.data.revision,title,
      }});
    };
    this.titleCancel = document.querySelector('#questbook-title-cancel');
    this.titleCancel.onclick = () => this.closeTitleEdit();
    this.pages = [null];
    this.reading = 0;
    this.mountRevision = 0;

    document.querySelector('#questbook-open').onclick = () => this.open();
    this.dialog.addEventListener('close', () => {
      if (this.dialog.open) return;
      ++this.reading;
      ++this.mountRevision;
      this.unmount();
      this.closeTitleEdit();
      this.createForm.hidden = this.createButton.hidden = true;
      this.createInput.value = '';
      if (this.scope) this.data = null;
      this.scope = null;
      this.creationOwner = null;
    });
    this.back.onclick = () => {
      this.pages.pop();
      void this.read();
    };
    this.next.onclick = () => {
      if (!this.data?.next) return;
      this.pages.push(this.data.next);
      void this.read();
    };
  }

  open(scope = null) {
    if (this.dialog.open) return;
    ++this.mountRevision;
    if (scope || this.scope) {
      this.pages = [null];
      this.data = null;
    }
    this.scope = scope;
    this.creationOwner = null;
    this.createForm.hidden = this.createButton.hidden = true;
    this.dialog.showModal();
    void this.read(this.data?.id);
  }

  closeTopic() {
    if (this.scope && this.dialog.open) this.dialog.close();
  }

  mount() {
    if (this.hud) return;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1,1,1,-1,.1,12);
    this.camera.position.z = 4;
    this.camera.updateMatrixWorld();
    this.hud = createSpatialHud({
      document:this.document, parent:this.scene, accessibilityRoot:this.stage,
      placeSurface:group => { this.group = group; },
      send:({action}) => { if (action) void this.dispatch(action); },
    });
    this.mirror = this.stage.querySelector('[data-spatial-hud-accessibility]');
    try {
      this.renderer = new WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true});
      this.canvas.hidden = false;
      this.canvas.addEventListener('pointerup',this.drawAfterInput,true);
      const ray = new Raycaster(), pointer = new Vector2();
      this.unbind = bindSpatialHudPointer({element:this.canvas,hud:this.hud,rayForPointer:event => {
        const bounds = this.canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        pointer.set(2*(event.clientX-bounds.left)/bounds.width-1,1-2*(event.clientY-bounds.top)/bounds.height);
        ray.setFromCamera(pointer,this.camera);
        return {ray:ray.ray};
      }});
      this.observer = new ResizeObserver(() => this.draw());
      this.observer.observe(this.canvas);
    } catch {
      this.fallback();
    }
    this.canvas.addEventListener('webglcontextlost',this.fallback);
    this.dialog.addEventListener('focusin',this.draw);
  }

  fallback = () => {
    this.canvas.hidden = true;
    this.mirror?.classList.add('questbook-accessible');
  };

  draw = () => {
    if (!this.hud) return;
    this.hud.update();
    if (!this.renderer || !this.group || this.canvas.hidden) return;
    const {width,height} = this.canvas.getBoundingClientRect();
    const bounds = this.hud.getSurfaceBounds(this.surface);
    if (!bounds || !width || !height) return;
    const scale = Math.min((width-12)/(bounds.right-bounds.left),(height-12)/(bounds.top-bounds.bottom),285);
    const density = Math.min(devicePixelRatio,2);
    this.renderer.setPixelRatio(density);
    this.renderer.setSize(width,height,false);
    placeHudInViewport(this.group,this.camera,{width,height,x:width/2,y:6+bounds.top*scale,pixelsPerUnit:scale,depth:1});
    this.hud.setTextDensity(this.surface,{cssPixelsPerUnit:scale,pixelRatio:density,fontSize:16});
    this.hud.update();
    this.renderer.render(this.scene,this.camera);
  };

  drawAfterInput = () => requestAnimationFrame(this.draw);

  unmount() {
    this.observer?.disconnect();
    this.unbind?.();
    this.canvas.removeEventListener('webglcontextlost',this.fallback);
    this.dialog.removeEventListener('focusin',this.draw);
    this.canvas.removeEventListener('pointerup',this.drawAfterInput,true);
    this.renderer?.dispose();
    this.hud?.dispose();
    this.renderer = this.hud = this.group = this.surface = null;
    this.canvas.hidden = true;
  }

  openTitleEdit() {
    if (!this.data?.canEditTitle) return;
    if (this.titleEditor?.card !== this.data.id) {
      this.titleEditor = {card:this.data.id};
      this.titleInput.value = this.data.title;
    }
    this.titleForm.hidden = false;
    this.titleInput.focus();
  }

  closeTitleEdit() {
    this.titleEditor = null;
    this.titleInput.value = '';
    this.titleForm.hidden = true;
  }

  creationScope() {
    return this.creationOwner && creationKey({...this.creationOwner,scope:this.scope ?? {}});
  }

  saveCreations() {
    saveIntent(sessionStorage,this.storageKey,[...this.pendingCreations.values()]);
  }

  showCreationAction() {
    const pending = this.pendingCreations.has(this.creationScope());
    this.createButton.hidden = !this.creationOwner || (!this.canCreate && !pending);
    this.createButton.textContent = pending ? 'Confirmar misión pendiente' : 'Nueva misión';
    this.createSave.textContent = pending ? 'Comprobar misión' : 'Crear misión';
  }

  openCreation() {
    if (this.createButton.hidden) return;
    const pending = this.pendingCreations.get(this.creationScope());
    if (!pending && this.pendingCreations.size >= MAX_PENDING_CREATIONS) {
      this.status.textContent = 'Confirmá una misión pendiente antes de crear otra.';
      return;
    }
    this.createForm.hidden = false;
    this.createInput.value = pending?.title ?? '';
    this.createInput.readOnly = this.createCancel.disabled = !!pending;
    this.createInput.focus();
  }

  async readCreationReceipt({scope,operation,card,title,actorRef,project}) {
    const query = new URLSearchParams({...scope,operation,expectedActor:actorRef,expectedProject:project});
    const {result} = await this.api('questbook/receipt?'+query);
    if (result === null) return false;
    if (result?.command?.operation !== operation || result.command.card !== card || result.command.action?.type !== 'create'
      || result.command.action.title !== title) throw Error('Creation receipt does not match the original');
    return true;
  }

  async createMission() {
    if (!this.dialog.open || this.saving || this.createForm.hidden || this.createButton.hidden) return;
    const key = this.creationScope();
    if (!key) return;
    const pending = this.pendingCreations.get(key);
    const title = pending?.title ?? this.createInput.value.trim();
    if (!title || new TextEncoder().encode(title).length > 240) {
      this.status.textContent = 'Escribí un título breve para la misión.';
      return;
    }
    if (!pending && (!this.canCreate || this.pendingCreations.size >= MAX_PENDING_CREATIONS)) return;
    const intent = pending ?? {...this.creationOwner,scope:{...this.scope},title,
      card:crypto.randomUUID(),operation:crypto.randomUUID()};
    if (!pending) {
      this.pendingCreations.set(key,intent);
      try { this.saveCreations(); }
      catch {
        this.pendingCreations.delete(key);
        this.status.textContent = 'No pude conservar este envío para recuperarlo. La misión no se envió.';
        return;
      }
    }
    const {card,operation,scope,actorRef,project} = intent;
    const mount = this.mountRevision;
    this.saving = this.createSave.disabled = this.createInput.readOnly = this.createCancel.disabled = true;
    this.status.textContent = 'Guardando…';
    let created = false, conflict = false, submitted = false;
    const canCreate = this.canCreate;
    try {
      if (pending) created = await this.readCreationReceipt(intent);
      if (!created && canCreate) {
        submitted = true;
        const {result} = await this.api('questbook/create',{card,operation,title,...scope,expectedActor:actorRef,expectedProject:project});
        created = ['applied','retained'].includes(result.status);
        conflict = result.status === 'conflict';
      }
    } catch {
      if (submitted) {
        try { created = await this.readCreationReceipt(intent); }
        catch { /* Leave the original scoped to this journal. */ }
      }
    } finally {
      this.saving = this.createSave.disabled = false;
    }
    if (created || conflict) {
      this.pendingCreations.delete(key);
      try { this.saveCreations(); }
      catch { /* A retained local copy can only reconcile the same operation. */ }
    }
    if (!this.dialog.open || this.mountRevision !== mount) return;
    this.showCreationAction();
    this.createInput.readOnly = this.createCancel.disabled = this.pendingCreations.has(key);
    if (created) {
      this.createForm.hidden = true;
      this.createInput.value = '';
      this.pages = [null];
      await this.read(card,'Misión creada.');
    } else {
      this.status.textContent = conflict ? 'No se pudo guardar la misión. Podés guardar el borrador de nuevo.'
        : canCreate ? 'Falta confirmar la misión. Podés reintentar el mismo envío.'
          : 'Falta confirmar la misión. Tu acceso actual permite consultar su estado.';
    }
  }

  async read(selected, notice = '') {
    const reading = ++this.reading;
    const query = new URLSearchParams(this.scope ?? {});
    if (selected) query.set('selected',selected);
    const cursor = this.pages.at(-1);
    if (cursor) query.set('after',cursor);
    this.status.textContent = 'Cargando misiones…';
    try {
      const {result,canCreate,actorRef,project} = await this.api('questbook?'+query);
      if (reading !== this.reading || !this.dialog.open) return;
      this.back.hidden = this.pages.length === 1;
      this.creationOwner = actorRef && project ? {actorRef,project} : null;
      this.canCreate = canCreate;
      this.showCreationAction();
      if (this.createButton.hidden) this.createForm.hidden = true;
      if (!result) {
        this.unmount();
        this.data = null;
        this.closeTitleEdit();
        this.next.hidden = true;
        this.status.textContent = cursor ? 'Llegaste al final del diario.' : 'Todavía no hay misiones.';
        return;
      }
      const [create,components,model] = result;
      const {surfaceId,value} = model.updateDataModel;
      this.mount();
      const messages = this.surface === surfaceId ? [components,model] : [create,components,model];
      this.surface = surfaceId;
      this.data = value;
      if (this.titleEditor && (this.titleEditor.card !== value.id || !value.canEditTitle)) {
        this.closeTitleEdit();
      }
      await this.hud.receiveBatch(messages);
      if (reading !== this.reading || !this.dialog.open) return;
      this.next.hidden = !value.next;
      this.status.textContent = notice;
      this.draw();
    } catch (error) {
      if (reading !== this.reading || !this.dialog.open) return;
      this.unmount();
      this.data = null;
      this.closeTitleEdit();
      this.creationOwner = null;
      this.createForm.hidden = this.createButton.hidden = true;
      this.next.hidden = true;
      this.back.hidden = this.pages.length === 1;
      this.status.textContent = error.httpStatus === 403
        ? 'Este diario no está disponible para tu cuenta.'
        : 'No pude cargar las misiones. Cerrá y volvé a abrir el diario.';
    }
  }

  async dispatch(event) {
    if (!this.dialog.open || this.saving || event.surfaceId !== this.surface) return;
    if (event.name === 'select_quest') {
      if (this.data.quests.some(entry => entry.id === event.context?.card)) await this.read(event.context.card);
      return;
    }
    if (!this.data || !['claim','done','edit_title'].includes(event.name) || event.context?.card !== this.data.id
      || event.context.revision !== this.data.revision) return;
    const editingTitle = event.name === 'edit_title';
    if (editingTitle && event.context.title === undefined) {
      this.openTitleEdit();
      return;
    }
    const {card,revision,title} = event.context;
    const editor = this.titleEditor;
    if (editingTitle && (editor?.card !== card || !this.data.canEditTitle)) return;
    this.saving = true;
    this.titleSave.disabled = true;
    if (editingTitle) {
      this.titleInput.disabled = true;
      this.titleCancel.disabled = true;
    }
    let operation;
    if (editingTitle) {
      const prior = editor.pending;
      if (prior?.revision === revision && prior.title === title) {
        operation = prior.operation;
      } else {
        operation = crypto.randomUUID();
        editor.pending = {operation,revision,title};
      }
    } else {
      operation = crypto.randomUUID();
    }
    const mountRevision = this.mountRevision;
    this.status.textContent = 'Guardando…';
    let notice = '';
    try {
      const {result} = await this.api('questbook/action',{operation,card,event,...this.scope});
      if (result.status === 'conflict') {
        if (editingTitle && this.titleEditor === editor) editor.pending = null;
        notice = editingTitle ? 'La misión cambió. Tu borrador sigue disponible.'
          : 'La misión cambió. Ya podés ver cómo quedó.';
      } else if (editingTitle && this.titleEditor === editor) {
        this.closeTitleEdit();
      }
    } catch {
      notice = 'No pude confirmar el cambio. Revisá el estado de la misión.';
    } finally {
      if (this.dialog.open && this.mountRevision === mountRevision) await this.read(card,notice);
      this.saving = false;
      this.titleSave.disabled = false;
      this.titleInput.disabled = false;
      this.titleCancel.disabled = false;
    }
  }

  async bridgeCompleted(command) {
    const card = this.data;
    if (this.scope) return;
    const objective = card?.tracking?.find(item => item.place === 'island-workshop'
      && item.event.type === 'bridge_state' && item.event.raised === command.args.raised);
    if (!objective) return;
    try {
      const {result} = await this.api('questbook/objective',{operation:crypto.randomUUID(),card:card.id,
        revision:card.revision,objective:objective.id,originalCommand:command.id});
      if (result.event && this.data === card) {
        card.tracking = card.tracking.filter(item => item.id !== objective.id);
        card.revision = result.event.card.revision;
      }
    } catch {
      // The original world action remains recorded. Opening the journal reads
      // the confirmed card state without sending another world command.
    }
    if (this.dialog.open && this.data?.id === card.id) await this.read(card.id);
  }
}
