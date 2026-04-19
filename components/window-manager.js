/**
 * Window Manager - Modular Floating Window System for Pro Audio Suite
 * 
 * Features:
 * - Component catalog menu (add/remove/toggle components)
 * - Floating draggable, resizable windows
 * - Z-order management (click-to-front)
 * - Minimize / Close / Hide
 * - Dynamic Web Component instantiation
 * - Snap-to-edge magnetism
 */

const COMPONENT_CATALOG = [
  { id: 'spectrum',      tag: 'pro-visualizer', attrs: { 'locked-mode': 'spectrum' },      icon: '📊', label: 'Spectrum Analyzer',  category: 'visualizer' },
  { id: 'waveform',     tag: 'pro-visualizer', attrs: { 'locked-mode': 'waveform' },      icon: '〰️', label: 'Waveform',           category: 'visualizer' },
  { id: 'vumeter',      tag: 'pro-visualizer', attrs: { 'locked-mode': 'vumeter' },       icon: '📈', label: 'VU Meter',            category: 'visualizer' },
  { id: 'circular',     tag: 'pro-visualizer', attrs: { 'locked-mode': 'circular' },      icon: '🔵', label: 'Circular Spectrum',   category: 'visualizer' },
  { id: 'oscilloscope', tag: 'pro-visualizer', attrs: { 'locked-mode': 'oscilloscope' },  icon: '⚡', label: 'Oscilloscope',        category: 'visualizer' },
  { id: 'spectrogram',  tag: 'pro-visualizer', attrs: { 'locked-mode': 'spectrogram' },   icon: '🌊', label: 'Spectrogram',         category: 'visualizer' },
  { id: 'vinyl',        tag: 'pro-vinyl',     attrs: {},                                    icon: '💿', label: 'Vinyl Disc',          category: 'visualizer' },
  { id: 'equalizer',    tag: 'pro-eq',        attrs: {},                                    icon: '🎚️', label: 'Equalizer',          category: 'audio' },
  { id: 'fx-rack',      tag: 'pro-fx-rack',   attrs: {},                                    icon: '🎛️', label: 'FX Rack',            category: 'audio' },
  { id: 'playlist',     tag: 'pro-playlist',  attrs: {},                                    icon: '🎵', label: 'Playlist',            category: 'media' },
];

