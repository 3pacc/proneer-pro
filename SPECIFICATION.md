# Pro Modular Audio Player - Spécification Technique

## 1. Vision & Objectifs

### 1.1 Concept
Un lecteur audio modulaire professionnel inspiré de Pioneer DJ et Teenage Engineering, construit avec des **Web Components purs** (Shadow DOM, Custom Elements). L'architecture permet de composer une interface audio complète via l'assemblage de composants indépendants, sans framework externe.

### 1.2 Aesthetic "Pioneer-Grade"
- **Palette** : Deep Charcoal (#121212), Electric Blue (#00D4FF), Neon Orange (#FF6B35)
- **Typography** : JetBrains Mono (données), Inter (UI)
- **Effets** : Glows CSS, gradients sur canvas, animations 60fps
- **Interactions** : Knobs rotatifs avec feedback tactile, faders fluides, boutons retroéclairés

---

## 2. Architecture Globale

### 2.1 Pattern AudioContext Partagé

Pour éviter le couplage fort entre composants, nous utilisons un **Event Bus centralisé** basé sur `CustomEvent` bubbles. L'`AudioContext` est créé et géré par `<pro-audio-engine>`, mais accessible à tous les composants via lookup.

```
┌─────────────────────────────────────────────────────────┐
│                    EVENT BUS                            │
│  (CustomEvents bubbles=true, composed=true)           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │ pro-audio-   │───▶│ Event Bus    │                  │
│  │ engine       │    │ (singleton) │                  │
│  └──────────────┘    └──────┬───────┘                  │
│                             │                           │
│         ┌───────────────────┼───────────────────┐      │
│         ▼                   ▼                   ▼      │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────┐ │
│  │ pro-visualizer│   │ pro-eq       │   │ pro-fx-rack│ │
│  └──────────────┘   └──────────────┘   └────────────┘ │
│         │                   │                   │      │
│  ┌──────────────┐   ┌──────────────┐                   │
│  │ pro-playlist │   │ pro-knob     │                   │
│  └──────────────┘   └──────────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Routing Audio Graph

```
Source (AudioBufferSourceNode / MediaElementSource)
    │
    ▼
┌─────────┐
│  INPUT  │ (pré-amp)
└────┬────┘
     │
     ▼
┌─────────┐
│   EQ    │ (10-band BiquadFilterNode)
└────┬────┘
     │
     ▼
┌─────────┐
│  FX     │ (FX Rack - WAM Host)
└────┬────┘
     │
     ▼
┌─────────┐
│  MASTER │ (GainNode + DynamicsCompressorNode)
└────┬────┘
     │
     ▼
┌─────────┐
│ Analyser│ (pour Visualizer)
└────┬────┘
     │
     ▼
┌─────────┐
│Destination│ (AudioContext.destination)
└─────────┘
```

### 2.3 Partage du AudioContext

1. `<pro-audio-engine>` crée et expose `audioContext` sur son element
2. Les composants enfants font un `document.querySelector('pro-audio-engine')` pour obtenir la référence
3. Alternativement, un attribut `engine-id` peut pointer vers un engine spécifique
4. L'engine émet des événements `engine-ready` quand le contexte est initialisé

---

## 3. Event Bus - Communication Inter-Composants

### 3.1 Convention des Événements

| Événement | Direction | Description |
|-----------|-----------|-------------|
| `engine-ready` | engine → all | AudioContext initialisé et prêt |
| `engine-suspend` | engine → all | Contexte suspendu (pause) |
| `engine-resume` | engine → all | Contexte repris |
| `track-loaded` | playlist → engine | Nouvelle piste chargée |
| `track-play` | engine → all | Lecture démarrée |
| `track-pause` | engine → all | Lecture en pause |
| `track-ended` | engine → all | Fin de piste |
| `time-update` | engine → all | Mise à jour temps (4fps) |
| `eq-change` | eq → engine | Paramètres EQ modifiés |
| `fx-load` | fx-rack → engine | Nouvel effet chargé |
| `fx-bypass` | fx-rack → engine | Effet bypass togglé |
| `master-volume` | any → engine | Volume master modifié |
| `visualizer-mode` | visualizer → engine | Mode visualiseur changé |

### 3.2 Payload Standard

Tous les événements CustomEvent contiennent un `detail` structuré :

```javascript
{
  source: 'component-id',      // ID du composant source
  timestamp: DOMHighResTimeStamp,
  data: { ... }               // Données spécifiques à l'événement
}
```

---

## 4. SPECIFICATION.md DES COMPOSANTS

---

## 4.1 `<pro-audio-engine>`

### 4.1.1 Description
Le composant central "cerveau" qui gère l'AudioContext, le routing graph complet (Source → EQ → FX → Master → Analyser), et la logique de playback.

### 4.1.2 Tag HTML
```html
<pro-audio-engine id="main-engine"></pro-audio-engine>
```

### 4.1.3 Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `volume` | float | `1.0` | Volume master (0.0 - 1.0) |
| `eq-bands` | string | `null` | JSON array de 10 valeurs initiales EQ |
| `fx-enabled` | boolean | `true` | FX rack activé |
| `analyser-fft` | int | `2048` | Taille FFT pour l'analyseur |
| `autoplay` | boolean | `false` | Lecture automatique à l'init |

### 4.1.4 Propriétés Exposed

| Propriété | Type | Description |
|-----------|------|-------------|
| `audioContext` | AudioContext | Référence au contexte audio |
| `currentTime` | float | Temps actuel de lecture |
| `duration` | float | Durée de la piste actuelle |
| `isPlaying` | boolean | État de lecture |
| `volume` | float | Volume master (getter/setter) |
| `sourceNode` | AudioBufferSourceNode\|MediaElementAudioSourceNode | Node source actuel |
| `eqBands` | Array<number> | Les 10 valeurs EQ (-12 à +12 dB) |
| `fxChain` | Array<WebAudioModule> | Liste des effets chargés |

### 4.1.5 Méthodes Externes

```javascript
// Contrôle playback
engine.play()                      // Démarrer la lecture
engine.pause()                     // Mettre en pause
engine.stop()                      // Arrêter et reset
engine.seek(time: float)           // Aller à une position (secondes)
engine.setVolume(value: float)     // Définir le volume (0-1)
engine.setEqBand(band: int, value: float)  // Définir 1 bande EQ
engine.setAllEq(values: Array<float>)     // Définir toutes les bandes
engine.loadTrack(url: string)      // Charger une nouvelle piste
engine.connectExternalNode(node: AudioNode) // Connecter un node externe

// Gestion FX
engine.addEffect(wamUrl: string)    // Ajouter un effet WAM
engine.removeEffect(index: int)    // Supprimer un effet
engine.bypassEffect(index: int, bypass: boolean) // Bypass un effet
```

### 4.1.6 Événements Émis

| Événement | Detail | Description |
|-----------|--------|-------------|
| `engine-ready` | `{ sampleRate, state }` | Contexte initialisé |
| `track-loaded` | `{ url, duration, metadata }` | Piste chargée |
| `track-play` | `{ currentTime }` | Lecture démarrée |
| `track-pause` | `{ currentTime }` | Lecture en pause |
| `track-ended` | `{}` | Fin de piste |
| `time-update` | `{ currentTime, duration }` | Mise à jour temps (4fps) |
| `eq-change` | `{ bands: Array<float> }` | EQ modifié |
| `volume-change` | `{ volume }` | Volume modifié |
| `fx-loaded` | `{ index, name }` | Nouvel effet chargé |

### 4.1.7 Événements Écoutés

| Événement | Action |
|-----------|--------|
| `track-play-request` | Démarrer lecture |
| `track-pause-request` | Mettre en pause |
| `seek-request` | Rechercher |
| `eq-change-request` | Appliquer EQ |

---

## 4.2 `<pro-visualizer>`

### 4.2.1 Description
Composant de visualisation haute performance utilisant Canvas 2D avec rendering à 60 FPS. Supporte 3 modes : Waveform, Spectrum (FFT), et Peak VU-Meters.

### 4.2.2 Tag HTML
```html
<pro-visualizer mode="spectrum" engine-id="main-engine"></pro-visualizer>
```

### 4.2.3 Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `mode` | string | `'spectrum'` | Mode : `waveform`, `spectrum`, `vumeter` |
| `engine-id` | string | `null` | ID de l'engine à utiliser |
| `colors` | string | `'#00D4FF;#FF6B35;#121212'` | Couleurs : accent;secondary;background |
| `fps` | int | `60` | Images par seconde |
| `gradient` | string | `'false'` | Utiliser gradients CSS |
| `glow` | string | `'true'` | Activer les effets glow |
| `height` | int | `200` | Hauteur du canvas |
| `width` | int | `400` | Largeur du canvas |

### 4.2.4 Propriétés Exposed

| Propriété | Type | Description |
|-----------|------|-------------|
| `mode` | string | Mode actuel (r/w) |
| `fps` | int | FPS cible (r/w) |
| `colors` | Object | Palette de couleurs { accent, secondary, bg } |

### 4.2.5 Méthodes Externes

```javascript
visualizer.setMode(mode: string)   // 'waveform' | 'spectrum' | 'vumeter'
visualizer.start()                 // Démarrer le rendu
visualizer.stop()                  // Arrêter le rendu
visualizer.setColors(colors: object) // Mettre à jour les couleurs
```

### 4.2.6 Événements Émis

| Événement | Detail | Description |
|-----------|--------|-------------|
| `mode-change` | `{ mode }` | Mode de visualisation changé |

### 4.2.7 Événements Écoutés

| Événement | Action |
|-----------|--------|
| `engine-ready` | Connecter à l'analyseur |
| `track-play` | Démarrer rendu |
| `track-pause` | Pause rendu |
| `engine-suspend` | Pause rendu |

---

## 4.3 `<pro-eq>`

### 4.3.1 Description
Égaliseur graphique 10 bandes utilisant des BiquadFilterNode. Chaque bande représente une fréquence standard ISO.

### 4.3.2 Frequencies ISO Standards

| Bande | Fréquence | Label |
|-------|-----------|-------|
| 0 | 31 Hz | 31 |
| 1 | 62 Hz | 62 |
| 2 | 125 Hz | 125 |
| 3 | 250 Hz | 250 |
| 4 | 500 Hz | 500 |
| 5 | 1 kHz | 1k |
| 6 | 2 kHz | 2k |
| 7 | 4 kHz | 4k |
| 8 | 8 kHz | 8k |
| 9 | 16 kHz | 16k |

### 4.3.3 Tag HTML
```html
<pro-eq engine-id="main-engine" preset="flat"></pro-eq>
```

### 4.3.4 Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `engine-id` | string | `null` | ID de l'engine |
| `bands` | string | `null` | JSON array 10 valeurs initiales |
| `colors` | string | `'#00D4FF;#FF6B35;#121212'` | Couleurs |
| `glow` | string | `'true'` | Effets glow |
| `height` | int | `120` | Hauteur |

### 4.3.5 Presets Intégrés

| Preset | Description |
|--------|-------------|
| `flat` | Toutes bandes à 0 dB |
| `bass` | +6 dB sur basses fréquences |
| `treble` | +6 dB sur hautes fréquences |
| `vocal` | -2 dB sur mediums, +2 sur 1k-4k |
| `rock` | Curve en V |
| `electronic` | Bass +5, Highs +4, coupure 250Hz |

### 4.3.6 Propriétés Exposed

| Propriété | Type | Description |
|-----------|------|-------------|
| `bands` | Array<float> | Valeurs des 10 bandes (-12 à +12) |
| `preset` | string | Preset actuel |

### 4.3.7 Méthodes Externes

```javascript
eq.setBand(index: int, value: float)  // -12 à +12 dB
eq.setAllBands(values: Array<float>) // 10 valeurs
eq.reset()                           // Reset à flat
eq.applyPreset(preset: string)      // Appliquer un preset
eq.getState()                       // Retourne état complet
```

### 4.3.8 Événements Émis

| Événement | Detail | Description |
|-----------|--------|-------------|
| `eq-change` | `{ bands, bandIndex, value }` | EQ modifié |

---

## 4.4 `<pro-playlist>`

### 4.4.1 Description
Gestionnaire de fichiers avancé avec drag & drop, parsing metadata ID3, et recherche.

### 4.4.2 Tag HTML
```html
<pro-playlist engine-id="main-engine"></pro-playlist>
```

### 4.4.3 Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `engine-id` | string | `null` | ID de l'engine |
| `sortable` | string | `'true'` | Enable drag reorder |
| `searchable` | string | `'true'` | Enable recherche |
| `height` | int | `300` | Hauteur |

### 4.4.4 Format Métadonnées ID3

```javascript
{
  title: string,
  artist: string,
  album: string,
  duration: float,      // secondes
  coverArt: string|null, // data URL base64
  year: string,
  genre: string
}
```

### 4.4.5 Propriétés Exposed

| Propriété | Type | Description |
|-----------|------|-------------|
| `tracks` | Array<Track> | Liste des pistes |
| `currentIndex` | int | Index piste en cours |
| `currentTrack` | Track | Piste actuelle |

### 4.4.6 Méthodes Externes

```javascript
playlist.addTrack(url: string, metadata?: object)  // Ajouter piste
playlist.removeTrack(index: int)                  // Supprimer piste
playlist.clear()                                  // Vider playlist
playlist.playTrack(index: int)                     // Jouer piste index
playlist.next()                                   // Piste suivante
playlist.previous()                               // Piste précédente
playlist.shuffle()                                // Mode shuffle
playlist.sortBy(field: string, asc: boolean)     // Tri
```

### 4.4.7 Événements Émis

| Événement | Detail | Description |
|-----------|--------|-------------|
| `track-loaded` | `{ index, url, metadata }` | Piste chargée dans engine |
| `track-selected` | `{ index, track }` | Sélection utilisateur |
| `playlist-change` | `{ tracks }` | Playlist modifiée |
| `repeat-change` | `{ mode }` | Mode repeat changé |

---

## 4.5 `<pro-fx-rack>`

### 4.5.1 Description
Container dynamique pour charger et gérer des effets Web Audio Modules (WAM 2.0). Supporte le routing série/parallèle.

### 4.5.2 Tag HTML
```html
<pro-fx-rack engine-id="main-engine" mode="series"></pro-fx-rack>
```

### 4.5.3 Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `engine-id` | string | `null` | ID de l'engine |
| `mode` | string | `'series'` | Mode : `series`, `parallel` |
| `bypass` | string | `'false'` | Tous les effets bypass |

### 4.5.4 WAM Integration

Le composant utilise le標準 WAM 2.0 API :

```javascript
// Loading WAM from URL
const wamUrl = 'https://cdn.example.com/my-effect';

// WAM must expose
{
  createAudioNode: (audioContext) => Promise<AudioNode>,
  createGui: () => HTMLElement
}
```

### 4.5.5 Propriétés Exposed

| Propriété | Type | Description |
|-----------|------|-------------|
| `effects` | Array<WAMInstance> | Effets chargés |
| `mode` | string | Mode routing |
| `bypass` | boolean | État bypass global |

### 4.5.6 Méthodes Externes

```javascript
fxrack.loadEffect(url: string)        // Charger effet WAM
fxrack.unloadEffect(index: int)       // Décharger effet
fxrack.bypassEffect(index: int)       // Toggle bypass
fxrack.setBypassAll(bypass: boolean)  // Bypass global
fxrack.setMode(mode: string)          // series | parallel
fxrack.connectInOrder()               // Reconnexion ordinale
```

### 4.5.7 Événements Émis

| Événement | detail | Description |
|-----------|--------|-------------|
| `fx-loaded` | `{ index, name, instance }` | Effet chargé |
| `fx-unloaded` | `{ index }` | Effet déchargé |
| `fx-bypass` | `{ index, bypass }` | Bypass changé |

---

## 4.6 `<pro-knob>`

### 4.6.1 Description
Primitive UI : knob rotatif avec interaction drag verticale réaliste et feedback visuel (glow).

### 4.6.2 Tag HTML
```html
<pro-knob value="50" min="0" max="100" label="GAIN"></pro-knob>
```

### 4.6.3 Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `value` | float | `0` | Valeur actuelle |
| `min` | float | `0` | Valeur minimum |
| `max` | float | `100` | Valeur maximum |
| `step` | float | `1` | Pas de valeur |
| `label` | string | `''` | Label text |
| `unit` | string | `''` | Unité (dB, Hz, etc.) |
| `size` | int | `60` | Taille en pixels |
| `colors` | string | `'#00D4FF;#FF6B35;#222'` | accent;secondary;bg |
| `sensitivity` | float | `1` | Sensibilité drag |
| `logarithmic` | string | `'false'` | Scale logarithmique |
| `bipolar` | string | `'false'` | Centre à 0 pour signed values |

### 4.6.4 CSS Custom Properties (Theming)

```css
pro-knob {
  --knob-accent: #00D4FF;
  --knob-secondary: #FF6B35;
  --knob-bg: #222;
  --knob-glow: 0 0 10px var(--knob-accent);
}
```

### 4.6.5 Propriétés Exposed

| Propriété | Type | Description |
|-----------|------|-------------|
| `value` | float | Valeur actuelle (getter/setter) |
| `min` | float | Minimum |
| `max` | float | Maximum |
| `step` | float | Pas |
| `label` | string | Label |

### 4.6.6 Méthodes Externes

```javascript
knob.setValue(value: float, fireEvent?: boolean)
knob.getValue()
knob.reset()
knob.setColors(colors: object)
```

### 4.6.7 Événements Émis

| Événement | detail | Description |
|-----------|--------|-------------|
| `input` | `{ value }` | Pendant le drag |
| `change` | `{ value }` | Fin du drag / click |

---

## 4.7 `<pro-fader>`

### 4.7.1 Description
Primitive UI : fader vertical/horizontal avec track visual et handle draggable.

### 4.7.2 Tag HTML
```html
<pro-fader value="75" min="0" max="100" orientation="vertical"></pro-fader>
```

### 4.7.3 Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `value` | float | `0` | Valeur actuelle |
| `min` | float | `0` | Minimum |
| `max` | float | `100` | Maximum |
| `step` | float | `1` | Pas |
| `orientation` | string | `'vertical'` | `vertical` ou `horizontal` |
| `label` | string | `''` | Label |
| `unit` | string | `''` | Unité |
| `length` | int | `150` | Longueur en pixels |
| `colors` | string | `'#00D4FF;#FF6B35;#222'` | accent;secondary;bg |
| `show-value` | string | `'true'` | Afficher valeur |

### 4.7.4 CSS Custom Properties

```css
pro-fader {
  --fader-accent: #00D4FF;
  --fader-track: #333;
  --fader-bg: #121212;
}
```

### 4.7.5 Propriétés Exposed

| Propriété | Type | Description |
|-----------|------|-------------|
| `value` | float | Valeur actuelle |
| `orientation` | string | `vertical` \| `horizontal` |

### 4.7.6 Méthodes Externes

```javascript
fader.setValue(value: float, fireEvent?: boolean)
fader.getValue()
fader.reset()
```

### 4.7.7 Événements Émis

| Événement | detail | Description |
|-----------|--------|-------------|
| `input` | `{ value }` | Pendant le drag |
| `change` | `{ value }` | Fin du drag |

---

## 5. Décisions de Design

### 5.1 Composants Imbricables ?

**Non, les composants ne sont PAS conçus pour être imbriqués hiérarchiquement dans le DOM.**

**Pourquoi :**
1. **Independence** : Chaque composant doit pouvoir fonctionner seul ou en组合 avec d'autres
2. **Audio Graph** : Le routing audio est centralisé dans `pro-audio-engine`, pas dans le DOM tree
3. **Shadow DOM** : L'isolation de Shadow DOM rend la communication inter-composants complexe si imbriqués
4. **Flexibilité** : Permet de positionner les composants n'importe où dans la page

**Exception** : `pro-knob` et `pro-fader` PEUVENT être utilisés seuls ou dans d'autres composants.

### 5.2 AudioContext Sharing

**Pattern choisi : Event-Based Lookup avec Cache**

```javascript
class AudioContextBridge {
  static cache = new WeakMap();
  
  static getEngine(element) {
    // 1. Check cache first
    // 2. Walk up DOM tree if needed
    // 3. Fallback to document querySelector
    // 4. Cache result for performance
  }
}
```

### 5.3 Memory Management

- Chaque composant écoute sur `window` via `{ once: false, passive: true }`
- `disconnectedCallback` cleanup : removeEventListeners, disconnect nodes
- Canvas : `cancelAnimationFrame` sur disconnect
- Audio nodes : `.disconnect()` explicite avant removal

---

## 6. Integration Guide

### 6.1 Import via URI (CDN Ready)

```html
<script type="module" src="https://your-cdn.com/pro-audio-player.js"></script>
```

### 6.2 Setup Minimal

```html
<!DOCTYPE html>
<html>
<head>
  <title>Pro Audio Player</title>
</head>
<body>
  <!-- 1. Engine first (creates AudioContext) -->
  <pro-audio-engine id="main-engine"></pro-audio-engine>
  
  <!-- 2. Playlist -->
  <pro-playlist engine-id="main-engine"></pro-playlist>
  
  <!-- 3. Visualizer -->
  <pro-visualizer engine-id="main-engine" mode="spectrum"></pro-visualizer>
  
  <!-- 4. EQ -->
  <pro-eq engine-id="main-engine"></pro-eq>
  
  <!-- 5. FX Rack -->
  <pro-fx-rack engine-id="main-engine"></pro-fx-rack>
  
  <script type="module" src="./pro-audio-player.js"></script>
</body>
</html>
```

### 6.3 Programmatic Control

```javascript
// Get engine reference
const engine = document.querySelector('pro-audio-engine');

// Load and play
await engine.loadTrack('https://example.com/track.mp3');
engine.play();

// Listen to events
engine.addEventListener('time-update', (e) => {
  console.log(`${e.detail.currentTime}s / ${e.detail.duration}s`);
});
```

---

## 7. WAM Support

### 7.1 Loading WAM Effects

```javascript
const fxRack = document.querySelector('pro-fx-rack');

// Load from WAM gallery URL
await fxRack.loadEffect('https://cdn.webaudiomodules.com/wamsynth/moog.vcv');

// Available effects URLs from gallery:
// - https://cdn.webaudiomodules.com/wamsynth/moog.vcv (Moog Synth)
// - https://cdn.webaudiomodules.com/wamfx/delay.wam (Delay)
// - https://cdn.webaudiomodules.com/wamfx/reverb.wam (Reverb)
```

### 7.2 WAM 2.0 Interface

```javascript
// Minimal WAM plugin structure
class MyWAM extends WebAudioModule {
  async createAudioNode(audioContext) {
    const node = audioContext.createGain();
    // ... configure node
    return node;
  }
  
  createGui() {
    return document.createElement('div');
  }
}
```

---

## 8. Browser Support

- Chrome 66+ (AudioWorklet)
- Firefox 76+ (AudioWorklet)
- Safari 14.1+ (AudioWorklet)
- Edge 79+

---

## 9. File Structure

```
/
├── SPECIFICATION.md
├── README.md
├── index.html              # Demo page
├── components/
│   ├── pro-audio-engine.js
│   ├── pro-visualizer.js
│   ├── pro-eq.js
│   ├── pro-playlist.js
│   ├── pro-fx-rack.js
│   ├── pro-knob.js
│   └── pro-fader.js
├── styles/
│   └── theme.css
└── utils/
    ├── audio-context-bridge.js
    └── id3-parser.js
```
