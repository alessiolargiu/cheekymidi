import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css'
import { WebMidi } from 'webmidi';

// ADSR values (in seconds, sustain is a 0–1 level)
const ENVELOPE = {
  volume: 0.3,   // master peak gain (0–1)
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.4,
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Convert a MIDI note number to a human-readable name, e.g. 60 → "C4" */
function midiNoteName(note: number): string {
  return NOTE_NAMES[note % 12] + Math.floor(note / 12 - 1);
}

/**
 * Autocorrelation pitch detector.
 * Analyses the loudest 4096-sample window of the buffer and returns
 * the nearest MIDI note, or null if no clear pitch is found.
 */
function detectPitch(buffer: AudioBuffer): number | null {
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const windowSize = 4096;

  // Find the loudest window to avoid analysing silence
  let bestStart = 0;
  let bestRMS = 0;
  const step = windowSize;
  for (let i = 0; i + windowSize < data.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / windowSize);
    if (rms > bestRMS) { bestRMS = rms; bestStart = i; }
  }

  // Silence guard — nothing useful to detect
  if (bestRMS < 0.01) return null;

  const win = data.slice(bestStart, bestStart + windowSize);

  // Lag range covers 50 Hz – 2000 Hz
  const minLag = Math.floor(sampleRate / 2000);
  const maxLag = Math.ceil(sampleRate / 50);

  // Normalised autocorrelation (NSDF)
  let peakLag = -1;
  let peakVal = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0, denom = 0;
    for (let i = 0; i < windowSize - lag; i++) {
      num += win[i] * win[i + lag];
      denom += win[i] * win[i] + win[i + lag] * win[i + lag];
    }
    const nsdf = denom === 0 ? 0 : 2 * num / denom;
    if (nsdf > peakVal) { peakVal = nsdf; peakLag = lag; }
  }

  // Confidence threshold — reject weak or noisy signals
  if (peakVal < 0.6 || peakLag < 1) return null;

  const freq = sampleRate / peakLag;
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

/**
 * Trims leading and trailing silence from an AudioBuffer.
 * Scans sample-by-sample from each end until the absolute amplitude
 * exceeds `threshold`, then copies the active region into a new buffer.
 */
function trimSilence(ctx: AudioContext, buffer: AudioBuffer, threshold = 0.01): AudioBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // Gather all channels so we trim based on the loudest channel at each point
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  const isSilent = (i: number) => channels.every(ch => Math.abs(ch[i]) <= threshold);

  // Walk in from the start
  let start = 0;
  while (start < length && isSilent(start)) start++;

  // Walk in from the end
  let end = length - 1;
  while (end > start && isSilent(end)) end--;

  const trimmedLength = end - start + 1;
  if (trimmedLength <= 0) return buffer; // all silence — return original

  const trimmed = ctx.createBuffer(numChannels, trimmedLength, sampleRate);
  for (let c = 0; c < numChannels; c++) {
    trimmed.copyToChannel(new Float32Array(channels[c].subarray(start, end + 1)), c);
  }

  console.log(
    `Trimmed silence: ${(start / sampleRate).toFixed(3)}s removed from start, ` +
    `${((length - end - 1) / sampleRate).toFixed(3)}s from end. ` +
    `New duration: ${(trimmedLength / sampleRate).toFixed(3)}s`
  );

  return trimmed;
}


const DEFAULT_SAMPLE_URL = "sounds/c.mp3";

