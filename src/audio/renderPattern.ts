import type { Note, Track } from '../store/useDawStore';

const SAMPLE_RATE = 44100;

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

const pitchToMidi = (pitch: string) => {
  const match = pitch.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60;
  return (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]];
};

const encodeWav = (buffer: AudioBuffer) => {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const view = new DataView(new ArrayBuffer(length));
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length - 44, true);

  let offset = 44;
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
};

export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const scheduleGainEnvelope = (
  gain: AudioParam,
  start: number,
  duration: number,
  velocity: number,
  track: Track,
) => {
  const attack = Math.max(0.001, track.attack || 0.01);
  const decay = Math.max(0.001, track.decay || 0.08);
  const sustain = Math.max(0, Math.min(1, track.sustain ?? 0.8));
  const release = Math.max(0.01, track.release || 0.25);
  const peak = Math.max(0, Math.min(1, velocity * track.volume));
  const noteOff = start + duration;

  gain.setValueAtTime(0, start);
  gain.linearRampToValueAtTime(peak, start + attack);
  gain.linearRampToValueAtTime(peak * sustain, start + attack + decay);
  gain.setValueAtTime(peak * sustain, noteOff);
  gain.linearRampToValueAtTime(0, noteOff + release);
};

export const renderNotesToWavClip = async (track: Track, notes: Note[], bpm: number) => {
  if (notes.length === 0) return null;

  const minStep = Math.min(...notes.map(note => note.time));
  const maxStep = Math.max(...notes.map(note => note.time + note.duration));
  const sixteenthSeconds = 60 / bpm / 4;
  const durationSteps = Math.max(1, maxStep - minStep);
  const renderSeconds = (durationSteps * sixteenthSeconds) + Math.max(0.4, track.release + 0.1);
  const context = new OfflineAudioContext(2, Math.ceil(renderSeconds * SAMPLE_RATE), SAMPLE_RATE);
  const master = context.createGain();
  master.gain.value = 0.85;
  master.connect(context.destination);

  let sampleBuffer: AudioBuffer | null = null;
  if (track.type === 'sampler' && track.sampleUrl) {
    const response = await fetch(track.sampleUrl);
    const sampleArrayBuffer = await response.arrayBuffer();
    sampleBuffer = await context.decodeAudioData(sampleArrayBuffer.slice(0));
  }

  notes.forEach(note => {
    const start = Math.max(0, (note.time - minStep) * sixteenthSeconds);
    const duration = Math.max(0.02, note.duration * sixteenthSeconds);
    const gain = context.createGain();
    const pan = context.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, track.pan || 0));
    gain.connect(pan);
    pan.connect(master);
    scheduleGainEnvelope(gain.gain, start, duration, note.velocity, track);

    if (sampleBuffer) {
      const source = context.createBufferSource();
      source.buffer = sampleBuffer;
      source.playbackRate.value = Math.pow(2, (pitchToMidi(note.pitch) - 60) / 12);
      source.connect(gain);
      source.start(start);
      source.stop(start + duration + Math.max(0.05, track.release));
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = track.oscillatorType || 'sawtooth';
      oscillator.frequency.value = 440 * Math.pow(2, (pitchToMidi(note.pitch) - 69) / 12);
      oscillator.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + duration + Math.max(0.05, track.release));
    }
  });

  const rendered = await context.startRendering();
  const wavBlob = encodeWav(rendered);
  return {
    url: URL.createObjectURL(wavBlob),
    blob: wavBlob,
    durationSteps,
    startStep: minStep,
  };
};
