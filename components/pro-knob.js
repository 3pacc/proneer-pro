/**
 * Pro-Knob - Rotary Knob Web Component
 * 
 * Composant UI primitif avec interaction drag verticale réaliste
 * et feedback visuel (glow). Inspiré des knobs Pioneer DJ.
 */

const templateKnob = document.createElement('template');
templateKnob.innerHTML = `
<style>
  :host {
    --knob-accent: #00D4FF;
    --knob-secondary: #FF6B35;
    --knob-bg: #1a1a1a;
    --knob-size: 48px;
    --knob-indicator: #00D4FF;
    
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    user-select: none;
    touch-action: none;
  }

  .knob-wrapper {
    position: relative;
    width: var(--knob-size);
    height: var(--knob-size);
  }

  /* Outer ring with arc indicator */
  .knob-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: conic-gradient(
      from 225deg,
      var(--knob-indicator) 0deg,
      var(--knob-indicator) var(--arc-angle, 0deg),
      rgba(255,255,255,0.05) var(--arc-angle, 0deg),
      rgba(255,255,255,0.05) 270deg,
      transparent 270deg
    );
    opacity: 0.6;
    transition: opacity 0.15s;
  }

  :host(:hover) .knob-ring {
    opacity: 1;
  }

  /* Main knob body */
  .knob-body {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(145deg, #3a3a3a 0%, #1a1a1a 50%, #0a0a0a 100%);
    box-shadow: 
      0 2px 8px rgba(0,0,0,0.6),
      inset 0 1px 1px rgba(255,255,255,0.1),
      inset 0 -1px 1px rgba(0,0,0,0.3);
    border: 2px solid #444;
    cursor: ns-resize;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  :host(:hover) .knob-body {
    border-color: var(--knob-accent);
  }

  :host(:focus-within) .knob-body {
    border-color: var(--knob-accent);
    box-shadow: 
      0 0 12px var(--knob-accent),
      0 2px 8px rgba(0,0,0,0.6);
  }

  /* Inner cap with gradient */
  .knob-cap {
    position: absolute;
    inset: 15%;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #4a4a4a, #1a1a1a 70%);
    border: 1px solid rgba(255,255,255,0.05);
  }

  /* Indicator line - the rotating part */
  .knob-indicator {
    position: absolute;
    top: 12%;
    left: 50%;
    width: 3px;
    height: 30%;
    background: var(--knob-indicator);
    border-radius: 2px;
    transform-origin: center bottom;
    transform: translateX(-50%) rotate(var(--rotation, -135deg));
    box-shadow: 0 0 6px var(--knob-indicator);
    transition: transform 0.05s ease-out;
  }

  /* Center dot */
  .knob-center {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20%;
    height: 20%;
    background: radial-gradient(circle, #555, #222);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    border: 1px solid #666;
  }

  /* Value display */
  .knob-value {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 9px;
    color: var(--knob-accent);
    text-shadow: 0 0 4px var(--knob-accent);
    min-width: 32px;
    text-align: center;
    opacity: 0.9;
  }

  /* Label below */
  .knob-label {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 8px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :host([disabled]) {
    opacity: 0.4;
    pointer-events: none;
  }
</style>

<div class="knob-wrapper">
  <div class="knob-ring"></div>
  <div class="knob-body">
    <div class="knob-cap"></div>
    <div class="knob-indicator"></div>
    <div class="knob-center"></div>
  </div>
</div>
<div class="knob-value">0</div>
<div class="knob-label"></div>
`;

