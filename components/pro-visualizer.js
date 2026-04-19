/**
 * Pro-Visualizer - High-Performance Audio Visualizer Web Component
 * 
 * Visualization à 60 FPS utilisant Canvas 2D.
 * Modes: Waveform, Spectrum (FFT), Peak VU-Meters, Circular, Oscilloscope, Spectrogram.
 * 
 * @element pro-visualizer
 * 
 * @attr {string} mode - Mode: waveform|spectrum|vumeter|circular|oscilloscope|spectrogram
 * @attr {string} locked-mode - If set, hides the mode switcher (for dedicated windows)
 * @attr {string} engine-id - ID de l'engine à utiliser
 * @attr {string} colors - Couleurs "accent;secondary;bg" (défaut: #00D4FF;#FF6B35;#121212)
 * @attr {number} fps - Images par seconde (défaut: 60)
 * @attr {string} gradient - Utiliser gradients (défaut: true)
 * @attr {string} glow - Activer les effets glow (défaut: true)
 * @attr {number} height - Hauteur du canvas (défaut: 200)
 * @attr {number} width - Largeur du canvas (défaut: 400)
 * 
 * @fires mode-change - Mode changé { mode }
 */

const templateVisualizer = document.createElement('template');
templateVisualizer.innerHTML = `
<style>
  :host {
    --viz-accent: #00D4FF;
    --viz-secondary: #FF6B35;
    --viz-bg: #121212;
    --viz-glow: 0 0 10px var(--viz-accent);
    
    display: block;
    background: var(--viz-bg);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #333;
  }

  :host([locked-mode]) .viz-header {
    display: none;
  }

  :host([locked-mode]) .viz-labels {
    display: none;
  }

  .viz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: linear-gradient(180deg, #1e1e1e, #161616);
    border-bottom: 1px solid #333;
  }

  .viz-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .viz-modes {
    display: flex;
    gap: 4px;
  }

  .viz-mode-btn {
    background: transparent;
    border: 1px solid #444;
    color: #666;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
  }

  .viz-mode-btn:hover {
    border-color: var(--viz-accent);
    color: var(--viz-accent);
  }

  .viz-mode-btn.active {
    background: var(--viz-accent);
    border-color: var(--viz-accent);
    color: #121212;
  }

  .viz-canvas-container {
    position: relative;
    padding: 4px;
    flex: 1;
    min-height: 0;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    background: #0a0a0a;
    border-radius: 4px;
  }

  .viz-labels {
    display: flex;
    justify-content: space-between;
    padding: 4px 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #555;
  }
</style>

<div class="viz-header">
  <span class="viz-title">Visualizer</span>
  <div class="viz-modes">
    <button class="viz-mode-btn" data-mode="spectrum">Spectrum</button>
    <button class="viz-mode-btn" data-mode="waveform">Waveform</button>
    <button class="viz-mode-btn" data-mode="vumeter">VU Meter</button>
  </div>
</div>

<div class="viz-canvas-container">
  <canvas></canvas>
</div>

<div class="viz-labels">
  <span>0 Hz</span>
  <span>20 kHz</span>
</div>
`;

