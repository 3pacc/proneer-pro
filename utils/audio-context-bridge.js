/**
 * AudioContextBridge - Système de partage du AudioContext entre Web Components
 * Pattern : Event-Based Lookup avec Cache
 * 
 * Ce module fournit un moyen centralisé de partager le AudioContext entre
 * tous les composants sans couplage fort.
 */

class AudioContextBridge {
  constructor() {
    this._cache = new WeakMap();
    this._engines = new Map();
  }

  /**
   * Récupère la référence à l'engine via plusieurs stratégies
   * @param {HTMLElement} element - Element demandeur
   * @param {string} engineId - ID optionnel de l'engine
   * @returns {pro-audio-engine|null}
   */
  getEngine(element, engineId = null) {
    // 1. Chercher par ID si fourni
    if (engineId) {
      const byId = document.getElementById(engineId);
      if (byId && byId.tagName === 'PRO-AUDIO-ENGINE') {
        return byId;
      }
    }

    // 2. Chercher dans le cache
    if (this._cache.has(element)) {
      return this._cache.get(element);
    }

    // 3. Remonter l'arbre DOM
    let current = element;
    while (current && current !== document) {
      if (current.tagName === 'PRO-AUDIO-ENGINE') {
        this._cache.set(element, current);
        return current;
      }
      current = current.parentElement || current.parentNode;
    }

    // 4. Fallback : premier pro-audio-engine dans le document
    const fallback = document.querySelector('pro-audio-engine');
    if (fallback) {
      this._cache.set(element, fallback);
      return fallback;
    }

    return null;
  }

  /**
   * Enregistre un engine par son ID
   * @param {string} id 
   * @param {pro-audio-engine} engine 
   */
  registerEngine(id, engine) {
    this._engines.set(id, engine);
  }

  /**
   * Récupère un engine par ID
   * @param {string} id 
   * @returns {pro-audio-engine|null}
   */
  getEngineById(id) {
    return this._engines.get(id) || document.getElementById(id);
  }

  /**
   * Efface le cache pour un element
   * @param {HTMLElement} element 
   */
  invalidateCache(element) {
    this._cache.delete(element);
  }
}

// Singleton global
const audioContextBridge = new AudioContextBridge();

/**
 * Mixin pour les composants qui ont besoin du AudioContext
 * @param {class} Base - Classe de base
 * @returns {class} Classe avec méthode findEngine()
 */
function WithAudioContext(Base) {
  return class extends Base {
    connectedCallback() {
      if (super.connectedCallback) {
        super.connectedCallback();
      }
      this._engine = null;
      this._engineId = this.getAttribute('engine-id');
      
      // Écouter les événements de l'engine
      window.addEventListener('engine-ready', this._onEngineReady.bind(this));
    }

    disconnectedCallback() {
      if (super.disconnectedCallback) {
        super.disconnectedCallback();
      }
      window.removeEventListener('engine-ready', this._onEngineReady.bind(this));
      audioContextBridge.invalidateCache(this);
    }

    /**
     * callback Called when engine is ready
     * @private
     */
    _onEngineReady(event) {
      // Peut être overridé par les subclasses
    }

    /**
     * Trouve l'engine AudioContext
     * @param {string} [engineId] - ID optionnel
     * @returns {pro-audio-engine|null}
     */
    findEngine(engineId) {
      return audioContextBridge.getEngine(this, engineId || this._engineId);
    }

    /**
     * Attend que l'engine soit prêt
     * @returns {Promise<pro-audio-engine>}
     */
    async waitForEngine() {
      const engine = this.findEngine();
      if (!engine) {
        throw new Error('No pro-audio-engine found');
      }
      
      if (engine.audioContext && engine.audioContext.state === 'running') {
        return engine;
      }

      return new Promise((resolve) => {
        const handler = (event) => {
          window.removeEventListener('engine-ready', handler);
          resolve(event.target);
        };
        window.addEventListener('engine-ready', handler);
      });
    }
  };
}

/**
 * Crée un CustomEvent structuré standard
 * @param {string} type - Type d'événement
 * @param {object} detail - Données du détail
 * @param {HTMLElement} source - Element source
 * @returns {CustomEvent}
 */
function createAudioEvent(type, detail = {}, source = this) {
  return new CustomEvent(type, {
    bubbles: true,
    composed: true,
    detail: {
      source: source.id || source.tagName,
      timestamp: performance.now(),
      ...detail
    }
  });
}

// Export pour utilisation par les composants
export { audioContextBridge, WithAudioContext, createAudioEvent };
export default audioContextBridge;
