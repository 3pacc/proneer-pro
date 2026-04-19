/**
 * Pro-Fader - Fader Web Component
 * 
 * Composant UI primitif avec track visual et handle draggable.
 * Supporte orientation verticale et horizontale.
 * 
 * @element pro-fader
 * 
 * @attr {number} value - Valeur actuelle (défaut: 0)
 * @attr {number} min - Valeur minimum (défaut: 0)
 * @attr {number} max - Valeur maximum (défaut: 100)
 * @attr {number} step - Pas de valeur (défaut: 1)
 * @attr {string} orientation - "vertical" ou "horizontal" (défaut: vertical)
 * @attr {string} label - Label text
 * @attr {string} unit - Unité
 * @attr {number} length - Longueur en pixels (défaut: 150)
 * @attr {string} colors - Couleurs "accent;secondary;bg" (défaut: #00D4FF;#FF6B35;#222)
 * @attr {boolean} show-value - Afficher la valeur (défaut: true)
 * 
 * @fires input - Pendant le drag { value }
 * @fires change - Fin du drag { value }
 * 
 * @cssvar --fader-accent - Couleur principale
 * @cssvar --fader-secondary - Couleur secondaire
 * @cssvar --fader-bg - Couleur fond
 */

const templateFader = document.createElement('template');
templateFader.innerHTML = `
<style>
  :host {
    --fader-accent: var(--fader-color, #00D4FF);
    --fader-secondary: #FF6B35;
    --fader-bg: #1a1a1a;
    --fader-track: #333;
    --fader-length: 150px;
    
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    user-select: none;
  }

  :host([orientation="horizontal"]) {
    flex-direction: row;
  }

  .fader-container {
    position: relative;
    background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
    border-radius: 4px;
    border: 1px solid #444;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
  }

  :host([orientation="vertical"]) .fader-container {
    width: 12px;
    height: var(--fader-length);
    padding: 4px 0;
  }

  :host([orientation="horizontal"]) .fader-container {
    width: var(--fader-length);
    height: 12px;
    padding: 0 4px;
  }

  .fader-track {
    position: absolute;
    background: var(--fader-track);
    border-radius: 2px;
  }

  :host([orientation="vertical"]) .fader-track {
    width: 4px;
    height: calc(100% - 8px);
    left: 4px;
    top: 4px;
  }

  :host([orientation="horizontal"]) .fader-track {
    width: calc(100% - 8px);
    height: 4px;
    top: 4px;
    left: 4px;
  }

  .fader-fill {
    position: absolute;
    background: linear-gradient(to top, var(--fader-accent), var(--fader-secondary));
    border-radius: 2px;
    box-shadow: 0 0 8px var(--fader-accent);
  }

  :host([orientation="vertical"]) .fader-fill {
    width: 4px;
    left: 4px;
    bottom: 4px;
    height: var(--fill-height, 50%);
  }

  :host([orientation="horizontal"]) .fader-fill {
    height: 4px;
    top: 4px;
    left: 4px;
    width: var(--fill-width, 50%);
  }

  .fader-handle {
    position: absolute;
    background: linear-gradient(145deg, #555, #222);
    border: 1px solid #666;
    border-radius: 2px;
    cursor: ns-resize;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  :host([orientation="vertical"]) .fader-handle {
    width: 20px;
    height: 8px;
    left: 50%;
    transform: translateX(-50%);
    bottom: var(--handle-bottom, 50%);
  }

  :host([orientation="horizontal"]) .fader-handle {
    width: 8px;
    height: 20px;
    top: 50%;
    transform: translateY(-50%);
    left: var(--handle-left, 50%);
    cursor: ew-resize;
  }

  .fader-handle::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 2px;
    background: var(--fader-accent);
    border-radius: 1px;
    box-shadow: 0 0 4px var(--fader-accent);
  }

  :host([orientation="horizontal"]) .fader-handle::before {
    width: 2px;
    height: 12px;
  }

  .fader-handle:hover,
  .fader-handle.active {
    border-color: var(--fader-accent);
    box-shadow: 0 0 10px var(--fader-accent);
  }

  .fader-label {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .fader-value {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    color: var(--fader-accent);
    text-shadow: 0 0 5px var(--fader-accent);
    min-width: 40px;
    text-align: center;
  }

  :host([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }
</style>

<div class="fader-container">
  <div class="fader-track"></div>
  <div class="fader-fill"></div>
  <div class="fader-handle"></div>
</div>
<div class="fader-label"></div>
<div class="fader-value"></div>
`;

