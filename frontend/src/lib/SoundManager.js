// @/lib/SoundManager.js
import { Howl, Howler } from 'howler';

/**
 * SoundManager - Professional audio manager using Howler.js
 * Features:
 * - Preload and cache sound effects
 * - Volume control and muting
 * - Sound sprite support
 * - Multiple simultaneous sounds
 */

class SoundManagerSingleton {
  constructor() {
    this.sounds = {};
    this.isMuted = false;
    this.globalVolume = 1.0;
    console.log("SoundManager: Initialized with Howler.js");
  }

  /**
   * Load a sound into the manager
   * @param {string} key - Unique identifier for the sound
   * @param {string|string[]} src - Path(s) to audio file(s)
   * @param {object} options - Howler options (loop, volume, sprite, etc.)
   */
  load(key, src, options = {}) {
    if (this.sounds[key]) {
      console.warn(`SoundManager: Sound '${key}' already loaded.`);
      return;
    }

    this.sounds[key] = new Howl({
      src: Array.isArray(src) ? src : [src],
      volume: options.volume !== undefined ? options.volume : 1.0,
      loop: options.loop || false,
      sprite: options.sprite || undefined,
      preload: options.preload !== undefined ? options.preload : true,
      onload: () => console.log(`SoundManager: '${key}' loaded successfully.`),
      onloaderror: (id, error) => console.error(`SoundManager: Error loading '${key}':`, error),
      ...options
    });
  }

  /**
   * Play a loaded sound
   * @param {string} key - Sound identifier
   * @param {string} sprite - Optional sprite name for sprite sheets
   * @returns {number|null} - Sound ID or null if failed
   */
  play(key, sprite = null) {
    if (this.isMuted) return null;

    if (!this.sounds[key]) {
      console.warn(`SoundManager: Sound '${key}' not found. Did you forget to load it?`);
      return null;
    }

    try {
      return sprite ? this.sounds[key].play(sprite) : this.sounds[key].play();
    } catch (error) {
      console.error(`SoundManager: Error playing '${key}':`, error);
      return null;
    }
  }

  /**
   * Stop a playing sound
   * @param {string} key - Sound identifier
   * @param {number} id - Optional specific sound instance ID
   */
  stop(key, id = null) {
    if (this.sounds[key]) {
      id !== null ? this.sounds[key].stop(id) : this.sounds[key].stop();
    }
  }

  /**
   * Pause a playing sound
   * @param {string} key - Sound identifier
   * @param {number} id - Optional specific sound instance ID
   */
  pause(key, id = null) {
    if (this.sounds[key]) {
      id !== null ? this.sounds[key].pause(id) : this.sounds[key].pause();
    }
  }

  /**
   * Set volume for a specific sound
   * @param {string} key - Sound identifier
   * @param {number} volume - Volume level (0.0 to 1.0)
   * @param {number} id - Optional specific sound instance ID
   */
  setVolume(key, volume, id = null) {
    if (this.sounds[key]) {
      this.sounds[key].volume(volume, id);
    }
  }

  /**
   * Set global volume for all sounds
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setGlobalVolume(volume) {
    this.globalVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.globalVolume);
  }

  /**
   * Toggle mute on/off for all sounds
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    console.log(`SoundManager: ${this.isMuted ? 'Muted' : 'Unmuted'}`);
  }

  /**
   * Set mute state
   * @param {boolean} muted - Mute state
   */
  setMute(muted) {
    this.isMuted = muted;
    Howler.mute(this.isMuted);
  }

  /**
   * Unload a sound to free memory
   * @param {string} key - Sound identifier
   */
  unload(key) {
    if (this.sounds[key]) {
      this.sounds[key].unload();
      delete this.sounds[key];
      console.log(`SoundManager: '${key}' unloaded.`);
    }
  }

  /**
   * Unload all sounds
   */
  unloadAll() {
    Object.keys(this.sounds).forEach(key => this.unload(key));
  }

  /**
   * Check if a sound is currently playing
   * @param {string} key - Sound identifier
   * @returns {boolean}
   */
  isPlaying(key) {
    return this.sounds[key] ? this.sounds[key].playing() : false;
  }
}

export const SoundManager = new SoundManagerSingleton();
