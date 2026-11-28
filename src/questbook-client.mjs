import {OrthographicCamera,Raycaster,Scene,Vector2,WebGLRenderer} from 'three';
import {bindSpatialHudPointer,createSpatialHud,placeHudInViewport} from 'proyeccion/spatial-hud';

export class Questbook {
  constructor(document, api) {
    this.document = document;
    this.api = api;
    this.dialog = document.querySelector('#questbook-dialog');
    this.status = document.querySelector('#questbook-status');
    this.stage = document.querySelector('#questbook-stage');
    this.canvas = this.stage.querySelector('canvas');
    this.back = document.querySelector('#questbook-back');
    this.next = document.querySelector('#questbook-next');
    this.pages = [null];
    this.reading = 0;
    this.mountRevision = 0;

    document.querySelector('#questbook-open').onclick = () => this.open();
    this.dialog.addEventListener('close', () => {
      if (this.dialog.open) return;
      ++this.reading;
      ++this.mountRevision;
      this.unmount();
      if (this.scope) this.data = null;
      this.scope = null;
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

  async read(selected, notice = '') {
    const reading = ++this.reading;
    const query = new URLSearchParams(this.scope ?? {});
    if (selected) query.set('selected',selected);
    const cursor = this.pages.at(-1);
    if (cursor) query.set('after',cursor);
    this.status.textContent = 'Cargando misiones…';
    try {
      const {result} = await this.api('questbook?'+query);
      if (reading !== this.reading || !this.dialog.open) return;
      this.back.hidden = this.pages.length === 1;
      if (!result) {
        this.unmount();
        this.data = null;
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
      await this.hud.receiveBatch(messages);
      if (reading !== this.reading || !this.dialog.open) return;
      this.next.hidden = !value.next;
      this.status.textContent = notice;
      this.draw();
    } catch (error) {
      if (reading !== this.reading || !this.dialog.open) return;
      this.unmount();
      this.data = null;
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
    if (!['claim','done'].includes(event.name) || event.context?.card !== this.data.id
      || event.context.revision !== this.data.revision) return;
    this.saving = true;
    const {card} = event.context;
    const mountRevision = this.mountRevision;
    this.status.textContent = 'Guardando…';
    let notice = '';
    try {
      const {result} = await this.api('questbook/action',{operation:crypto.randomUUID(),card,event,...this.scope});
      if (result.status === 'conflict') notice = 'La misión cambió. Ya podés ver cómo quedó.';
    } catch {
      notice = 'No pude confirmar el cambio. Revisá el estado de la misión.';
    } finally {
      if (this.dialog.open && this.mountRevision === mountRevision) await this.read(card,notice);
      this.saving = false;
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
