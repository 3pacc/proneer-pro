/**
 * Pro-FX-Rack - Web Audio Modules (WAM) FX Rack Web Component
 * 
 * Container dynamique pour charger et gérer des effets audio.
 * Supporte le routing série/parallèle et les effets intégrés.
 */

const templateFX = document.createElement('template');
templateFX.innerHTML = `
<style>
  :host {
    --fx-accent: #00D4FF;
    --fx-secondary: #FF6B35;
    --fx-bg: #1a1a1a;
    --fx-bg-2: #222;
    --fx-bg-3: #2a2a2a;
    
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
    align-items: flex-start;
    min-height: 60px;
  }

  .fx-empty {
    width: 100%;
    text-align: center;
    padding: 20px;
    color: #555;
    font-size: 11px;
  }

  .fx-slot {
    display: flex;
    flex-direction: column;
    background: var(--fx-bg-2);
    border: 1px solid #333;
    border-radius: 8px;
    overflow: hidden;
    min-width: 120px;
    transition: all 0.2s;
  }

  .fx-slot:hover {
    border-color: #555;
  }

  .fx-slot.bypassed {
    opacity: 0.5;
  }

  .fx-slot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: var(--fx-bg-3);
    border-bottom: 1px solid #333;
  }

  .fx-slot-name {
    font-size: 10px;
    color: #aaa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80px;
  }

  .fx-slot-controls {
    display: flex;
    gap: 4px;
  }

  .fx-btn {
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .fx-btn:hover {
    color: #fff;
  }

  .fx-btn.bypass.active {
    color: var(--fx-secondary);
  }

  .fx-btn.remove:hover {
    color: #ff4444;
  }

  .fx-slot-gui {
    padding: 8px;
    min-height: 50px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--fx-bg);
  }

  .fx-param {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
  }

  .fx-param-label {
    color: #666;
  }

  .fx-param-slider {
    width: 60px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #333;
    border-radius: 2px;
    outline: none;
  }

  .fx-param-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    background: var(--fx-accent);
    border-radius: 50%;
    cursor: pointer;
  }

  .fx-param-value {
    font-family: 'JetBrains Mono', monospace;
    color: var(--fx-accent);
    min-width: 30px;
    text-align: right;
  }

  .fx-add {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 2px dashed #333;
    border-radius: 8px;
    min-width: 120px;
    min-height: 80px;
    cursor: pointer;
    transition: all 0.2s;
    color: #555;
    font-size: 10px;
    gap: 4px;
  }

  .fx-add:hover {
    border-color: var(--fx-accent);
    color: var(--fx-accent);
  }

  .fx-add-icon {
    font-size: 20px;
  }

  /* Modal */
  .fx-modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s;
  }

  .fx-modal.open {
    opacity: 1;
    visibility: visible;
  }

  .fx-modal-content {
    background: var(--fx-bg);
    border: 1px solid #444;
    border-radius: 12px;
    padding: 20px;
    width: 360px;
    max-width: 90vw;
    transform: scale(0.95);
    transition: transform 0.2s;
  }

  .fx-modal.open .fx-modal-content {
    transform: scale(1);
  }

  .fx-modal-title {
    font-size: 12px;
    color: #888;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .fx-modal-section {
    margin-bottom: 16px;
  }

  .fx-modal-section-title {
    font-size: 10px;
    color: #666;
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .fx-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .fx-preset-btn {
    padding: 6px 12px;
    background: var(--fx-bg-2);
    border: 1px solid #444;
    border-radius: 20px;
    color: #888;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .fx-preset-btn:hover {
    border-color: var(--fx-accent);
    color: var(--fx-accent);
  }

  .fx-preset-btn.active {
    background: var(--fx-accent);
    border-color: var(--fx-accent);
    color: #121212;
  }

  .fx-url-input {
    width: 100%;
    background: var(--fx-bg-2);
    border: 1px solid #444;
    color: #fff;
    font-family: inherit;
    font-size: 11px;
    padding: 10px;
    border-radius: 6px;
    outline: none;
  }

  .fx-url-input:focus {
    border-color: var(--fx-accent);
  }

  .fx-modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .fx-modal-cancel {
    background: transparent;
    border: 1px solid #444;
    color: #666;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
  }

  .fx-modal-load {
    background: var(--fx-accent);
    border: none;
    color: #121212;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    font-weight: bold;
  }
</style>

<div class="fx-rack"></div>

<div class="fx-modal" id="fx-modal">
  <div class="fx-modal-content">
    <div class="fx-modal-title">Add Effect</div>
    
    <div class="fx-modal-section">
      <div class="fx-modal-section-title">Built-in Effects</div>
      <div class="fx-presets">
        <button class="fx-preset-btn" data-type="delay">Delay</button>
        <button class="fx-preset-btn" data-type="reverb">Reverb</button>
        <button class="fx-preset-btn" data-type="chorus">Chorus</button>
        <button class="fx-preset-btn" data-type="distortion">Distortion</button>
        <button class="fx-preset-btn" data-type="phaser">Phaser</button>
        <button class="fx-preset-btn" data-type="flanger">Flanger</button>
      </div>
    </div>

    <div class="fx-modal-section">
      <div class="fx-modal-section-title">Load WAM (URL)</div>
      <input type="text" class="fx-url-input" id="fx-url-input" placeholder="Enter WAM module URL..." />
    </div>

    <div class="fx-modal-actions">
      <button class="fx-modal-cancel" id="fx-modal-cancel">Cancel</button>
      <button class="fx-modal-load" id="fx-modal-load">Load</button>
    </div>
  </div>
</div>
`;