class ProVisualizer extends HTMLElement {
  static get observedAttributes() {
    return ['mode', 'locked-mode', 'engine-id', 'colors', 'fps', 'gradient', 'glow', 'height', 'width'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(templateVisualizer.content.cloneNode(true));
    
    this._mode = 'spectrum';
    this._engineId = null;
    this._engine = null;
    this._analyser = null;
    this._fps = 60;
    this._useGradient = true;
    this._useGlow = true;
    
    this._canvas = this.shadowRoot.querySelector('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._modeBtns = this.shadowRoot.querySelectorAll('.viz-mode-btn');
    
    this._animationId = null;
    this._isRunning = false;
    
    // Data arrays for analysis
    this._frequencyData = null;
    this._timeData = null;
    
    // Smoothing arrays for liquid spectrum
    this._smoothedSpectrum = null;
    this._smoothDecay = 0.82; // Higher = slower descent (more liquid)
    
    // VU meter peak hold
    this._peakL = 0;
    this._peakR = 0;
    this._peakHoldL = 0;
    this._peakHoldR = 0;
    this._peakHoldTimerL = 0;
    this._peakHoldTimerR = 0;
    this._peakHoldDuration = 90; // frames to hold peak
    this._peakDecay = 0.97;      // decay rate for peak
    this._vuDecay = 0.92;        // decay rate for bar
    
    // Bass energy for glow
    this._bassEnergy = 0;
    
    // Spectrogram history
    this._spectrogramHistory = [];
    this._spectrogramMaxHistory = 200;
  }

  connectedCallback() {
    // Setup mode buttons
    this._modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setMode(btn.dataset.mode);
      });
    });
    
    // Set initial mode button active
    this._updateModeButtons();
    
    // Find engine and setup
    this._findEngine();
    
    // Listen for events
    window.addEventListener('engine-ready', this._onEngineReady.bind(this));
    window.addEventListener('engine-resume', () => this._start());
    window.addEventListener('engine-suspend', () => this._stop());
    window.addEventListener('track-play', () => this._start());
    window.addEventListener('track-pause', () => this._stop());
    
    // Start animation loop
    this._start();
  }

  disconnectedCallback() {
    this._stop();
    
    window.removeEventListener('engine-ready', this._onEngineReady.bind(this));
    window.removeEventListener('engine-resume', () => this._start());
    window.removeEventListener('engine-suspend', () => this._stop());
    window.removeEventListener('track-play', () => this._start());
    window.removeEventListener('track-pause', () => this._stop());
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'mode':
        this._mode = newValue || 'spectrum';
        this._updateModeButtons();
        break;
      case 'locked-mode':
        // When locked-mode is set, the header is hidden via CSS
        if (newValue !== null) this._mode = newValue;
        break;
      case 'engine-id':
        this._engineId = newValue;
        this._findEngine();
        break;
      case 'colors':
        this._applyColors(newValue);
        break;
      case 'fps':
        this._fps = parseInt(newValue) || 60;
        break;
      case 'gradient':
        this._useGradient = newValue !== 'false';
        break;
      case 'glow':
        this._useGlow = newValue !== 'false';
        break;
      case 'height':
        this._canvas.style.height = `${newValue}px`;
        this._resizeCanvas();
        break;
      case 'width':
        this._canvas.width = parseInt(newValue) || 400;
        this._resizeCanvas();
        break;
    }
  }

  // ============ PROPERTIES ============

  get mode() { return this._mode; }
  set mode(val) { this.setAttribute('mode', val); }

  get fps() { return this._fps; }
  set fps(val) { this._fps = val; }

  get colors() {
    return {
      accent: getComputedStyle(this).getPropertyValue('--viz-accent').trim(),
      secondary: getComputedStyle(this).getPropertyValue('--viz-secondary').trim(),
      bg: getComputedStyle(this).getPropertyValue('--viz-bg').trim()
    };
  }

  // ============ PUBLIC METHODS ============

  /**
   * Change le mode de visualisation
   * @param {string} mode - 'spectrum' | 'waveform' | 'vumeter'
   */
  setMode(mode) {
    if (!['spectrum', 'waveform', 'vumeter', 'circular', 'oscilloscope', 'spectrogram'].includes(mode)) return;
    
    this._mode = mode;
    this._updateModeButtons();
    
    this.dispatchEvent(new CustomEvent('mode-change', {
      bubbles: true,
      composed: true,
      detail: { mode }
    }));
  }

  /**
   * Démarre le rendu
   */
  start() {
    this._start();
  }

  /**
   * Arrête le rendu
   */
  stop() {
    this._stop();
  }

  /**
   * Met à jour les couleurs
   * @param {object|string} colors 
   */
  setColors(colors) {
    if (typeof colors === 'string') {
      this._applyColors(colors);
    } else {
      if (colors.accent) this.style.setProperty('--viz-accent', colors.accent);
      if (colors.secondary) this.style.setProperty('--viz-secondary', colors.secondary);
      if (colors.bg) this.style.setProperty('--viz-bg', colors.bg);
    }
  }

  // ============ PRIVATE METHODS ============

  _findEngine() {
    if (this._engineId) {
      this._engine = document.getElementById(this._engineId);
    }
    
    if (!this._engine) {
      this._engine = document.querySelector('pro-audio-engine');
    }
    
    if (this._engine && this._engine.analyser) {
      this._setupAnalyser();
    }
  }

  _setupAnalyser() {
    this._analyser = this._engine.analyser;
    
    if (this._analyser) {
      this._frequencyData = new Uint8Array(this._analyser.frequencyBinCount);
      this._timeData = new Uint8Array(this._analyser.fftSize);
      // Initialize smoothing array
      this._smoothedSpectrum = new Float32Array(this._analyser.frequencyBinCount).fill(0);
    }
    
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const rect = this._canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    
    this._ctx.scale(dpr, dpr);
    this._width = rect.width;
    this._height = rect.height;
  }

  _start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._animate();
  }

  _stop() {
    this._isRunning = false;
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  _animate() {
    if (!this._isRunning) return;
    
    this._animationId = requestAnimationFrame(() => this._animate());
    
    // Get analyser data
    if (this._analyser) {
      this._analyser.getByteFrequencyData(this._frequencyData);
      this._analyser.getByteTimeDomainData(this._timeData);
    }
    
    // Render based on mode
    this._clear();
    
    switch (this._mode) {
      case 'spectrum':
        this._renderSpectrum();
        break;
      case 'waveform':
        this._renderWaveform();
        break;
      case 'vumeter':
        this._renderVUMeter();
        break;
      case 'circular':
        this._renderCircular();
        break;
      case 'oscilloscope':
        this._renderOscilloscope();
        break;
      case 'spectrogram':
        this._renderSpectrogram();
        break;
    }
  }

  _clear() {
    this._ctx.fillStyle = '#0a0a0a';
    this._ctx.fillRect(0, 0, this._width, this._height);
  }

  _renderSpectrum() {
    if (!this._frequencyData || !this._smoothedSpectrum) return;
    
    const accent = getComputedStyle(this).getPropertyValue('--viz-accent').trim() || '#00D4FF';
    const secondary = getComputedStyle(this).getPropertyValue('--viz-secondary').trim() || '#FF6B35';
    
    const barCount = 64;
    const barWidth = this._width / barCount;
    const step = Math.floor(this._frequencyData.length / barCount);
    
    // Create gradient
    const gradient = this._ctx.createLinearGradient(0, this._height, 0, 0);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(0.5, secondary);
    gradient.addColorStop(1, '#ff0080');
    
    // Calculate bass energy for glow
    let bassSum = 0;
    for (let i = 0; i < 8; i++) bassSum += this._frequencyData[i * step];
    this._bassEnergy = this._bassEnergy * 0.9 + (bassSum / 8 / 255) * 0.1;
    
    for (let i = 0; i < barCount; i++) {
      const rawValue = this._frequencyData[i * step];
      
      // Exponential smoothing: bars fall slowly, rise instantly
      const idx = i * step;
      if (rawValue > this._smoothedSpectrum[idx]) {
        this._smoothedSpectrum[idx] = rawValue; // instant rise
      } else {
        this._smoothedSpectrum[idx] = this._smoothedSpectrum[idx] * this._smoothDecay + rawValue * (1 - this._smoothDecay);
      }
      
      const value = this._smoothedSpectrum[idx];
      const barHeight = (value / 255) * this._height * 0.9;
      
      const x = i * barWidth;
      const y = this._height - barHeight;
      
      // Bar with gradient
      this._ctx.fillStyle = gradient;
      this._ctx.fillRect(x, y, barWidth - 2, barHeight);
      
      // Peak indicator (small bright line at peak)
      if (barHeight > 4) {
        this._ctx.fillStyle = '#fff';
        this._ctx.globalAlpha = 0.7;
        this._ctx.fillRect(x, y, barWidth - 2, 2);
        this._ctx.globalAlpha = 1;
      }
      
      // Glow effect pulsing with bass energy
      if (this._useGlow && barHeight > 10) {
        this._ctx.shadowBlur = 8 + this._bassEnergy * 20;
        this._ctx.shadowColor = accent;
        this._ctx.fillStyle = accent;
        this._ctx.globalAlpha = 0.3;
        this._ctx.fillRect(x, y, barWidth - 2, 2);
        this._ctx.shadowBlur = 0;
        this._ctx.globalAlpha = 1;
      }
    }
    
    // Grid lines
    this._ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    this._ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (this._height / 5) * i;
      this._ctx.beginPath();
      this._ctx.moveTo(0, y);
      this._ctx.lineTo(this._width, y);
      this._ctx.stroke();
    }
  }

  _renderWaveform() {
    if (!this._timeData) return;

    const accent = getComputedStyle(this).getPropertyValue('--viz-accent').trim() || '#00D4FF';
    const secondary = getComputedStyle(this).getPropertyValue('--viz-secondary').trim() || '#FF6B35';

    // Create a smooth gradient for the filled waveform
    const gradient = this._ctx.createLinearGradient(0, 0, 0, this._height);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(0.5, secondary);
    gradient.addColorStop(1, accent);

    this._ctx.fillStyle = gradient;

    if (this._useGlow) {
      this._ctx.shadowBlur = 5;
      this._ctx.shadowColor = accent;
    }

    const cy = this._height / 2;
    const sliceWidth = this._width / this._timeData.length;

    for (let i = 0; i < this._timeData.length; i++) {
      const v = this._timeData[i] / 128.0; 
      const y = (v * this._height) / 2;
      
      // Draw vertical blocks mirroring from the center
      if (Math.abs(y - cy) > 1) {
        this._ctx.fillRect(i * sliceWidth, Math.min(y, cy), sliceWidth > 1 ? sliceWidth - 0.5 : sliceWidth, Math.abs(y - cy));
      }
    }

    this._ctx.shadowBlur = 0;
    
    // Center line
    this._ctx.strokeStyle = '#fff';
    this._ctx.globalAlpha = 0.2;
    this._ctx.lineWidth = 1;
    this._ctx.beginPath();
    this._ctx.moveTo(0, cy);
    this._ctx.lineTo(this._width, cy);
    this._ctx.stroke();
    this._ctx.globalAlpha = 1;
  }

  _renderVUMeter() {
    if (!this._frequencyData) return;
    
    const accent = getComputedStyle(this).getPropertyValue('--viz-accent').trim() || '#00D4FF';
    const secondary = getComputedStyle(this).getPropertyValue('--viz-secondary').trim() || '#FF6B35';
    
    // Calculate RMS levels (pseudo L/R from frequency bands)
    let sumL = 0, sumR = 0;
    const half = Math.min(64, this._frequencyData.length);
    for (let i = 0; i < half / 2; i++) {
      sumL += this._frequencyData[i] * this._frequencyData[i];
    }
    for (let i = half / 2; i < half; i++) {
      sumR += this._frequencyData[i] * this._frequencyData[i];
    }
    const rmsL = Math.sqrt(sumL / (half / 2)) / 255;
    const rmsR = Math.sqrt(sumR / (half / 2)) / 255;
    
    // Convert to dBFS (0 = max, -48 = silence floor)
    const toDB = (linear) => linear > 0.001 ? Math.max(-48, 20 * Math.log10(linear)) : -48;
    const dbL = toDB(rmsL);
    const dbR = toDB(rmsR);
    
    // Normalize -48..0 to 0..1
    const normL = (dbL + 48) / 48;
    const normR = (dbR + 48) / 48;
    
    // Smooth decay (bar falls slowly)
    this._peakL = normL > this._peakL ? normL : this._peakL * this._vuDecay;
    this._peakR = normR > this._peakR ? normR : this._peakR * this._vuDecay;
    
    // Peak hold (stays at peak for a while then decays)
    if (normL >= this._peakHoldL) {
      this._peakHoldL = normL;
      this._peakHoldTimerL = this._peakHoldDuration;
    } else if (this._peakHoldTimerL > 0) {
      this._peakHoldTimerL--;
    } else {
      this._peakHoldL *= this._peakDecay;
    }
    
    if (normR >= this._peakHoldR) {
      this._peakHoldR = normR;
      this._peakHoldTimerR = this._peakHoldDuration;
    } else if (this._peakHoldTimerR > 0) {
      this._peakHoldTimerR--;
    } else {
      this._peakHoldR *= this._peakDecay;
    }
    
    const meterHeight = this._height * 0.85;
    const meterWidth = 30;
    const gap = 20;
    const startX = (this._width - (meterWidth * 2 + gap)) / 2;
    
    // Left meter
    this._renderVUBar(startX, meterHeight, meterWidth, this._peakL, this._peakHoldL, accent, secondary);
    
    // Right meter
    this._renderVUBar(startX + meterWidth + gap, meterHeight, meterWidth, this._peakR, this._peakHoldR, accent, secondary);
    
    // Labels
    this._ctx.fillStyle = '#666';
    this._ctx.font = '10px JetBrains Mono';
    this._ctx.textAlign = 'center';
    this._ctx.fillText('L', startX + meterWidth / 2, this._height - 5);
    this._ctx.fillText('R', startX + meterWidth + gap + meterWidth / 2, this._height - 5);
    
    // dBFS scale
    const dbLabels = ['0', '-6', '-12', '-24', '-48'];
    this._ctx.fillStyle = '#444';
    this._ctx.font = '8px JetBrains Mono';
    this._ctx.textAlign = 'right';
    dbLabels.forEach((db, i) => {
      const y = (meterHeight / (dbLabels.length - 1)) * i + 10;
      this._ctx.fillText(db, startX - 6, y + 3);
    });
  }

  _renderVUBar(x, height, width, level, peakHold, accent, secondary) {
    // Background
    this._ctx.fillStyle = '#1a1a1a';
    this._ctx.fillRect(x, 0, width, height);
    
    // Segments
    const segmentCount = 24;
    const segmentHeight = height / segmentCount - 2;
    const litSegments = Math.floor(level * segmentCount);
    
    for (let i = 0; i < segmentCount; i++) {
      const y = height - (i + 1) * (segmentHeight + 2);
      
      if (i < litSegments) {
        // Color based on level (green -> yellow/orange -> red)
        if (i > segmentCount * 0.88) {
          this._ctx.fillStyle = '#ff3333';
          this._ctx.shadowColor = '#ff3333';
        } else if (i > segmentCount * 0.72) {
          this._ctx.fillStyle = '#ffaa00';
          this._ctx.shadowColor = '#ffaa00';
        } else {
          this._ctx.fillStyle = '#00ff88';
          this._ctx.shadowColor = '#00ff88';
        }
        
        if (this._useGlow) {
          this._ctx.shadowBlur = 4;
        }
      } else {
        this._ctx.fillStyle = '#2a2a2a';
        this._ctx.shadowBlur = 0;
      }
      
      this._ctx.fillRect(x + 2, y, width - 4, segmentHeight);
    }
    
    // Peak hold indicator (bright line that stays at peak)
    const peakSegment = Math.floor(peakHold * segmentCount);
    if (peakSegment > 0 && peakSegment < segmentCount) {
      const peakY = height - (peakSegment + 1) * (segmentHeight + 2);
      this._ctx.shadowBlur = 0;
      this._ctx.fillStyle = peakSegment > segmentCount * 0.88 ? '#ff4444' : '#fff';
      this._ctx.globalAlpha = 0.9;
      this._ctx.fillRect(x + 2, peakY, width - 4, 2);
      this._ctx.globalAlpha = 1;
    }
    
    this._ctx.shadowBlur = 0;
    
    // Border
    this._ctx.strokeStyle = '#333';
    this._ctx.lineWidth = 1;
    this._ctx.strokeRect(x, 0, width, height);
  }

  _applyColors(colorsStr) {
    const parts = colorsStr.split(';');
    if (parts[0]) this.style.setProperty('--viz-accent', parts[0].trim());
    if (parts[1]) this.style.setProperty('--viz-secondary', parts[1].trim());
    if (parts[2]) this.style.setProperty('--viz-bg', parts[2].trim());
  }

  _updateModeButtons() {
    this._modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this._mode);
    });
  }

  _onEngineReady(e) {
    this._engine = e.target;
    this._setupAnalyser();
  }

  // ============ NEW VISUALIZATION MODES ============

  _renderCircular() {
    if (!this._frequencyData || !this._smoothedSpectrum) return;
    const accent = getComputedStyle(this).getPropertyValue('--viz-accent').trim() || '#00D4FF';
    const secondary = getComputedStyle(this).getPropertyValue('--viz-secondary').trim() || '#FF6B35';

    const cx = this._width / 2;
    const cy = this._height / 2;
    const baseR = Math.min(cx, cy) * 0.35;
    const maxR = Math.min(cx, cy) * 0.85;
    const barCount = 90;
    const step = Math.floor(this._frequencyData.length / barCount);

    // Rotation animation
    const time = performance.now() / 8000;

    // Background glow
    let bassSum = 0;
    for (let i = 0; i < 6; i++) bassSum += this._frequencyData[i * step];
    this._bassEnergy = this._bassEnergy * 0.92 + (bassSum / 6 / 255) * 0.08;
    const glowR = baseR + this._bassEnergy * 30;
    const grd = this._ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grd.addColorStop(0, `rgba(0, 212, 255, ${this._bassEnergy * 0.15})`);
    grd.addColorStop(1, 'transparent');
    this._ctx.fillStyle = grd;
    this._ctx.fillRect(0, 0, this._width, this._height);

    for (let i = 0; i < barCount; i++) {
      const raw = this._frequencyData[i * step];
      const idx = i * step;
      if (raw > this._smoothedSpectrum[idx]) this._smoothedSpectrum[idx] = raw;
      else this._smoothedSpectrum[idx] = this._smoothedSpectrum[idx] * 0.88 + raw * 0.12;

      const val = this._smoothedSpectrum[idx] / 255;
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2 + time;
      const barLen = val * (maxR - baseR);

      const x1 = cx + Math.cos(angle) * baseR;
      const y1 = cy + Math.sin(angle) * baseR;
      const x2 = cx + Math.cos(angle) * (baseR + barLen);
      const y2 = cy + Math.sin(angle) * (baseR + barLen);

      const hue = (i / barCount) * 180 + 180;
      this._ctx.strokeStyle = `hsl(${hue}, 80%, ${50 + val * 30}%)`;
      this._ctx.lineWidth = Math.max(1.5, (Math.PI * 2 * baseR) / barCount - 1);
      this._ctx.lineCap = 'round';

      if (this._useGlow) {
        this._ctx.shadowBlur = 6 + val * 10;
        this._ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
      }

      this._ctx.beginPath();
      this._ctx.moveTo(x1, y1);
      this._ctx.lineTo(x2, y2);
      this._ctx.stroke();
    }

    this._ctx.shadowBlur = 0;

    // Center circle
    this._ctx.beginPath();
    this._ctx.arc(cx, cy, baseR - 4, 0, Math.PI * 2);
    this._ctx.fillStyle = '#111';
    this._ctx.fill();
    this._ctx.strokeStyle = '#333';
    this._ctx.lineWidth = 1;
    this._ctx.stroke();
  }

  _renderOscilloscope() {
    if (!this._timeData) return;
    const accent = getComputedStyle(this).getPropertyValue('--viz-accent').trim() || '#00D4FF';

    const sliceWidth = this._width / this._timeData.length;

    // Main signal
    this._ctx.strokeStyle = accent;
    this._ctx.lineWidth = 2;
    this._ctx.lineJoin = 'round';

    if (this._useGlow) {
      this._ctx.shadowBlur = 8;
      this._ctx.shadowColor = accent;
    }

    this._ctx.beginPath();
    for (let i = 0; i < this._timeData.length; i++) {
      const v = this._timeData[i] / 128.0;
      const y = (v * this._height) / 2;
      if (i === 0) this._ctx.moveTo(0, y);
      else this._ctx.lineTo(i * sliceWidth, y);
    }
    this._ctx.stroke();

    // Ghost trail
    this._ctx.globalAlpha = 0.15;
    this._ctx.strokeStyle = '#FF6B35';
    this._ctx.shadowBlur = 0;
    this._ctx.beginPath();
    for (let i = 0; i < this._timeData.length; i++) {
      const v = this._timeData[i] / 128.0;
      const y = (v * this._height) / 2 + 2;
      if (i === 0) this._ctx.moveTo(0, y);
      else this._ctx.lineTo(i * sliceWidth, y);
    }
    this._ctx.stroke();
    this._ctx.globalAlpha = 1;
    this._ctx.shadowBlur = 0;

    // Center line
    this._ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    this._ctx.lineWidth = 1;
    this._ctx.beginPath();
    this._ctx.moveTo(0, this._height / 2);
    this._ctx.lineTo(this._width, this._height / 2);
    this._ctx.stroke();

    // Grid
    this._ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let i = 1; i < 4; i++) {
      const y = (this._height / 4) * i;
      this._ctx.beginPath();
      this._ctx.moveTo(0, y);
      this._ctx.lineTo(this._width, y);
      this._ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const x = (this._width / 6) * i;
      this._ctx.beginPath();
      this._ctx.moveTo(x, 0);
      this._ctx.lineTo(x, this._height);
      this._ctx.stroke();
    }
  }

  _renderSpectrogram() {
    if (!this._frequencyData) return;

    // Capture current frame
    const frame = new Uint8Array(this._frequencyData.length);
    frame.set(this._frequencyData);
    this._spectrogramHistory.push(frame);
    if (this._spectrogramHistory.length > this._spectrogramMaxHistory) {
      this._spectrogramHistory.shift();
    }

    const cols = this._spectrogramHistory.length;
    const colWidth = this._width / this._spectrogramMaxHistory;
    const barCount = Math.min(128, frame.length);
    const barHeight = this._height / barCount;
    const step = Math.floor(frame.length / barCount);

    for (let x = 0; x < cols; x++) {
      const data = this._spectrogramHistory[x];
      for (let y = 0; y < barCount; y++) {
        const val = data[y * step] / 255;
        if (val < 0.02) continue;
        // Heatmap color (dark blue -> cyan -> yellow -> red -> white)
        let r, g, b;
        if (val < 0.25) {
          r = 0; g = Math.floor(val * 4 * 180); b = Math.floor(val * 4 * 255);
        } else if (val < 0.5) {
          const t = (val - 0.25) * 4;
          r = 0; g = 180 + Math.floor(t * 75); b = 255 - Math.floor(t * 100);
        } else if (val < 0.75) {
          const t = (val - 0.5) * 4;
          r = Math.floor(t * 255); g = 255 - Math.floor(t * 100); b = Math.floor(155 * (1 - t));
        } else {
          const t = (val - 0.75) * 4;
          r = 255; g = Math.floor(155 + t * 100); b = Math.floor(t * 200);
        }

        this._ctx.fillStyle = `rgb(${r},${g},${b})`;
        this._ctx.fillRect(
          x * colWidth,
          this._height - (y + 1) * barHeight,
          Math.ceil(colWidth) + 1,
          Math.ceil(barHeight) + 1
        );
      }
    }

    // Time indicator line
    const lineX = cols * colWidth;
    this._ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    this._ctx.lineWidth = 1;
    this._ctx.beginPath();
    this._ctx.moveTo(lineX, 0);
    this._ctx.lineTo(lineX, this._height);
    this._ctx.stroke();
  }
}

customElements.define('pro-visualizer', ProVisualizer);

export default ProVisualizer;