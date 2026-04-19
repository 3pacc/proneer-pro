/**
 * Pro-Playlist - Advanced Playlist Manager Web Component
 * 
 * Gestionnaire de fichiers avec drag & drop, parsing metadata ID3,
 * recherche et fonctionnalités de playlist avancées.
 * 
 * @element pro-playlist
 * 
 * @attr {string} engine-id - ID de l'engine à utiliser
 * @attr {string} sortable - Enable drag reorder (défaut: true)
 * @attr {string} searchable - Enable recherche (défaut: true)
 * @attr {number} height - Hauteur (défaut: 300)
 * 
 * @fires track-loaded - Piste chargée { index, url, metadata }
 * @fires track-selected - Sélection utilisateur { index, track }
 * @fires playlist-change - Playlist modifiée { tracks }
 * @fires repeat-change - Mode repeat changé { mode }
 */

const templatePlaylist = document.createElement('template');
templatePlaylist.innerHTML = `
<style>
  :host {
    --pl-accent: #00D4FF;
    --pl-secondary: #FF6B35;
    --pl-bg: #1a1a1a;
    --pl-bg-2: #222;
    --pl-hover: #2a2a2a;
    --pl-playing: rgba(0, 212, 255, 0.1);
    
    display: block;
    background: var(--pl-bg);
    border-radius: 8px;
    border: 1px solid #333;
    overflow: hidden;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
  }

  .pl-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: linear-gradient(180deg, #1e1e1e, #161616);
    border-bottom: 1px solid #333;
  }

  .pl-title {
    font-size: 12px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .pl-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .pl-btn {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #888;
    font-size: 10px;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pl-btn:hover {
    background: #333;
    color: var(--pl-accent);
    border-color: var(--pl-accent);
  }

  .pl-btn.active {
    background: var(--pl-accent);
    border-color: var(--pl-accent);
    color: #121212;
  }

  .pl-search {
    background: #1a1a1a;
    border: 1px solid #333;
    color: #888;
    font-family: inherit;
    font-size: 10px;
    padding: 6px 10px;
    border-radius: 4px;
    width: 120px;
    outline: none;
  }

  .pl-search:focus {
    border-color: var(--pl-accent);
    color: #fff;
  }

  .pl-search::placeholder {
    color: #555;
  }

  .pl-drop-zone {
    padding: 16px;
    margin: 12px;
    border: 2px dashed #444;
    border-radius: 8px;
    text-align: center;
    color: #555;
    font-size: 11px;
    transition: all 0.2s;
  }

  .pl-drop-zone.drag-over {
    border-color: var(--pl-accent);
    background: rgba(0, 212, 255, 0.05);
    color: var(--pl-accent);
  }

  .pl-drop-zone.hidden {
    display: none;
  }

  .pl-list {
    max-height: var(--pl-height, 300px);
    overflow-y: auto;
    padding: 0 8px 8px;
  }

  .pl-list::-webkit-scrollbar {
    width: 6px;
  }

  .pl-list::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .pl-list::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
  }

  .pl-list::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  .pl-track {
    display: grid;
    grid-template-columns: 32px 1fr auto auto;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    margin-bottom: 4px;
    background: var(--pl-bg-2);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
  }

  .pl-track:hover {
    background: var(--pl-hover);
    border-color: #444;
  }

  .pl-track.playing {
    background: var(--pl-playing);
    border-color: var(--pl-accent);
  }

  .pl-track.selected {
    border-color: var(--pl-secondary);
  }

  .pl-track.dragging {
    opacity: 0.5;
  }

  .pl-track-index {
    font-size: 10px;
    color: #555;
    text-align: center;
  }

  .pl-track.playing .pl-track-index {
    color: var(--pl-accent);
  }

  .pl-track-info {
    overflow: hidden;
  }

  .pl-track-title {
    font-size: 11px;
    color: #ccc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pl-track.playing .pl-track-title {
    color: var(--pl-accent);
  }

  .pl-track-artist {
    font-size: 9px;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .pl-track-duration {
    font-size: 10px;
    color: #555;
    min-width: 40px;
    text-align: right;
  }

  .pl-track-fav {
    background: transparent;
    border: none;
    color: #444;
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    line-height: 1;
    transition: color 0.2s;
  }

  .pl-track-fav:hover {
    color: #ffaa00;
  }
  
  .pl-track-fav.active {
    color: #ffaa00;
  }

  .pl-track-remove {
    background: transparent;
    border: none;
    color: #444;
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    line-height: 1;
    transition: color 0.2s;
  }

  .pl-track-remove:hover {
    color: #ff4444;
  }

  .pl-empty {
    text-align: center;
    padding: 40px 20px;
    color: #555;
    font-size: 11px;
  }

  .pl-empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.3;
  }

  .pl-footer {
    display: flex;
    justify-content: space-between;
    padding: 10px 16px;
    background: #161616;
    border-top: 1px solid #333;
    font-size: 10px;
    color: #555;
  }

  .pl-count {
    color: #666;
  }

  .pl-repeat-mode {
    display: flex;
    gap: 8px;
  }

  .pl-repeat-btn {
    background: transparent;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 12px;
    transition: color 0.2s;
  }

  .pl-repeat-btn:hover,
  .pl-repeat-btn.active {
    color: var(--pl-accent);
  }

  .pl-repeat-btn.active.one {
    color: var(--pl-secondary);
  }
</style>

<div class="pl-header">
  <span class="pl-title">Playlist</span>
  <div class="pl-controls">
    <input type="text" class="pl-search" placeholder="Search..." />
    <button class="pl-btn" id="shuffle-btn">Shuffle</button>
    <button class="pl-btn" id="clear-btn">Clear</button>
  </div>
</div>

<div class="pl-drop-zone" id="drop-zone">
  Drag & drop audio files here or click to browse
  <input type="file" accept="audio/*" multiple style="display:none" />
</div>

<div class="pl-list"></div>

<div class="pl-footer">
  <span class="pl-count">0 tracks</span>
  <div class="pl-repeat-mode">
    <button class="pl-repeat-btn" data-mode="none" title="No repeat">⏹</button>
    <button class="pl-repeat-btn active" data-mode="all" title="Repeat all">🔁</button>
    <button class="pl-repeat-btn" data-mode="one" title="Repeat one">🔂</button>
  </div>
</div>
`;

