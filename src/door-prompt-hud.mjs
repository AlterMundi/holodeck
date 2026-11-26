import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const doorPromptId = 'world-door';
export const doorPromptWidth = 2.38;
const model = key => ({'@path': '/' + key});
export const compactDoorPromptWidth = .52;
export const anchoredDoorPromptWidth = 1.46;
const components = width => [
  {id: 'root', component: 'HudPanel', label: 'Cruzar un paso', width, children: ['cross']},
  {id: 'cross', component: 'HudButton', label: model('label'), disabled: model('busy'),
    action: {event: {name: 'cross', context: {scope: model('scope'), revision: model('revision')}}}},
];

export class DoorPromptHud {
  constructor({adapter, send, read, cross, focusControl, hasFocus, finePointer}) {
    Object.assign(this, {adapter, send, read, cross, focusControl, hasFocus, finePointer});
  }

  update(visible, compact = false, anchor) {
    const current = visible ? this.read() : null;
    this.anchor=current?anchor:null;
    if (!current) {
      this.presented(false);
      if (this.group) this.send('deleteSurface', {}, doorPromptId);
      this.group = null;
      this.signature = null;
      this.compact = null;
      return;
    }
    const oldOffer = this.group && this.revision !== current.revision;
    const restoreFocus = oldOffer && this.hasFocus();
    if (oldOffer) {
      this.send('deleteSurface', {}, doorPromptId);
      this.group = null;
    }
    if (!this.group) {
      this.revision = current.revision;
      this.send('createSurface', {catalogId: spatialHudCatalog.id}, doorPromptId);
      this.compact = null;
    }
    const width = this.anchor ? anchoredDoorPromptWidth : compact ? compactDoorPromptWidth : doorPromptWidth;
    if (this.compact !== compact || this.width !== width) {
      this.compact = compact;
      this.width = width;
      this.send('updateComponents', {components: components(width)}, doorPromptId);
    }
    const shortcut = compact || this.anchor ? ' [E]' : '   [E]';
    const label = current.title + (this.anchor || this.finePointer() ? shortcut : '');
    const value = {label, scope: current.scope, revision: current.revision, busy: current.busy};
    const signature = JSON.stringify(value);
    if (signature !== this.signature) {
      this.signature = signature;
      this.send('updateDataModel', {value}, doorPromptId);
    }
    if (restoreFocus) this.focusControl('cross');
  }

  activate({name, context}) {
    if (!this.group || name !== 'cross') return;
    const current = this.read();
    if (current && !current.busy && context?.scope === current.scope && context.revision === current.revision) {
      this.cross(current.scope, current.revision);
    }
  }

  presented(visible) {
    if (this.adapter.hasAttribute('data-native-door') === visible) return;
    const fallbackFocused = visible && this.adapter === this.adapter.ownerDocument.activeElement;
    const nativeFocused = !visible && this.hasFocus();
    this.adapter.toggleAttribute('data-native-door', visible);
    if (fallbackFocused) this.focusControl('cross');
    if (nativeFocused && this.adapter.getClientRects().length) this.adapter.focus({preventScroll: true});
  }
}
