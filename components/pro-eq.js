/**
 * Pro-EQ - 10-Band Parametric Equalizer Web Component
 * 
 * Égaliseur graphique 10 bandes utilisant des BiquadFilterNode.
 * Fréquences ISO standards.
 * 
 * @element pro-eq
 * 
 * @attr {string} engine-id - ID de l'engine à utiliser
 * @attr {string} bands - JSON array 10 valeurs initiales
 * @attr {string} colors - Couleurs "accent;secondary;background"
 * @attr {string} glow - Activer les effets glow (défaut: true)
 * @attr {number} height - Hauteur (défaut: 120)
 * @attr {string} preset - Preset initial (flat|bass|treble|vocal|rock|electronic)
 * 
 * @fires eq-change - EQ modifié { bands, bandIndex, value }
 */

const ISO_FREQUENCIES_LABEL = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
  vocal: [-2, -1, 0, 2, 3, 2, 3, 1, -1, -2],
  rock: [5, 4, 2, 0, -2, -1, 0, 2, 4, 5],
  electronic: [5, 4, 2, 0, -2, 0, 1, 3, 4, 5]
};

const templateEQ = document.createElement('template');
templateEQ.innerHTML = `
<style>
  :host {
    --eq-accent: #00D4FF;
    --eq-secondary: #FF6B35;
    --eq-bg: #1a1a1a;
    --eq-bar-bg: #2a2a2a;
    --eq-glow: 0 0 8px var(--eq-accent);
    
    display: block;
    background: linear-gradient(180deg, #1e1e1e, #151515);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 16px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
  }

  .eq-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .eq-title {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .eq-presets {
    display: flex;
    gap: 4px;
  }

  .eq-preset-btn {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #888;
    font-size: 9px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
  }

  .eq-preset-btn:hover {
    background: #333;
    color: var(--eq-accent);
    border-color: var(--eq-accent);
  }

  .eq-preset-btn.active {
    background: var(--eq-accent);
    color: #121212;
    border-color: var(--eq-accent);
  }

  .eq-bands {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 100px;
    padding: 0 4px;
    gap: 4px;
  }

  .eq-band {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .eq-bar-container {
    width: 100%;
    height: 80px;
    background: var(--eq-bar-bg);
    border-radius: 4px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #333;
  }

  .eq-bar {
    position: absolute;
    width: 8px;
    background: linear-gradient(to top, var(--eq-accent), var(--eq-secondary));
    border-radius: 2px;
    bottom: 50%;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: var(--eq-glow);
    transition: height 0.1s ease-out;
  }

  .eq-band[data-positive="true"] .eq-bar {
    bottom: 50%;
  }

  .eq-band[data-positive="false"] .eq-bar {
    top: 50%;
    bottom: auto;
    background: linear-gradient(to bottom, var(--eq-accent), var(--eq-secondary));
  }

  .eq-center-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: #555;
  }

  .eq-value {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: var(--eq-accent);
    text-shadow: 0 0 4px var(--eq-accent);
    white-space: nowrap;
  }

  .eq-freq {
    font-size: 9px;
    color: #666;
    text-transform: uppercase;
  }

  .eq-slider {
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: ns-resize;
    position: absolute;
    z-index: 10;
  }

  .eq-reset {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #888;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    text-transform: uppercase;
    cursor: pointer;
    padding: 4px 8px;
    transition: all 0.2s;
  }

  .eq-reset:hover {
    color: var(--eq-accent);
  }
</style>

<div class="eq-header">
  <span class="eq-title">10-Band EQ</span>
  <div class="eq-presets">
    <button class="eq-preset-btn" data-preset="flat">Flat</button>
    <button class="eq-preset-btn" data-preset="bass">Bass</button>
    <button class="eq-preset-btn" data-preset="treble">Treble</button>
    <button class="eq-preset-btn" data-preset="vocal">Vocal</button>
    <button class="eq-preset-btn" data-preset="rock">Rock</button>
    <button class="eq-preset-btn" data-preset="electronic">Elec</button>
  </div>
</div>

<div class="eq-bands"></div>
<button class="eq-reset" title="Reset EQ">↺ Reset</button>
`;

