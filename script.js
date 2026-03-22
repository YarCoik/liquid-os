/**
 * ═══════════════════════════════════════════════════════════════
 * LiquidOS — script.js  (fixed)
 * Vanilla ES6+ · zero dependencies · type="module" (strict mode)
 * ═══════════════════════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const LS_FS_KEY       = 'liquidOS_vfs';
const LS_SETTINGS_KEY = 'liquidOS_settings';

/* ─────────────────────────────────────────────
   1. VIRTUAL FILE SYSTEM
   Backed by localStorage, tree-shaped object.
───────────────────────────────────────────── */
class FileSystem {
  constructor() { this._load(); }

  _load() {
    const raw = localStorage.getItem(LS_FS_KEY);
    this.tree = raw ? JSON.parse(raw) : this._seed();
    if (!raw) this._save();
  }

  _seed() {
    return {
      '/': {
        type: 'dir',
        children: {
          Home: {
            type: 'dir',
            children: {
              Documents: { type: 'dir', children: {} },
              Pictures:  { type: 'dir', children: {} },
              Downloads: { type: 'dir', children: {} },
              'readme.txt': {
                type: 'file',
                content: 'Welcome to LiquidOS!\n\nThis is your virtual file system.\nFiles persist across page reloads via localStorage.\n\nOpen the Terminal and run: ls\n',
                modified: Date.now()
              }
            }
          },
          System: {
            type: 'dir',
            children: {
              'info.txt': {
                type: 'file',
                content: 'LiquidOS v1.0\nVanilla JS + Liquid Glass CSS\n',
                modified: Date.now()
              }
            }
          }
        }
      }
    };
  }

  _save() { localStorage.setItem(LS_FS_KEY, JSON.stringify(this.tree)); }

  /* Resolve an absolute path to its node */
  _resolve(path) {
    if (!path || path === '/') return this.tree['/'];
    const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
    let node = this.tree['/'];
    for (const p of parts) {
      if (!node || node.type !== 'dir' || !node.children[p]) return null;
      node = node.children[p];
    }
    return node;
  }

  /* Return { parentNode, childName } for a path */
  _parentOf(path) {
    const parts = path.replace(/^\/+/, '').split('/').filter(Boolean);
    const childName = parts.pop();
    const parentPath = parts.length ? '/' + parts.join('/') : '/';
    return { parentNode: this._resolve(parentPath), childName };
  }

  ls(path = '/') {
    const node = this._resolve(path);
    if (!node || node.type !== 'dir') return null;
    return Object.entries(node.children).map(([name, n]) => ({
      name, type: n.type, modified: n.modified || null
    }));
  }

  mkdir(path) {
    const { parentNode, childName } = this._parentOf(path);
    if (!parentNode || parentNode.type !== 'dir' || !childName) return false;
    if (parentNode.children[childName]) return false;
    parentNode.children[childName] = { type: 'dir', children: {} };
    this._save();
    return true;
  }

  writeFile(path, content) {
    const { parentNode, childName } = this._parentOf(path);
    if (!parentNode || parentNode.type !== 'dir' || !childName) return false;
    parentNode.children[childName] = { type: 'file', content, modified: Date.now() };
    this._save();
    return true;
  }

  readFile(path) {
    const node = this._resolve(path);
    return node && node.type === 'file' ? node.content : null;
  }

  remove(path) {
    const { parentNode, childName } = this._parentOf(path);
    if (!parentNode || !parentNode.children[childName]) return false;
    delete parentNode.children[childName];
    this._save();
    return true;
  }

  exists(path) { return this._resolve(path) !== null; }

  type(path) {
    const n = this._resolve(path);
    return n ? n.type : null;
  }

  rename(oldPath, newName) {
    const { parentNode, childName } = this._parentOf(oldPath);
    if (!parentNode || !parentNode.children[childName]) return false;
    parentNode.children[newName] = parentNode.children[childName];
    delete parentNode.children[childName];
    this._save();
    return true;
  }

  reset() { this.tree = this._seed(); this._save(); }
}

/* ─────────────────────────────────────────────
   2. SETTINGS STORE
───────────────────────────────────────────── */
class SettingsStore {
  constructor() {
    const defaults = { theme: 'dark', wallpaper: '0', wallpaperUrl: '' };
    const saved = JSON.parse(localStorage.getItem(LS_SETTINGS_KEY) || '{}');
    this.data = { ...defaults, ...saved };
  }
  get(key) { return this.data[key]; }
  set(key, value) {
    this.data[key] = value;
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(this.data));
  }
}

/* ─────────────────────────────────────────────
   3. WINDOW MANAGER
   FIX: a single pair of global mousemove /
   mouseup listeners replaces per-window ones
   that used to accumulate without cleanup.
───────────────────────────────────────────── */
class WindowManager {
  constructor() {
    this.layer     = document.getElementById('window-layer');
    this.windows   = new Map();   // windowId -> meta
    this._zTop     = 100;
    this._activeId = null;
    this._drag     = null;   // active drag state
    this._resize   = null;   // active resize state
    this._setupGlobalListeners();
  }

  /* ── One global pair handles ALL drags and resizes ── */
  _setupGlobalListeners() {
    document.addEventListener('mousemove', e => {
      this._onDragMove(e);
      this._onResizeMove(e);
    });
    document.addEventListener('mouseup', () => {
      this._drag   = null;
      this._resize = null;
    });
  }

  _startDrag(meta, e) {
    const r = meta.el.getBoundingClientRect();
    this._drag = { meta, ox: e.clientX - r.left, oy: e.clientY - r.top };
  }

  _onDragMove(e) {
    if (!this._drag) return;
    const { meta, oy } = this._drag;
    let ox = this._drag.ox;
    if (meta.maximized) {
      this.toggleMaximize(meta.id);
      ox = this._drag.ox = meta.el.offsetWidth / 2;
    }
    const nx = Math.max(-meta.el.offsetWidth + 60,
      Math.min(e.clientX - ox, window.innerWidth - 60));
    const ny = Math.max(28,
      Math.min(e.clientY - oy, window.innerHeight - 60));
    meta.el.style.left = nx + 'px';
    meta.el.style.top  = ny + 'px';
  }

  _startResize(meta, dir, e) {
    const r = meta.el.getBoundingClientRect();
    this._resize = {
      meta, dir,
      startX: e.clientX, startY: e.clientY,
      startLeft: r.left, startTop: r.top,
      startW: r.width,   startH: r.height
    };
  }

  _onResizeMove(e) {
    if (!this._resize) return;
    const { meta, dir, startX, startY, startLeft, startTop, startW, startH } = this._resize;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let left = startLeft, top = startTop, w = startW, h = startH;

    if (dir.includes('e')) w  = Math.max(320, startW + dx);
    if (dir.includes('s')) h  = Math.max(220, startH + dy);
    if (dir.includes('w')) { w = Math.max(320, startW - dx); left = startLeft + startW - w; }
    if (dir.includes('n')) { h = Math.max(220, startH - dy); top  = startTop  + startH - h; }

    Object.assign(meta.el.style, {
      left: left + 'px', top:    top + 'px',
      width: w + 'px',   height: h   + 'px'
    });
  }

