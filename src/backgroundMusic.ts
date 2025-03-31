import * as TONE from "tone";

// Define the background music interface
export interface BackgroundMusic {
  start: () => void;
  stop: () => void;
}

/**
 * Sets up a simple background music system that plays gentle chord pads in C Lydian.
 * @param globalLimiter (Optional) A global limiter; not used in this simplified version.
 * @returns A BackgroundMusic object with start and stop methods.
 */
export function setupBackgroundMusic(_globalLimiter: TONE.Limiter): BackgroundMusic {
  console.log("Setting up simple background music...");

  // Create a gentle pad using a polyphonic synth with a slow envelope.
  const padSynth = new TONE.PolySynth(TONE.Synth, {
    oscillator: { type: "sine" },
    envelope: {
      attack: 2,
      decay: 1,
      sustain: 0.7,
      release: 3,
    },
  }).toDestination();
  padSynth.volume.value = -30;

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

  // Define a static chord progression in C Lydian.
  const chordProgression = [
    { chord: "CM7", duration: "1m" },
    { chord: "D7", duration: "1m" },
    { chord: "EM7", duration: "1m" },
    { chord: "F#m7", duration: "1m" },
  ];

  // Use a Tone.Sequence to loop through the progression.
  const sequence = new TONE.Sequence(
    (time, noteData) => {
      const notes = getChordNotes(noteData.chord);
      padSynth.triggerAttackRelease(notes, noteData.duration, time);
    },
    chordProgression,
    "1m" // step interval: one measure per chord
  );
  sequence.loop = true;

  // Simple start/stop functions.
  function start() {
    sequence.start(0);
    if (TONE.Transport.state !== "started") {
      TONE.Transport.start();
    }
    console.log("Background music started");
  }

  function stop() {
    sequence.stop();
    sequence.dispose();
    console.log("Background music stopped");
  }

  return { start, stop };
}