class ProWindowManager extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._windows = new Map();   // windowId -> { el, config, component, minimized }
    this._topZ = 100;
    this._dragState = null;
    this._resizeState = null;
    this._snapThreshold = 12;
    this._nextInstanceId = 0;

    this.shadowRoot.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* ===== WORKSPACE ===== */
  .workspace {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* ===== COMPONENT MENU DRAWER ===== */
  .menu-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9998;
    opacity: 0;
    visibility: hidden;
    transition: all 0.25s ease;
  }
  .menu-overlay.open {
    opacity: 1;
    visibility: visible;
  }

  .component-menu {
    position: fixed;
    top: 0;
    right: -320px;
    width: 300px;
    height: 100vh;
    background: linear-gradient(180deg, #1a1a1a, #111);
    border-left: 1px solid #333;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    transition: right 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: -8px 0 40px rgba(0,0,0,0.6);
  }
  .component-menu.open {
    right: 0;
  }

  .menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
    background: linear-gradient(180deg, #222, #1a1a1a);
  }
  .menu-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #00D4FF;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .menu-close {
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid #444;
    border-radius: 6px;
    color: #888;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .menu-close:hover {
    background: #ff4444;
    border-color: #ff4444;
    color: #fff;
  }

  .menu-section-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 16px 20px 8px;
  }

  .menu-items {
    flex: 1;
    overflow-y: auto;
    padding: 0 12px 12px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin: 2px 0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
  }
  .menu-item:hover {
    background: rgba(255,255,255,0.04);
    border-color: #333;
  }
  .menu-item-icon {
    font-size: 18px;
    min-width: 28px;
    text-align: center;
  }
  .menu-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu-item-label {
    font-size: 12px;
    color: #ccc;
    font-weight: 500;
  }
  .menu-item-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #555;
  }
  .menu-item-add {
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid #444;
    border-radius: 6px;
    color: #666;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .menu-item-add:hover {
    background: #00D4FF;
    border-color: #00D4FF;
    color: #000;
    box-shadow: 0 0 12px rgba(0, 212, 255, 0.4);
  }

  /* Active instances */
  .menu-active-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 16px 20px 8px;
    border-top: 1px solid #333;
    margin-top: 8px;
  }
  .menu-active-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    margin: 2px 0;
    border-radius: 6px;
    font-size: 11px;
    color: #aaa;
    transition: all 0.15s;
  }
  .menu-active-item:hover {
    background: rgba(255,255,255,0.03);
  }
  .menu-active-icon {
    font-size: 14px;
    min-width: 22px;
    text-align: center;
  }
  .menu-active-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .menu-active-btn {
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #555;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .menu-active-btn:hover {
    color: #fff;
  }
  .menu-active-btn.focus:hover {
    color: #00D4FF;
  }
  .menu-active-btn.close:hover {
    background: #ff4444;
    color: #fff;
  }

  /* ===== FLOATING WINDOWS ===== */
  .float-window {
    position: absolute;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    min-width: 240px;
    min-height: 120px;
    overflow: hidden;
    transition: box-shadow 0.2s, opacity 0.2s;
    animation: windowOpen 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes windowOpen {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(12px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .float-window.closing {
    animation: windowClose 0.2s ease forwards;
  }
  @keyframes windowClose {
    to {
      opacity: 0;
      transform: scale(0.92) translateY(12px);
    }
  }

  .float-window.active {
    border-color: #00D4FF33;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(0, 212, 255, 0.3);
  }

  .float-window.dragging {
    opacity: 0.88;
    cursor: grabbing;
  }

  .float-window.minimized {
    display: none;
  }

  .win-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px 0 12px;
    height: 34px;
    min-height: 34px;
    background: linear-gradient(180deg, #252525, #1e1e1e);
    border-bottom: 1px solid #333;
    cursor: grab;
    user-select: none;
  }
  .win-header:active {
    cursor: grabbing;
  }

  .win-icon {
    font-size: 12px;
  }

  .win-title {
    flex: 1;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .float-window.active .win-title {
    color: #bbb;
  }

  .win-badge {
    font-size: 7px;
    padding: 2px 5px;
    background: #00D4FF;
    color: #000;
    border-radius: 3px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .win-controls {
    display: flex;
    gap: 3px;
    position: relative;
    z-index: 10;
  }
  .win-btn {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: #555;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s;
  }
  .win-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
  }
  .win-btn.min:hover {
    background: #FF6B35;
    color: #000;
  }
  .win-btn.close:hover {
    background: #ff4444;
    color: #fff;
  }

  .win-body {
    flex: 1;
    overflow: hidden;
    padding: 0;
    min-height: 0;
    position: relative;
  }
  .win-body > * {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Resize handle */
  .win-resize {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 18px;
    height: 18px;
    cursor: se-resize;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .float-window:hover .win-resize {
    opacity: 0.4;
  }
  .win-resize::before {
    content: '';
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 8px;
    height: 8px;
    border-right: 2px solid #666;
    border-bottom: 2px solid #666;
  }

  /* ===== MINIMIZED BAR ===== */
  .minimized-bar {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    z-index: 50;
  }
  .minimized-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 11px;
    color: #888;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .minimized-tab:hover {
    border-color: #00D4FF;
    color: #00D4FF;
    box-shadow: 0 2px 12px rgba(0, 212, 255, 0.15);
  }
  .minimized-tab-icon {
    font-size: 12px;
  }
  .minimized-tab-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ===== EMPTY STATE ===== */
  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #333;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .empty-state.hidden {
    opacity: 0;
  }
  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }
  .empty-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .empty-hint {
    font-size: 11px;
    color: #2a2a2a;
    margin-top: 8px;
  }
</style>

<div class="workspace" id="workspace">
  <div class="empty-state" id="empty-state">
    <div class="empty-icon">🎛️</div>
    <div class="empty-text">Workspace</div>
    <div class="empty-hint">Open the Components menu to add modules</div>
  </div>
  <div class="minimized-bar" id="minimized-bar"></div>
</div>

<div class="menu-overlay" id="menu-overlay"></div>

<div class="component-menu" id="component-menu">
  <div class="menu-header">
    <span class="menu-title">Components</span>
    <button class="menu-close" id="menu-close">×</button>
  </div>
  <div class="menu-items" id="menu-items"></div>
</div>
`;

    this._workspace = this.shadowRoot.getElementById('workspace');
    this._menuOverlay = this.shadowRoot.getElementById('menu-overlay');
    this._menu = this.shadowRoot.getElementById('component-menu');
    this._menuItems = this.shadowRoot.getElementById('menu-items');
    this._minimizedBar = this.shadowRoot.getElementById('minimized-bar');
    this._emptyState = this.shadowRoot.getElementById('empty-state');
  }

  connectedCallback() {
    this._buildMenu();

    // Menu controls
    this.shadowRoot.getElementById('menu-close').addEventListener('click', () => this.closeMenu());
    this._menuOverlay.addEventListener('click', () => this.closeMenu());

    // Global mouse events for drag/resize
    document.addEventListener('mousemove', this._onMouseMove.bind(this));
    document.addEventListener('mouseup', this._onMouseUp.bind(this));

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeMenu();
    });
  }

  // ==================== PUBLIC API ====================

  /** Open the component catalog menu */
  openMenu() {
    this._menu.classList.add('open');
    this._menuOverlay.classList.add('open');
    this._refreshActiveList();
  }

  /** Close the component catalog menu */
  closeMenu() {
    this._menu.classList.remove('open');
    this._menuOverlay.classList.remove('open');
  }

  /** Toggle the component catalog menu */
  toggleMenu() {
    if (this._menu.classList.contains('open')) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  /** Load a predefined workspace setup */
  loadWorkspace(presetName) {
    // Clear all existing windows
    for (const [id, win] of this._windows) {
      win.el.remove();
    }
    this._windows.clear();
    this._nextInstanceId = 0;

    const presets = {
      studio: [
        { id: 'vinyl', x: 16, y: 16, w: 380, h: 380 },
        { id: 'spectrum', x: 412, y: 16, w: 440, h: 280 },
        { id: 'circular', x: 412, y: 312, w: 440, h: 300 },
        { id: 'equalizer', x: 16, y: 412, w: 380, h: 280 },
        { id: 'fx-rack', x: 16, y: 708, w: 836, h: 160 }
      ],
      dj: [
        { id: 'vinyl', x: 16, y: 16, w: 420, h: 420 },
        { id: 'waveform', x: 450, y: 16, w: 700, h: 220 },
        { id: 'equalizer', x: 450, y: 250, w: 400, h: 280 },
        { id: 'playlist', x: 860, y: 250, w: 290, h: 280 }
      ],
      minimal: [
        { id: 'spectrum', x: 40, y: 40, w: 600, h: 300 },
        { id: 'equalizer', x: 40, y: 360, w: 600, h: 240 }
      ],
      all: [
        { id: 'vinyl', x: 10, y: 10, w: 380, h: 380 },
        { id: 'playlist', x: 400, y: 10, w: 340, h: 380 },
        { id: 'equalizer', x: 750, y: 10, w: 380, h: 220 },
        { id: 'fx-rack', x: 750, y: 240, w: 380, h: 150 },
        { id: 'waveform', x: 10, y: 400, w: 550, h: 200 },
        { id: 'spectrum', x: 570, y: 400, w: 560, h: 200 },
        { id: 'oscilloscope', x: 10, y: 610, w: 300, h: 180 },
        { id: 'vumeter', x: 320, y: 610, w: 200, h: 180 },
        { id: 'circular', x: 530, y: 610, w: 250, h: 180 },
        { id: 'spectrogram', x: 790, y: 610, w: 340, h: 180 }
      ]
    };

    const configs = presets[presetName];
    if (!configs) return;

    configs.forEach(conf => {
      const entry = COMPONENT_CATALOG.find(c => c.id === conf.id);
      if (!entry) return;

      const instanceId = `${conf.id}-${this._nextInstanceId++}`;
      const component = document.createElement(entry.tag);
      for (const [k, v] of Object.entries(entry.attrs)) {
        component.setAttribute(k, v);
      }
      component.id = `comp-${instanceId}`;

      this._createWindow(instanceId, entry, component, conf.x, conf.y, conf.w, conf.h);
    });

    this._updateEmptyState();
    this._renderMinimizedBar();
    this._refreshActiveList();
  }

  /** Add a component to the workspace */
  addComponent(catalogId) {
    const entry = COMPONENT_CATALOG.find(c => c.id === catalogId);
    if (!entry) return null;

    const instanceId = `${catalogId}-${this._nextInstanceId++}`;
    const component = document.createElement(entry.tag);
    for (const [k, v] of Object.entries(entry.attrs)) {
      component.setAttribute(k, v);
    }
    component.id = `comp-${instanceId}`;

    const { x, y } = this._getSmartPosition();
    this._createWindow(instanceId, entry, component, x, y);
    this._updateEmptyState();
    this._refreshActiveList();
    return instanceId;
  }

  /** Remove a window and its component */
  removeWindow(windowId) {
    const win = this._windows.get(windowId);
    if (!win) return;

    win.el.classList.add('closing');
    setTimeout(() => {
      win.el.remove();
      this._windows.delete(windowId);
      this._updateEmptyState();
      this._renderMinimizedBar();
      this._refreshActiveList();
    }, 200);
  }

  /** Minimize a window */
  minimizeWindow(windowId) {
    const win = this._windows.get(windowId);
    if (!win) return;
    win.minimized = true;
    win.el.classList.add('minimized');
    this._renderMinimizedBar();
    this._refreshActiveList();
  }

  /** Restore a window from minimized state */
  restoreWindow(windowId) {
    const win = this._windows.get(windowId);
    if (!win) return;
    win.minimized = false;
    win.el.classList.remove('minimized');
    this._bringToFront(windowId);
    this._renderMinimizedBar();
    this._refreshActiveList();
  }

  /** Bring a window to the front */
  focusWindow(windowId) {
    this._bringToFront(windowId);
    const win = this._windows.get(windowId);
    if (win && win.minimized) {
      this.restoreWindow(windowId);
    }
  }

  // ==================== PRIVATE ====================

  _spawnDefaults() {
    // Spawn default set of components
    const defaults = ['vinyl', 'spectrum', 'circular', 'equalizer', 'fx-rack'];
    const positions = [
      { x: 16, y: 16, w: 380, h: 380 },
      { x: 412, y: 16, w: 440, h: 280 },
      { x: 412, y: 312, w: 440, h: 300 },
      { x: 16, y: 412, w: 380, h: 280 },
      { x: 16, y: 708, w: 836, h: 160 },
    ];

    defaults.forEach((id, i) => {
      const entry = COMPONENT_CATALOG.find(c => c.id === id);
      if (!entry) return;

      const instanceId = `${id}-${this._nextInstanceId++}`;
      const component = document.createElement(entry.tag);
      for (const [k, v] of Object.entries(entry.attrs)) {
        component.setAttribute(k, v);
      }
      component.id = `comp-${instanceId}`;

      const pos = positions[i] || { x: 50 + i * 30, y: 50 + i * 30, w: 420, h: 260 };
      this._createWindow(instanceId, entry, component, pos.x, pos.y, pos.w, pos.h);
    });

    this._updateEmptyState();
  }

  _createWindow(instanceId, catalogEntry, component, x, y, w = 420, h = 260) {
    const win = document.createElement('div');
    win.className = 'float-window';
    win.id = `win-${instanceId}`;
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
    win.style.width = `${w}px`;
    win.style.height = `${h}px`;
    win.style.zIndex = ++this._topZ;

    const isLive = catalogEntry.category === 'visualizer';

    win.innerHTML = `
      <div class="win-header">
        <span class="win-icon">${catalogEntry.icon}</span>
        <span class="win-title">${catalogEntry.label}</span>
        ${isLive ? '<span class="win-badge">LIVE</span>' : ''}
        <div class="win-controls">
          <button class="win-btn min" title="Minimize">−</button>
          <button class="win-btn close" title="Close">×</button>
        </div>
      </div>
      <div class="win-body"></div>
      <div class="win-resize"></div>
    `;

    // Inject component
    win.querySelector('.win-body').appendChild(component);

    // Event: bring to front on click
    win.addEventListener('mousedown', () => this._bringToFront(instanceId));

    // Event: drag
    const header = win.querySelector('.win-header');
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.win-controls')) return;
      this._startDrag(instanceId, e);
    });

    // Event: resize
    win.querySelector('.win-resize').addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this._startResize(instanceId, e);
    });

    // Event: minimize
    win.querySelector('.win-btn.min').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimizeWindow(instanceId);
    });

    // Event: close
    win.querySelector('.win-btn.close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeWindow(instanceId);
    });

    this._workspace.appendChild(win);

    this._windows.set(instanceId, {
      el: win,
      config: catalogEntry,
      component,
      minimized: false
    });
  }

  _bringToFront(instanceId) {
    const win = this._windows.get(instanceId);
    if (!win) return;

    // Remove active from all
    for (const [, w] of this._windows) {
      w.el.classList.remove('active');
    }

    win.el.style.zIndex = ++this._topZ;
    win.el.classList.add('active');
  }

  _getSmartPosition() {
    // Cascade new windows
    const offset = (this._windows.size % 8) * 32;
    return { x: 60 + offset, y: 60 + offset };
  }

  // ===== DRAG =====
  _startDrag(instanceId, e) {
    const win = this._windows.get(instanceId);
    if (!win) return;
    e.preventDefault();

    this._dragState = {
      instanceId,
      el: win.el,
      startX: e.clientX,
      startY: e.clientY,
      origX: parseInt(win.el.style.left),
      origY: parseInt(win.el.style.top)
    };
    win.el.classList.add('dragging');
  }

  // ===== RESIZE =====
  _startResize(instanceId, e) {
    const win = this._windows.get(instanceId);
    if (!win) return;
    e.preventDefault();

    this._resizeState = {
      instanceId,
      el: win.el,
      startX: e.clientX,
      startY: e.clientY,
      origW: win.el.offsetWidth,
      origH: win.el.offsetHeight
    };
  }

  _onMouseMove(e) {
    if (this._dragState) {
      const { el, startX, startY, origX, origY } = this._dragState;
      let newX = origX + (e.clientX - startX);
      let newY = origY + (e.clientY - startY);

      // Snap to edges
      const rect = this._workspace.getBoundingClientRect();
      const elW = el.offsetWidth;
      const elH = el.offsetHeight;

      if (Math.abs(newX) < this._snapThreshold) newX = 0;
      if (Math.abs(newY) < this._snapThreshold) newY = 0;
      if (Math.abs((newX + elW) - rect.width) < this._snapThreshold) newX = rect.width - elW;
      if (Math.abs((newY + elH) - rect.height) < this._snapThreshold) newY = rect.height - elH;

      // Keep within bounds
      newX = Math.max(-(elW - 60), Math.min(rect.width - 60, newX));
      newY = Math.max(0, Math.min(rect.height - 34, newY));

      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
    }

    if (this._resizeState) {
      const { el, startX, startY, origW, origH } = this._resizeState;
      el.style.width = `${Math.max(240, origW + (e.clientX - startX))}px`;
      el.style.height = `${Math.max(120, origH + (e.clientY - startY))}px`;
    }
  }

  _onMouseUp() {
    if (this._dragState) {
      this._dragState.el.classList.remove('dragging');
      this._dragState = null;
    }
    if (this._resizeState) {
      this._resizeState = null;
    }
  }

  // ===== MENU =====
  _buildMenu() {
    const categories = { visualizer: 'Visualizers', audio: 'Audio Processing', media: 'Media' };
    let html = '';

    for (const [cat, title] of Object.entries(categories)) {
      const items = COMPONENT_CATALOG.filter(c => c.category === cat);
      if (items.length === 0) continue;

      html += `<div class="menu-section-title">${title}</div>`;
      items.forEach(item => {
        html += `
          <div class="menu-item" data-catalog-id="${item.id}">
            <span class="menu-item-icon">${item.icon}</span>
            <div class="menu-item-info">
              <span class="menu-item-label">${item.label}</span>
              <span class="menu-item-tag">&lt;${item.tag}&gt;</span>
            </div>
            <button class="menu-item-add" data-add="${item.id}" title="Add to workspace">+</button>
          </div>
        `;
      });
    }

    html += '<div class="menu-active-title" id="active-title">Active Windows</div>';
    html += '<div id="active-list"></div>';

    this._menuItems.innerHTML = html;

    // Add handlers
    this._menuItems.querySelectorAll('.menu-item-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addComponent(btn.dataset.add);
        this._refreshActiveList();
      });
    });
  }

  _refreshActiveList() {
    const list = this.shadowRoot.getElementById('active-list');
    if (!list) return;

    let html = '';
    for (const [id, win] of this._windows) {
      const status = win.minimized ? '📦' : '✦';
      html += `
        <div class="menu-active-item" data-win-id="${id}">
          <span class="menu-active-icon">${win.config.icon}</span>
          <span class="menu-active-name">${win.config.label}${win.minimized ? ' (min)' : ''}</span>
          <button class="menu-active-btn focus" data-focus="${id}" title="Focus">⊙</button>
          <button class="menu-active-btn close" data-remove="${id}" title="Remove">×</button>
        </div>
      `;
    }

    if (this._windows.size === 0) {
      html = '<div style="padding: 12px 16px; font-size: 11px; color: #444;">No active windows</div>';
    }

    list.innerHTML = html;

    // Re-bind events
    list.querySelectorAll('[data-focus]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.focusWindow(btn.dataset.focus);
        this.closeMenu();
      });
    });
    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => this.removeWindow(btn.dataset.remove));
    });
  }

  // ===== MINIMIZED BAR =====
  _renderMinimizedBar() {
    let html = '';
    for (const [id, win] of this._windows) {
      if (!win.minimized) continue;
      html += `
        <div class="minimized-tab" data-restore="${id}">
          <span class="minimized-tab-icon">${win.config.icon}</span>
          <span class="minimized-tab-label">${win.config.label}</span>
        </div>
      `;
    }
    this._minimizedBar.innerHTML = html;

    this._minimizedBar.querySelectorAll('[data-restore]').forEach(tab => {
      tab.addEventListener('click', () => this.restoreWindow(tab.dataset.restore));
    });
  }

  // ===== EMPTY STATE =====
  _updateEmptyState() {
    const hasWindows = this._windows.size > 0;
    this._emptyState.classList.toggle('hidden', hasWindows);
  }
}

customElements.define('pro-window-manager', ProWindowManager);
export default ProWindowManager;