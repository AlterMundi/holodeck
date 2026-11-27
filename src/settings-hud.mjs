import {spatialHudCatalog} from 'proyeccion/spatial-hud';

export const settingsId = 'world-settings';
const path = name => ({'@path': '/' + name});
const text = (id, label, fields = {}) => ({id, component: 'HudText', label, ...fields});
const action = (name, fields = {}) => ({event: {name, context: {scope: path('scope'), ...fields}}});
const button = (id, label, fields = {}) => ({id, component: 'HudButton', label, action: action(id), ...fields});
const choice = (id, label) => ({
  id, component: 'HudChoice', label, options: path(id + 'Options'), value: path(id),
  disabled: path(id + 'Disabled'), draft: path(id + 'Draft'),
  action: action(id, {value: path(id + 'Draft')}),
});
const row = (id, children) => ({id, component: 'HudRow', children});
const panel = (label, children) => [
  {id: 'root', component: 'HudPanel', label, width: 2.12, children: ['heading', ...children]},
  row('heading', ['title', 'close']),
  text('title', label, {style: 'title', weight: 2}),
  button('close', 'Cerrar'),
];
const video = [
  ...panel('Ajustes', ['sound', 'quality', 'sensitivity', 'fullscreen', 'shortcut', 'status']),
  button('sound', path('soundLabel'), {disabled:path('soundDisabled'),pressed:path('soundActive')}),
  choice('quality', 'Gráficos'),
  {id: 'sensitivity', component: 'HudRange', label: 'Sensibilidad (%)', min: 30, max: 240, step: 5,
    value: path('sensitivity'), draft: path('sensitivityDraft'), action: action('sensitivity', {value: path('sensitivityDraft')})},
  button('fullscreen', path('fullscreenLabel'), {disabled: path('fullscreenDisabled'), pressed: path('fullscreenActive')}),
  text('shortcut', 'Ctrl + Alt + F', {visible: path('showShortcut')}),
  text('status', path('status'), {style: 'status', visible: path('hasStatus')}),
];
const appearance = [
  ...panel('Apariencia', ['theme', 'room', 'roomStatus', 'avatar', 'save', 'status']),
  {...choice('theme', 'Tema de la interfaz'), visible: path('themeVisible')},
  {...choice('room', 'Estilo de esta sala · tu vista'), visible: path('roomVisible')},
  text('roomStatus', path('roomStatus'), {style: 'status', visible: path('hasRoomStatus')}),
  choice('avatar', 'Tu avatar'),
  button('save', 'Guardar avatar', {disabled: path('saveDisabled')}),
  text('status', path('status'), {style: 'status', visible: path('hasStatus')}),
];

function options(select, grouped = false) {
  return Array.from(select.options, option => {
    const group = option.parentElement.label;
    return {id: option.value, label: grouped && group ? option.label + ' · ' + group.replace('Presentación ', '') : option.label,
      disabled: option.disabled || option.parentElement.disabled === true};
  });
}

function change(input, value, event) {
  if (input.disabled || input.value === String(value)) return;
  if (input.options && !options(input).some(option => !option.disabled && option.id === value)) return;
  input.value = value;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event(event, {bubbles: true}));
}

// Keep the browser settings adapters as the behavior owners. The visible
// controls use their live state and invoke the same actions and persistence.
export class SettingsHud {
  constructor({document, send, focusControl, focusLauncher, onSurfaceChange,onSound}) {
    Object.assign(this, {send, focusControl, focusLauncher, onSurfaceChange, onSound, scope: 0});
    const find = id => document.getElementById(id);
    this.dialogs = {appearance: find('appearance-dialog'), video: find('video-dialog')};
    this.launchers = {appearance: find('appearance-open'), video: find('video-open')};
    this.theme = find('hud-theme-choice');
    this.room = find('room-style-choice');
    this.roomPanel = find('room-style');
    this.roomStatus = find('room-style-status');
    this.avatar = find('appearance-choice');
    this.save = find('appearance-save');
    this.appearanceStatus = find('appearance-status');
    this.quality = find('video-quality');
    this.sensitivity = find('mouse-sensitivity');
    this.fullscreen = find('video-fullscreen');
    this.sound = find('sound');
    this.videoStatus = find('video-status');
  }

