/**
 * useSoundEffects.js - Casino Sound Effects Hook
 * 
 * Provides immersive audio feedback for game events
 * Uses Web Audio API for low-latency playback
 */

import { useCallback, useRef, useEffect } from 'react';

// Sound effect URLs - using free casino sound effects
const SOUND_URLS = {
  // Player events
  playerJoin: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleicAeli33teleWACEXW953teleGACBj+a2teleicAeli33teleWACEXW953teleGACBj+a2teleicAeli33teleWACEXW953teleGAC', // Door open/chime
  playerLeave: 'data:audio/wav;base64,UklGRl4EAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToEAACAgICAgICAgICAgICAgICAgICAf3x5d3Z1dXV2d3l8f4KFiIqMjY2NjIqIhYJ/fHl3dnV1dXZ3eXyAgoWIioyNjY2MioiFgn98eXd2dXV1dnd5fH+ChYiKjI2NjYyKiIWCf3x5d3Z1dXV2d3l8f4KFiIqMjY2NjIqIhYJ/', // Soft close
  
  // Card events
  cardDeal: 'data:audio/wav;base64,UklGRl4CAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToCAACAgICAgICAgI2VmZKGe3d6hZSlraaamY2Hh4uVpK+0sKOTiIWJl6e1u7eomYuHi5qqu7+6qpiKh42drrzAvauZi4iPn666vbuqmYuIkKC5',
  cardFlip: 'data:audio/wav;base64,UklGRl4BAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToBAACAf359fHt7fH1+f4CBgoOEhYWFhYSDgoGAf359fHt7fH1+f4CBgoOEhYWFhYSDgoGAf359fHt7fH1+f4CBgoOEhYWFhYSDgoGAf35',
  
  // Chip events
  chipPlace: 'data:audio/wav;base64,UklGRl4BAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToBAACAjpSRiYJ+foOLk5iWj4eBfn6Dj5edn5iPhoF/gYqVnaCdlIqDgICIk5ycm5SKhIGAiJOcnZyUioSBgIiT',
  chipStack: 'data:audio/wav;base64,UklGRl4BAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToBAACAkJaVjod/fYKMlpybk4mDfn+GkZqenZSLhYCBiJObnp2Ui4aDgoiSnZ+dk4uGg4KIkp2fn',
  
  // Win/Lose
  win: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleicAeli33teleWACEXW953teleGACBj+a2teleicAeli33teleWACEXW953teleGACBj+a2teleicAeli33teleWACEXW953teleGACBj+a2teleicAeli33tele',
  lose: 'data:audio/wav;base64,UklGRl4CAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToCAACAgH98eXZ0cnJzdXh7f4KGiYuMjIuJhoJ/fHl2dHJycnN1eHt/goaJi4yMi4mGgn98eXZ0cnJyc3V4e3+ChoqLjIyLiYaCf3x5dnRycnJzdXh7f4KGiYuMjIuJhoJ/',
  
  // UI
  buttonClick: 'data:audio/wav;base64,UklGRl4AAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToAAACAgICAf35+foCAgICAgH9+fn+AgICAgIB/fn5/gICA',
  notification: 'data:audio/wav;base64,UklGRl4BAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YToBAACAhIiLjY6PkJCQj42LiISAgHx4dXNycnN1eHyAgISIi42Oj5CQkI+NiIiEgIB8eHVzcnJzdXh8gICEiIuNjo+QkJCPjYuI'
};

/**
 * Generate a more realistic door chime sound using Web Audio API
 */
const createDoorChimeBuffer = (audioContext) => {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.8; // 800ms
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  // Create a pleasant door chime (two-tone)
  const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 - major chord
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Layer multiple frequencies with decay
    frequencies.forEach((freq, idx) => {
      const delay = idx * 0.05; // Stagger each note
      if (t >= delay) {
        const localT = t - delay;
        const envelope = Math.exp(-localT * 4); // Exponential decay
        sample += Math.sin(2 * Math.PI * freq * localT) * envelope * 0.3;
      }
    });
    
    data[i] = sample;
  }
  
  return buffer;
};

/**
 * Generate a subtle whoosh sound for player entrance
 */
const createWhooshBuffer = (audioContext) => {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.3;
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    // Filtered noise with pitch sweep
    const noise = (Math.random() * 2 - 1);
    const envelope = Math.sin(Math.PI * t / duration); // Fade in/out
    const pitchMod = 1 + (1 - t / duration) * 2; // Pitch sweep down
    data[i] = noise * envelope * 0.15 * Math.sin(t * 1000 * pitchMod);
  }
  
  return buffer;
};

/**
 * Generate a satisfying card deal/snap sound
 */
const createCardDealBuffer = (audioContext) => {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.15; // Short, snappy
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    // Initial click/snap
    const click = t < 0.01 ? (Math.random() * 2 - 1) * Math.exp(-t * 500) : 0;
    // Soft thud as card lands
    const thud = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t * 30);
    // High frequency flutter (card through air)
    const flutter = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.3;
    
    data[i] = (click * 0.6 + thud * 0.3 + flutter * 0.1) * Math.exp(-t * 20);
  }
  
  return buffer;
};

/**
 * Generate a chip/coin sound
 */