  /* ── Create a new window ── */
  create({ id, title, icon, width, height, x, y, content, appName }) {
    if (this.windows.has(id)) { this.focus(id); return this.windows.get(id).el; }

    const el = document.createElement('div');
    el.className  = 'os-window focused';
    el.dataset.id = id;
    el.style.cssText = `width:${width}px;height:${height}px;` +
                       `left:${x}px;top:${y}px;z-index:${++this._zTop};`;

    el.innerHTML = `
      <div class="window-titlebar">
        <div class="window-controls">
          <button class="wc-btn wc-close" title="Close"></button>
          <button class="wc-btn wc-min"   title="Minimise"></button>
          <button class="wc-btn wc-max"   title="Maximise"></button>
        </div>
        <span class="window-icon">${icon}</span>
        <span class="window-title">${title}</span>
      </div>
      <div class="window-content">${content}</div>
      <div class="resize-handle nw" data-dir="nw"></div>
      <div class="resize-handle n"  data-dir="n"></div>
      <div class="resize-handle ne" data-dir="ne"></div>
      <div class="resize-handle e"  data-dir="e"></div>
      <div class="resize-handle se" data-dir="se"></div>
      <div class="resize-handle s"  data-dir="s"></div>
      <div class="resize-handle sw" data-dir="sw"></div>
      <div class="resize-handle w"  data-dir="w"></div>`;

    this.layer.appendChild(el);

    const meta = { el, id, title, icon, appName, minimized: false, maximized: false, prevRect: null };
    this.windows.set(id, meta);

    this._bindTitlebar(el, meta);
    this._bindControls(el, meta);
    this._bindResizeHandles(el, meta);
    el.addEventListener('mousedown', () => this.focus(id), true);

    this._activeId = id;
    OS.dock.setRunning(appName, true);
    OS.menuBar.setActiveApp(title);
    return el;
  }

  focus(id) {
    if (!this.windows.has(id)) return;
    this.windows.forEach(m => m.el.classList.remove('focused'));
    const meta = this.windows.get(id);
    meta.el.classList.add('focused');
    meta.el.style.zIndex = ++this._zTop;
    this._activeId = id;
    OS.menuBar.setActiveApp(meta.title);
    if (meta.minimized) this._restore(meta);
  }

  close(id) {
    if (!this.windows.has(id)) return;
    const meta = this.windows.get(id);
    const { el, appName } = meta;

    const cleanup = () => {
      if (!document.contains(el)) return; // guard double-call
      el.remove();
      this.windows.delete(id);
      const stillOpen = [...this.windows.values()].some(m => m.appName === appName);
      if (!stillOpen) OS.dock.setRunning(appName, false);
      const rest = [...this.windows.values()]
        .sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex);
      rest.length ? this.focus(rest[0].id) : OS.menuBar.setActiveApp('LiquidOS');
    };

    el.classList.add('closing');
    /* FIX: fallback so cleanup fires even if animationend never triggers */
    const t = setTimeout(cleanup, 400);
    el.addEventListener('animationend', () => { clearTimeout(t); cleanup(); }, { once: true });
  }

  minimize(id) {
    if (!this.windows.has(id)) return;
    const meta = this.windows.get(id);
    if (meta.minimized) { this._restore(meta); return; }

    const hide = () => {
      meta.el.style.display = 'none';
      meta.el.classList.remove('minimizing');
      meta.minimized = true;
      OS.dock.setBounce(meta.appName);
    };

    meta.el.classList.add('minimizing');
    const t = setTimeout(hide, 400);
    meta.el.addEventListener('animationend', () => { clearTimeout(t); hide(); }, { once: true });
  }

  /* FIX: double-rAF ensures the browser has painted before re-adding animation */
  _restore(meta) {
    meta.el.style.display = 'flex';
    meta.minimized = false;
    requestAnimationFrame(() => {
      meta.el.style.animation = 'none';
      requestAnimationFrame(() => {
        meta.el.style.animation = '';
        this.focus(meta.id);
      });
    });
  }

  toggleMaximize(id) {
    if (!this.windows.has(id)) return;
    const meta = this.windows.get(id);
    if (meta.maximized) {
      const r = meta.prevRect;
      meta.el.classList.remove('maximized');
      Object.assign(meta.el.style, {
        left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', height: r.height + 'px'
      });
      meta.maximized = false;
    } else {
      meta.prevRect = {
        left:   parseInt(meta.el.style.left)  || 0,
        top:    parseInt(meta.el.style.top)   || 0,
        width:  meta.el.offsetWidth,
        height: meta.el.offsetHeight
      };
      meta.el.classList.add('maximized');
      meta.maximized = true;
    }
  }

  _bindTitlebar(el, meta) {
    const tb = el.querySelector('.window-titlebar');
    tb.addEventListener('mousedown', e => {
      if (e.target.classList.contains('wc-btn')) return;
      e.preventDefault();
      this.focus(meta.id);
      this._startDrag(meta, e);
    });
    tb.addEventListener('dblclick', e => {
      if (!e.target.classList.contains('wc-btn')) this.toggleMaximize(meta.id);
    });
  }

  _bindControls(el, meta) {
    el.querySelector('.wc-close').onclick = () => this.close(meta.id);
    el.querySelector('.wc-min').onclick   = () => this.minimize(meta.id);
    el.querySelector('.wc-max').onclick   = () => this.toggleMaximize(meta.id);
  }

  _bindResizeHandles(el, meta) {
    el.querySelectorAll('.resize-handle').forEach(h => {
      h.addEventListener('mousedown', e => {
        if (meta.maximized) return;
        e.stopPropagation(); e.preventDefault();
        this.focus(meta.id);
        this._startResize(meta, h.dataset.dir, e);
      });
    });
  }
}

/* ─────────────────────────────────────────────
   4. DOCK
───────────────────────────────────────────── */
class Dock {
  constructor() {
    this.el   = document.getElementById('dock-icons');
    this.apps = [];
  }

  init(apps) {
    this.apps = apps;
    this._render();
    this._bindMagnify();
  }

  _render() {
    this.el.innerHTML = '';
    this.apps.forEach(app => {
      const div = document.createElement('div');
      div.className    = 'dock-icon';
      div.dataset.appId = app.id;
      div.innerHTML = `
        <div class="dock-icon-img ${app.bgClass}">${app.icon}</div>
        <span class="dock-label">${app.name}</span>
        <span class="dock-dot"></span>`;
      div.addEventListener('click', () => OS.launchApp(app.id));
      this.el.appendChild(div);
    });
  }

  setRunning(appId, running) {
    this.el.querySelector(`[data-app-id="${appId}"]`)?.classList.toggle('running', running);
  }

  setBounce(appId) {
    const icon = this.el.querySelector(`[data-app-id="${appId}"]`);
    if (!icon) return;
    icon.classList.remove('launching');
    void icon.offsetWidth; // force reflow to restart animation
    icon.classList.add('launching');
    icon.addEventListener('animationend', () => icon.classList.remove('launching'), { once: true });
  }

  _bindMagnify() {
    this.el.addEventListener('mousemove', e => {
      const icons   = [...this.el.querySelectorAll('.dock-icon')];
      const hovered = e.target.closest('.dock-icon');
      if (!hovered) return;
      const idx = icons.indexOf(hovered);
      icons.forEach((icon, i) => {
        icon.classList.remove('neighbor-1', 'neighbor-2');
        const d = Math.abs(i - idx);
        if (d === 1) icon.classList.add('neighbor-1');
        else if (d === 2) icon.classList.add('neighbor-2');
      });
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.querySelectorAll('.dock-icon')
        .forEach(i => i.classList.remove('neighbor-1', 'neighbor-2'));
    });
  }
}

/* ─────────────────────────────────────────────
   5. MENU BAR
───────────────────────────────────────────── */
class MenuBar {
  constructor() {
    this.timeEl = document.getElementById('menubar-time');
    this.dateEl = document.getElementById('menubar-date');
    this.appEl  = document.getElementById('active-app-name');
    this._tick();
    setInterval(() => this._tick(), 1000);
  }
  _tick() {
    const now = new Date();
    this.timeEl.textContent = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    this.dateEl.textContent = now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  setActiveApp(name) { this.appEl.textContent = name; }
}

/* ─────────────────────────────────────────────
   6. DESKTOP
───────────────────────────────────────────── */
class Desktop {
  constructor() {
    this.el      = document.getElementById('desktop');
    this.iconsEl = document.getElementById('desktop-icons');
    this.rectEl  = document.getElementById('drag-select-rect');
    this._selected = new Set();
  }

  init(apps) {
    this._apps = apps;
    this._renderIcons();
    this._bindDragSelect();
  }