  open(id) {
    if (!Object.hasOwn(this.dialogs, id)) return;
    if (this.dialogs[id].open) { this.close(); return; }
    for (const dialog of Object.values(this.dialogs)) if (dialog.open) dialog.close();
    this.launchers[id].click();
    this.sync();
  }

  sync(restoreFocus = true) {
    const current = Object.keys(this.dialogs).find(id =>
      this.dialogs[id].open && this.dialogs[id].hasAttribute('data-native-settings'));
    const previous = this.current;
    const opened = current !== previous;
    if (opened) {
      if (previous) this.send('deleteSurface', {}, settingsId);
      this.current = current;
      this.group = null;
      this.signature = null;
      this.scope++;
      if (current) {
        this.send('createSurface', {catalogId: spatialHudCatalog.id}, settingsId);
        this.send('updateComponents', {components: current === 'video' ? video : appearance}, settingsId);
      }
    }
    if (!current) {
      if (opened) {
        this.onSurfaceChange();
        if (restoreFocus) this.focusLauncher(previous);
      }
      return;
    }
    const value = {scope: this.scope, ...(current === 'video' ? {
      soundLabel:this.sound.textContent,soundDisabled:this.sound.disabled,soundActive:this.sound.getAttribute('aria-pressed')==='true',
      quality: this.quality.value, qualityOptions: options(this.quality),
      qualityDisabled: this.quality.disabled,
      sensitivity: this.sensitivity.valueAsNumber,
      fullscreenLabel: this.fullscreen.textContent, fullscreenActive: this.fullscreen.getAttribute('aria-pressed') === 'true',
      fullscreenDisabled: this.fullscreen.disabled, showShortcut: !this.fullscreen.disabled,
      status: this.videoStatus.textContent, hasStatus: Boolean(this.videoStatus.textContent),
    } : {
      themeVisible: Boolean(this.theme), theme: this.theme?.value ?? 'dark',
      themeOptions: this.theme ? options(this.theme) : [], themeDisabled: !this.theme || this.theme.disabled,
      avatar: this.avatar.value, avatarOptions: options(this.avatar, true), avatarDisabled: this.avatar.disabled,
      saveDisabled: this.save.disabled, status: this.appearanceStatus.textContent, hasStatus: Boolean(this.appearanceStatus.textContent),
      room: this.room.value, roomOptions: options(this.room), roomDisabled: this.room.disabled,
      roomVisible: !this.roomPanel.hidden, roomStatus: this.roomStatus.textContent,
      hasRoomStatus: !this.roomPanel.hidden && Boolean(this.roomStatus.textContent),
    })};
    const signature = JSON.stringify(value);
    if (this.signature === signature) return;
    this.signature = signature;
    this.send('updateDataModel', {value}, settingsId);
    if (opened) {
      this.onSurfaceChange();
      this.focusControl('close');
    }
  }

  activate({name, context}) {
    const active = this.current;
    if (!active || !this.dialogs[active].open || context?.scope !== this.scope) return;
    if (name === 'close') { this.close(); return; }
    const {value} = context;
    if (active === 'video') {
      if (name === 'sound') this.onSound?.();
      if (name === 'quality') change(this.quality, value, 'change');
      if (name === 'sensitivity' && Number.isFinite(value) && value >= 30 && value <= 240 && value % 5 === 0)
        change(this.sensitivity, value, 'input');
      if (name === 'fullscreen') this.fullscreen.click();
    } else {
      if (name === 'theme' && this.theme) change(this.theme, value, 'change');
      if (name === 'room' && !this.roomPanel.hidden) change(this.room, value, 'change');
      if (name === 'avatar') change(this.avatar, value, 'change');
      if (name === 'save') this.save.click();
    }
    this.sync();
  }

  close(restoreFocus = true) {
    const active = this.current;
    if (!active) return false;
    this.dialogs[active].close();
    this.sync(restoreFocus);
    return true;
  }
}

export function showSettingsDialog(dialog) {
  if (dialog.open) return;
  const native = dialog.ownerDocument.body.hasAttribute('data-native-settings-available');
  dialog.toggleAttribute('data-native-settings', native);
  const sibling = dialog.ownerDocument.querySelector('#appearance-dialog[open],#video-dialog[open]');
  if (sibling !== dialog) sibling?.close();
  if (native) dialog.show();
  else dialog.showModal();
}