// Built-in effect generators
const BUILT_IN_EFFECTS = {
  delay: {
    name: 'Delay',
    defaultParams: { time: 0.3, feedback: 0.4, mix: 0.3 },
    createNode: (ctx, params) => {
      const delay = ctx.createDelay(1);
      const feedback = ctx.createGain();
      const mix = ctx.createGain();
      delay.delayTime.value = params.time;
      feedback.gain.value = params.feedback;
      mix.gain.value = params.mix;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(mix);
      return { input: delay, output: mix, nodes: [delay, feedback, mix] };
    }
  },
  reverb: {
    name: 'Reverb',
    defaultParams: { decay: 2, mix: 0.3 },
    createNode: (ctx, params) => {
      const convolver = ctx.createConvolver();
      const mix = ctx.createGain();
      mix.gain.value = params.mix;
      // Create impulse response
      const rate = ctx.sampleRate;
      const length = rate * params.decay;
      const impulse = ctx.createBuffer(2, length, rate);
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, params.decay);
        }
      }
      convolver.buffer = impulse;
      convolver.connect(mix);
      return { input: convolver, output: mix, nodes: [convolver, mix] };
    }
  },
  chorus: {
    name: 'Chorus',
    defaultParams: { rate: 1.5, depth: 0.002, mix: 0.5 },
    createNode: (ctx, params) => {
      const delay = ctx.createDelay(0.1);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const mix = ctx.createGain();
      delay.delayTime.value = 0.02;
      lfo.frequency.value = params.rate;
      lfoGain.gain.value = params.depth;
      mix.gain.value = params.mix;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      delay.connect(mix);
      lfo.start();
      return { input: delay, output: mix, nodes: [delay, lfo, lfoGain, mix] };
    }
  },
  distortion: {
    name: 'Distortion',
    defaultParams: { amount: 50, tone: 0.5, mix: 0.5 },
    createNode: (ctx, params) => {
      const waveshaper = ctx.createWaveShaper();
      const tone = ctx.createBiquadFilter();
      const mix = ctx.createGain();
      tone.type = 'lowpass';
      tone.frequency.value = params.tone * 10000 + 200;
      mix.gain.value = params.mix;
      // Create distortion curve
      const k = params.amount;
      const samples = 44100;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      }
      waveshaper.curve = curve;
      waveshaper.connect(tone);
      tone.connect(mix);
      return { input: waveshaper, output: mix, nodes: [waveshaper, tone, mix] };
    }
  },
  phaser: {
    name: 'Phaser',
    defaultParams: { rate: 0.5, depth: 0.8, mix: 0.5 },
    createNode: (ctx, params) => {
      const allpassL = ctx.createBiquadFilter();
      allpassL.type = 'allpass';
      allpassL.frequency.value = 1000;
      const allpassR = ctx.createBiquadFilter();
      allpassR.type = 'allpass';
      allpassR.frequency.value = 1100;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const mix = ctx.createGain();
      lfo.frequency.value = params.rate;
      lfoGain.gain.value = params.depth * 3500;
      mix.gain.value = params.mix;
      lfo.connect(lfoGain);
      lfoGain.connect(allpassL.frequency);
      lfoGain.connect(allpassR.frequency);
      allpassL.connect(allpassR);
      allpassR.connect(mix);
      lfo.start();
      return { input: allpassL, output: mix, nodes: [allpassL, allpassR, lfo, lfoGain, mix] };
    }
  },
  flanger: {
    name: 'Flanger',
    defaultParams: { rate: 0.5, depth: 0.003, mix: 0.5 },
    createNode: (ctx, params) => {
      const delay = ctx.createDelay(0.01);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const mix = ctx.createGain();
      delay.delayTime.value = 0.005;
      lfo.frequency.value = params.rate;
      lfoGain.gain.value = params.depth;
      mix.gain.value = params.mix;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      delay.connect(mix);
      lfo.start();
      return { input: delay, output: mix, nodes: [delay, lfo, lfoGain, mix] };
    }
  }
};