  _renderIcons() {
    this.iconsEl.innerHTML = '';
    this._apps.forEach(app => {
      const div = document.createElement('div');
      div.className    = 'desktop-icon';
      div.dataset.appId = app.id;
      div.innerHTML = `
        <div class="icon-img ${app.bgClass}">${app.icon}</div>
        <span class="icon-label">${app.name}</span>`;
      div.addEventListener('dblclick', () => OS.launchApp(app.id));
      div.addEventListener('click', e => {
        e.stopPropagation();
        if (!e.ctrlKey && !e.metaKey) this._deselectAll();
        div.classList.add('selected');
        this._selected.add(app.id);
      });
      this.iconsEl.appendChild(div);
    });
  }

  applyWallpaper(settings) {
    const gradients = [
      'radial-gradient(ellipse at 20% 20%, #1a1f3a 0%, #0b0d14 100%)',
      'radial-gradient(ellipse at 80% 20%, #0d1b2a 0%, #1b4332 100%)',
      'radial-gradient(ellipse at 50% 80%, #2d1b69 0%, #11001c 100%)',
      'radial-gradient(ellipse at 30% 60%, #1a0533 0%, #0b0d14 100%)',
    ];
    if (settings.wallpaper === 'custom' && settings.wallpaperUrl) {
      this.el.style.background = `url(${settings.wallpaperUrl}) center/cover no-repeat`;
    } else {
      const idx = parseInt(settings.wallpaper) || 0;
      this.el.style.background = gradients[Math.min(idx, gradients.length - 1)];
    }
  }

  _deselectAll() {
    this.iconsEl.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    this._selected.clear();
  }

  _bindDragSelect() {
    let active = false, sx = 0, sy = 0;

    this.el.addEventListener('mousedown', e => {
      if (e.target !== this.el && e.target !== this.iconsEl) return;
      active = true; sx = e.clientX; sy = e.clientY;
      this._deselectAll();
    });
    document.addEventListener('mousemove', e => {
      if (!active) return;
      this._drawRect(sx, sy, e.clientX, e.clientY);
      this._hitTest(sx, sy, e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', () => {
      if (!active) return;
      active = false;
      this.rectEl.style.display = 'none';
    });
    this.el.addEventListener('click', e => {
      if (e.target === this.el || e.target === this.iconsEl) this._deselectAll();
    });
  }

  _drawRect(x1, y1, x2, y2) {
    const dr = this.el.getBoundingClientRect();
    this.rectEl.style.cssText = `display:block;` +
      `left:${Math.min(x1, x2) - dr.left}px;top:${Math.min(y1, y2) - dr.top}px;` +
      `width:${Math.abs(x2 - x1)}px;height:${Math.abs(y2 - y1)}px;`;
  }

  _hitTest(x1, y1, x2, y2) {
    const sel = { left: Math.min(x1,x2), top: Math.min(y1,y2),
                  right: Math.max(x1,x2), bottom: Math.max(y1,y2) };
    this.iconsEl.querySelectorAll('.desktop-icon').forEach(icon => {
      const r = icon.getBoundingClientRect();
      icon.classList.toggle('selected',
        r.left < sel.right && r.right > sel.left &&
        r.top  < sel.bottom && r.bottom > sel.top);
    });
  }
}

/* ─────────────────────────────────────────────
   7. CONTEXT MENU
   FIX: position off-screen first, measure,
   then clamp and reveal.
───────────────────────────────────────────── */
class ContextMenu {
  constructor() {
    this.el   = document.getElementById('context-menu');
    this.list = document.getElementById('context-menu-list');
    document.addEventListener('click',       () => this.hide());
    document.addEventListener('contextmenu', e  => e.preventDefault());
  }

  show(x, y, items) {
    this.list.innerHTML = '';
    items.forEach(item => {
      if (item.separator) {
        const li = document.createElement('li');
        li.className = 'separator';
        this.list.appendChild(li);
        return;
      }
      const li = document.createElement('li');
      li.innerHTML = `<span>${item.icon || ''}</span><span>${item.label}</span>`;
      li.addEventListener('click', e => { e.stopPropagation(); item.action?.(); this.hide(); });
      this.list.appendChild(li);
    });

    /* FIX: place off-screen, show, measure, then clamp */
    this.el.style.left = '-9999px';
    this.el.style.top  = '-9999px';
    this.el.classList.remove('hidden');

    const vw = window.innerWidth, vh = window.innerHeight;
    const w  = this.el.offsetWidth, h = this.el.offsetHeight;
    this.el.style.left = Math.min(x, vw - w - 8) + 'px';
    this.el.style.top  = Math.min(y, vh - h - 8) + 'px';
  }

  hide() { this.el.classList.add('hidden'); }
}

/* ─────────────────────────────────────────────
   8. NOTIFICATIONS
───────────────────────────────────────────── */
class NotificationSystem {
  constructor() { this.container = document.getElementById('notification-container'); }

  show(title, body, duration = 3500) {
    const el = document.createElement('div');
    el.className = 'notification';
    el.innerHTML = `
      <div class="notification-title">${title}</div>
      <div class="notification-body">${body}</div>`;
    this.container.appendChild(el);

    const dismiss = () => {
      el.classList.add('hiding');
      const t = setTimeout(() => el.remove(), 350);
      el.addEventListener('animationend', () => { clearTimeout(t); el.remove(); }, { once: true });
    };
    setTimeout(dismiss, duration);
    el.addEventListener('click', dismiss);
  }
}

/* ─────────────────────────────────────────────
   9. APPLICATION BASE CLASS
───────────────────────────────────────────── */
class Application {
  constructor(cfg) { Object.assign(this, cfg); }

  buildContent() { return '<div style="padding:20px">No content</div>'; }
  onMount(/* windowEl */) {}

  /** Replace __ID__ placeholders with the real window id */
  _resolveIds(windowEl) {
    const uid = windowEl.dataset.id;
    windowEl.querySelectorAll('[id*="__ID__"]').forEach(el => {
      el.id = el.id.replace(/__ID__/g, uid);
    });
    return uid;
  }

  open() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w  = this.width  || 640;
    const h  = this.height || 420;
    const x  = Math.max(40, (vw - w) / 2 + (Math.random() * 60 - 30));
    const y  = Math.max(36, (vh - h) / 2 + (Math.random() * 40 - 20));

    OS.dock.setBounce(this.id);
    const el = OS.wm.create({
      id: this.id + '-' + Date.now(),
      title: this.name, icon: this.icon,
      width: w, height: h, x, y,
      content: this.buildContent(),
      appName: this.id
    });
    this.onMount(el);
    return el;
  }
}

/* ─────────────────────────────────────────────
   10. TERMINAL
   FIX: every switch case that declares `const`
   is wrapped in its own `{ }` block.
───────────────────────────────────────────── */
class TerminalApp extends Application {
  constructor() {
    super({ id: 'terminal', name: 'Terminal', icon: '>_',
            bgClass: 'icon-bg-terminal', width: 660, height: 420 });
    this.cwd = '/Home';
  }

  buildContent() {
    return `
      <div class="terminal-app">
        <div class="terminal-output" id="term-output-__ID__"></div>
        <div class="terminal-input-row">
          <span class="terminal-prompt" id="term-prompt-__ID__">user@liquidOS:~$</span>
          <input class="terminal-input" id="term-input-__ID__"
                 type="text" autocomplete="off" spellcheck="false" />
        </div>
      </div>`;
  }

  onMount(windowEl) {
    const uid      = this._resolveIds(windowEl);
    const outputEl = windowEl.querySelector(`#term-output-${uid}`);
    const inputEl  = windowEl.querySelector(`#term-input-${uid}`);
    const promptEl = windowEl.querySelector(`#term-prompt-${uid}`);

    const cmdHistory = [];
    let histIdx = -1;

    const print = (text, cls = '') => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = text;
      outputEl.appendChild(d);
      outputEl.scrollTop = outputEl.scrollHeight;
    };
    const printHTML = html => {
      const d = document.createElement('div');
      d.innerHTML = html;
      outputEl.appendChild(d);
      outputEl.scrollTop = outputEl.scrollHeight;
    };

