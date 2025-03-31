import * as TONE from "tone";

// Define the background music interface
export interface BackgroundMusic {
  start: () => void;
  stop: () => void;
}

/**
 * Sets up a two-layer background music system that plays gentle chord pads and arpeggios in C Lydian.
 * @param globalLimiter A global limiter to connect the music output to.
 * @returns A BackgroundMusic object with start and stop methods.
 */
export function setupBackgroundMusic(_globalLimiter: TONE.Limiter): BackgroundMusic {
  console.log("Setting up two-layer background music...");

  // Create a master volume node for background music.
  // Set this node very low so that its overall level is quiet relative to game sounds.
  const musicMasterVolume = new TONE.Volume(-80);
  musicMasterVolume.connect(_globalLimiter);

  // Helper function to convert chord symbols to note arrays.
  function getChordNotes(chord: string): string[] {
    switch (chord) {
      case "CM7":
        return ["C4", "E4", "G4", "B4"];
      case "D7":
        return ["D4", "F#4", "A4", "C5"];
      case "EM7":
        return ["E4", "G#4", "B4", "D#5"];
      case "F#m7":
        return ["F#3", "A3", "C#4", "E4"];
      default:
        return [chord]; // fallback
    }
  }

  // --- PAD LAYER ---
  // A gentle chord pad with a slow envelope.
  const padSynth = new TONE.PolySynth(TONE.Synth, {
    oscillator: { type: "sine" },
    envelope: {
      attack: 4,
      decay: 2,
      sustain: 0.6,
      release: 4,
    },
  }).toDestination(); // We'll re-route manually in the next line.
  padSynth.volume.value = -40; // lowered level for quiet background
  padSynth.disconnect(); // remove default connection
  padSynth.connect(musicMasterVolume);

  // Define a pad chord progression (e.g. C Lydian chords).
  const padProgression = [
    { chord: ["C4", "E4", "G4", "B4"], duration: "2m" },
    { chord: ["D4", "F#4", "A4", "C5"], duration: "2m" },
    { chord: ["E4", "G#4", "B4", "D#5"], duration: "2m" },
    { chord: ["F#3", "A3", "C#4", "E4"], duration: "2m" },
  ];

  // Create a Tone.Sequence that plays these chords in loop.
  const padSequence = new TONE.Sequence(
    (time, noteData) => {
      padSynth.triggerAttackRelease(noteData.chord, noteData.duration, time);
    },
    padProgression,
    "2m" // one chord per 2 measures
  );
  padSequence.loop = true;

  // --- ARPEGGIO LAYER ---
  // A melodic arpeggiator using a single-voice synth.
  const arpSynth = new TONE.Synth({
    oscillator: { type: "triangle" },
    envelope: {
      attack: 0.05,
      decay: 0.2,
      sustain: 0.3,
      release: 0.4,
    },
  });
  arpSynth.volume.value = -38; // lowered level for quiet background
  arpSynth.connect(musicMasterVolume);

  // Define a C Lydian scale for the arpeggio.
  const lydianScale = ["C4", "D4", "E4", "F#4", "G4", "A4", "B4"];
  // Create a simple arpeggio pattern that slowly cycles through the scale.
  const arpPattern = new TONE.Sequence(
    (time, note) => {
      arpSynth.triggerAttackRelease(note, "8n", time);
    },
    // Use a slowly shifting sequence. (For instance, each measure select the next note.)
    lydianScale,
    "1m"
  );
  arpPattern.loop = true;

  // --- Start/Stop API for background music ---
  function start() {
    padSequence.start(0);
    arpPattern.start(0);
    if (TONE.Transport.state !== "started") {
      TONE.Transport.start();
    }
    console.log("Background music (new layers) started");
  }
  
  function stop() {
    padSequence.stop();
    arpPattern.stop();
    padSequence.dispose();
    arpPattern.dispose();
    console.log("Background music stopped");
  }

  return { start, stop };
}