class ProFXRack extends HTMLElement {
  static get observedAttributes() {
    return ['engine-id', 'mode', 'bypass'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(templateFX.content.cloneNode(true));
    
    this._engineId = null;
    this._engine = null;
    this._effects = [];
    this._mode = 'series';
    this._bypassAll = false;
    
    this._rack = this.shadowRoot.querySelector('.fx-rack');
    this._modal = this.shadowRoot.querySelector('.fx-modal');
    this._urlInput = this.shadowRoot.querySelector('#fx-url-input');
  }

  connectedCallback() {
    this._renderEmpty();
    
    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'fx-add';
    addBtn.innerHTML = '<span class="fx-add-icon">+</span><span>Add Effect</span>';
    addBtn.addEventListener('click', () => this._openModal());
    this._rack.appendChild(addBtn);
    
    // Modal controls
    this.shadowRoot.querySelector('#fx-modal-cancel').addEventListener('click', () => this._closeModal());
    this.shadowRoot.querySelector('#fx-modal-load').addEventListener('click', () => this._loadFromUrl());
    this._urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._loadFromUrl();
    });
    
    // Preset buttons
    this.shadowRoot.querySelectorAll('.fx-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._addBuiltInEffect(btn.dataset.type);
        this._closeModal();
      });
    });
    
    // Close modal on background click
    this._modal.addEventListener('click', (e) => {
      if (e.target === this._modal) this._closeModal();
    });
    
    // Find engine
    this._findEngine();
    window.addEventListener('engine-ready', () => this._findEngine());
  }

  disconnectedCallback() {
    // Cleanup
    this._effects.forEach(fx => {
      if (fx.nodes) {
        fx.nodes.forEach(node => {
          try { node.disconnect(); } catch(e) {}
        });
      }
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'engine-id':
        this._engineId = newValue;
        this._findEngine();
        break;
      case 'mode':
        this._mode = newValue || 'series';
        this._reconnectChain();
        break;
      case 'bypass':
        this._bypassAll = newValue === 'true';
        this._effects.forEach((fx, i) => this._setBypass(i, this._bypassAll));
        break;
    }
  }

  // ============ PROPERTIES ============

  get effects() { return [...this._effects]; }
  get mode() { return this._mode; }
  get bypass() { return this._bypassAll; }

  // ============ PUBLIC METHODS ==========

  /**
   * Ajoute un effet intégré
   */
  async addBuiltInEffect(type) {
    const effect = BUILT_IN_EFFECTS[type];
    if (!effect) return -1;
    
    await this._ensureEngine();
    
    const params = { ...effect.defaultParams };
    const audioContext = this._engine.audioContext;
    const { input, output, nodes } = effect.createNode(audioContext, params);
    
    const fx = {
      type,
      name: effect.name,
      params,
      input,
      output,
      nodes,
      bypassed: false,
      wamInstance: null
    };
    
    this._effects.push(fx);
    this._reconnectChain();
    this._renderEffects();
    
    this.dispatchEvent(new CustomEvent('fx-loaded', {
      bubbles: true,
      composed: true,
      detail: { index: this._effects.length - 1, name: fx.name, type }
    }));
    
    return this._effects.length - 1;
  }

  /**
   * Ajoute un effet depuis URL WAM
   */
  async loadEffect(wamUrl) {
    try {
      await this._ensureEngine();
      
      // Try to load as ES module
      const module = await import(wamUrl);
      const WAMClass = module.default || module;
      
      const instance = new WAMClass({
        audioContext: this._engine.audioContext,
        sampleRate: this._engine.audioContext.sampleRate
      });
      
      await instance.createAudioNode();
      const audioNode = instance.getAudioNode ? instance.getAudioNode() : instance._audioNode;
      
      const fx = {
        type: 'wam',
        name: instance.name || this._getNameFromUrl(wamUrl),
        params: {},
        input: audioNode,
        output: audioNode,
        nodes: [audioNode],
        bypassed: false,
        wamInstance: instance
      };
      
      this._effects.push(fx);
      this._reconnectChain();
      this._renderEffects();
      
      this.dispatchEvent(new CustomEvent('fx-loaded', {
        bubbles: true,
        composed: true,
        detail: { index: this._effects.length - 1, name: fx.name }
      }));
      
      return this._effects.length - 1;
    } catch (e) {
      console.warn('Failed to load WAM effect:', e);
      return -1;
    }
  }

  /**
   * Supprime un effet
   */
  unloadEffect(index) {
    if (index < 0 || index >= this._effects.length) return;
    
    const fx = this._effects[index];
    
    // Disconnect nodes
    if (fx.nodes) {
      fx.nodes.forEach(node => {
        try { node.disconnect(); } catch(e) {}
      });
    }
    
    if (fx.wamInstance && fx.wamInstance.destroy) {
      fx.wamInstance.destroy();
    }
    
    this._effects.splice(index, 1);
    this._reconnectChain();
    this._renderEffects();
    
    this.dispatchEvent(new CustomEvent('fx-unloaded', {
      bubbles: true,
      composed: true,
      detail: { index }
    }));
  }

  /**
   * Bypass un effet
   */
  bypassEffect(index, bypass) {
    this._setBypass(index, bypass);
    this._renderEffects();
    
    this.dispatchEvent(new CustomEvent('fx-bypass', {
      bubbles: true,
      composed: true,
      detail: { index, bypass }
    }));
  }

  /**
   * Met à jour un paramètre d'effet
   */
  setParam(index, param, value) {
    const fx = this._effects[index];
    if (!fx) return;
    
    fx.params[param] = value;
    
    // Update the actual node parameter
    if (fx.nodes) {
      // For built-in effects, update relevant node
      // This would need more specific handling per effect type
    }
    
    this._renderEffects();
  }

  // ============ PRIVATE METHODS ==========

  async _ensureEngine() {
    await this._findEngine();
    if (!this._engine || !this._engine.audioContext) {
      // Wait for engine ready
      await new Promise(resolve => {
        if (this._engine && this._engine.audioContext) {
          resolve();
        } else {
          window.addEventListener('engine-ready', () => resolve(), { once: true });
        }
      });
    }
  }

  _findEngine() {
    if (this._engineId) {
      this._engine = document.getElementById(this._engineId);
    }
    if (!this._engine) {
      this._engine = document.querySelector('pro-audio-engine');
    }
  }

  _reconnectChain() {
    if (!this._engine || !this._engine.audioContext) return;
    
    // Disconnect all existing connections
    this._effects.forEach(fx => {
      if (fx.input) {
        try { fx.input.disconnect(); } catch(e) {}
      }
    });
    
    // Get source node from engine (after EQ)
    let prevNode = this._engine._eqFilters ? this._engine._eqFilters[this._engine._eqFilters.length - 1] : null;
    
    if (!prevNode && this._engine.audioContext) {
      // Create direct input
      prevNode = this._engine.audioContext.createGain();
    }
    
    if (this._mode === 'series' && this._effects.length > 0) {
      // Series connection
      this._effects.forEach((fx, i) => {
        if (prevNode && !fx.bypassed) {
          try { prevNode.connect(fx.input); } catch(e) {}
        }
        prevNode = fx.output;
      });
      
      // Connect last to master
      if (prevNode) {
        try { prevNode.connect(this._engine._masterGain); } catch(e) {}
      }
    } else if (this._effects.length > 0) {
      // Parallel connection
      const inputNode = this._engine.audioContext.createGain();
      const outputNode = this._engine.audioContext.createGain();
      
      try { prevNode.connect(inputNode); } catch(e) {}
      
      this._effects.forEach(fx => {
        if (!fx.bypassed) {
          try { inputNode.connect(fx.input); } catch(e) {}
          try { fx.output.connect(outputNode); } catch(e) {}
        }
      });
      
      try { outputNode.connect(this._engine._masterGain); } catch(e) {}
    }
  }

  _setBypass(index, bypass) {
    const fx = this._effects[index];
    if (!fx) return;
    
    fx.bypassed = bypass;
    this._reconnectChain();
  }

  _openModal() {
    this._modal.classList.add('open');
    this._urlInput.focus();
  }

  _closeModal() {
    this._modal.classList.remove('open');
    this._urlInput.value = '';
  }

  async _loadFromUrl() {
    const url = this._urlInput.value.trim();
    if (!url) return;
    
    const index = await this.loadEffect(url);
    if (index >= 0) {
      this._closeModal();
    } else {
      alert('Failed to load effect. Check the URL and try again.');
    }
  }

  _getNameFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    } catch {
      return 'Effect';
    }
  }

  _renderEmpty() {
    if (this._effects.length === 0) {
      this._rack.innerHTML = '<div class="fx-empty">No effects loaded</div>';
    }
  }

  _renderEffects() {
    // Remove existing effect slots (keep add button)
    this._rack.querySelectorAll('.fx-slot').forEach(el => el.remove());
    
    this._effects.forEach((fx, i) => {
      const slot = document.createElement('div');
      slot.className = `fx-slot ${fx.bypassed ? 'bypassed' : ''}`;
      
      const paramsHtml = Object.entries(fx.params).map(([key, value]) => `
        <div class="fx-param">
          <span class="fx-param-label">${key}</span>
          <input type="range" class="fx-param-slider" 
            min="0" max="1" step="0.01" value="${value}"
            data-index="${i}" data-param="${key}" />
          <span class="fx-param-value">${typeof value === 'number' ? value.toFixed(2) : value}</span>
        </div>
      `).join('');
      
      slot.innerHTML = `
        <div class="fx-slot-header">
          <span class="fx-slot-name">${fx.name}</span>
          <div class="fx-slot-controls">
            <button class="fx-btn bypass ${fx.bypassed ? 'active' : ''}" data-index="${i}" title="Bypass">B</button>
            <button class="fx-btn remove" data-index="${i}" title="Remove">×</button>
          </div>
        </div>
        <div class="fx-slot-gui">
          ${paramsHtml}
        </div>
      `;
      
      // Event handlers
      slot.querySelectorAll('.fx-param-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
          const index = parseInt(e.target.dataset.index);
          const param = e.target.dataset.param;
          const value = parseFloat(e.target.value);
          this.setParam(index, param, value);
        });
      });
      
      slot.querySelectorAll('.fx-btn.bypass').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.dataset.index);
          const fx = this._effects[index];
          if (fx) this.bypassEffect(index, !fx.bypassed);
        });
      });
      
      slot.querySelectorAll('.fx-btn.remove').forEach(btn => {
        btn.addEventListener('click', () => {
          this.unloadEffect(parseInt(btn.dataset.index));
        });
      });
      
      this._rack.insertBefore(slot, this._rack.querySelector('.fx-add'));
    });
    
    this._renderEmpty();
  }
}

customElements.define('pro-fx-rack', ProFXRack);

export default ProFXRack;