class ProFader extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'min', 'max', 'step', 'orientation', 'label', 'unit', 'length', 'colors', 'show-value', 'disabled'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(templateFader.content.cloneNode(true));
    
    this._value = 0;
    this._min = 0;
    this._max = 100;
    this._step = 1;
    this._orientation = 'vertical';
    this._length = 150;
    this._dragging = false;
    this._startPos = 0;
    this._startValue = 0;
    
    this._container = this.shadowRoot.querySelector('.fader-container');
    this._handle = this.shadowRoot.querySelector('.fader-handle');
    this._fill = this.shadowRoot.querySelector('.fader-fill');
    this._labelEl = this.shadowRoot.querySelector('.fader-label');
    this._valueEl = this.shadowRoot.querySelector('.fader-value');
  }

  connectedCallback() {
    this._handle.addEventListener('mousedown', this._onMouseDown.bind(this));
    document.addEventListener('mousemove', this._onMouseMove.bind(this));
    document.addEventListener('mouseup', this._onMouseUp.bind(this));
    
    // Touch support
    this._handle.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this._onTouchEnd.bind(this));
    
    // Click on track
    this._container.addEventListener('click', this._onTrackClick.bind(this));
    
    this._updateVisual();
  }

  disconnectedCallback() {
    document.removeEventListener('mousemove', this._onMouseMove.bind(this));
    document.removeEventListener('mouseup', this._onMouseUp.bind(this));
    document.removeEventListener('touchmove', this._onTouchMove.bind(this));
    document.removeEventListener('touchend', this._onTouchEnd.bind(this));
  }

  // ============ ATTRIBUTES ============

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'value':
        this._value = parseFloat(newValue) || 0;
        break;
      case 'min':
        this._min = parseFloat(newValue) || 0;
        break;
      case 'max':
        this._max = parseFloat(newValue) || 100;
        break;
      case 'step':
        this._step = parseFloat(newValue) || 1;
        break;
      case 'orientation':
        this._orientation = newValue || 'vertical';
        break;
      case 'label':
        this._labelEl.textContent = newValue || '';
        break;
      case 'unit':
        this._unit = newValue || '';
        break;
      case 'length':
        this._length = parseInt(newValue) || 150;
        this.style.setProperty('--fader-length', `${this._length}px`);
        break;
      case 'colors':
        this._applyColors(newValue);
        break;
      case 'show-value':
        this._valueEl.style.display = newValue === 'false' ? 'none' : 'block';
        break;
      case 'disabled':
        if (newValue !== null) {
          this._handle.style.cursor = 'not-allowed';
        } else {
          this._handle.style.cursor = '';
        }
        break;
    }
    this._updateVisual();
  }

  // ============ PROPERTIES ============

  get value() {
    return this._value;
  }

  set value(val) {
    this._setValue(val, false);
  }

  get min() { return this._min; }
  get max() { return this._max; }

  get orientation() { return this._orientation; }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(val) { val ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  // ============ PUBLIC METHODS ============

  setValue(value, fireEvent = true) {
    this._setValue(value, fireEvent);
  }

  getValue() {
    return this._value;
  }

  reset() {
    const def = this.hasAttribute('defvalue') ? parseFloat(this.getAttribute('defvalue')) : this._min;
    this._setValue(def, true);
  }

  setColors(colors) {
    if (typeof colors === 'string') {
      this._applyColors(colors);
    } else {
      if (colors.accent) this.style.setProperty('--fader-accent', colors.accent);
      if (colors.secondary) this.style.setProperty('--fader-secondary', colors.secondary);
    }
  }

  // ============ PRIVATE METHODS ============

  _setValue(value, fireEvent) {
    value = Math.max(this._min, Math.min(this._max, value));
    value = Math.round(value / this._step) * this._step;
    
    this._value = value;
    this._updateVisual();
    
    if (fireEvent) {
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { value: this._value }
      }));
    }
  }

  _updateVisual() {
    const range = this._max - this._min;
    const normalized = (this._value - this._min) / range;
    
    if (this._orientation === 'vertical') {
      const handleBottom = normalized * (this._length - 16); // 16 = handle height
      this._handle.style.setProperty('bottom', `${handleBottom}px`);
      this._fill.style.setProperty('--fill-height', `${normalized * 100}%`);
    } else {
      const handleLeft = normalized * (this._length - 16); // 16 = handle width
      this._handle.style.setProperty('left', `${handleLeft}px`);
      this._fill.style.setProperty('--fill-width', `${normalized * 100}%`);
    }
    
    const displayValue = this._step < 1 ? this._value.toFixed(2) : Math.round(this._value);
    this._valueEl.textContent = displayValue + (this._unit || '');
  }

  _applyColors(colorsStr) {
    const parts = colorsStr.split(';');
    if (parts[0]) this.style.setProperty('--fader-accent', parts[0].trim());
    if (parts[1]) this.style.setProperty('--fader-secondary', parts[1].trim());
    if (parts[2]) this.style.setProperty('--fader-bg', parts[2].trim());
  }

  _valueFromPosition(clientX, clientY) {
    const rect = this._container.getBoundingClientRect();
    let ratio;
    
    if (this._orientation === 'vertical') {
      ratio = 1 - (clientY - rect.top) / rect.height;
    } else {
      ratio = (clientX - rect.left) / rect.width;
    }
    
    ratio = Math.max(0, Math.min(1, ratio));
    return this._min + ratio * (this._max - this._min);
  }

  // ============ EVENT HANDLERS ============

  _onMouseDown(e) {
    if (this.disabled) return;
    e.preventDefault();
    this._dragging = true;
    this._startPos = this._orientation === 'vertical' ? e.clientY : e.clientX;
    this._startValue = this._value;
    this._handle.classList.add('active');
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    
    const currentPos = this._orientation === 'vertical' ? e.clientY : e.clientX;
    const delta = this._startPos - currentPos;
    const range = this._max - this._min;
    const sensitivity = this._length / range * this._step;
    
    const newValue = this._startValue + delta * sensitivity;
    this._setValue(newValue, false);
    
    this.dispatchEvent(new CustomEvent('input', {
      bubbles: true,
      composed: true,
      detail: { value: this._value }
    }));
  }

  _onMouseUp(e) {
    if (this._dragging) {
      this._dragging = false;
      this._handle.classList.remove('active');
      
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { value: this._value }
      }));
    }
  }

  _onTouchStart(e) {
    if (this.disabled) return;
    e.preventDefault();
    const touch = e.touches[0];
    this._dragging = true;
    this._startPos = this._orientation === 'vertical' ? touch.clientY : touch.clientX;
    this._startValue = this._value;
    this._handle.classList.add('active');
  }

  _onTouchMove(e) {
    if (!this._dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const currentPos = this._orientation === 'vertical' ? touch.clientY : touch.clientX;
    const delta = this._startPos - currentPos;
    const range = this._max - this._min;
    const sensitivity = this._length / range * this._step;
    
    const newValue = this._startValue + delta * sensitivity;
    this._setValue(newValue, false);
    
    this.dispatchEvent(new CustomEvent('input', {
      bubbles: true,
      composed: true,
      detail: { value: this._value }
    }));
  }

  _onTouchEnd(e) {
    if (this._dragging) {
      this._dragging = false;
      this._handle.classList.remove('active');
      
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { value: this._value }
      }));
    }
  }

  _onTrackClick(e) {
    if (this.disabled) return;
    // Don't trigger if click was on handle
    if (e.target === this._handle) return;
    
    const newValue = this._valueFromPosition(e.clientX, e.clientY);
    this._setValue(newValue, true);
  }
}

customElements.define('pro-fader', ProFader);

export default ProFader;