    printHTML(`<span class="t-info">╔══════════════════════════════════╗</span>`);
    printHTML(`<span class="t-info">║   LiquidOS Terminal  v1.0        ║</span>`);
    printHTML(`<span class="t-info">╚══════════════════════════════════╝</span>`);
    print('Type "help" for available commands.', 't-sys');
    print('');

    const updatePrompt = () => {
      const d = this.cwd === '/'
        ? '/'
        : (this.cwd.startsWith('/Home') ? this.cwd.replace('/Home', '~') : this.cwd);
      promptEl.textContent = `user@liquidOS:${d}$`;
    };
    updatePrompt();

    const exec = raw => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      cmdHistory.unshift(trimmed);
      histIdx = -1;

      printHTML(
        `<span class="t-path">${promptEl.textContent}</span> ` +
        `<span class="t-cmd">${this._esc(trimmed)}</span>`
      );

      const [cmd, ...args] = trimmed.split(/\s+/);

      switch (cmd) {
        case 'help': {
          /* FIX: const inside its own block scope */
          const cmds = ['help','echo','clear','date','pwd','ls','mkdir',
                        'cd','rm','touch','cat','whoami'];
          print('Available commands:', 't-info');
          print('  ' + cmds.join('  '));
          break;
        }
        case 'echo':
          print(args.join(' '));
          break;
        case 'clear':
          outputEl.innerHTML = '';
          break;
        case 'date':
          print(new Date().toString());
          break;
        case 'pwd':
          print(this.cwd);
          break;
        case 'whoami':
          print('user');
          break;
        case 'ls': {
          const target  = args[0] ? this._abs(args[0]) : this.cwd;
          const entries = OS.fs.ls(target);
          if (!entries) { print(`ls: ${target}: No such directory`, 't-err'); break; }
          if (!entries.length) { print('(empty)', 't-sys'); break; }
          entries.forEach(e =>
            print(`${e.type === 'dir' ? '📁' : '📄'}  ${e.name}${e.type === 'dir' ? '/' : ''}`)
          );
          break;
        }
        case 'cd': {
          if (!args[0] || args[0] === '~') { this.cwd = '/Home'; updatePrompt(); break; }
          if (args[0] === '..') {
            const parts = this.cwd.split('/').filter(Boolean);
            parts.pop();
            this.cwd = parts.length ? '/' + parts.join('/') : '/';
            updatePrompt(); break;
          }
          const dest = this._abs(args[0]);
          if (OS.fs.type(dest) !== 'dir') {
            print(`cd: ${args[0]}: No such directory`, 't-err'); break;
          }
          this.cwd = dest;
          updatePrompt();
          break;
        }
        case 'mkdir': {
          if (!args[0]) { print('mkdir: missing operand', 't-err'); break; }
          const p = this._abs(args[0]);
          if (!OS.fs.mkdir(p)) { print(`mkdir: cannot create '${args[0]}'`, 't-err'); break; }
          print(`Created directory: ${args[0]}`, 't-info');
          break;
        }
        case 'rm': {
          if (!args[0]) { print('rm: missing operand', 't-err'); break; }
          if (!OS.fs.remove(this._abs(args[0]))) {
            print(`rm: cannot remove '${args[0]}'`, 't-err'); break;
          }
          print(`Removed: ${args[0]}`, 't-info');
          break;
        }
        case 'touch': {
          if (!args[0]) { print('touch: missing operand', 't-err'); break; }
          OS.fs.writeFile(this._abs(args[0]), '');
          print(`Created: ${args[0]}`, 't-info');
          break;
        }
        case 'cat': {
          if (!args[0]) { print('cat: missing operand', 't-err'); break; }
          const content = OS.fs.readFile(this._abs(args[0]));
          if (content === null) { print(`cat: ${args[0]}: No such file`, 't-err'); break; }
          content.split('\n').forEach(l => print(l));
          break;
        }
        default:
          print(`bash: ${cmd}: command not found`, 't-err');
      }
      print('');
    };

    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        exec(inputEl.value);
        inputEl.value = '';
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        histIdx = Math.min(histIdx + 1, cmdHistory.length - 1);
        inputEl.value = cmdHistory[histIdx] ?? '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        histIdx = Math.max(histIdx - 1, -1);
        inputEl.value = histIdx === -1 ? '' : cmdHistory[histIdx];
      }
    });

    windowEl.querySelector('.terminal-app').addEventListener('click', () => inputEl.focus());
    inputEl.focus();
  }

  _abs(p) { return p.startsWith('/') ? p : (this.cwd === '/' ? '' : this.cwd) + '/' + p; }
  _esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}

/* ─────────────────────────────────────────────
   11. FILE EXPLORER
   FIX: navigate() now pushes correctly into
   the history stack so Back works.
───────────────────────────────────────────── */
class FileExplorerApp extends Application {
  constructor() {
    super({ id: 'files', name: 'Files', icon: '📁',
            bgClass: 'icon-bg-files', width: 700, height: 460 });
  }

  buildContent() {
    return `
      <div class="fileexplorer-app">
        <div class="fe-toolbar">
          <button id="fe-back-__ID__">‹ Back</button>
          <button id="fe-up-__ID__">↑ Up</button>
          <span class="fe-path-bar" id="fe-path-__ID__">/Home</span>
          <button id="fe-new-folder-__ID__">+ Folder</button>
          <button id="fe-new-file-__ID__">+ File</button>
          <button id="fe-delete-__ID__" style="color:#ff6b6b">Delete</button>
        </div>
        <div class="fe-body">
          <nav class="fe-sidebar" id="fe-sidebar-__ID__">
            <div class="fe-sidebar-item" data-path="/Home">🏠 Home</div>
            <div class="fe-sidebar-item" data-path="/Home/Documents">📄 Docs</div>
            <div class="fe-sidebar-item" data-path="/Home/Pictures">🖼️ Pictures</div>
            <div class="fe-sidebar-item" data-path="/Home/Downloads">⬇️ Downloads</div>
            <div class="fe-sidebar-item" data-path="/System">⚙️ System</div>
          </nav>
          <div class="fe-content" id="fe-content-__ID__"></div>
        </div>
        <div class="fe-status-bar" id="fe-status-__ID__">0 items</div>
      </div>`;
  }

  onMount(windowEl) {
    const uid       = this._resolveIds(windowEl);
    const pathBar   = windowEl.querySelector(`#fe-path-${uid}`);
    const contentEl = windowEl.querySelector(`#fe-content-${uid}`);
    const statusEl  = windowEl.querySelector(`#fe-status-${uid}`);
    const sidebarEl = windowEl.querySelector(`#fe-sidebar-${uid}`);

    /* FIX: proper navigation history */
    const stack = ['/Home'];
    let stackIdx     = 0;
    let cwd          = '/Home';
    let selectedName = null;

    const render = path => {
      cwd = path;
      pathBar.textContent = path;
      selectedName = null;
      contentEl.innerHTML = '';

      const entries = OS.fs.ls(path) || [];
      statusEl.textContent = `${entries.length} item${entries.length !== 1 ? 's' : ''}`;

      entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'fe-item';
        const icon = entry.type === 'dir' ? '📁' : this._fileIcon(entry.name);
        div.innerHTML = `<div class="fe-icon">${icon}</div><div class="fe-name">${entry.name}</div>`;

        div.addEventListener('click', () => {
          contentEl.querySelectorAll('.fe-item').forEach(i => i.classList.remove('selected'));
          div.classList.add('selected');
          selectedName = entry.name;
        });

        div.addEventListener('dblclick', () => {
          if (entry.type === 'dir') {
            const next = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
            navigate(next);
          } else {
            const fullPath = `${path}/${entry.name}`;
            const content  = OS.fs.readFile(fullPath) ?? '';
            const editorApp = OS.apps.find(a => a.id === 'editor');
            if (!editorApp) return;
            const existing = [...OS.wm.windows.values()].find(m => m.appName === 'editor');
            if (existing) {
              OS.wm.focus(existing.id);
              editorApp._loadFile(existing.id, fullPath, content);
            } else {
              const win = editorApp.open();
              editorApp._loadFile(win.dataset.id, fullPath, content);
            }
          }
        });

        contentEl.appendChild(div);
      });

