import { create } from 'zustand';

export interface Note {
  id: string;
  pitch: string; // e.g., 'C4'
  time: number; // Support fractional 16ths (e.g. 0.5)
  duration: number; // Support fractional 16ths
  velocity: number;
}

export interface Track {
  id: string;
  name: string;
  type: 'synth' | 'sampler';
  oscillatorType?: 'sawtooth' | 'square' | 'triangle' | 'sine';
  sampleUrl?: string; // Uploaded custom one-shot
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  notes: Note[];
  // ADSR and Delay
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  delayTime: number;
  delayFeedback: number;
  targetDevice?: string; // e.g. "Mixer 1"
}

export interface DawState {
  tracks: Track[];
  bpm: number;
  isPlaying: boolean;
  playheadPosition: number; // 0 to 32+ (continuous)
  
  metronome: boolean;
  setMetronome: (m: boolean) => void;
  loopActive: boolean;
  loopStart: number; // in 16ths
  loopEnd: number; // in 16ths

  snapInterval: number; // 0.25, 0.5, 1, or 0 (none)
  lastNoteDuration: number; // stores last placed note length

  selectedTrackId: string | null;
  activeWindow: 'pianoRoll' | 'channelSettings' | null;
  isChannelRackOpen: boolean;

  history: Track[][];
  future: Track[][];

  // Actions
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
  addTrack: (track: Track) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  addNote: (trackId: string, note: Note) => void;
  removeNote: (trackId: string, noteId: string) => void;
  updateNote: (trackId: string, noteId: string, updates: Partial<Note>) => void;
  setBpm: (bpm: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlayheadPosition: (pos: number) => void;
  setSelectedTrackId: (id: string | null) => void;
  setSnapInterval: (val: number) => void;
  setLastNoteDuration: (val: number) => void;
  setLoopPoints: (start: number, end: number) => void;
  setLoopActive: (active: boolean) => void;
  setActiveWindow: (window: 'pianoRoll' | 'channelSettings' | null) => void;
  setIsChannelRackOpen: (val: boolean) => void;
  setState: (state: Partial<DawState>) => void;
}

export const useDawStore = create<DawState>((set) => ({
  tracks: [
    {
      id: 'track-1',
      name: 'Default Synth',
      type: 'synth',
      oscillatorType: 'sawtooth',
      volume: 0.4,
      pan: 0,
      notes: [],
      attack: 0.01,
      decay: 0.5, // Changed to 0.5
      sustain: 1.0, // Changed to 1.0 so tall notes actually hold fully!
      release: 0.3, // Shorter release feels snappier
      delayTime: 0,
      delayFeedback: 0,
    }
  ],
  bpm: 120,
  isPlaying: false,
  playheadPosition: 0,
  
  metronome: false,
  setMetronome: (metronome) => set({ metronome }),

  loopActive: true,
  loopStart: 0,
  loopEnd: 16, // Default 1 bar loop (16 16ths)
  snapInterval: 4, // Default 1 beat (4 steps)
  lastNoteDuration: 1,

  selectedTrackId: 'track-1',
  activeWindow: 'pianoRoll',
  isChannelRackOpen: true,

  history: [],
  future: [],

  commitHistory: () => set((state) => {
      if (state.history.length > 0 && state.history[state.history.length - 1] === state.tracks) return state;
      return {
          history: [...state.history.slice(-50), state.tracks],
          future: []
      };
  }),

  undo: () => set((state) => {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
          tracks: prev,
          history: state.history.slice(0, -1),
          future: [state.tracks, ...state.future]
      };
  }),

  redo: () => set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
          tracks: next,
          history: [...state.history, state.tracks],
          future: state.future.slice(1)
      };
  }),

  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),
  
  updateTrack: (trackId, updates) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t)
  })),

  addNote: (trackId, note) => set((state) => ({
    tracks: state.tracks.map(t => 
      t.id === trackId ? { ...t, notes: [...t.notes, note] } : t
    )
  })),

  removeNote: (trackId, noteId) => set((state) => ({
    tracks: state.tracks.map(t => 
      t.id === trackId ? { ...t, notes: t.notes.filter(n => n.id !== noteId) } : t
    )
  })),

  updateNote: (trackId, noteId, updates) => set((state) => ({
    tracks: state.tracks.map(t => 
      t.id === trackId ? {
        ...t,
        notes: t.notes.map(n => n.id === noteId ? { ...n, ...updates } : n)
      } : t
    )
  })),

  setBpm: (bpm) => set({ bpm }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlayheadPosition: (playheadPosition) => set({ playheadPosition }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setSnapInterval: (val) => set({ snapInterval: val }),
  setLastNoteDuration: (val) => set({ lastNoteDuration: val }),
  setLoopPoints: (start, end) => set({ loopStart: start, loopEnd: end }),
  setLoopActive: (active) => set({ loopActive: active }),
  setActiveWindow: (window) => set({ activeWindow: window }),
  setIsChannelRackOpen: (val) => set({ isChannelRackOpen: val }),
  setState: (newState) => set((state) => ({ ...state, ...newState }))
}));
