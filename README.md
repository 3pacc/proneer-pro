# Pro Modular Audio Player - Web Components Suite

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Web Components](https://img.shields.io/badge/Web%20Components-v3-green)
![AudioContext](https://img.shields.io/badge/AudioContext-Web%20API-orange)
![WAM](https://img.shields.io/badge/WAM-2.0-purple)

Lecteur audio modulaire professionnel inspiré de **Pioneer DJ** et **Teenage Engineering**, construit avec des **Web Components purs** (Shadow DOM, Custom Elements). L'architecture permet de composer une interface audio complète via l'assemblage de composants indépendants, sans framework externe.

## Table des Matières

- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Structure des Composants](#structure-des-composants)
- [API Documentation](#api-documentation)
- [Communication Inter-Composants](#communication-inter-composants)
- [Guide d'Intégration](#guide-dintégration)
- [Support WAM](#support-wam)
- [Theming](#theming)
- [Post-Mortem IA](#post-mortem-ia)

---

## Fonctionnalités

### Composants Core

| Composant | Description |
|-----------|-------------|
| `<pro-audio-engine>` | Gestionnaire AudioContext, routing graph, playback |
| `<pro-eq>` | Égaliseur 10 bandes (fréquences ISO) |
| `<pro-visualizer>` | Visualiseur 60 FPS (Spectrum/Waveform/VU) |
| `<pro-playlist>` | Gestionnaire de fichiers avec drag & drop, ID3 |
| `<pro-fx-rack>` | Container WAM avec routing série/parallèle |
| `<pro-knob>` | Knob rotatif avec interaction réaliste |
| `<pro-fader>` | Fader vertical/horizontal |

### Caractéristiques Techniques

- **100% Web Components** - Aucune dépendance externe
- **Shadow DOM** - Isolation complète des styles
- **Event Bus** - Communication découplée entre composants
- **Audio Worklet Ready** - Architecture prête pour WAM 2.0
- **60 FPS Rendering** - Visualisations fluides
- **Logarithmique/linéaire** - Support pour knobs et scales
- **Theming CSS Variables** - Personnalisation facile

---

## Installation

### Option 1: Import CDN (Recommandé)

```html
<script type="module" src="https://your-cdn.com/pro-audio-player.js"></script>
```

### Option 2: Import Local

```html
<script type="module" src="./components/pro-knob.js"></script>
<script type="module" src="./components/pro-fader.js"></script>
<script type="module" src="./components/pro-audio-engine.js"></script>
<script type="module" src="./components/pro-eq.js"></script>
<script type="module" src="./components/pro-visualizer.js"></script>
<script type="module" src="./components/pro-playlist.js"></script>
<script type="module" src="./components/pro-fx-rack.js"></script>
```

### Option 3: Bundle Unique

```html
<script type="module" src="./pro-audio-player.js"></script>
```

---

## Structure des Composants

```
pro-proneer-pro/
├── index.html              # Demo page
├── pro-audio-player.js     # Bundle export
├── SPECIFICATION.md        # Spécifications API détaillées
├── components/
│   ├── pro-audio-engine.js # Audio Context & routing
│   ├── pro-eq.js          # 10-band equalizer
│   ├── pro-visualizer.js   # Canvas visualizer
│   ├── pro-playlist.js     # File management
│   ├── pro-fx-rack.js     # WAM host
│   ├── pro-knob.js        # Rotary knob UI
│   └── pro-fader.js       # Fader UI
├── styles/
│   └── theme.css          # CSS variables & global styles
└── utils/
    └── audio-context-bridge.js # Shared audio context
```

---

## API Documentation

### `<pro-audio-engine>`

#### Tag
```html
<pro-audio-engine id="main-engine" volume="0.8"></pro-audio-engine>
```

#### Attributs HTML

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `volume` | float | `1.0` | Volume master (0.0 - 1.0) |
| `eq-bands` | string | `null` | JSON array de 10 valeurs EQ |
| `fx-enabled` | boolean | `true` | FX rack activé |
| `analyser-fft` | int | `2048` | Taille FFT pour l'analyseur |
| `autoplay` | boolean | `false` | Lecture auto à l'init |

#### Méthodes

```javascript
engine.play()                              // Démarrer lecture
engine.pause()                             // Pause
engine.stop()                              // Stop
engine.seek(time: float)                   // Rechercher (secondes)
engine.setVolume(value: float)             // Volume 0-1
engine.setEqBand(band: int, value: float)  // 1 bande EQ (-12 à +12 dB)
engine.setAllEq(values: Array<float>)      // Toutes bandes EQ
engine.loadTrack(url: string)               // Charger piste
engine.addEffect(wamUrl: string)            // Ajouter effet WAM
```

#### Événements Émis

| Événement | Detail | Description |
|-----------|--------|-------------|
| `engine-ready` | `{ sampleRate, state }` | Context initialisé |
| `track-loaded` | `{ url, duration, metadata }` | Piste chargée |
| `track-play` | `{ currentTime }` | Lecture démarrée |
| `track-pause` | `{ currentTime }` | Pause |
| `track-ended` | `{}` | Fin de piste |
| `time-update` | `{ currentTime, duration }` | Update 4fps |

---

### `<pro-visualizer>`

#### Tag
```html
<pro-visualizer mode="spectrum" height="200"></pro-visualizer>
```

#### Attributs

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `mode` | string | `spectrum` | `spectrum`, `waveform`, `vumeter` |
| `engine-id` | string | `null` | ID de l'engine |
| `colors` | string | `accent;secondary;bg` | Palette |
| `fps` | int | `60` | Images par seconde |
| `glow` | boolean | `true` | Effets glow |

#### Méthodes

```javascript
visualizer.setMode('spectrum')  // Changer mode
visualizer.start()              // Démarrer rendu
visualizer.stop()              // Arrêter rendu
visualizer.setColors({ accent: '#ff0000' })
```

---

### `<pro-eq>`

#### Tag
```html
<pro-eq preset="flat" height="140"></pro-eq>
```

#### Presets Intégrés

- `flat` - Toutes bandes à 0 dB
- `bass` - +6 dB sur basses
- `treble` - +6 dB sur hautes
- `vocal` - Curve pour voix
- `rock` - Curve en V
- `electronic` - Curve électronique

#### Méthodes

```javascript
eq.setBand(0, 6)                 // Bande 0 à +6 dB
eq.setAllBands([0,0,0,0,0,0,0,0,0,0]) // Reset
eq.applyPreset('rock')           // Appliquer preset
eq.reset()                       // Reset à flat
```

---

### `<pro-playlist>`

#### Tag
```html
<pro-playlist height="300" searchable="true"></pro-playlist>
```

#### Méthodes

```javascript
playlist.addTrack(url, metadata) // Ajouter piste
playlist.removeTrack(index)      // Supprimer
playlist.playTrack(index)         // Jouer
playlist.next()                   // Suivante
playlist.previous()               // Précédente
playlist.shuffle()                // Mode shuffle
playlist.clear()                  // Vider
```

#### Événements

| Événement | Description |
|-----------|-------------|
| `track-selected` | Utilisateur sélectionne piste |
| `track-loaded` | Piste chargée dans engine |
| `playlist-change` | Playlist modifiée |

---

### `<pro-fx-rack>`

#### Tag
```html
<pro-fx-rack mode="series"></pro-fx-rack>
```

#### Méthodes

```javascript
fxRack.loadEffect('https://.../delay.wam')  // Charger WAM
fxRack.unloadEffect(index)                   // Décharger
fxRack.bypassEffect(index)                   // Toggle bypass
fxRack.setMode('parallel')                   // Routing mode
```

---

### `<pro-knob>`

#### Tag
```html
<pro-knob value="50" min="0" max="100" label="GAIN" size="60"></pro-knob>
```

#### Attributs

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `value` | float | `0` | Valeur actuelle |
| `min` | float | `0` | Minimum |
| `max` | float | `100` | Maximum |
| `step` | float | `1` | Pas |
| `label` | string | `''` | Label |
| `unit` | string | `''` | Unité (dB, Hz) |
| `size` | int | `60` | Taille px |
| `logarithmic` | boolean | `false` | Scale log |
| `bipolar` | boolean | `false` | Centre à 0 |

#### Événements

```javascript
knob.addEventListener('input', (e) => console.log(e.detail.value));
knob.addEventListener('change', (e) => console.log(e.detail.value));
```

---

### `<pro-fader>`

#### Tag
```html
<pro-fader value="75" orientation="vertical" length="120"></pro-fader>
```

#### Attributs

| Attribut | Type | Défaut | Description |
|----------|------|--------|-------------|
| `value` | float | `0` | Valeur |
| `min` | float | `0` | Minimum |
| `max` | float | `100` | Maximum |
| `orientation` | string | `vertical` | `vertical`/`horizontal` |
| `length` | int | `150` | Longueur px |
| `show-value` | boolean | `true` | Afficher valeur |

---

## Communication Inter-Composants

### Event Bus Pattern

Les composants communiquent via un **Event Bus** centralisé basé sur `CustomEvent` bubbles.

```
┌─────────────────────────────────────────────┐
│              window (Event Bus)             │
├─────────────────────────────────────────────┤
│  track-play-request ──────────────────────▶ │
│  engine-ready ◀────────────────────────────  │
│  time-update ◀─────────────────────────────  │
│  eq-change ◀───────────────────────────────  │
└─────────────────────────────────────────────┘
```

### Partager le AudioContext

```javascript
// Via attribut engine-id
<pro-visualizer engine-id="main-engine"></pro-visualizer>

// Via recherche automatique (premier pro-audio-engine)
<pro-visualizer></pro-visualizer>

// Via API directe
const engine = document.getElementById('main-engine');
const visualizer = document.getElementById('viz');
visualizer.findEngine(); // Retourne l'engine
```

### Exemple Complet

```html
<!-- 1. Déclarer l'engine -->
<pro-audio-engine id="main-engine"></pro-audio-engine>

<!-- 2. Les composants se connectent automatiquement -->
<pro-playlist engine-id="main-engine"></pro-playlist>
<pro-eq engine-id="main-engine"></pro-eq>
<pro-visualizer engine-id="main-engine"></pro-visualizer>

<!-- 3. Contrôle programatique -->
<script>
  const engine = document.getElementById('main-engine');
  
  engine.addEventListener('engine-ready', () => {
    engine.loadTrack('https://example.com/audio.mp3');
    engine.play();
  });
</script>
```

---

## Guide d'Intégration

### Intégration Minimale

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles/theme.css">
</head>
<body>
  <pro-audio-engine id="engine"></pro-audio-engine>
  <pro-playlist engine-id="engine"></pro-playlist>
  <pro-visualizer engine-id="engine"></pro-visualizer>
  <pro-eq engine-id="engine"></pro-eq>
  
  <script type="module" src="./components/pro-audio-engine.js"></script>
  <script type="module" src="./components/pro-playlist.js"></script>
  <script type="module" src="./components/pro-visualizer.js"></script>
  <script type="module" src="./components/pro-eq.js"></script>
</body>
</html>
```

### Configuration Avancée

```javascript
// Configuration de l'engine
const engine = document.getElementById('engine');

// Volume
engine.setVolume(0.8);

// EQ
engine.setAllEq([3, 2, 0, -1, 2, 3, 1, 0, -2, -3]);

// Chargement async
async function loadAndPlay(url) {
  await engine.loadTrack(url, { title: 'My Track', artist: 'Artist' });
  engine.play();
}

// Écouter les événements
engine.addEventListener('time-update', (e) => {
  const { currentTime, duration } = e.detail;
  updateProgressBar(currentTime / duration);
});

engine.addEventListener('track-ended', () => {
  playNext();
});
```

---

## Support WAM

### Charger un Effet WAM

```javascript
const fxRack = document.getElementById('fx-rack');

// URL de la galerie WAM
const delayWam = 'https://cdn.webaudiomodules.com/wamfx/delay.wam';

await fxRack.loadEffect(delayWam);
```

### URLs WAM Prédéfinies (Exemples)

| Nom | URL |
|-----|-----|
| Delay | `https://cdn.webaudiomodules.com/wamfx/delay.wam` |
| Reverb | `https://cdn.webaudiomodules.com/wamfx/reverb.wam` |
| Chorus | `https://cdn.webaudiomodules.com/wamfx/chorus.wam` |
| Overdrive | `https://cdn.webaudiomodules.com/wamfx/overdrive.wam` |

### Architecture WAM 2.0

```javascript
// Interface minimale WAM
class MyEffect extends WebAudioModule {
  async createAudioNode(audioContext) {
    const node = audioContext.createGain();
    // ... configure
    return node;
  }
  
  createGui() {
    return document.createElement('div');
  }
}
```

---

## Theming

### CSS Variables

```css
/* Dans votre CSS ou :root */
:root {
  --color-accent-primary: #00D4FF;
  --color-accent-secondary: #FF6B35;
  --color-bg-primary: #121212;
}

/* Sur un composant spécifique */
pro-knob {
  --knob-accent: #FF0000;  /* Override */
  --knob-size: 80px;
}
```

### Variables par Composant

| Composant | Variables |
|-----------|-----------|
| `pro-knob` | `--knob-accent`, `--knob-secondary`, `--knob-bg`, `--knob-glow` |
| `pro-fader` | `--fader-accent`, `--fader-secondary`, `--fader-bg` |
| `pro-eq` | `--eq-accent`, `--eq-secondary`, `--eq-bg` |
| `pro-visualizer` | `--viz-accent`, `--viz-secondary`, `--viz-bg` |
| `pro-playlist` | `--pl-accent`, `--pl-secondary`, `--pl-bg` |
| `pro-fx-rack` | `--fx-accent`, `--fx-secondary`, `--fx-bg` |

### Thème Sombre (Défaut)

Les composants utilisent automatiquement le thème sombre Pioneer-grade.

---

## Post-Mortem IA

### Outils IA Utilisés

Ce projet a été développé avec l'assistance d'un agent IA (Cursor AI) fonctionnant avec le modèle **MiniMax-M2**.

### Méthodologie

#### 1. **Analyse des Exigences**
- Découpage en phases séquentielles (SPEC → Core → Components → Demo)
- Utilisation de TodoWrite pour tracking
- Recherche d'informations sur les standards (WAM API, webaudio-controls specs)

#### 2. **Génération du Code**
- Lecture des specifications d'API de référence (webaudio-controls)
- Recherche sur WAM (Web Audio Modules)
- Application des patterns Web Components (Shadow DOM, Custom Elements)
- Documentation JSDoc pour chaque méthode/événement

#### 3. **Standards de Code**
- Pas de frameworks externes (vanilla JS pur)
- Shadow DOM `{ mode: 'open' }`
- Custom Events avec `bubbles: true, composed: true`
- JSDoc pour documentation automatique
- CSS Variables pour le theming

### Fichiers de Règles Créés

Aucun fichier de règles personnalisé n'a été créé explicitement. Les contraintes ont été appliquées via:
- Instructions system prompt
- SPECIFICATION.md (documentation d'API)
- README.md (guide d'intégration)

### Decisions de Design Documentées

#### 1. **Composants Non-Imbricables**
**Pourquoi**: L'architecture Event Bus rend la communication inter-composants complexe si imbriqués dans le DOM hierarchy. Chaque composant fonctionne indépendamment et peut être positionné n'importe où.

#### 2. **AudioContext Partagé via Event Bus**
**Pourquoi**: Évite le couplage fort. Les composants ne connaissent pas les autres, ils écoutent les événements. L'engine crée le contexte, les autres s'y connectent.

#### 3. **Zero Dépendances**
**Pourquoi**: L'objectif est l'hébergement CDN. Chaque composant est autonome et peut être importé individuellement.

### Améliorations Possibles

1. **AudioWorklet Migration** - Remplacer AudioWorklet pour meilleur performance
2. **ServiceWorker Caching** - Cache offline pour les composants
3. **Web Components Testing** - Tests automatisés avec Web Test Runner
4. **TypeScript Definitions** - Ajouter .d.ts pour autocomplétion
5. **Accessibility** - ARIA labels et keyboard navigation

### Conclusion

Le projet a été développé enFollowing les principes de clean code et Web Components standards. L'utilisation d'un agent IA a permis de:
- Générer rapidement la structure de code
- Obtenir des références d'API pour les standards (WAM)
- Maintenir une cohérence dans le naming et la structure
- Documenter automatiquement via JSDoc

La principale limite est la nécessiter de tester manuellement dans un vrai navigateur, particulièrement pour les fonctionnalités audio qui dépendent du user gesture requirement.

---

## Licence

MIT License - Libre d'utilisation et modification.

## Browser Support

- Chrome 66+ (AudioWorklet)
- Firefox 76+ (AudioWorklet)
- Safari 14.1+ (AudioWorklet)
- Edge 79+

---

Développé avec ❤️ et Web Components