      sidebarEl.querySelectorAll('.fe-sidebar-item').forEach(item => {
        item.classList.toggle('active', item.dataset.path === path);
      });
    };

    /* FIX: push new path, truncate forward history */
    const navigate = path => {
      if (!path) path = '/';
      if (path === cwd) return;
      stack.splice(stackIdx + 1);
      stack.push(path);
      stackIdx = stack.length - 1;
      render(path);
    };

    windowEl.querySelector(`#fe-back-${uid}`).addEventListener('click', () => {
      if (stackIdx > 0) render(stack[--stackIdx]);
    });
    windowEl.querySelector(`#fe-up-${uid}`).addEventListener('click', () => {
      const parts = cwd.split('/').filter(Boolean);
      parts.pop();
      navigate(parts.length ? '/' + parts.join('/') : '/');
    });
    windowEl.querySelector(`#fe-new-folder-${uid}`).addEventListener('click', () => {
      const name = prompt('Folder name:');
      if (!name) return;
      OS.fs.mkdir(`${cwd}/${name}`);
      render(cwd);
      OS.notifications.show('Files', `Folder "${name}" created`);
    });
    windowEl.querySelector(`#fe-new-file-${uid}`).addEventListener('click', () => {
      const name = prompt('File name:');
      if (!name) return;
      OS.fs.writeFile(`${cwd}/${name}`, '');
      render(cwd);
    });
    windowEl.querySelector(`#fe-delete-${uid}`).addEventListener('click', () => {
      if (!selectedName) return;
      if (!confirm(`Delete "${selectedName}"?`)) return;
      OS.fs.remove(`${cwd}/${selectedName}`);
      render(cwd);
    });

    sidebarEl.querySelectorAll('.fe-sidebar-item').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.path));
    });

    render('/Home');
  }

  _fileIcon(name) {
    if (/\.(txt|md|log|json|yaml|yml)$/i.test(name)) return '📄';
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name))  return '🖼️';
    if (/\.(js|ts|jsx|tsx|html|css)$/i.test(name))     return '📜';
    return '📄';
  }
}

/* ─────────────────────────────────────────────
   12. TEXT EDITOR
───────────────────────────────────────────── */
class TextEditorApp extends Application {
  constructor() {
    super({ id: 'editor', name: 'Text Editor', icon: '✏️',
            bgClass: 'icon-bg-editor', width: 680, height: 480 });
    this._instances = new Map(); // windowId -> { path }
  }

  buildContent() {
    return `
      <div class="texteditor-app">
        <div class="te-toolbar">
          <button id="te-new-__ID__">New</button>
          <button id="te-save-__ID__">💾 Save</button>
          <button id="te-saveas-__ID__">Save As…</button>
          <input class="te-filename" id="te-filename-__ID__"
                 type="text" placeholder="untitled.txt" value="untitled.txt" />
        </div>
        <textarea class="te-textarea" id="te-textarea-__ID__"
                  placeholder="Start typing…" spellcheck="false"></textarea>
        <div class="te-statusbar">
          <span id="te-lines-__ID__">Lines: 1</span>
          <span id="te-chars-__ID__">Chars: 0</span>
          <span id="te-cur-__ID__">Ln 1, Col 1</span>
        </div>
      </div>`;
  }

  onMount(windowEl) {
    const uid       = this._resolveIds(windowEl);
    const textarea  = windowEl.querySelector(`#te-textarea-${uid}`);
    const filename  = windowEl.querySelector(`#te-filename-${uid}`);
    const statLines = windowEl.querySelector(`#te-lines-${uid}`);
    const statChars = windowEl.querySelector(`#te-chars-${uid}`);
    const statCur   = windowEl.querySelector(`#te-cur-${uid}`);

    this._instances.set(uid, { path: null });

    const updateStats = () => {
      const v = textarea.value;
      statLines.textContent = `Lines: ${v.split('\n').length}`;
      statChars.textContent = `Chars: ${v.length}`;
    };
    const updateCursor = () => {
      const before = textarea.value.substr(0, textarea.selectionStart).split('\n');
      statCur.textContent = `Ln ${before.length}, Col ${before[before.length - 1].length + 1}`;
    };

    textarea.addEventListener('input', updateStats);
    textarea.addEventListener('keyup',  updateCursor);
    textarea.addEventListener('click',  updateCursor);

    const save = () => {
      const name = filename.value.trim() || 'untitled.txt';
      const inst  = this._instances.get(uid);
      if (!inst.path) inst.path = `/Home/${name}`;
      OS.fs.writeFile(inst.path, textarea.value);
      OS.notifications.show('Text Editor', `Saved: ${name}`);
    };

    const saveAs = () => {
      const name = prompt('Save as:', filename.value || 'untitled.txt');
      if (!name) return;
      filename.value = name;
      const inst = this._instances.get(uid);
      inst.path = `/Home/${name}`;
      OS.fs.writeFile(inst.path, textarea.value);
      OS.notifications.show('Text Editor', `Saved: ${name}`);
    };

    windowEl.querySelector(`#te-new-${uid}`).addEventListener('click', () => {
      textarea.value = ''; filename.value = 'untitled.txt';
      this._instances.get(uid).path = null;
      updateStats();
    });
    windowEl.querySelector(`#te-save-${uid}`).addEventListener('click', save);
    windowEl.querySelector(`#te-saveas-${uid}`).addEventListener('click', saveAs);
    windowEl.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
    });

    textarea.focus();
    updateStats();

    /* Clean up instance map when window is removed */
    new MutationObserver(() => {
      if (!document.contains(windowEl)) {
        this._instances.delete(uid);
      }
    }).observe(document.getElementById('window-layer'), { childList: true });
  }

  _loadFile(uid, path, content) {
    const textarea = document.querySelector(`#te-textarea-${uid}`);
    const filename = document.querySelector(`#te-filename-${uid}`);
    if (!textarea || !filename) return;
    textarea.value = content ?? '';
    filename.value = path.split('/').pop();
    const inst = this._instances.get(uid);
    if (inst) inst.path = path;
    textarea.dispatchEvent(new Event('input'));
  }
}

/* ─────────────────────────────────────────────
   13. SETTINGS
───────────────────────────────────────────── */
class SettingsApp extends Application {
  constructor() {
    super({ id: 'settings', name: 'Settings', icon: '⚙️',
            bgClass: 'icon-bg-settings', width: 580, height: 420 });
  }

  buildContent() {
    const gradients = [
      'background:radial-gradient(ellipse at 20% 20%, #1a1f3a, #0b0d14)',
      'background:radial-gradient(ellipse at 80% 20%, #0d1b2a, #1b4332)',
      'background:radial-gradient(ellipse at 50% 80%, #2d1b69, #11001c)',
      'background:radial-gradient(ellipse at 30% 60%, #1a0533, #0b0d14)',
    ];
    const thumbs = gradients.map((g, i) =>
      `<div class="wallpaper-thumb" data-wp="${i}" style="${g}"></div>`
    ).join('');

    return `
      <div class="settings-app">
        <nav class="settings-sidebar">
          <div class="settings-nav-item active" data-section="appearance">🎨 Appearance</div>
          <div class="settings-nav-item" data-section="wallpaper">🖼️ Wallpaper</div>
          <div class="settings-nav-item" data-section="system">⚙️ System</div>
          <div class="settings-nav-item" data-section="about">ℹ️ About</div>
        </nav>
        <div class="settings-content">
          <div class="settings-section active" id="sec-appearance">
            <h2>Appearance</h2>
            <div class="settings-row">
              <label>Dark Theme</label>
              <label class="toggle-switch">
                <input type="checkbox" id="toggle-dark-theme">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="settings-section" id="sec-wallpaper">
            <h2>Wallpaper</h2>
            <div class="wallpaper-grid">${thumbs}</div>
            <div class="settings-row" style="margin-top:16px">
              <label>Custom URL</label>
              <input type="url" id="wp-url-input" placeholder="https://…/image.jpg" />
            </div>
            <button class="settings-btn" id="wp-url-apply" style="margin-top:8px">Apply URL Wallpaper</button>
          </div>
          <div class="settings-section" id="sec-system">
            <h2>System</h2>
            <button class="settings-btn danger" id="reset-os-btn">🗑️ Reset OS (clear all data)</button>
            <button class="settings-btn" id="clear-cache-btn">🧹 Clear non-OS localStorage</button>
          </div>
          <div class="settings-section" id="sec-about">
            <h2>About LiquidOS</h2>
            <div class="settings-row"><label>Version</label>
              <span style="color:var(--text-secondary)">1.0.0</span></div>
            <div class="settings-row"><label>Engine</label>
              <span style="color:var(--text-secondary)">Vanilla JS ES2024</span></div>
            <div class="settings-row"><label>Style</label>
              <span style="color:var(--text-secondary)">Liquid Glass CSS</span></div>
            <div class="settings-row"><label>Storage</label>
              <span style="color:var(--text-secondary)">localStorage VFS</span></div>
          </div>
        </div>
      </div>`;
  }