class ProKnob extends HTMLElement {
  static get observedAttributes() {
    return ['value', 'min', 'max', 'step', 'label', 'unit', 'size', 'colors', 'sensitivity', 'logarithmic', 'bipolar', 'disabled'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(templateKnob.content.cloneNode(true));
    
    this._value = 0;
    this._min = 0;
    this._max = 100;
    this._step = 1;
    this._sensitivity = 1;
    this._logarithmic = false;
    this._bipolar = false;
    this._dragging = false;
    this._startY = 0;
    this._startValue = 0;
    this._currentRotation = -135;
    
    this._wrapper = this.shadowRoot.querySelector('.knob-wrapper');
    this._ring = this.shadowRoot.querySelector('.knob-ring');
    this._body = this.shadowRoot.querySelector('.knob-body');
    this._indicator = this.shadowRoot.querySelector('.knob-indicator');
    this._labelEl = this.shadowRoot.querySelector('.knob-label');
    this._valueEl = this.shadowRoot.querySelector('.knob-value');
  }

  connectedCallback() {
    // Mouse events
    this._body.addEventListener('mousedown', this._onMouseDown.bind(this));
    document.addEventListener('mousemove', this._onMouseMove.bind(this));
    document.addEventListener('mouseup', this._onMouseUp.bind(this));
    
    // Touch events
    this._body.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this._onTouchEnd.bind(this));
    
    // Double click to reset
    this._body.addEventListener('dblclick', this._onDoubleClick.bind(this));
    
    // Keyboard
    this.setAttribute('tabindex', '0');
    this.addEventListener('keydown', this._onKeyDown.bind(this));
    
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
      case 'label':
        this._labelEl.textContent = newValue || '';
        break;
      case 'unit':
        this._unit = newValue || '';
        break;
      case 'size':
        const size = parseInt(newValue) || 48;
        this.style.setProperty('--knob-size', `${size}px`);
        break;
      case 'colors':
        this._applyColors(newValue);
        break;
      case 'sensitivity':
        this._sensitivity = parseFloat(newValue) || 1;
        break;
      case 'logarithmic':
        this._logarithmic = newValue === 'true';
        break;
      case 'bipolar':
        this._bipolar = newValue === 'true';
        break;
      case 'disabled':
        if (newValue !== null) {
          this._body.style.cursor = 'not-allowed';
        } else {
          this._body.style.cursor = 'ns-resize';
        }
        break;
    }
    this._updateVisual();
  }

  // ============ PROPERTIES ============

  get value() { return this._value; }
  set value(val) { this._setValue(val, false); }

  get min() { return this._min; }
  set min(val) { this._min = val; this._updateVisual(); }

  get max() { return this._max; }
  set max(val) { this._max = val; this._updateVisual(); }

  get step() { return this._step; }
  set step(val) { this._step = val; }

  get label() { return this.getAttribute('label') || ''; }
  set label(val) { this.setAttribute('label', val); }

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
      if (colors.accent) this.style.setProperty('--knob-accent', colors.accent);
      if (colors.secondary) this.style.setProperty('--knob-indicator', colors.accent || colors.secondary);
      if (colors.bg) this.style.setProperty('--knob-bg', colors.bg);
    }
  }

  // ============ PRIVATE METHODS ============

  _setValue(value, fireEvent) {
    // Clamp
    value = Math.max(this._min, Math.min(this._max, value));
    
    // Snap to step
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
    // Calculate rotation based on value
    const range = this._max - this._min;
    const normalized = (this._value - this._min) / range;
    
    // Map 0-1 to -135deg to +135deg (270 degree sweep)
    this._currentRotation = normalized * 270 - 135;
    
    // Update CSS custom properties
    this._wrapper.style.setProperty('--rotation', `${this._currentRotation}deg`);
    
    // Arc angle for the ring indicator (from 0 to current rotation)
    const arcAngle = Math.max(0, (this._currentRotation + 135));
    this._wrapper.style.setProperty('--arc-angle', `${arcAngle}deg`);
    
    // Value display
    const displayValue = Math.abs(this._value) < 0.01 ? '0' : 
                        this._step < 1 ? this._value.toFixed(1) : 
                        Math.round(this._value).toString();
    this._valueEl.textContent = displayValue + (this._unit || '');
  }

  _applyColors(colorsStr) {
    const parts = colorsStr.split(';');
    if (parts[0]) {
      this.style.setProperty('--knob-accent', parts[0].trim());
      this.style.setProperty('--knob-indicator', parts[0].trim());
    }
    if (parts[1]) this.style.setProperty('--knob-secondary', parts[1].trim());
    if (parts[2]) this.style.setProperty('--knob-bg', parts[2].trim());
  }

  _valueFromDelta(deltaY) {
    // Sensitivity: pixels needed for full range
    const sensitivity = 150 / this._sensitivity;
    const range = this._max - this._min;
    
    // deltaY is inverted (drag up = increase)
    const deltaValue = -deltaY / sensitivity * range;
    
    let newValue;
    if (this._logarithmic && this._min > 0) {
      // Logarithmic scaling
      const logMin = Math.log(this._min);
      const logMax = Math.log(this._max);
      const logCurrent = Math.log(Math.max(this._min, this._value));
      const logRange = logMax - logMin;
      const logDelta = -deltaY / sensitivity * logRange / 100;
      newValue = Math.exp(Math.min(logMax, Math.max(logMin, logCurrent + logDelta)));
    } else {
      // Linear scaling
      newValue = this._startValue + deltaValue;
    }
    
    return newValue;
  }

  // ============ EVENT HANDLERS ============

  _onMouseDown(e) {
    if (this.disabled) return;
    e.preventDefault();
    this._dragging = true;
    this._startY = e.clientY;
    this._startValue = this._value;
    this._body.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    
    const deltaY = this._startY - e.clientY;
    const newValue = this._valueFromDelta(deltaY);
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
      this._body.style.cursor = 'ns-resize';
      
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
    this._startY = touch.clientY;
    this._startValue = this._value;
  }

  _onTouchMove(e) {
    if (!this._dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const deltaY = this._startY - touch.clientY;
    const newValue = this._valueFromDelta(deltaY);
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
      
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { value: this._value }
      }));
    }
  }

  _onDoubleClick() {
    this.reset();
  }

  _onKeyDown(e) {
    if (this.disabled) return;
    
    let newValue = this._value;
    const step = this._step;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        newValue = this._value + step;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        newValue = this._value - step;
        break;
      case 'Home':
        newValue = this._min;
        break;
      case 'End':
        newValue = this._max;
        break;
      default:
        return;
    }
    
    e.preventDefault();
    this._setValue(newValue, true);
  }
}

customElements.define('pro-knob', ProKnob);

export default ProKnob;