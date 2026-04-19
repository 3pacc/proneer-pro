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

## Licence

MIT License - Libre d'utilisation et modification.

## Browser Support

- Chrome 66+ (AudioWorklet)
- Firefox 76+ (AudioWorklet)
- Safari 14.1+ (AudioWorklet)
- Edge 79+