  onMount(windowEl) {
    windowEl.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        windowEl.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
        windowEl.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        windowEl.querySelector(`#sec-${item.dataset.section}`)?.classList.add('active');
      });
    });

    const toggle = windowEl.querySelector('#toggle-dark-theme');
    toggle.checked = OS.settings.get('theme') === 'dark';
    toggle.addEventListener('change', () => {
      const t = toggle.checked ? 'dark' : 'light';
      OS.settings.set('theme', t);
      document.getElementById('os-body').className = `theme-${t}`;
    });

    const savedWp = OS.settings.get('wallpaper');
    windowEl.querySelectorAll('.wallpaper-thumb').forEach(thumb => {
      if (thumb.dataset.wp === savedWp) thumb.classList.add('active');
      thumb.addEventListener('click', () => {
        windowEl.querySelectorAll('.wallpaper-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        OS.settings.set('wallpaper', thumb.dataset.wp);
        OS.settings.set('wallpaperUrl', '');
        OS.desktop.applyWallpaper(OS.settings.data);
      });
    });

    const urlInput = windowEl.querySelector('#wp-url-input');
    urlInput.value = OS.settings.get('wallpaperUrl') || '';
    windowEl.querySelector('#wp-url-apply').addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (!url) return;
      OS.settings.set('wallpaper', 'custom');
      OS.settings.set('wallpaperUrl', url);
      OS.desktop.applyWallpaper(OS.settings.data);
      OS.notifications.show('Settings', 'Wallpaper updated');
    });

    windowEl.querySelector('#reset-os-btn').addEventListener('click', () => {
      if (!confirm('Reset LiquidOS? All files and settings will be erased.')) return;
      OS.fs.reset();
      localStorage.removeItem(LS_SETTINGS_KEY);
      OS.notifications.show('System', 'Resetting…');
      setTimeout(() => location.reload(), 900);
    });
    windowEl.querySelector('#clear-cache-btn').addEventListener('click', () => {
      const keys = Object.keys(localStorage).filter(k => !k.startsWith('liquidOS'));
      keys.forEach(k => localStorage.removeItem(k));
      OS.notifications.show('System', `Cleared ${keys.length} cache entries`);
    });
  }
}

/* ─────────────────────────────────────────────
   14. BROWSER
───────────────────────────────────────────── */
class BrowserApp extends Application {
  constructor() {
    super({ id: 'browser', name: 'Browser', icon: '🌐',
            bgClass: 'icon-bg-browser', width: 800, height: 560 });
  }

  buildContent() {
    return `
      <div class="browser-app">
        <div class="browser-toolbar">
          <button class="browser-nav-btn" id="br-back-__ID__">‹</button>
          <button class="browser-nav-btn" id="br-fwd-__ID__">›</button>
          <button class="browser-nav-btn" id="br-reload-__ID__">↻</button>
          <input class="browser-url" id="br-url-__ID__" type="text"
                 placeholder="https://example.com" />
          <button class="browser-nav-btn" id="br-go-__ID__">⏎</button>
        </div>
        <div class="browser-no-load" id="br-placeholder-__ID__">
          <div class="big-icon">🌐</div>
          <div>Enter a URL and press Go or Enter</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
            Note: many sites block iframe embedding (X-Frame-Options)
          </div>
        </div>
        <iframe class="browser-iframe" id="br-iframe-__ID__"
                style="display:none"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </div>`;
  }

  onMount(windowEl) {
    const uid         = this._resolveIds(windowEl);
    const urlInput    = windowEl.querySelector(`#br-url-${uid}`);
    const iframe      = windowEl.querySelector(`#br-iframe-${uid}`);
    const placeholder = windowEl.querySelector(`#br-placeholder-${uid}`);

    const navigate = raw => {
      let url = raw.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      urlInput.value = url;
      placeholder.style.display = 'none';
      iframe.style.display = 'block';
      iframe.src = url;
      OS.notifications.show('Browser', 'Loading…');
    };

    windowEl.querySelector(`#br-go-${uid}`).addEventListener('click', () => navigate(urlInput.value));
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(urlInput.value); });
    windowEl.querySelector(`#br-reload-${uid}`).addEventListener('click', () => {
      if (iframe.src && iframe.src !== 'about:blank') iframe.src = iframe.src;
    });
    windowEl.querySelector(`#br-back-${uid}`).addEventListener('click', () => {
      try { iframe.contentWindow?.history.back(); } catch (_) {}
    });
    windowEl.querySelector(`#br-fwd-${uid}`).addEventListener('click', () => {
      try { iframe.contentWindow?.history.forward(); } catch (_) {}
    });
  }
}

/* ─────────────────────────────────────────────
   15. PULSE — SYSTEM MONITOR
   Canvas gauges + rolling history graph + process list.
   All metrics are simulated with organic noise so the
   numbers feel alive rather than robotic.
───────────────────────────────────────────── */
class PulseApp extends Application {
  constructor() {
    super({ id: 'pulse', name: 'Pulse', icon: '⚡',
            bgClass: 'icon-bg-pulse', width: 720, height: 510 });
    /* Stagger phases so all three gauges animate differently */
    this._phase = Math.random() * Math.PI * 2;
    /* Base CPU weight for each fake process (proportional distribution) */
    this._procDefs = [
      { name: 'kernel_task',    pid: 0,    w: 5,  mem: 1240 },
      { name: 'WindowServer',   pid: 121,  w: 7,  mem:  340 },
      { name: 'Chrome Helper',  pid: 2341, w: 14, mem:  890 },
      { name: 'node',           pid: 8821, w: 9,  mem:  340 },
      { name: 'mds_stores',     pid: 82,   w: 4,  mem:  120 },
      { name: 'coreaudiod',     pid: 441,  w: 2,  mem:   28 },
      { name: 'Spotlight',      pid: 567,  w: 6,  mem:  220 },
      { name: 'SystemUIServer', pid: 234,  w: 2,  mem:   88 },
      { name: 'launchd',        pid: 1,    w: 1,  mem:   12 },
      { name: 'loginwindow',    pid: 87,   w: 2,  mem:   55 },
    ];
  }

