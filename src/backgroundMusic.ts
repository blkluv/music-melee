import * as TONE from "tone";

// Define the background music interface
interface BackgroundMusic {
  start: () => void;
  stop: () => void;
  updateIntensity: (progress: number) => void;
  setVolume: (volume: number) => void;
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
        padSynth.triggerAttackRelease(TONE.Chord.get(chord), "2n", time);
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
  let chordPatternId: TONE.Pattern;
  let bassPatternId: TONE.Pattern;
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
    setVolume,
    mute,
    unmute
  };
}
import * as TONE from "tone";

/**
 * Sets up the background music system with ambient chord progressions,
 * bass lines, and melody patterns that evolve over time.
 * 
 * @param globalLimiter - The global limiter to connect the music output to
 * @returns An object with methods to control the background music
 */
export function setupBackgroundMusic(globalLimiter: TONE.Limiter) {
  // Create synths for different musical elements
  const chordSynth = new TONE.PolySynth(TONE.Synth, {
    envelope: {
      attack: 0.1,
      decay: 0.3,
      sustain: 0.4,
      release: 1.5
    }
  });
  
  const bassSynth = new TONE.MonoSynth({
    oscillator: {
      type: "sine"
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
  });
  
  const melodySynth = new TONE.FMSynth({
    harmonicity: 2,
    modulationIndex: 3,
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.2,
      release: 0.5
    },
    modulation: {
      type: "sine"
    },
    modulationEnvelope: {
      attack: 0.5,
      decay: 0.1,
      sustain: 0.2,
      release: 0.5
    }
  });
  
  // Effects chain
  const reverb = new TONE.Reverb(3);
  const delay = new TONE.FeedbackDelay("8n", 0.3);
  const filter = new TONE.Filter(2000, "lowpass");
  
  // Volume control for the entire music system
  const musicVolume = new TONE.Volume(0).connect(globalLimiter);
  
  // Connect synths to effects chain
  chordSynth.chain(filter, reverb, musicVolume);
  bassSynth.chain(filter, musicVolume);
  melodySynth.chain(delay, reverb, musicVolume);
  
  // Music patterns
  let chordPatternId: number;
  let bassPatternId: number;
  let melodyPatternId: number;
  
  // Define chord progressions in C Lydian (C, D, E, F#, G, A, B)
  const chordProgressions = [
    // Progression 1: I - V - vi - IV (C - G - Am - F)
    [["C4", "E4", "G4", "B4"], ["G3", "B3", "D4", "F#4"], ["A3", "C4", "E4"], ["F#3", "A3", "C4", "E4"]],
    // Progression 2: vi - IV - I - V (Am - F - C - G)
    [["A3", "C4", "E4"], ["F#3", "A3", "C4", "E4"], ["C4", "E4", "G4", "B4"], ["G3", "B3", "D4", "F#4"]],
    // Progression 3: I - vi - IV - V (C - Am - F - G)
    [["C4", "E4", "G4", "B4"], ["A3", "C4", "E4"], ["F#3", "A3", "C4", "E4"], ["G3", "B3", "D4", "F#4"]]
  ];
  
  // Define bass patterns in C Lydian
  const bassPatterns = [
    ["C2", "G2", "A2", "F#2"],
    ["C2", "E2", "G2", "B2"],
    ["C2", "D2", "E2", "F#2"]
  ];
  
  // Define melody patterns in C Lydian
  const melodyPatterns = [
    ["C5", "D5", "E5", "F#5", "G5", "A5", "B5", "C6"],
    ["E5", "G5", "B5", "C6", "B5", "G5", "E5", "D5"],
    ["G5", "F#5", "E5", "D5", "C5", "D5", "E5", "G5"]
  ];
  
  // Current pattern indices
  let currentChordProgression = 0;
  let currentBassPattern = 0;
  let currentMelodyPattern = 0;
  
  // Current intensity level (0-1)
  let intensity = 0;
  
  // Schedule chord patterns
  function scheduleChords() {
    return TONE.Transport.scheduleRepeat((time) => {
      const chords = chordProgressions[currentChordProgression];
      
      // Play each chord for one measure
      chords.forEach((chord, index) => {
        chordSynth.triggerAttackRelease(chord, "2n", time + index * TONE.Time("1m").toSeconds());
      });
      
      // Randomly change progression occasionally based on intensity
      if (Math.random() < 0.3 * intensity) {
        currentChordProgression = Math.floor(Math.random() * chordProgressions.length);
      }
    }, "4m");
  }
  
  // Schedule bass patterns
  function scheduleBass() {
    return TONE.Transport.scheduleRepeat((time) => {
      const bassLine = bassPatterns[currentBassPattern];
      
      // Play each bass note for one measure
      bassLine.forEach((note, index) => {
        bassSynth.triggerAttackRelease(note, "2n", time + index * TONE.Time("1m").toSeconds());
      });
      
      // Randomly change bass pattern based on intensity
      if (Math.random() < 0.4 * intensity) {
        currentBassPattern = Math.floor(Math.random() * bassPatterns.length);
      }
    }, "4m");
  }
  
  // Schedule melody patterns
  function scheduleMelody() {
    return TONE.Transport.scheduleRepeat((time) => {
      // Only play melody at higher intensity levels
      if (intensity > 0.3) {
        const melodyLine = melodyPatterns[currentMelodyPattern];
        
        // Play each melody note for an eighth note
        melodyLine.forEach((note, index) => {
          // Adjust velocity based on intensity
          const velocity = 0.5 + (intensity * 0.5);
          melodySynth.triggerAttackRelease(note, "8n", time + index * TONE.Time("8n").toSeconds(), velocity);
        });
        
        // Randomly change melody pattern based on intensity
        if (Math.random() < 0.5 * intensity) {
          currentMelodyPattern = Math.floor(Math.random() * melodyPatterns.length);
        }
      }
    }, "2m");
  }
  
  return {
    // Start the background music
    start: function() {
      // Always schedule music patterns when start() is called
      chordPatternId = scheduleChords();
      bassPatternId = scheduleBass();
      melodyPatternId = scheduleMelody();
      
      console.log("Background music started");
    },
    
    // Stop the background music
    stop: function() {
      // Clear all scheduled events
      TONE.Transport.clear(chordPatternId);
      TONE.Transport.clear(bassPatternId);
      TONE.Transport.clear(melodyPatternId);
      
      console.log("Background music stopped");
    },
    
    // Update the music intensity based on game progress (0-1)
    updateIntensity: function(value: number) {
      intensity = Math.max(0, Math.min(1, value));
      
      // Adjust filter cutoff based on intensity
      filter.frequency.value = 1000 + (intensity * 4000);
      
      // Adjust reverb wet/dry mix based on intensity
      reverb.wet.value = 0.3 + (intensity * 0.4);
      
      // Adjust delay feedback based on intensity
      delay.feedback.value = 0.2 + (intensity * 0.3);
    },
    
    // Mute the background music
    mute: function() {
      musicVolume.volume.value = -Infinity;
    },
    
    // Unmute the background music
    unmute: function() {
      musicVolume.volume.value = 0;
    }
  };
}
