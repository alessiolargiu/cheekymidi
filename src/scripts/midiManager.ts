const ENVELOPE = {
  volume: 0.3,
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.4,
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export async function loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuffer);
}


export function playSample(
  ctx: AudioContext,
  buffer: AudioBuffer,
  note: number,
  rootNote: number,
  activeNotes: Map<number, { gain: GainNode; source: AudioBufferSourceNode }>
) {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.playbackRate.value = Math.pow(2, (note - rootNote) / 12);

  source.connect(gain);
  gain.connect(ctx.destination);

  // --- ADSR: Attack → Decay → Sustain ---
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(ENVELOPE.volume, now + ENVELOPE.attack);
  gain.gain.linearRampToValueAtTime(
    ENVELOPE.volume * ENVELOPE.sustain,
    now + ENVELOPE.attack + ENVELOPE.decay
  );

  source.start(now);
  activeNotes.set(note, { gain, source });
}

export function releaseSample(
  ctx: AudioContext,
  note: number,
  activeNotes: Map<number, { gain: GainNode; source: AudioBufferSourceNode }>
) {
  const active = activeNotes.get(note);
  if (!active) return;

  const { gain, source } = active;
  const now = ctx.currentTime;

  // --- ADSR: Release ---
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + ENVELOPE.release);

  source.stop(now + ENVELOPE.release);
  activeNotes.delete(note);
}



/** Convert a MIDI note number to a human-readable name, e.g. 60 → "C4" */
export function midiNoteName(note: number): string {
  return NOTE_NAMES[note % 12] + Math.floor(note / 12 - 1);
}