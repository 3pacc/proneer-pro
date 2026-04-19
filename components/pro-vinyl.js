/**
 * Pro-Vinyl - Spinning Vinyl Disc with Transport Controls & Butterchurn
 * 
 * A premium vinyl record that spins when audio plays.
 * Integrated transport buttons (prev/play/stop/next) below the disc.
 * Center label area shows Butterchurn (MilkDrop) WebGL visualization.
 * 
 * @element pro-vinyl
 */

class ProVinyl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this._isPlaying = false;
    this._rotation = 0;
    this._animId = null;
    this._engine = null;
    this._butterchurn = null;
    this._presets = null;
    this._currentPresetIdx = 0;
    this._bcCanvas = null;
    this._lastTime = 0;
    this._bcReady = false;
    this._bcFailed = false;
    this._initAttempts = 0;

    this.shadowRoot.innerHTML = `
<style>
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #0a0a0a;
    overflow: hidden;
    user-select: none;
  }

  .vinyl-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 100%;
    padding: 6px;
  }

  .vinyl-wrapper {
    position: relative;
    flex: 1;
    aspect-ratio: 1;
    max-width: 100%;
    max-height: calc(100% - 56px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vinyl-disc-area {
    position: relative;
    width: min(100%, 100%);
    height: 100%;
    aspect-ratio: 1;
  }

  /* Outer ring - vinyl grooves */
  .vinyl-outer {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: repeating-radial-gradient(
      circle at center,
      #111 0px, #111 1px,
      #1a1a1a 1px, #1a1a1a 3px,
      #151515 3px, #151515 4px,
      #1d1d1d 4px, #1d1d1d 6px
    );
    box-shadow:
      0 0 60px rgba(0,0,0,0.8),
      inset 0 0 30px rgba(0,0,0,0.5),
      0 0 2px rgba(255,255,255,0.05);
    border: 2px solid #222;
  }

  /* Shiny reflection */
  .vinyl-reflection {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      transparent 20%,
      rgba(255,255,255,0.03) 40%,
      transparent 42%,
      transparent 58%,
      rgba(255,255,255,0.02) 60%,
      transparent 80%
    );
    pointer-events: none;
    z-index: 3;
  }

  /* Label / center area */
  .vinyl-label {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 42%;
    height: 42%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    overflow: hidden;
    z-index: 2;
    border: 2px solid #333;
    box-shadow:
      0 0 20px rgba(0, 212, 255, 0.1),
      inset 0 0 10px rgba(0,0,0,0.5);
    cursor: pointer;
  }

  /* Butterchurn WebGL canvas */
  .bc-canvas {
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 50%;
    background: transparent;
  }

  /* Fallback overlay (HTML, not canvas 2D — avoids locking canvas context) */
  .fallback-label {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, #1a1a2e 0%, #0d0d1a 50%, #050510 100%);
    pointer-events: none;
    transition: opacity 0.5s;
  }
  .fallback-label.hidden { opacity: 0; pointer-events: none; }
  .fallback-label .fl-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #333;
    letter-spacing: 2px;
  }
  .fallback-label .fl-main {
    font-family: 'JetBrains Mono', monospace;
    font-size: 16px;
    font-weight: bold;
    color: #00D4FF;
    letter-spacing: 3px;
    text-shadow: 0 0 12px rgba(0, 212, 255, 0.3);
  }

  /* Center spindle */
  .vinyl-spindle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 5%;
    height: 5%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #555, #222);
    border: 1px solid #444;
    z-index: 4;
    box-shadow: 0 0 8px rgba(0,0,0,0.6);
  }

  /* Tonearm */
  .tonearm {
    position: absolute;
    top: 8%;
    right: 6%;
    width: 42%;
    height: 4px;
    transform-origin: right center;
    transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 5;
    transform: rotate(-25deg);
  }
  .tonearm.playing {
    transform: rotate(-5deg);
  }
  .tonearm-arm {
    position: absolute;
    right: 0;
    top: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, #555, #888);
    border-radius: 2px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  .tonearm-head {
    position: absolute;
    left: -4px;
    top: -4px;
    width: 12px;
    height: 12px;
    background: #666;
    border-radius: 2px;
    border: 1px solid #888;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }
  .tonearm-pivot {
    position: absolute;
    right: -6px;
    top: -8px;
    width: 20px;
    height: 20px;
    background: radial-gradient(circle at 40% 40%, #666, #333);
    border-radius: 50%;
    border: 1px solid #555;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  }

  /* Glow ring */
  .glow-ring {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1px solid transparent;
    transition: all 0.5s;
    z-index: 1;
  }
  .glow-ring.active {
    border-color: rgba(0, 212, 255, 0.2);
    box-shadow: 0 0 40px rgba(0, 212, 255, 0.1);
  }

  /* ===== TRANSPORT CONTROLS ===== */
  .transport-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 0;
    min-height: 42px;
    width: 100%;
  }

  .t-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid #333;
    background: rgba(255,255,255,0.03);
    color: #666;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'JetBrains Mono', monospace;
  }
  .t-btn:hover {
    border-color: #00D4FF;
    color: #00D4FF;
    background: rgba(0,212,255,0.06);
  }

  .t-btn.play-btn {
    width: 44px;
    height: 44px;
    background: #00D4FF;
    border-color: #00D4FF;
    color: #000;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.25);
  }
  .t-btn.play-btn:hover {
    box-shadow: 0 0 30px rgba(0, 212, 255, 0.5);
    transform: scale(1.08);
  }
  .t-btn.play-btn.paused {
    background: rgba(255,255,255,0.06);
    color: #00D4FF;
    box-shadow: none;
  }
  .t-btn.play-btn.paused:hover {
    background: #00D4FF;
    color: #000;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
  }

  .rpm-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    color: #333;
    text-transform: uppercase;
    letter-spacing: 1px;
    position: absolute;
    bottom: 50px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    transition: color 0.3s;
    pointer-events: none;
  }
  .rpm-label.playing { color: #555; }

  .bc-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    color: #00D4FF;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7px;
    padding: 2px 6px;
    border-radius: 3px;
    z-index: 10;
    letter-spacing: 0.5px;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .bc-badge.visible { opacity: 1; }
</style>

<div class="vinyl-container">
  <div class="vinyl-wrapper">
    <div class="vinyl-disc-area" id="disc-area">
      <div class="glow-ring" id="glow-ring"></div>
      <div class="vinyl-outer" id="vinyl-outer"></div>
      <div class="vinyl-reflection"></div>
      <div class="vinyl-label" id="label">
        <canvas class="bc-canvas" id="bc-canvas"></canvas>
        <div class="fallback-label" id="fallback">
          <span class="fl-sub">PRO</span>
          <span class="fl-main">AUDIO</span>
        </div>
      </div>
      <div class="vinyl-spindle"></div>
      <div class="tonearm" id="tonearm">
        <div class="tonearm-arm"></div>
        <div class="tonearm-head"></div>
        <div class="tonearm-pivot"></div>
      </div>
    </div>
    <span class="rpm-label" id="rpm">33 RPM</span>
    <span class="bc-badge" id="bc-badge">MILKDROP</span>
  </div>
  <div class="transport-bar">
    <button class="t-btn" id="btn-prev" title="Previous">⏮</button>
    <button class="t-btn" id="btn-stop" title="Stop">⏹</button>
    <button class="t-btn play-btn paused" id="btn-play" title="Play">▶</button>
    <button class="t-btn" id="btn-next" title="Next">⏭</button>
  </div>
</div>
`;

    this._vinylOuter = this.shadowRoot.getElementById('vinyl-outer');
    this._tonearm = this.shadowRoot.getElementById('tonearm');
    this._glowRing = this.shadowRoot.getElementById('glow-ring');
    this._rpmLabel = this.shadowRoot.getElementById('rpm');
    this._bcCanvas = this.shadowRoot.getElementById('bc-canvas');
    this._bcBadge = this.shadowRoot.getElementById('bc-badge');
    this._fallback = this.shadowRoot.getElementById('fallback');
    this._btnPlay = this.shadowRoot.getElementById('btn-play');
    this._btnStop = this.shadowRoot.getElementById('btn-stop');
    this._btnPrev = this.shadowRoot.getElementById('btn-prev');
    this._btnNext = this.shadowRoot.getElementById('btn-next');
  }

  connectedCallback() {
    this._engine = document.querySelector('pro-audio-engine');
    
    // Listen for engine state changes - on engine element directly
    const bindEngine = () => {
      if (!this._engine) this._engine = document.querySelector('pro-audio-engine');
      if (this._engine) {
        this._engine.addEventListener('track-play', () => this._setPlaying(true));
        this._engine.addEventListener('track-pause', () => this._setPlaying(false));
        this._engine.addEventListener('track-ended', () => this._setPlaying(false));
        this._engine.addEventListener('engine-ready', () => this._tryInitButterchurn());
      }
    };
    bindEngine();
    
    // Also listen on document for bubbled events (fallback)
    document.addEventListener('track-play', () => this._setPlaying(true));
    document.addEventListener('track-pause', () => this._setPlaying(false));
    document.addEventListener('track-ended', () => this._setPlaying(false));
    document.addEventListener('engine-ready', () => {
      this._engine = document.querySelector('pro-audio-engine');
      this._tryInitButterchurn();
    });

    // Transport controls
    this._btnPlay.addEventListener('click', () => this._togglePlay());
    this._btnStop.addEventListener('click', () => this._doStop());
    this._btnPrev.addEventListener('click', () => this._doPrev());
    this._btnNext.addEventListener('click', () => this._doNext());

    // Click label to change Butterchurn preset
    this.shadowRoot.getElementById('label').addEventListener('click', () => this._nextPreset());

    // Load butterchurn
    this._loadButterchurn();

    // Start render loop
    this._animate();
  }

  disconnectedCallback() {
    if (this._animId) cancelAnimationFrame(this._animId);
  }

  // ===== TRANSPORT =====
  _togglePlay() {
    if (!this._engine) this._engine = document.querySelector('pro-audio-engine');
    if (!this._engine) return;
    if (this._engine.isPlaying) {
      this._engine.pause();
    } else {
      this._engine.play();
    }
  }

  _doStop() {
    if (!this._engine) this._engine = document.querySelector('pro-audio-engine');
    if (!this._engine) return;
    this._engine.stop();
    this._setPlaying(false);
  }

  _doPrev() {
    this.dispatchEvent(new CustomEvent('transport-prev', { bubbles: true, composed: true }));
  }

  _doNext() {
    this.dispatchEvent(new CustomEvent('transport-next', { bubbles: true, composed: true }));
  }

  _setPlaying(playing) {
    this._isPlaying = playing;
    this._tonearm.classList.toggle('playing', playing);
    this._glowRing.classList.toggle('active', playing);
    this._rpmLabel.classList.toggle('playing', playing);

    if (playing) {
      this._btnPlay.textContent = '⏸';
      this._btnPlay.classList.remove('paused');
    } else {
      this._btnPlay.textContent = '▶';
      this._btnPlay.classList.add('paused');
    }

    // Try init butterchurn when first playing (audio context now exists)
    if (playing && !this._bcReady && !this._bcFailed) {
      setTimeout(() => this._tryInitButterchurn(), 300);
    }
  }

  // ===== ANIMATION =====
  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());
    
    const now = performance.now();
    const dt = (now - this._lastTime) / 1000;
    this._lastTime = now;

    if (this._isPlaying) {
      this._rotation += 198 * dt; // 33 RPM
      if (this._rotation >= 360) this._rotation -= 360;
    }

    this._vinylOuter.style.transform = `rotate(${this._rotation}deg)`;

    // Render butterchurn
    if (this._bcReady && this._butterchurn) {
      try { this._butterchurn.render(); } catch (e) { /* ignore */ }
    }
  }

  // ===== BUTTERCHURN =====
  async _loadButterchurn() {
    try {
      if (!window.butterchurn) {
        await this._loadScript('https://cdn.jsdelivr.net/npm/butterchurn/lib/butterchurn.min.js');
      }
      if (!window.butterchurnPresets) {
        await this._loadScript('https://cdn.jsdelivr.net/npm/butterchurn-presets/lib/butterchurnPresets.min.js');
      }
      console.log('[ProVinyl] Butterchurn scripts loaded:', !!window.butterchurn, !!window.butterchurnPresets);
      this._tryInitButterchurn();
    } catch (e) {
      console.warn('[ProVinyl] Butterchurn CDN failed:', e);
      this._bcFailed = true;
    }
  }

  _tryInitButterchurn() {
    if (this._bcReady || this._bcFailed) return;
    if (!window.butterchurn) return;
    
    this._initAttempts++;
    if (this._initAttempts > 10) { this._bcFailed = true; return; }

    // Need engine + audio context
    if (!this._engine) this._engine = document.querySelector('pro-audio-engine');
    if (!this._engine) return;

    const ctx = this._engine.audioContext;
    if (!ctx) {
      console.log('[ProVinyl] No AudioContext yet, will retry on play...');
      return;
    }

    try {
      const canvas = this._bcCanvas;
      const label = this.shadowRoot.getElementById('label');
      const rect = label.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const size = Math.max(150, Math.min(rect.width, rect.height) * dpr);
      canvas.width = size;
      canvas.height = size;

      console.log('[ProVinyl] Creating Butterchurn visualizer...', size, 'x', size);

      this._butterchurn = (window.butterchurn.default || window.butterchurn).createVisualizer(ctx, canvas, {
        width: size,
        height: size,
        pixelRatio: dpr,
      });

      // Connect audio source
      if (this._engine.analyser) {
        this._butterchurn.connectAudio(this._engine.analyser);
        console.log('[ProVinyl] Connected audio analyser');
      }

      // Load presets
      if (window.butterchurnPresets && typeof window.butterchurnPresets.getPresets === 'function') {
        this._presets = window.butterchurnPresets.getPresets();
        const names = Object.keys(this._presets);
        console.log('[ProVinyl] Loaded', names.length, 'presets');
        if (names.length > 0) {
          this._currentPresetIdx = Math.floor(Math.random() * names.length);
          this._butterchurn.loadPreset(this._presets[names[this._currentPresetIdx]], 0.0);
          this._bcReady = true;
          this._fallback.classList.add('hidden');
          this._bcBadge.classList.add('visible');
          console.log('[ProVinyl] ✓ Butterchurn active! Preset:', names[this._currentPresetIdx]);
        }
      }
    } catch (e) {
      console.error('[ProVinyl] Butterchurn init failed:', e);
      this._bcFailed = true;
    }
  }

  _nextPreset() {
    if (!this._bcReady || !this._butterchurn || !this._presets) return;
    const names = Object.keys(this._presets);
    if (names.length === 0) return;
    this._currentPresetIdx = (this._currentPresetIdx + 1) % names.length;
    try {
      this._butterchurn.loadPreset(this._presets[names[this._currentPresetIdx]], 1.0);
      console.log('[ProVinyl] Preset →', names[this._currentPresetIdx]);
    } catch (e) { /* ignore */ }
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = () => { console.log('[ProVinyl] Loaded:', src); resolve(); };
      s.onerror = (e) => { console.warn('[ProVinyl] Failed to load:', src); reject(e); };
      document.head.appendChild(s);
    });
  }
}

customElements.define('pro-vinyl', ProVinyl);
export default ProVinyl;
