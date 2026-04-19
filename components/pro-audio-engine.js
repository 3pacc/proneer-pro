/**
 * Pro-Audio-Engine - Web Audio Engine Web Component
 * 
 * Le "cerveau" central qui gère l'AudioContext, le routing graph complet
 * (Source -> EQ -> FX -> Master -> Analyser), et la logique de playback.
 * 
 * @element pro-audio-engine
 * 
 * @attr {number} volume - Volume master 0.0-1.0 (défaut: 1.0)
 * @attr {string} eq-bands - JSON array de 10 valeurs initiales EQ
 * @attr {boolean} fx-enabled - FX rack activé (défaut: true)
 * @attr {number} analyser-fft - Taille FFT (défaut: 2048)
 * @attr {boolean} autoplay - Lecture automatique (défaut: false)
 * 
 * @fires engine-ready - AudioContext initialisé { sampleRate, state }
 * @fires track-loaded - Piste chargée { url, duration, metadata }
 * @fires track-play - Lecture démarrée { currentTime }
 * @fires track-pause - Lecture en pause { currentTime }
 * @fires track-ended - Fin de piste {}
 * @fires time-update - Mise à jour temps { currentTime, duration }
 * @fires eq-change - EQ modifié { bands }
 * @fires volume-change - Volume modifié { volume }
 * @fires fx-loaded - Nouvel effet chargé { index, name }
 * 
 * @listens track-play-request
 * @listens track-pause-request
 * @listens seek-request
 * @listens eq-change-request
 */

const ISO_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

class ProAudioEngine extends HTMLElement {
  static get observedAttributes() {
    return ['volume', 'eq-bands', 'fx-enabled', 'analyser-fft', 'autoplay'];
  }

  constructor() {
    super();
    
    // Audio nodes (will be created in connect())
    this._audioContext = null;
    this._sourceNode = null;
    this._mediaElement = null;
    this._inputGain = null;
    this._eqFilters = [];
    this._fxChain = [];
    this._masterGain = null;
    this._compressor = null;
    this._analyser = null;
    this._activeFxIndex = -1;
    this._panNode = null;          // StereoPannerNode for L/R
    this._preGain = null;          // Separate gain stage (Quick Controls Gain knob)
    
    // State
    this._isPlaying = false;
    this._currentTime = 0;
    this._duration = 0;
    this._volume = 1.0;
    this._pan = 0;                 // -1 (left) to +1 (right)
    this._playbackRate = 1.0;      // pitch/speed
    this._preGainValue = 1.0;      // separate gain stage
    this._eqBands = new Array(10).fill(0);
    this._fxEnabled = true;
    this._autoplay = false;
    this._currentUrl = null;
    this._metadata = {};
    
    // Timing
    this._startTime = 0;
    this._pauseTime = 0;
    this._updateInterval = null;
  }

  // ============ LIFECYCLE ============

  connectedCallback() {
    // DON'T create AudioContext here - browsers require user gesture!
    // We'll create it lazily on first play/load.
    
    // Listen for events
    window.addEventListener('track-play-request', this._onPlayRequest.bind(this));
    window.addEventListener('track-pause-request', this._onPauseRequest.bind(this));
    window.addEventListener('seek-request', this._onSeekRequest.bind(this));
    window.addEventListener('eq-change-request', this._onEqChangeRequest.bind(this));
  }

  disconnectedCallback() {
    // Cleanup
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }
    
    window.removeEventListener('track-play-request', this._onPlayRequest.bind(this));
    window.removeEventListener('track-pause-request', this._onPauseRequest.bind(this));
    window.removeEventListener('seek-request', this._onSeekRequest.bind(this));
    window.removeEventListener('eq-change-request', this._onEqChangeRequest.bind(this));
    
