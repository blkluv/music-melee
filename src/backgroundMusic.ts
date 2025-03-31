import * as TONE from "tone";

// Define the background music interface
interface BackgroundMusic {
  start: () => void;
  stop: () => void;
  updateIntensity: (progress: number) => void;
  mute: () => void;
  unmute: () => void;
}

/**
 * Sets up the background music system for the game
 * @param globalLimiter The global limiter to connect the music to
 * @returns A BackgroundMusic object with methods to control the music
 */
export function setupBackgroundMusic(globalLimiter: TONE.Limiter): BackgroundMusic {
  console.log("Setting up background music...");
  
  // Create a volume node for overall music control
  const musicVolume = new TONE.Volume(-15).connect(globalLimiter);
  
  // Store the original volume level for mute/unmute
  let originalVolume = -15;
  let isMuted = false;
  
  // Create a low-pass filter that will open up as intensity increases
  const musicFilter = new TONE.Filter({
    type: "lowpass",
    frequency: 800,
    Q: 1
  }).connect(musicVolume);
  
  // Create a reverb for ambience
  const musicReverb = new TONE.Reverb({
    decay: 2.5,
    wet: 0.2
  }).connect(musicFilter);
  
  // Create a polyphonic synth for ambient pads
  const padSynth = new TONE.PolySynth(TONE.Synth, {
    oscillator: {
      type: "sine"
    },
    envelope: {
      attack: 0.5,
      decay: 0.5,
      sustain: 0.8,
      release: 2
    }
  }).connect(musicReverb);
  padSynth.volume.value = -20;
  
  // Helper function to convert chord symbols to arrays of note names
  function getChordNotes(chord: string): string[] {
    switch (chord) {
      case "CM7":
        return ["C4", "E4", "G4", "B4"];
      case "D7":
        return ["D4", "F#4", "A4", "C5"];
      case "EM7":
        return ["E4", "G#4", "B4", "D#5"];
      case "F#m7":
        return ["F#4", "A4", "C#5", "E5"];
      case "AM7":
        return ["A4", "C#5", "E5", "G#5"];
      case "GM7":
        return ["G4", "B4", "D5", "F#5"];
      default:
        return [chord]; // fallback: return chord as a single note
    }
  }
  
  // Create a bass synth
  const bassSynth = new TONE.MonoSynth({
    oscillator: {
      type: "triangle"
    },
    envelope: {
      attack: 0.05,
      decay: 0.2,
      sustain: 0.8,
      release: 0.5
    },
    filterEnvelope: {
      attack: 0.05,
      decay: 0.2,
      sustain: 0.5,
      release: 0.5,
      baseFrequency: 200,
      octaves: 2
    }
  }).connect(musicFilter);
  bassSynth.volume.value = -25;
  
  // Create a melody synth
  const melodySynth = new TONE.Synth({
    oscillator: {
      type: "sine"
    },
    envelope: {
      attack: 0.02,
      decay: 0.2,
      sustain: 0.5,
      release: 0.5
    }
  }).connect(musicReverb);
  melodySynth.volume.value = -30; // Start very quiet
  
  // Define chord progressions in C Lydian (C, D, E, F#, G, A, B)
  const chordProgressions = [
    ["CM7", "D7", "EM7", "F#m7"],  // Progression 1
    ["CM7", "AM7", "GM7", "F#m7"], // Progression 2
    ["EM7", "F#m7", "GM7", "AM7"]  // Progression 3
  ];
  
  // Define bass patterns
  const bassPatterns = [
    ["C2", "G2", "A2", "E2"],      // Pattern 1
    ["C2", "C2", "G2", "G2"],      // Pattern 2
    ["C2", "D2", "E2", "F#2"]      // Pattern 3
  ];
  
  // Define melody notes (all in C Lydian scale)
  const melodyNotes = ["C4", "D4", "E4", "F#4", "G4", "A4", "B4", "C5"];
  
  // Current progression index
  let currentProgression = 0;
  
  // Schedule the chord progression
  function scheduleChords() {
    const progression = chordProgressions[currentProgression];
    const pattern = new TONE.Pattern(
      (time, chord) => {
        // Convert chord symbol into an array of note names
        const notes = getChordNotes(chord);
        notes.forEach(note => {
          padSynth.triggerAttackRelease(note, "2n", time);
        });
      },
      progression,
      "up"
    );
    pattern.interval = "1m";
    pattern.start(0);
    
    return pattern;
  }
  
  // Schedule the bass line
  function scheduleBass() {
    const bassLine = bassPatterns[currentProgression];
    const pattern = new TONE.Pattern(
      (time, note) => {
        bassSynth.triggerAttackRelease(note, "4n", time);
      },
      bassLine,
      "up"
    );
    pattern.interval = "4n";
    pattern.start(0);
    
    return pattern;
  }
  
  // Schedule random melody notes that become more frequent with intensity
  function scheduleMelody() {
    // This will be controlled by the updateIntensity function
    return TONE.Transport.scheduleRepeat((time) => {
      // Only play melody notes occasionally at first
      if (Math.random() > 0.7) {
        const note = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        melodySynth.triggerAttackRelease(note, "8n", time);
      }
    }, "2n");
  }
  
  // Store pattern IDs for later disposal
  let chordPatternId: TONE.Pattern<any>;
  let bassPatternId: TONE.Pattern<any>;
  let melodyPatternId: number;
  
  // Start the background music
  function start() {
    if (TONE.Transport.state === "started") {
      console.log("Transport already started, just starting music patterns");
    }
    
    // Schedule all patterns
    chordPatternId = scheduleChords();
    bassPatternId = scheduleBass();
    melodyPatternId = scheduleMelody();
    
    console.log("Background music started");
  }
  
  // Stop the background music
  function stop() {
    // Dispose of patterns
    if (chordPatternId) chordPatternId.dispose();
    if (bassPatternId) bassPatternId.dispose();
    if (melodyPatternId) TONE.Transport.clear(melodyPatternId);
    
    console.log("Background music stopped");
  }
  
  // Update music intensity based on game progress (0-1)
  function updateIntensity(progress: number) {
    // Increase filter frequency as game progresses
    const maxFreq = 10000;
    const minFreq = 800;
    musicFilter.frequency.value = minFreq + (maxFreq - minFreq) * progress;
    
    // Increase melody volume as game progresses
    melodySynth.volume.value = -30 + progress * 15;
    
    // Change chord progression at certain thresholds
    if (progress > 0.7 && currentProgression !== 2) {
      currentProgression = 2;
      stop();
      start();
    } else if (progress > 0.3 && progress <= 0.7 && currentProgression !== 1) {
      currentProgression = 1;
      stop();
      start();
    }
    
    // Increase reverb wetness for more tension
    musicReverb.wet.value = 0.2 + progress * 0.3;
  }
  
  // Set the overall music volume
  function setVolume(volume: number) {
    if (!isMuted) {
      originalVolume = volume;
      musicVolume.volume.value = volume;
    }
  }
  
  // Mute the music
  function mute() {
    if (!isMuted) {
      originalVolume = musicVolume.volume.value;
      musicVolume.volume.value = -Infinity;
      isMuted = true;
    }
  }
  
  // Unmute the music
  function unmute() {
    if (isMuted) {
      musicVolume.volume.value = originalVolume;
      isMuted = false;
    }
  }
  
  return {
    start,
    stop,
    updateIntensity,
    mute,
    unmute
  };
}
