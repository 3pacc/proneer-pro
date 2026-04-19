/**
 * Pro Audio Player - Bundle Export
 * 
 * Ce fichier exporte tous les composants Web Components.
 * Importez ce fichier pour charger l'ensemble de la suite.
 */

// Audio Context Bridge
export { audioContextBridge, WithAudioContext, createAudioEvent } from './utils/audio-context-bridge.js';

// ID3 Parser
export { parseID3, parseID3FromFile } from './utils/id3-parser.js';

// Components
export { default as ProKnob } from './components/pro-knob.js';
export { default as ProFader } from './components/pro-fader.js';
export { default as ProAudioEngine } from './components/pro-audio-engine.js';
export { default as ProEQ } from './components/pro-eq.js';
export { default as ProVisualizer } from './components/pro-visualizer.js';
export { default as ProPlaylist } from './components/pro-playlist.js';
export { default as ProFXRack } from './components/pro-fx-rack.js';
export { default as ProVinyl } from './components/pro-vinyl.js';
export { default as ProWindowManager } from './components/window-manager.js';

// Register all custom elements
import './components/pro-knob.js';
import './components/pro-fader.js';
import './components/pro-audio-engine.js';
import './components/pro-eq.js';
import './components/pro-visualizer.js';
import './components/pro-playlist.js';
import './components/pro-fx-rack.js';
import './components/pro-vinyl.js';
import './components/window-manager.js';

console.log('%c✦ Pro Audio Player Suite loaded', 'color: #00D4FF; font-size: 12px; font-weight: bold;');