    this._disconnectAll();
  }

  // ============ ATTRIBUTES ============

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'volume':
        this._volume = parseFloat(newValue) || 1.0;
        if (this._masterGain) {
          this._masterGain.gain.value = this._volume;
        }
        break;
      case 'eq-bands':
        try {
          const bands = JSON.parse(newValue);
          if (Array.isArray(bands) && bands.length === 10) {
            this._eqBands = bands;
            this._applyEqBands();
          }
        } catch (e) {
          console.warn('Invalid eq-bands JSON');
        }
        break;
      case 'fx-enabled':
        this._fxEnabled = newValue !== 'false';
        break;
      case 'analyser-fft':
        this._analyserSize = parseInt(newValue) || 2048;
        if (this._analyser) {
          this._analyser.fftSize = this._analyserSize;
        }
        break;
      case 'autoplay':
        this._autoplay = newValue === 'true';
        break;
    }
  }

  // ============ PROPERTIES ============

  get audioContext() { return this._audioContext; }
  get currentTime() { 
    if (this._isPlaying && this._mediaElement) {
      return this._mediaElement.currentTime;
    }
    return this._pauseTime || this._currentTime;
  }
  get duration() { return this._duration; }
  get isPlaying() { return this._isPlaying; }
  
  get volume() { return this._volume; }
  set volume(val) {
    this._volume = Math.max(0, Math.min(1, val));
    this.setAttribute('volume', this._volume);
    
    // Ensure audio context exists for volume changes
    this._ensureAudioContext();
    
    if (this._masterGain && this._audioContext) {
      this._masterGain.gain.setTargetAtTime(this._volume, this._audioContext.currentTime, 0.01);
    }
    this._emit('volume-change', { volume: this._volume });
  }

  /** Pan position (-1 left, 0 center, +1 right) */
  get pan() { return this._pan; }
  set pan(val) {
    this._pan = Math.max(-1, Math.min(1, val));
    if (this._panNode && this._audioContext) {
      this._panNode.pan.setTargetAtTime(this._pan, this._audioContext.currentTime, 0.01);
    }
  }

  /** Playback rate / pitch (0.25 to 4.0, 1.0 = normal) */
  get playbackRate() { return this._playbackRate; }
  set playbackRate(val) {
    this._playbackRate = Math.max(0.25, Math.min(4.0, val));
    if (this._mediaElement) {
      this._mediaElement.playbackRate = this._playbackRate;
    }
  }

  /** Separate pre-gain stage (0 to 2, 1.0 = unity) */
  get preGain() { return this._preGainValue; }
  set preGain(val) {
    this._preGainValue = Math.max(0, Math.min(2, val));
    if (this._preGain && this._audioContext) {
      this._preGain.gain.setTargetAtTime(this._preGainValue, this._audioContext.currentTime, 0.01);
    }
  }

  get eqBands() { return [...this._eqBands]; }
  
  get sourceNode() { return this._sourceNode; }
  get analyser() { return this._analyser; }

  // ============ PUBLIC METHODS ============

  /**
   * Initialise l'AudioContext (lazy - appelé après user gesture)
   * @private
   */
  async _ensureAudioContext() {
    if (this._audioContext) return;
    
    this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create audio graph
    this._createAudioGraph();
    
    // Apply initial EQ
    this._applyEqBands();
    
    // Emit ready event
    this._emit('engine-ready', {
      sampleRate: this._audioContext.sampleRate,
      state: this._audioContext.state
    });
    
    // Start time update interval
    this._startTimeUpdate();
  }

  /**
   * Charge une piste audio depuis une URL
   * @param {string} url - URL du fichier audio
   * @param {object} [metadata] - Métadonnées optionnelles
   */
  async loadTrack(url, metadata = {}) {
    // Ensure AudioContext is created (lazy init after user gesture)
    await this._ensureAudioContext();
    
    this._currentUrl = url;
    this._metadata = metadata;
    
    // Stop current playback
    this._stop();
    
    // Create media element source for streaming (better for large files)
    if (this._mediaElement) {
      this._mediaElement.pause();
      URL.revokeObjectURL(this._mediaElement.src);
    }
    
    this._mediaElement = new Audio();
    this._mediaElement.crossOrigin = 'anonymous';
    this._mediaElement.preload = 'metadata';
    
    // Set up source node
    this._sourceNode = this._audioContext.createMediaElementSource(this._mediaElement);
    this._sourceNode.connect(this._inputGain);
    
    // Load metadata from file if not provided
    if (!metadata.duration) {
      await new Promise((resolve, reject) => {
        this._mediaElement.addEventListener('loadedmetadata', resolve, { once: true });
        this._mediaElement.addEventListener('error', reject, { once: true });
        this._mediaElement.src = url;
      });
      
      this._duration = this._mediaElement.duration;
      this._metadata = {
        ...this._metadata,
        duration: this._duration
      };
    } else {
      this._duration = metadata.duration;
      this._mediaElement.src = url;
    }
    
    // Listen for ended
    this._mediaElement.addEventListener('ended', this._onTrackEnded.bind(this));
    
    this._emit('track-loaded', {
      url,
      duration: this._duration,
      metadata: this._metadata
    });
    
    if (this._autoplay) {
      this.play();
    }
  }

  /**
   * Démarre la lecture
   */
  async play() {
    // Ensure AudioContext exists before playing
    await this._ensureAudioContext();
    
    if (!this._mediaElement) return;
    
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
    
    this._mediaElement.play();
    this._isPlaying = true;
    this._pauseTime = 0;
    
    this._emit('track-play', { currentTime: this.currentTime });
    window.dispatchEvent(new CustomEvent('engine-resume', { bubbles: true }));
  }

  /**
   * Met en pause la lecture
   */
  pause() {
    if (!this._mediaElement || !this._isPlaying) return;
    
    this._pauseTime = this._mediaElement.currentTime;
    this._mediaElement.pause();
    this._isPlaying = false;
    
    this._emit('track-pause', { currentTime: this._pauseTime });
    window.dispatchEvent(new CustomEvent('engine-suspend', { bubbles: true }));
  }

  /**
   * Arrête la lecture
   */
  stop() {
    this._stop();
    this._pauseTime = 0;
    this._currentTime = 0;
  }

  /**
   * Seek to position
   * @param {number} time - Position en secondes
   */
  seek(time) {
    if (!this._mediaElement) return;
    
    time = Math.max(0, Math.min(this._duration, time));
    this._mediaElement.currentTime = time;
    this._pauseTime = time;
    this._currentTime = time;
    
    this._emit('time-update', { currentTime: time, duration: this._duration });
  }

  /**
   * Définit le volume
   * @param {number} value - Volume 0-1
   */
  setVolume(value) {
    this.volume = value;
  }

  /**
   * Définit une bande EQ
   * @param {number} band - Index 0-9
   * @param {number} value - Valeur -12 à +12 dB
   */
  setEqBand(band, value) {
    if (band < 0 || band > 9) return;
    
    // Ensure audio context exists (create if needed for EQ adjustments)
    this._ensureAudioContext();
    
    value = Math.max(-12, Math.min(12, value));
    this._eqBands[band] = value;
    
    if (this._eqFilters[band]) {
      // BiquadFilterNode gain is in dB
      this._eqFilters[band].gain.value = value;
    }
    
    this._emit('eq-change', { 
      bands: [...this._eqBands],
      bandIndex: band,
      value 
    });
  }

  /**
   * Définit toutes les bandes EQ
   * @param {number[]} values - Array de 10 valeurs
   */
  setAllEq(values) {
    if (!Array.isArray(values) || values.length !== 10) {
      console.warn('setAllEq requires array of 10 values');
      return;
    }
    
    this._eqBands = values.map(v => Math.max(-12, Math.min(12, v)));
    this._applyEqBands();
    
    this._emit('eq-change', { bands: [...this._eqBands] });
  }

  /**
   * Reset EQ à flat
   */
  resetEq() {
    this.setAllEq(new Array(10).fill(0));
  }

  /**
   * Ajoute un effet WAM
   * @param {string} wamUrl - URL du module WAM
   */
  async addEffect(wamUrl) {
    try {
      const module = await import(wamUrl);
      const WAMClass = module.default || module;
      
      const instance = new WAMClass(this._audioContext);
      await instance.createAudioNode(this._audioContext);
      
      // Create FX gain node for routing
      const fxInput = this._audioContext.createGain();
      const fxOutput = this._audioContext.createGain();
      
      // Connect FX
      const audioNode = instance.getAudioNode ? instance.getAudioNode() : instance._audioNode;
      if (audioNode) {
        fxInput.connect(audioNode);
        audioNode.connect(fxOutput);
      }
      
      this._fxChain.push({
        instance,
        input: fxInput,
        output: fxOutput
      });
      
      this._reconnectFxChain();
      
      this._emit('fx-loaded', {
        index: this._fxChain.length - 1,
        name: instance.name || 'Effect'
      });
      
    } catch (e) {
      console.error('Failed to load WAM:', e);
      throw e;
    }
  }

  /**
   * Supprime un effet
   * @param {number} index 
   */
  removeEffect(index) {
    if (index < 0 || index >= this._fxChain.length) return;
    
    const fx = this._fxChain[index];
    if (fx.input) fx.input.disconnect();
    if (fx.output) fx.output.disconnect();
    if (fx.audioNode) fx.audioNode.disconnect();
    
    this._fxChain.splice(index, 1);
    this._reconnectFxChain();
  }

  /**
   * Bypass un effet
   * @param {number} index 
   * @param {boolean} bypass 
   */
  bypassEffect(index, bypass) {
    const fx = this._fxChain[index];
    if (!fx) return;
    
    if (bypass) {
      fx.input.disconnect();
      fx.input.connect(fx.output);
    } else {
      // Reconnect properly
      this._reconnectFxChain();
    }
  }

  /**
   * Connecte un node externe (pour visualisation ou extensions)
   * @param {AudioNode} node 
   */
  connectExternalNode(node) {
    if (this._analyser) {
      this._analyser.connect(node);
      node.connect(this._audioContext.destination);
    }
  }

  /**
   * Retourne l'état complet pour sérialisation
   */
  getState() {
    return {
      volume: this._volume,
      eqBands: [...this._eqBands],
      isPlaying: this._isPlaying,
      currentTime: this.currentTime,
      duration: this._duration,
      fxCount: this._fxChain.length
    };
  }

  // ============ PRIVATE METHODS ============

  _createAudioGraph() {
    const ctx = this._audioContext;
    
    // Input gain (pre-amp)
    this._inputGain = ctx.createGain();
    this._inputGain.gain.value = 1.0;
    
    // Separate pre-gain stage (for Quick Controls Gain knob)
    this._preGain = ctx.createGain();
    this._preGain.gain.value = this._preGainValue;
    this._inputGain.connect(this._preGain);
    
    // Create 10-band EQ using BiquadFilterNodes
    this._eqFilters = ISO_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4; // Q factor for smooth curve
      filter.gain.value = this._eqBands[i];
      return filter;
    });
    
    // Chain EQ filters from pre-gain
    let prevNode = this._preGain;
    for (const filter of this._eqFilters) {
      prevNode.connect(filter);
      prevNode = filter;
    }
    
    // FX rack input (placeholder until effects are added)
    this._fxInput = ctx.createGain();
    prevNode.connect(this._fxInput);
    
    // Stereo panner (for Pan knob)
    this._panNode = ctx.createStereoPanner();
    this._panNode.pan.value = this._pan;
    
    // Master gain
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = this._volume;
    
    // Compressor (transparent limiter to prevent clipping)
    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -6;
    this._compressor.knee.value = 12;
    this._compressor.ratio.value = 20;
    this._compressor.attack.value = 0.001;
    this._compressor.release.value = 0.1;
    
    // Analyser for visualizations
    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = this._analyserSize || 2048;
    this._analyser.smoothingTimeConstant = 0.85;
    
    // Connect chain: EQ -> FX -> Pan -> Master -> Compressor -> Analyser -> Destination
    this._fxInput.connect(this._panNode);
    this._panNode.connect(this._masterGain);
    this._masterGain.connect(this._compressor);
    this._compressor.connect(this._analyser);
    this._analyser.connect(ctx.destination);
  }

  _applyEqBands() {
    this._eqFilters.forEach((filter, i) => {
      filter.gain.value = this._eqBands[i];
    });
  }

  _reconnectFxChain() {
    if (!this._audioContext) return;
    
    // Disconnect all FX
    this._fxChain.forEach(fx => {
      if (fx.input) fx.input.disconnect();
      if (fx.output) fx.output.disconnect();
      if (fx.audioNode) fx.audioNode.disconnect();
    });
    
    if (this._fxChain.length === 0) {
      // No FX, direct connection
      this._eqFilters[this._eqFilters.length - 1].disconnect();
      this._eqFilters[this._eqFilters.length - 1].connect(this._fxInput);
    } else {
      // Connect FX in series
      let prevNode = this._eqFilters[this._eqFilters.length - 1];
      
      this._fxChain.forEach((fx, i) => {
        prevNode.disconnect();
        prevNode.connect(fx.input);
        
        // Connect to audio node
        if (fx.audioNode) {
          fx.input.disconnect();
          fx.input.connect(fx.audioNode);
          fx.audioNode.connect(fx.output);
        }
        
        prevNode = fx.output;
      });
      
      // Connect last FX to master
      prevNode.disconnect();
      prevNode.connect(this._fxInput);
    }
  }

  _stop() {
    if (this._mediaElement) {
      this._mediaElement.pause();
      this._mediaElement.currentTime = 0;
    }
    this._isPlaying = false;
    this._pauseTime = 0;
  }

  _startTimeUpdate() {
    this._updateInterval = setInterval(() => {
      if (this._isPlaying && this._mediaElement) {
        this._currentTime = this._mediaElement.currentTime;
        this._emit('time-update', {
          currentTime: this._currentTime,
          duration: this._duration
        });
      }
    }, 250); // 4 fps
  }

  _onTrackEnded() {
    this._isPlaying = false;
    this._pauseTime = 0;
    this._emit('track-ended', {});
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail: {
        source: this.id || 'pro-audio-engine',
        timestamp: performance.now(),
        ...detail
      }
    }));
  }

  _disconnectAll() {
    if (this._sourceNode) {
      try { this._sourceNode.disconnect(); } catch(e) {}
    }
    if (this._inputGain) {
      try { this._inputGain.disconnect(); } catch(e) {}
    }
    this._eqFilters.forEach(f => {
      try { f.disconnect(); } catch(e) {}
    });
    if (this._masterGain) {
      try { this._masterGain.disconnect(); } catch(e) {}
    }
    if (this._compressor) {
      try { this._compressor.disconnect(); } catch(e) {}
    }
    if (this._analyser) {
      try { this._analyser.disconnect(); } catch(e) {}
    }
    if (this._mediaElement) {
      this._mediaElement.pause();
    }
  }

  // ============ EVENT HANDLERS ============

  _onPlayRequest(e) {
    if (e.detail && e.detail.engineId && e.detail.engineId !== this.id) return;
    this.play();
  }

  _onPauseRequest(e) {
    if (e.detail && e.detail.engineId && e.detail.engineId !== this.id) return;
    this.pause();
  }

  _onSeekRequest(e) {
    if (e.detail && e.detail.engineId && e.detail.engineId !== this.id) return;
    this.seek(e.detail.time);
  }

  _onEqChangeRequest(e) {
    if (e.detail && e.detail.engineId && e.detail.engineId !== this.id) return;
    if (e.detail.bands) {
      this.setAllEq(e.detail.bands);
    } else if (typeof e.detail.band === 'number') {
      this.setEqBand(e.detail.band, e.detail.value);
    }
  }
}

customElements.define('pro-audio-engine', ProAudioEngine);

export default ProAudioEngine;