class ProEQ extends HTMLElement {
  static get observedAttributes() {
    return ['engine-id', 'bands', 'colors', 'glow', 'height', 'preset'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(templateEQ.content.cloneNode(true));
    
    this._engineId = null;
    this._engine = null;
    this._bands = [...EQ_PRESETS.flat];
    this._currentPreset = 'flat';
    
    this._bandsContainer = this.shadowRoot.querySelector('.eq-bands');
    this._presetBtns = this.shadowRoot.querySelectorAll('.eq-preset-btn');
    this._resetBtn = this.shadowRoot.querySelector('.eq-reset');
  }

  connectedCallback() {
    // Build band elements
    this._buildBands();
    
    // Setup preset buttons
    this._presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyPreset(btn.dataset.preset);
      });
    });
    
    // Reset button
    this._resetBtn.addEventListener('click', () => this.reset());
    
    // Find engine
    this._findEngine();
    
    // Listen for engine ready
    window.addEventListener('engine-ready', this._onEngineReady.bind(this));
  }

  disconnectedCallback() {
    window.removeEventListener('engine-ready', this._onEngineReady.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'engine-id':
        this._engineId = newValue;
        this._findEngine();
        break;
      case 'bands':
        try {
          const bands = JSON.parse(newValue);
          if (Array.isArray(bands) && bands.length === 10) {
            this._bands = bands;
            this._updateAllBars();
          }
        } catch (e) {}
        break;
      case 'glow':
        if (newValue === 'false') {
          this.style.setProperty('--eq-glow', 'none');
        }
        break;
      case 'height':
        this.style.setProperty('--eq-height', `${newValue}px`);
        break;
      case 'preset':
        if (EQ_PRESETS[newValue]) {
          this.applyPreset(newValue);
        }
        break;
    }
  }

  // ============ PROPERTIES ============

  get bands() { return [...this._bands]; }
  get preset() { return this._currentPreset; }
  get engineId() { return this._engineId; }
  set engineId(val) { this.setAttribute('engine-id', val); }

  // ============ PUBLIC METHODS ============

  /**
   * Définit une bande EQ
   * @param {number} index - Index 0-9
   * @param {number} value - Valeur -12 à +12 dB
   */
  setBand(index, value) {
    if (index < 0 || index > 9) return;
    
    value = Math.max(-12, Math.min(12, value));
    this._bands[index] = value;
    this._updateBar(index);
    this._syncToEngine();
    
    this.dispatchEvent(new CustomEvent('eq-change', {
      bubbles: true,
      composed: true,
      detail: { 
        bands: [...this._bands],
        bandIndex: index,
        value 
      }
    }));
  }

  /**
   * Définit toutes les bandes
   * @param {number[]} values - Array de 10 valeurs
   */
  setAllBands(values) {
    if (!Array.isArray(values) || values.length !== 10) return;
    
    this._bands = values.map(v => Math.max(-12, Math.min(12, v)));
    this._updateAllBars();
    this._syncToEngine();
    
    this.dispatchEvent(new CustomEvent('eq-change', {
      bubbles: true,
      composed: true,
      detail: { bands: [...this._bands] }
    }));
  }

  /**
   * Reset à flat
   */
  reset() {
    this.setAllBands([...EQ_PRESETS.flat]);
    this._currentPreset = 'flat';
    this._updatePresetButtons();
  }

  /**
   * Applique un preset
   * @param {string} presetName 
   */
  applyPreset(presetName) {
    const preset = EQ_PRESETS[presetName];
    if (!preset) return;
    
    this._currentPreset = presetName;
    this.setAllBands([...preset]);
    this._updatePresetButtons();
  }

  /**
   * Retourne l'état complet
   */
  getState() {
    return {
      bands: [...this._bands],
      preset: this._currentPreset
    };
  }

  // ============ PRIVATE METHODS ============

  _buildBands() {
    this._bandsContainer.innerHTML = '';
    
    this._bands.forEach((value, i) => {
      const band = document.createElement('div');
      band.className = 'eq-band';
      band.dataset.positive = value >= 0;
      band.innerHTML = `
        <div class="eq-bar-container">
          <div class="eq-center-line"></div>
          <div class="eq-bar"></div>
          <div class="eq-value">${value > 0 ? '+' : ''}${value}</div>
          <input type="range" class="eq-slider" min="-12" max="12" step="0.5" value="${value}" />
        </div>
        <div class="eq-freq">${ISO_FREQUENCIES_LABEL[i]}</div>
      `;
      
      const slider = band.querySelector('.eq-slider');
      slider.addEventListener('input', (e) => {
        e.stopPropagation();
        this.setBand(i, parseFloat(slider.value));
      });
      
      this._bandsContainer.appendChild(band);
    });
  }

  _updateBar(index) {
    const bandEl = this._bandsContainer.children[index];
    if (!bandEl) return;
    
    const value = this._bands[index];
    const bar = bandEl.querySelector('.eq-bar');
    const valueEl = bandEl.querySelector('.eq-value');
    const slider = bandEl.querySelector('.eq-slider');
    
    bandEl.dataset.positive = value >= 0;
    
    // Calculate height percentage (0-12 dB range = 0-100% height)
    const absValue = Math.abs(value);
    const heightPercent = (absValue / 12) * 40; // Max 40% of container height
    
    bar.style.height = `${heightPercent}%`;
    valueEl.textContent = `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
    slider.value = value;
  }

  _updateAllBars() {
    this._bands.forEach((_, i) => this._updateBar(i));
  }

  _updatePresetButtons() {
    this._presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === this._currentPreset);
    });
  }

  _findEngine() {
    if (this._engineId) {
      this._engine = document.getElementById(this._engineId);
    }
    
    if (!this._engine) {
      // Try to find first engine
      this._engine = document.querySelector('pro-audio-engine');
    }
    
    if (this._engine && this._engine.audioContext) {
      this._syncToEngine();
    }
  }

  _syncToEngine() {
    if (this._engine && this._engine.setAllEq) {
      this._engine.setAllEq(this._bands);
    }
  }

  _onEngineReady(e) {
    this._engine = e.target;
    this._syncToEngine();
  }
}

customElements.define('pro-eq', ProEQ);

export default ProEQ;