const createChipBuffer = (audioContext) => {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.2;
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    // High metallic ping
    const ping = Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t * 25);
    // Lower body
    const body = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 15);
    
    data[i] = (ping * 0.4 + body * 0.6) * 0.5;
  }
  
  return buffer;
};

/**
 * Generate a bingo ball rolling sound - tumbling, bouncing ball in cage
 */
const createBallRollBuffer = (audioContext) => {
  const sampleRate = audioContext.sampleRate;
  const duration = 1.2; // 1.2 seconds for full roll effect
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Rolling rumble - low frequency with slight variation
    const rollFreq = 80 + Math.sin(t * 15) * 30; // Wobbling frequency
    const rumble = Math.sin(2 * Math.PI * rollFreq * t) * 0.3;
    
    // Multiple bounce impacts - decreasing frequency and amplitude
    const bounces = 8;
    for (let b = 0; b < bounces; b++) {
      const bounceTime = (b * 0.12) + (b * b * 0.01); // Accelerating bounce timing
      const bounceDuration = 0.05;
      if (t >= bounceTime && t < bounceTime + bounceDuration) {
        const localT = t - bounceTime;
        const bounceAmp = Math.exp(-b * 0.4); // Decreasing amplitude
        // High-pitched ping for ball hitting cage
        const ping = Math.sin(2 * Math.PI * (2000 + b * 100) * localT) * Math.exp(-localT * 80);
        // Thud component
        const thud = Math.sin(2 * Math.PI * (300 - b * 20) * localT) * Math.exp(-localT * 40);
        sample += (ping * 0.5 + thud * 0.5) * bounceAmp;
      }
    }
    
    // Rattling sound - random high freq bursts
    const rattle = (Math.random() * 2 - 1) * Math.sin(t * 50) * 0.15;
    
    // Envelope - builds up then fades
    const envelope = Math.sin(Math.PI * t / duration) * (1 - t / duration * 0.5);
    
    data[i] = (rumble + sample + rattle) * envelope * 0.6;
  }
  
  return buffer;
};

/**
 * Generate a ball pop/emerge sound when ball is selected
 */
const createBallPopBuffer = (audioContext) => {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.4;
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    
    // Pneumatic pop sound
    const pop = t < 0.02 ? (Math.random() * 2 - 1) * (1 - t / 0.02) : 0;
    
    // Rising tone (ball shooting up)
    const rise = Math.sin(2 * Math.PI * (400 + t * 800) * t) * Math.exp(-t * 8);
    
    // Settling wobble
    const wobble = Math.sin(2 * Math.PI * 600 * t) * Math.exp(-t * 10) * Math.sin(t * 40);
    
    data[i] = (pop * 0.6 + rise * 0.3 + wobble * 0.1) * 0.7;
  }
  
  return buffer;
};

export const useSoundEffects = (enabled = true) => {
  const audioContextRef = useRef(null);
  const soundBuffers = useRef({});
  const gainNodeRef = useRef(null);

  // Initialize audio context on first user interaction
  const initAudio = useCallback(() => {
    if (audioContextRef.current) return;
    
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = 0.5; // 50% volume
      
      // Pre-generate synthesized sounds
      soundBuffers.current.doorChime = createDoorChimeBuffer(audioContextRef.current);
      soundBuffers.current.whoosh = createWhooshBuffer(audioContextRef.current);
      soundBuffers.current.cardDeal = createCardDealBuffer(audioContextRef.current);
      soundBuffers.current.chip = createChipBuffer(audioContextRef.current);
      soundBuffers.current.ballRoll = createBallRollBuffer(audioContextRef.current);
      soundBuffers.current.ballPop = createBallPopBuffer(audioContextRef.current);
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }, []);

  // Play a sound effect
  const playSound = useCallback((soundName, volume = 1.0) => {
    if (!enabled) return;
    
    // Lazy init on first play
    if (!audioContextRef.current) {
      initAudio();
    }
    
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    try {
      const buffer = soundBuffers.current[soundName];
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = ctx.createGain();
        gainNode.gain.value = volume * 0.5;
        
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
      }
    } catch (e) {
      console.warn('Error playing sound:', e);
    }
  }, [enabled, initAudio]);

  // Specific sound effect methods
  const playPlayerJoin = useCallback(() => playSound('doorChime', 0.6), [playSound]);
  const playPlayerLeave = useCallback(() => playSound('whoosh', 0.4), [playSound]);
  const playCardDeal = useCallback(() => playSound('cardDeal', 0.7), [playSound]);
  const playChipPlace = useCallback(() => playSound('chip', 0.5), [playSound]);
  const playWin = useCallback(() => playSound('doorChime', 0.8), [playSound]); // Reuse chime for wins
  const playLose = useCallback(() => playSound('whoosh', 0.3), [playSound]);
  const playClick = useCallback(() => playSound('chip', 0.2), [playSound]);
  const playBallRoll = useCallback(() => playSound('ballRoll', 0.8), [playSound]);
  const playBallPop = useCallback(() => playSound('ballPop', 0.7), [playSound]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    initAudio,
    playSound,
    playPlayerJoin,
    playPlayerLeave,
    playCardDeal,
    playChipPlace,
    playWin,
    playLose,
    playClick,
    playBallRoll,
    playBallPop
  };
};

export default useSoundEffects;