function App() {

  const audioCtx = useRef<AudioContext | null>(null);
  const ctx = new AudioContext();

  // The currently active sample buffer (default piano or mic recording)
  const currentSample = useRef<AudioBuffer | null>(null);

  // Map of MIDI note number → { gainNode, sourceNode } so noteoff can find them
  const activeNotes = useRef<Map<number, { gain: GainNode; source: AudioBufferSourceNode }>>(new Map());

  // Mic recording state
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleSource, setSampleSource] = useState<'default' | 'mic'>('default');

  // Root note of the current sample (MIDI number). Default piano sample is C3 = 48.
  const rootNote = useRef<number>(48);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(0.01);

  async function loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  const startAudio = async () => {
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();
    }
    if (audioCtx.current.state === "suspended") {
      await audioCtx.current.resume();
    }

    // Pre-load the default sample on first enable
    if (!currentSample.current) {
      currentSample.current = await loadSample(ctx, DEFAULT_SAMPLE_URL);
      console.log("Default sample loaded");
    }

    console.log("Audio ready");
  };

  function playSample(
    ctx: AudioContext,
    buffer: AudioBuffer,
    note: number,
  ) {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, (note - rootNote.current) / 12);

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

    // Store so noteoff can trigger release
    activeNotes.current.set(note, { gain, source });
  }

  function releaseSample(note: number) {
    const active = activeNotes.current.get(note);
    if (!active) return;

    const { gain, source } = active;
    const now = ctx.currentTime;

    // --- ADSR: Release ---
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + ENVELOPE.release);

    source.stop(now + ENVELOPE.release);
    activeNotes.current.delete(note);
  }

  function midiToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // ------------------------------------------------------------------
  // Microphone recording
  // ------------------------------------------------------------------

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks.current = [];

    const recorder = new MediaRecorder(stream);
    mediaRecorder.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Stop all mic tracks to release the device
      stream.getTracks().forEach(t => t.stop());

      const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      const trimmed = trimSilence(ctx, decoded, silenceThreshold);

      // Detect the pitch and use it as the root note for transposition
      const detected = detectPitch(trimmed);
      if (detected !== null) {
        rootNote.current = detected;
        setDetectedNote(midiNoteName(detected));
        console.log(`Detected pitch: ${midiNoteName(detected)} (MIDI ${detected})`);
      } else {
        // Fall back to C3 if pitch is ambiguous (e.g. percussive sound)
        rootNote.current = 48;
        setDetectedNote('?');
        console.warn("Pitch detection inconclusive, defaulting to C3");
      }

      currentSample.current = trimmed;
      setSampleSource('mic');
      console.log("Mic sample ready, duration:", trimmed.duration.toFixed(2) + "s");
    };

    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const resetToDefault = async () => {
    currentSample.current = await loadSample(ctx, DEFAULT_SAMPLE_URL);
    rootNote.current = 48;
    setDetectedNote(null);
    setSampleSource('default');
  };

  // ------------------------------------------------------------------
  // MIDI
  // ------------------------------------------------------------------

  useEffect(() => {

    WebMidi.enable()
      .then(() => {
        console.log("MIDI enabled");

        const input = WebMidi.inputs[0];

        WebMidi.inputs.forEach(input => {
          console.log(input.name);
        });

        if (input) {
          input.addListener("noteon", e => {
            if (!currentSample.current) return;
            playSample(ctx, currentSample.current, e.note.number);
          });

          input.addListener("noteoff", e => {
            releaseSample(e.note.number);
          });
        }

      })
      .catch(err => console.error(err));

  }, []);



  const playNote =  useCallback((action: "press" | "release", freq: number) => {
    if (currentSample.current) {
      switch (action) {
        case "press":
          console.log("press", freq)
          
          playSample(ctx, currentSample.current, freq);
          break;

        case "release":
          console.log("release")
          releaseSample(freq);
          break;
      }
    }

  },[currentSample.current])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      <button onClick={startAudio}>
        Enable Audio
      </button>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {!isRecording ? (
          <button onClick={startRecording}>
            🎙 Record Sample
          </button>
        ) : (
          <button onClick={stopRecording} style={{ color: 'red' }}>
            ⏹ Stop Recording
          </button>
        )}
        {sampleSource === 'mic' && (
          <button onClick={resetToDefault}>
            ↩ Use Default Sample
          </button>
        )}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <small>Silence threshold: {silenceThreshold.toFixed(3)}</small>
        <input
          type="range"
          min={0.001}
          max={0.1}
          step={0.001}
          value={silenceThreshold}
          onChange={e => setSilenceThreshold(parseFloat(e.target.value))}
        />
      </label>

      <small style={{ opacity: 0.6 }}>
        Sample: {sampleSource === 'mic'
          ? `🎙 Mic recording — root note: ${detectedNote ?? '…'}`
          : '🎹 Default piano (C3)'}
      </small>

      <div className="keys">
        <button onMouseDown={() => { playNote("press", 261)}} onMouseUp={() => { playNote("release", 261)}} />
        <button />
        <button />
        <button />
        <button />
        <button />
        <button />
        <button />
        <button />
        <button />
        <button />
        <button />
      </div>

    </div>
  );
}

export default App;