class ProPlaylist extends HTMLElement {
  static get observedAttributes() {
    return ['engine-id', 'sortable', 'searchable', 'height'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(templatePlaylist.content.cloneNode(true));
    
    this._engineId = null;
    this._engine = null;
    this._tracks = [];
    this._currentIndex = -1;
    this._repeatMode = 'all'; // 'none', 'all', 'one'
    this._shuffleMode = false;
    this._searchQuery = '';
    
    this._list = this.shadowRoot.querySelector('.pl-list');
    this._dropZone = this.shadowRoot.querySelector('.pl-drop-zone');
    this._searchInput = this.shadowRoot.querySelector('.pl-search');
    this._shuffleBtn = this.shadowRoot.querySelector('#shuffle-btn');
    this._clearBtn = this.shadowRoot.querySelector('#clear-btn');
    this._countEl = this.shadowRoot.querySelector('.pl-count');
    this._repeatBtns = this.shadowRoot.querySelectorAll('.pl-repeat-btn');
    
    // Listen for global favorite updates
    window.addEventListener('favorites-updated', (e) => {
      this._favoriteUrls = e.detail.favorites || [];
      this._renderTracks();
    });
    this._favoriteUrls = window.ProApp ? window.ProApp.getFavorites() : [];
  }

  connectedCallback() {
    // Drop zone click
    this._dropZone.addEventListener('click', () => {
      const input = this._dropZone.querySelector('input[type="file"]');
      input.click();
    });
    
    this._dropZone.addEventListener('input', (e) => {
      this._handleFileSelect(e.target.files);
      e.target.value = '';
    });
    
    // Drag & drop
    this._dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dropZone.classList.add('drag-over');
    });
    
    this._dropZone.addEventListener('dragleave', () => {
      this._dropZone.classList.remove('drag-over');
    });
    
