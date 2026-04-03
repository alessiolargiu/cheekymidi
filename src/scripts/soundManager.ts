/**
 * Autocorrelation pitch detector.
 * Analyses the loudest 4096-sample window of the buffer and returns
 * the nearest MIDI note, or null if no clear pitch is found.
 */
export function detectPitch(buffer: AudioBuffer): number | null {
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
export function trimSilence(ctx: AudioContext, buffer: AudioBuffer, threshold = 0.01): AudioBuffer {
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



