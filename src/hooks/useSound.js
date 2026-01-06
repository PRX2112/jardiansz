import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for managing game audio using Web Audio API
 * Generates sound effects procedurally without external files
 */
export function useSound(enabled = true) {
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);

  // Initialize Audio Context on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      // Create AudioContext (singleton pattern)
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('Web Audio API not supported');
        return;
      }

      audioContextRef.current = new AudioContext();

      // Create master gain node for volume control
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.value = 0.3; // Default volume (30%)

    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [enabled]);

  // Helper function to create and play a tone
  const playTone = useCallback((frequency, duration, type = 'sine', volume = 1) => {
    if (!enabled || !audioContextRef.current || !masterGainRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      // Create oscillator
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);

      // Create gain node for this sound
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(volume * 0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current);

      // Play and stop
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      console.error('Error playing tone:', error);
    }
  }, [enabled]);

  // Helper function to play a frequency sweep
  const playSweep = useCallback((startFreq, endFreq, duration, type = 'sine', volume = 1) => {
    if (!enabled || !audioContextRef.current || !masterGainRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(startFreq, now);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(volume * 0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      console.error('Error playing sweep:', error);
    }
  }, [enabled]);

  // Helper function to play a chord
  const playChord = useCallback((frequencies, duration, volume = 1) => {
    if (!enabled || !audioContextRef.current || !masterGainRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      frequencies.forEach(freq => {
        const oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(volume * 0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.connect(gainNode);
        gainNode.connect(masterGainRef.current);

        oscillator.start(now);
        oscillator.stop(now + duration);
      });
    } catch (error) {
      console.error('Error playing chord:', error);
    }
  }, [enabled]);

  // Sound effect functions
  const playWallBounce = useCallback(() => {
    playTone(800, 0.05, 'sine', 0.5);
  }, [playTone]);

  const playPaddleHit = useCallback(() => {
    playTone(200, 0.1, 'triangle', 0.7);
  }, [playTone]);

  const playBrickHit = useCallback(() => {
    playTone(400, 0.08, 'square', 0.6);
  }, [playTone]);

  const playBrickBreak = useCallback(() => {
    playSweep(800, 200, 0.2, 'sawtooth', 0.8);
  }, [playSweep]);

  const playPowerUp = useCallback(() => {
    // Ascending chime
    setTimeout(() => playTone(400, 0.05, 'sine', 0.6), 0);
    setTimeout(() => playTone(600, 0.05, 'sine', 0.6), 50);
    setTimeout(() => playTone(800, 0.1, 'sine', 0.6), 100);
  }, [playTone]);

  const playPowerUpSplit = useCallback(() => {
    // Rapid dispersion sound
    setTimeout(() => playTone(600, 0.05, 'triangle', 0.7), 0);
    setTimeout(() => playTone(500, 0.05, 'triangle', 0.7), 30);
    setTimeout(() => playTone(400, 0.05, 'triangle', 0.7), 60);
  }, [playTone]);

  const playPowerUpFire = useCallback(() => {
    // Low burning whoosh
    playSweep(150, 600, 0.3, 'sawtooth', 0.5);
  }, [playSweep]);

  const playExtraLife = useCallback(() => {
    // Classic 1-up sound
    setTimeout(() => playTone(660, 0.1, 'square', 0.6), 0);
    setTimeout(() => playTone(1320, 0.2, 'square', 0.6), 100);
  }, [playTone]);

  const playLevelComplete = useCallback(() => {
    // Victory fanfare - C major chord (C-E-G)
    playChord([261.63, 329.63, 392.00], 0.5, 1);
  }, [playChord]);

  const playGameOver = useCallback(() => {
    // Descending defeat sound
    playSweep(400, 100, 0.4, 'triangle', 0.9);
  }, [playSweep]);

  const playNewLife = useCallback(() => {
    // Positive chime
    setTimeout(() => playTone(523.25, 0.1, 'sine', 0.7), 0);
    setTimeout(() => playTone(659.25, 0.15, 'sine', 0.7), 100);
  }, [playTone]);

  // Volume control
  const setVolume = useCallback((volume) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = Math.max(0, Math.min(1, volume));
    }
  }, []);

  return {
    playWallBounce,
    playPaddleHit,
    playBrickHit,
    playBrickBreak,
    playPowerUp,
    playPowerUpSplit,
    playPowerUpFire,
    playExtraLife,
    playLevelComplete,
    playGameOver,
    playNewLife,
    setVolume,
  };
}