    this._dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dropZone.classList.remove('drag-over');
      this._handleFileSelect(e.dataTransfer.files);
    });
    
    // Global drag & drop
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      if (e.target !== this._dropZone && !this._dropZone.contains(e.target)) {
        e.preventDefault();
        this._handleFileSelect(e.dataTransfer.files);
      }
    });
    
    // Search
    this._searchInput.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase();
      this._renderTracks();
    });
    
    // Shuffle
    this._shuffleBtn.addEventListener('click', () => this._toggleShuffle());
    
    // Clear
    this._clearBtn.addEventListener('click', () => this.clear());
    
    // Repeat modes
    this._repeatBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this._repeatMode = btn.dataset.mode;
        this._updateRepeatButtons();
        this.dispatchEvent(new CustomEvent('repeat-change', {
          bubbles: true,
          composed: true,
          detail: { mode: this._repeatMode }
        }));
      });
    });
    
    // Find engine
    this._findEngine();
    window.addEventListener('engine-ready', this._onEngineReady.bind(this));
    
    // Listen for track end to auto-advance
    window.addEventListener('track-ended', this._onTrackEnded.bind(this));
  }

  disconnectedCallback() {
    window.removeEventListener('engine-ready', this._onEngineReady.bind(this));
    window.removeEventListener('track-ended', this._onTrackEnded.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'engine-id':
        this._engineId = newValue;
        this._findEngine();
        break;
      case 'sortable':
        this._sortable = newValue !== 'false';
        break;
      case 'searchable':
        this._searchable = newValue !== 'false';
        this._searchInput.style.display = this._searchable ? 'block' : 'none';
        break;
      case 'height':
        this.style.setProperty('--pl-height', `${newValue}px`);
        break;
    }
  }

  // ============ PROPERTIES ============

  get tracks() { return [...this._tracks]; }
  get currentIndex() { return this._currentIndex; }
  get currentTrack() { return this._tracks[this._currentIndex] || null; }

  // ============ PUBLIC METHODS ============

  /**
   * Ajoute une piste à la playlist
   * @param {string} url - URL du fichier
   * @param {object} [metadata] - Métadonnées
   */
  async addTrack(url, metadata = {}) {
    // Parse ID3 if file is local
    if (!metadata.title) {
      metadata = await this._parseMetadata(url, metadata);
    }
    
    const track = {
      url,
      metadata: {
        title: metadata.title || this._getFileName(url),
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || 'Unknown Album',
        duration: metadata.duration || 0,
        coverArt: metadata.coverArt || null,
        year: metadata.year || '',
        genre: metadata.genre || ''
      }
    };
    
    this._tracks.push(track);
    this._renderTracks();
    
    this.dispatchEvent(new CustomEvent('playlist-change', {
      bubbles: true,
      composed: true,
      detail: { tracks: this.tracks }
    }));
    
    return this._tracks.length - 1;
  }

  /**
   * Supprime une piste
   * @param {number} index 
   */
  removeTrack(index) {
    if (index < 0 || index >= this._tracks.length) return;
    
    this._tracks.splice(index, 1);
    
    // Adjust current index
    if (index < this._currentIndex) {
      this._currentIndex--;
    } else if (index === this._currentIndex) {
      this._currentIndex = -1;
    }
    
    this._renderTracks();
    
    this.dispatchEvent(new CustomEvent('playlist-change', {
      bubbles: true,
      composed: true,
      detail: { tracks: this.tracks }
    }));
  }

  /**
   * Vide la playlist
   */
  clear() {
    this._tracks = [];
    this._currentIndex = -1;
    this._renderTracks();
    
    this.dispatchEvent(new CustomEvent('playlist-change', {
      bubbles: true,
      composed: true,
      detail: { tracks: [] }
    }));
  }

  /**
   * Joue la piste à l'index
   * @param {number} index 
   */
  async playTrack(index) {
    if (index < 0 || index >= this._tracks.length) return;
    
    this._currentIndex = index;
    const track = this._tracks[index];
    
    this._renderTracks();
    
    // Load in engine
    if (this._engine) {
      await this._engine.loadTrack(track.url, track.metadata);
      this._engine.play();
    }
    
    this.dispatchEvent(new CustomEvent('track-selected', {
      bubbles: true,
      composed: true,
      detail: { index, track }
    }));
  }

  /**
   * Piste suivante
   */
  next() {
    if (this._tracks.length === 0) return;
    
    let nextIndex;
    if (this._shuffleMode) {
      nextIndex = Math.floor(Math.random() * this._tracks.length);
    } else if (this._currentIndex < this._tracks.length - 1) {
      nextIndex = this._currentIndex + 1;
    } else if (this._repeatMode === 'all') {
      nextIndex = 0;
    } else {
      return;
    }
    
    this.playTrack(nextIndex);
  }

  /**
   * Piste précédente
   */
  previous() {
    if (this._tracks.length === 0) return;
    
    let prevIndex;
    if (this._currentIndex > 0) {
      prevIndex = this._currentIndex - 1;
    } else if (this._repeatMode === 'all') {
      prevIndex = this._tracks.length - 1;
    } else {
      return;
    }
    
    this.playTrack(prevIndex);
  }

  /**
   * Toggle shuffle mode
   */
  shuffle() {
    this._toggleShuffle();
  }

  /**
   * Tri par champ
   * @param {string} field 
   * @param {boolean} asc 
   */
  sortBy(field, asc = true) {
    this._tracks.sort((a, b) => {
      const valA = a.metadata[field] || '';
      const valB = b.metadata[field] || '';
      return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    this._renderTracks();
  }

  // ============ PRIVATE METHODS ============

  _handleFileSelect(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
        const url = URL.createObjectURL(file);
        this.addTrack(url, { title: file.name.replace(/\.[^.]+$/, '') });
      }
    });
    
    if (files.length > 0) {
      this._dropZone.classList.add('hidden');
    }
  }

  async _parseMetadata(url, metadata) {
    // Basic metadata parsing - for full ID3 support, use a library
    // This is a simplified version
    const audio = new Audio();
    
    try {
      audio.src = url;
      await new Promise((resolve, reject) => {
        audio.addEventListener('loadedmetadata', resolve, { once: true });
        audio.addEventListener('error', reject, { once: true });
      });
      
      metadata.duration = audio.duration;
    } catch (e) {
      // Ignore errors, use default duration
    }
    
    return metadata;
  }

  _getFileName(url) {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split('/').pop().replace(/\.[^.]+$/, '');
    } catch {
      return url;
    }
  }

  _toggleShuffle() {
    this._shuffleMode = !this._shuffleMode;
    this._shuffleBtn.classList.toggle('active', this._shuffleMode);
  }

  _updateRepeatButtons() {
    this._repeatBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this._repeatMode);
      btn.classList.toggle('one', this._repeatMode === 'one' && btn.dataset.mode === 'one');
    });
  }

  _renderTracks() {
    if (this._tracks.length === 0) {
      this._list.innerHTML = `
        <div class="pl-empty">
          <div class="pl-empty-icon">🎵</div>
          <div>No tracks in playlist</div>
          <div style="margin-top: 8px; color: #444">Drag & drop audio files to add</div>
        </div>
      `;
      this._countEl.textContent = '0 tracks';
      return;
    }
    
    const filteredTracks = this._searchQuery 
      ? this._tracks.filter(t => 
          t.metadata.title.toLowerCase().includes(this._searchQuery) ||
          t.metadata.artist.toLowerCase().includes(this._searchQuery))
      : this._tracks;
    
    if (filteredTracks.length === 0) {
      this._list.innerHTML = `
        <div class="pl-empty">
          <div>No tracks match your search</div>
        </div>
      `;
      return;
    }
    
    this._list.innerHTML = '';
    
    filteredTracks.forEach((track, i) => {
      // Map back to actual index in original tracks
      const actualIndex = this._tracks.indexOf(track);
      const trackEl = document.createElement('div');
      trackEl.className = 'pl-track';
      if (actualIndex === this._currentIndex) trackEl.classList.add('playing');
      if (actualIndex === this._currentIndex) trackEl.classList.add('selected');
      
      const isFav = this._favoriteUrls.includes(track.url);
      
      trackEl.innerHTML = `
        <div class="pl-track-index">${actualIndex + 1}</div>
        <div class="pl-track-info">
          <div class="pl-track-title">${track.metadata.title}</div>
          <div class="pl-track-artist">${track.metadata.artist}</div>
        </div>
        <div class="pl-track-duration">${this._formatDuration(track.metadata.duration)}</div>
        <button class="pl-track-fav ${isFav ? 'active' : ''}" data-index="${actualIndex}">★</button>
        <button class="pl-track-remove" data-index="${actualIndex}">×</button>
      `;
      
      trackEl.addEventListener('click', (e) => {
        if (!e.target.classList.contains('pl-track-remove') && !e.target.classList.contains('pl-track-fav')) {
          this.playTrack(actualIndex);
        }
      });
      
      trackEl.querySelector('.pl-track-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('toggle-favorite', { detail: track }));
      });

      trackEl.querySelector('.pl-track-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTrack(actualIndex);
      });
      
      this._list.appendChild(trackEl);
    });
    
    this._countEl.textContent = `${this._tracks.length} track${this._tracks.length !== 1 ? 's' : ''}`;
  }

  _formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  _findEngine() {
    if (this._engineId) {
      this._engine = document.getElementById(this._engineId);
    }
    
    if (!this._engine) {
      this._engine = document.querySelector('pro-audio-engine');
    }
  }

  _onEngineReady(e) {
    this._engine = e.target;
  }

  _onTrackEnded() {
    if (this._repeatMode === 'one') {
      this.playTrack(this._currentIndex);
    } else {
      this.next();
    }
  }
}

customElements.define('pro-playlist', ProPlaylist);

export default ProPlaylist;