  buildContent() {
    return `
      <div class="pulse-app">
        <div class="pulse-header">
          <span class="pulse-brand">⚡ PULSE</span>
          <span class="pulse-uptime" id="pulse-uptime-__ID__">UP 00:00:00</span>
        </div>

        <div class="pulse-gauges">
          <div class="pulse-gauge-card">
            <canvas id="pulse-gcpu-__ID__" style="width:130px;height:130px"></canvas>
            <div class="pulse-metric-label" style="color:#60a5fa">CPU</div>
            <div class="pulse-metric-val"   style="color:#60a5fa" id="pulse-vcpu-__ID__">0%</div>
          </div>
          <div class="pulse-gauge-card">
            <canvas id="pulse-gram-__ID__" style="width:130px;height:130px"></canvas>
            <div class="pulse-metric-label" style="color:#c084fc">MEMORY</div>
            <div class="pulse-metric-val"   style="color:#c084fc" id="pulse-vram-__ID__">0%</div>
          </div>
          <div class="pulse-gauge-card">
            <canvas id="pulse-gnet-__ID__" style="width:130px;height:130px"></canvas>
            <div class="pulse-metric-label" style="color:#34d399">NETWORK</div>
            <div class="pulse-metric-val"   style="color:#34d399" id="pulse-vnet-__ID__">0 KB/s</div>
          </div>
        </div>

        <div class="pulse-graph-wrap">
          <div class="pulse-legend">
            <span class="pulse-leg-item">
              <span class="pulse-leg-dot" style="background:#60a5fa"></span>CPU
            </span>
            <span class="pulse-leg-item">
              <span class="pulse-leg-dot" style="background:#c084fc"></span>MEM
            </span>
            <span class="pulse-leg-item">
              <span class="pulse-leg-dot" style="background:#34d399"></span>NET
            </span>
          </div>
          <canvas id="pulse-graph-__ID__" style="width:100%;height:110px;display:block"></canvas>
        </div>

        <div class="pulse-procs">
          <div class="pulse-procs-head">
            <span>Process</span><span style="text-align:right">CPU</span>
            <span style="text-align:right">Mem</span><span>Load</span>
          </div>
          <div id="pulse-plist-__ID__"></div>
        </div>
      </div>`;
  }

  onMount(windowEl) {
    const uid       = this._resolveIds(windowEl);
    const startTime = Date.now();
    const MAXPTS    = 80;
    const hist      = { cpu: [], ram: [], net: [] };
    let   t         = this._phase;
    let   animId, tickId;

    /* ── HiDPI canvas setup ── */
    const makeCanvas = (id, w, h) => {
      const el  = windowEl.querySelector(`#${id}`);
      const dpr = window.devicePixelRatio || 1;
      el.width  = w * dpr;
      el.height = h * dpr;
      const ctx = el.getContext('2d');
      ctx.scale(dpr, dpr);
      return { el, ctx, w, h };
    };

    const cpuG = makeCanvas(`pulse-gcpu-${uid}`, 130, 130);
    const ramG = makeCanvas(`pulse-gram-${uid}`, 130, 130);
    const netG = makeCanvas(`pulse-gnet-${uid}`, 130, 130);

    /* Graph canvas uses container width — set up after first paint */
    const graphEl = windowEl.querySelector(`#pulse-graph-${uid}`);
    let graphCtx, graphW, graphH;

    const initGraph = () => {
      const dpr = window.devicePixelRatio || 1;
      const container = graphEl.parentElement;
      graphW = container.clientWidth - 36;
      graphH = 110;
      graphEl.width  = graphW * dpr;
      graphEl.height = graphH * dpr;
      graphEl.style.width  = graphW + 'px';
      graphEl.style.height = graphH + 'px';
      graphCtx = graphEl.getContext('2d');
      graphCtx.scale(dpr, dpr);
    };
    requestAnimationFrame(initGraph);

    /* ── Data simulation ── */
    const simulate = () => {
      t += 0.055;
      const noise = () => (Math.random() - 0.5) * 7;

      /* CPU: sine base ~35%, rare spikes */
      let cpu = 30 + 16 * Math.sin(t * 0.6) + 8 * Math.sin(t * 1.4) + noise();
      if (Math.random() < 0.04) cpu += 25 + Math.random() * 35;  // spike
      cpu = Math.max(2, Math.min(97, cpu));

      /* RAM: very slow drift, stable 52-70% */
      const ram = 58 + 10 * Math.sin(t * 0.08) + noise() * 0.4;

      /* NET: mostly idle, occasional bursts */
      let net = 3 + Math.random() * 6;
      if (Math.random() < 0.07) net = 20 + Math.random() * 60;
      net = Math.max(0, Math.min(100, net));

      /* Push to history buffers */
      ['cpu','ram','net'].forEach(k => {
        hist[k].push({ cpu, ram, net }[k]);
        if (hist[k].length > MAXPTS) hist[k].shift();
      });

      return { cpu, ram, net };
    };

    /* ── Gauge drawing (glowing arc) ── */
    const drawGauge = ({ ctx, w, h }, value, color) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2 + 6;
      const R  = 44, LW = 8.5;
      const SA = (150 * Math.PI) / 180;   // start angle
      const TA = (240 * Math.PI) / 180;   // total sweep
      const EA = SA + Math.max(0.01, Math.min(value / 100, 1)) * TA;

      /* Background track */
      ctx.beginPath();
      ctx.arc(cx, cy, R, SA, SA + TA);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = LW;
      ctx.lineCap   = 'round';
      ctx.shadowBlur = 0;
      ctx.stroke();

      /* Tick marks */
      for (let i = 0; i <= 8; i++) {
        const a   = SA + (i / 8) * TA;
        const ir  = R - LW / 2 - 7;
        const or  = R - LW / 2 - 2;
        ctx.beginPath();
        ctx.moveTo(cx + ir * Math.cos(a), cy + ir * Math.sin(a));
        ctx.lineTo(cx + or * Math.cos(a), cy + or * Math.sin(a));
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth   = 1;
        ctx.stroke();
      }

      if (value > 0.5) {
        /* Outer diffuse glow */
        ctx.shadowColor = color;
        ctx.shadowBlur  = 22;
        ctx.beginPath();
        ctx.arc(cx, cy, R, SA, EA);
        ctx.strokeStyle = color;
        ctx.lineWidth   = LW;
        ctx.lineCap     = 'round';
        ctx.globalAlpha = 0.45;
        ctx.stroke();

        /* Bright core arc */
        ctx.shadowBlur  = 8;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R, SA, EA);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      /* Center value text */
      ctx.globalAlpha = 1;
      ctx.fillStyle   = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 10;
      ctx.font        = `600 20px 'Geist Mono', monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(value) + '%', cx, cy - 4);
      ctx.shadowBlur  = 0;

      /* Small label below value */
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font      = '400 9px Outfit, sans-serif';
      ctx.fillText('of 100', cx, cy + 14);
    };

    /* ── History graph drawing ── */
    const drawGraph = () => {
      if (!graphCtx) return;
      const w = graphW, h = graphH;
      graphCtx.clearRect(0, 0, w, h);

      /* Horizontal grid lines */
      graphCtx.lineWidth   = 0.5;
      graphCtx.strokeStyle = 'rgba(255,255,255,0.04)';
      for (let i = 1; i <= 3; i++) {
        graphCtx.beginPath();
        graphCtx.moveTo(0,     (h * i) / 4);
        graphCtx.lineTo(w,     (h * i) / 4);
        graphCtx.stroke();
      }

      /* Percentage labels */
      ['100', '75', '50', '25'].forEach((lbl, i) => {
        graphCtx.fillStyle = 'rgba(255,255,255,0.15)';
        graphCtx.font      = '9px Geist Mono, monospace';
        graphCtx.textAlign = 'right';
        graphCtx.fillText(lbl, w - 2, (h * i) / 4 + 9);
      });

      /* Draw three filled areas — NET first (back), CPU last (front) */
      const layers = [
        { key: 'net', color: '#34d399' },
        { key: 'ram', color: '#c084fc' },
        { key: 'cpu', color: '#60a5fa' },
      ];

      layers.forEach(({ key, color }) => {
        const pts = hist[key];
        if (pts.length < 2) return;

        const stepX = w / (MAXPTS - 1);
        const getX  = i => (MAXPTS - pts.length + i) * stepX;
        const getY  = v => h - (v / 100) * h * 0.88 - 4;

        /* Parse hex color once */
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        /* Filled area */
        graphCtx.beginPath();
        graphCtx.moveTo(getX(0), h);
        pts.forEach((v, i) => graphCtx.lineTo(getX(i), getY(v)));
        graphCtx.lineTo(getX(pts.length - 1), h);
        graphCtx.closePath();
        graphCtx.fillStyle = `rgba(${r},${g},${b},0.06)`;
        graphCtx.fill();

        /* Glowing line */
        graphCtx.shadowColor = color;
        graphCtx.shadowBlur  = 5;
        graphCtx.beginPath();
        pts.forEach((v, i) => {
          const x = getX(i), y = getY(v);
          i === 0 ? graphCtx.moveTo(x, y) : graphCtx.lineTo(x, y);
        });
        graphCtx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
        graphCtx.lineWidth   = 1.5;
        graphCtx.lineJoin    = 'round';
        graphCtx.stroke();
        graphCtx.shadowBlur  = 0;
      });
    };

    /* ── Process list rendering ── */
    const procColors = ['#60a5fa','#c084fc','#34d399','#f59e0b','#f87171'];
    const totalW     = this._procDefs.reduce((s, p) => s + p.w, 0);

    const renderProcs = (totalCpu) => {
      const listEl = windowEl.querySelector(`#pulse-plist-${uid}`);
      if (!listEl) return;

      /* Distribute total CPU proportionally with per-process noise */
      const procs = this._procDefs
        .map(p => ({
          ...p,
          cpu: Math.max(0, (p.w / totalW) * totalCpu * (0.75 + Math.random() * 0.5)),
          mem: p.mem + Math.floor((Math.random() - 0.5) * 8)
        }))
        .sort((a, b) => b.cpu - a.cpu);

      listEl.innerHTML = procs.map((p, i) => {
        const col    = procColors[i % procColors.length];
        const cpuPct = Math.min(100, p.cpu);
        const barR   = parseInt(col.slice(1,3), 16);
        const barG   = parseInt(col.slice(3,5), 16);
        const barB   = parseInt(col.slice(5,7), 16);

        return `
          <div class="pulse-proc-row">
            <div class="pulse-proc-name-cell">
              <span class="pulse-proc-dot" style="background:${col}"></span>
              <span class="pulse-proc-name-text">${p.name}</span>
            </div>
            <div class="pulse-proc-cpu">${p.cpu.toFixed(1)}%</div>
            <div class="pulse-proc-mem">${p.mem} MB</div>
            <div class="pulse-bar-wrap">
              <div class="pulse-bar-track">
                <div class="pulse-bar-fill"
                     style="width:${cpuPct.toFixed(1)}%;
                            background:rgba(${barR},${barG},${barB},0.8)">
                </div>
              </div>
            </div>
          </div>`;
      }).join('');
    };

    /* ── Uptime counter ── */
    const uptimeEl = windowEl.querySelector(`#pulse-uptime-${uid}`);
    const updateUptime = () => {
      const s   = Math.floor((Date.now() - startTime) / 1000);
      const hh  = String(Math.floor(s / 3600)).padStart(2, '0');
      const mm  = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss  = String(s % 60).padStart(2, '0');
      if (uptimeEl) uptimeEl.textContent = `UP ${hh}:${mm}:${ss}`;
    };

    /* ── Value label elements ── */
    const vcpuEl = windowEl.querySelector(`#pulse-vcpu-${uid}`);
    const vramEl = windowEl.querySelector(`#pulse-vram-${uid}`);
    const vnetEl = windowEl.querySelector(`#pulse-vnet-${uid}`);

    /* ── Main animation loop (rAF drives canvas) ── */
    let lastTick = 0;
    let live = { cpu: 0, ram: 60, net: 0 };

    const frame = (now) => {
      animId = requestAnimationFrame(frame);

      /* Update data ~2× per second */
      if (now - lastTick > 500) {
        lastTick = now;
        live = simulate();
        renderProcs(live.cpu);
        updateUptime();

        /* Update text values */
        if (vcpuEl) vcpuEl.textContent = Math.round(live.cpu) + '%';
        if (vramEl) vramEl.textContent = Math.round(live.ram) + '%';
        if (vnetEl) {
          const kbs = (live.net * 0.82).toFixed(1);
          vnetEl.textContent = kbs + ' KB/s';
        }
      }

      /* Smooth interpolation for gauge animation */
      drawGauge(cpuG, live.cpu, '#60a5fa');
      drawGauge(ramG, live.ram, '#c084fc');
      drawGauge(netG, live.net, '#34d399');
      drawGraph();
    };

    animId = requestAnimationFrame(frame);

    /* ── Cleanup when window is destroyed ── */
    new MutationObserver(() => {
      if (!document.contains(windowEl)) {
        cancelAnimationFrame(animId);
      }
    }).observe(document.getElementById('window-layer'), { childList: true });
  }
}

/* ─────────────────────────────────────────────
   16. OS — ORCHESTRATOR
───────────────────────────────────────────── */
class OS {
  static init() {
    OS.fs            = new FileSystem();
    OS.settings      = new SettingsStore();
    OS.wm            = new WindowManager();
    OS.menuBar       = new MenuBar();
    OS.dock          = new Dock();
    OS.desktop       = new Desktop();
    OS.ctxMenu       = new ContextMenu();
    OS.notifications = new NotificationSystem();

    OS.apps = [
      new TerminalApp(),
      new FileExplorerApp(),
      new TextEditorApp(),
      new SettingsApp(),
      new BrowserApp(),
      new PulseApp(),       /* ← System Monitor */
    ];

    OS.dock.init(OS.apps);
    OS.desktop.init(OS.apps);

    document.getElementById('os-body').className =
      `theme-${OS.settings.get('theme') || 'dark'}`;
    OS.desktop.applyWallpaper(OS.settings.data);

    document.getElementById('desktop').addEventListener('contextmenu', e => {
      e.preventDefault();
      OS.ctxMenu.show(e.clientX, e.clientY, [
        { icon: '📁', label: 'New Folder',       action: () => OS._newFolder() },
        { icon: '📄', label: 'New Text File',    action: () => OS._newFile() },
        { separator: true },
        { icon: '🖼️', label: 'Change Wallpaper', action: () => OS.launchApp('settings') },
        { icon: 'ℹ️', label: 'System Info',      action: () => OS._sysInfo() },
      ]);
    });

    OS._boot();
  }

  static launchApp(id) {
    const app = OS.apps.find(a => a.id === id);
    if (!app) return;
    const existing = [...OS.wm.windows.values()].find(m => m.appName === id);
    if (existing) { OS.wm.focus(existing.id); return; }
    app.open();
  }

  static _newFolder() {
    const name = prompt('Folder name:');
    if (!name) return;
    OS.fs.mkdir('/Home/' + name);
    OS.notifications.show('Desktop', `Folder "${name}" created`);
  }

  static _newFile() {
    const name = prompt('File name:', 'untitled.txt');
    if (!name) return;
    OS.fs.writeFile('/Home/' + name, '');
    OS.notifications.show('Desktop', `File "${name}" created`);
  }

  static _sysInfo() {
    alert(`LiquidOS v1.0\nResolution: ${window.innerWidth}×${window.innerHeight}\n` +
          `Agent: ${navigator.userAgent.slice(0, 80)}`);
  }

  static _boot() {
    const screen = document.getElementById('boot-screen');
    const fill   = document.getElementById('boot-progress-fill');
    const steps  = [10, 30, 55, 75, 90, 100];
    let i = 0;

    const advance = () => {
      if (i >= steps.length) {
        setTimeout(() => {
          /*
           * FIX: do NOT use .hidden (which sets display:none immediately).
           * Instead use opacity + pointer-events so the CSS transition fires.
           */
          screen.style.opacity        = '0';
          screen.style.pointerEvents  = 'none';
          setTimeout(() => screen.style.display = 'none', 600);
          OS.notifications.show('LiquidOS', 'System ready. Welcome!', 4000);
        }, 350);
        return;
      }
      fill.style.width = steps[i++] + '%';
      setTimeout(advance, 200 + Math.random() * 180);
    };
    setTimeout(advance, 400);
  }
}

/* ─────────────────────────────────────────────
   ENTRY POINT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => OS.init());