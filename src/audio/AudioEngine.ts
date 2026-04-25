import * as Tone from 'tone';
import { useDawStore } from '../store/useDawStore';

class AudioEngine {
  private instruments: Map<string, Tone.PolySynth | Tone.Sampler> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private clipPlayers: Map<string, Tone.Player> = new Map();
  private clipParts: Map<string, Tone.Part> = new Map();
  private initialized = false;
  private suppressStoreTransportUntil = 0;
  
  public analyser: Tone.Analyser;

  constructor() {
     this.analyser = new Tone.Analyser('waveform', 128);
  }

  async init() {
    if (this.initialized) return;
    Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0.025 }));
    await Tone.start();
    Tone.Transport.bpm.value = useDawStore.getState().bpm;
    
    // Connect master track to analyser
    Tone.Destination.connect(this.analyser);
    
    this.initialized = true;

    // Map initial configuration state to AudioEngine instantly
    const currentState = useDawStore.getState();
    this.syncState(currentState, { tracks: [] });

    useDawStore.subscribe((state, prevState) => {
      this.syncState(state, prevState);
    });

    // Apply initial loop points
    const { loopStart, loopEnd, loopActive } = useDawStore.getState();
    this.updateLoopPoints(loopStart, loopEnd, loopActive);

    // Initialize Logic-style Metronome Beep
    this.metronomeSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 }
    }).toDestination();
    this.metronomeSynth.volume.value = -8; 

    Tone.Transport.scheduleRepeat((time) => {
       if (this.isMetronomeOn && this.metronomeSynth) {
          // Play a slightly higher tick on the downbeat (tick 0 of the measure)
          const currentTick = Math.round(Tone.Transport.ticks);
          const ticksPerMeasure = Tone.Transport.PPQ * 4;
          const isDownbeat = (currentTick % ticksPerMeasure) === 0;
          this.metronomeSynth.triggerAttackRelease(isDownbeat ? "E6" : "E5", "32n", time);
       }
    }, "4n");
  }

  private metronomeSynth: Tone.Synth | null = null;
  private isMetronomeOn = false;

  public setMetronome(state: boolean) {
     this.isMetronomeOn = state;
  }

  private updateLoopPoints(start: number, end: number, active: boolean) {
    const ticksPerSixteenth = Tone.Transport.PPQ / 4;
    if (active) {
        Tone.Transport.loopStart = `${Math.max(0, Math.round(start * ticksPerSixteenth))}i`;
        Tone.Transport.loopEnd = `${Math.max(1, Math.round(end * ticksPerSixteenth))}i`;
        Tone.Transport.loop = true;
     } else {
        Tone.Transport.loop = false;
     }
  }

  private syncState(state: any, prevState: any) {
    if (!this.initialized) return;

    if (state.isPlaying !== prevState.isPlaying) {
      if (performance.now() > this.suppressStoreTransportUntil) {
        if (state.isPlaying) {
          this.startTransport(Tone.Transport.ticks, 0, state.bpm);
        } else {
          this.stopTransport(state.loopStart);
        }
      }
    }

    if (state.bpm !== prevState.bpm) {
      Tone.Transport.bpm.value = state.bpm;
    }

    if (state.metronome !== prevState.metronome) {
      this.setMetronome(state.metronome);
    }

    if (state.loopStart !== prevState.loopStart || state.loopEnd !== prevState.loopEnd || state.loopActive !== prevState.loopActive) {
       this.updateLoopPoints(state.loopStart, state.loopEnd, state.loopActive);
    }

    const patternClips = state.playlistClips?.filter((clip: any) => clip.type === 'pattern') || [];
    const audioClips = state.playlistClips?.filter((clip: any) => clip.type === 'audio' && clip.audioUrl) || [];
    const arrangeFromPlaylist = patternClips.length > 0;

    const activeTrackIds = new Set(state.tracks.map((track: any) => track.id));
    this.parts.forEach((part, trackId) => {
      if (!activeTrackIds.has(trackId)) {
        part.dispose();
        this.parts.delete(trackId);
      }
    });
    this.instruments.forEach((instrument, trackId) => {
      if (!activeTrackIds.has(trackId)) {
        instrument.dispose();
        this.instruments.delete(trackId);
      }
    });

    const playlistChanged = state.playlistClips !== prevState?.playlistClips;

    state.tracks.forEach((track: any) => {
      const prevTrack = prevState?.tracks?.find((t: any) => t.id === track.id);
      
      const shouldRecreate = !this.instruments.has(track.id) || 
                             (prevTrack && (
                                prevTrack.type !== track.type || 
                                prevTrack.sampleUrl !== track.sampleUrl ||
                                prevTrack.oscillatorType !== track.oscillatorType
                              ));

      if (shouldRecreate) {
        if (this.instruments.has(track.id)) {
           this.instruments.get(track.id)!.dispose();
        }

        let instrument: Tone.PolySynth | Tone.Sampler;
        if (track.type === 'sampler' && track.sampleUrl) {
          instrument = new Tone.Sampler({
            urls: { C4: track.sampleUrl },
          }).toDestination();
        } else {
          instrument = new Tone.PolySynth(Tone.Synth, {
             oscillator: { type: track.oscillatorType || 'sawtooth' }
          }).toDestination();
          instrument.maxPolyphony = 32;
        }
        
        this.instruments.set(track.id, instrument);
      }

      const instrument = this.instruments.get(track.id)!;
      
      instrument.volume.value = track.volume <= 0 ? -Infinity : Tone.gainToDb(track.volume);
      
      if (instrument instanceof Tone.PolySynth) {
        instrument.set({
          envelope: {
            attack: track.attack,
            decay: track.decay,
            sustain: track.sustain,
            release: track.release
          }
        });
      } else if (instrument instanceof Tone.Sampler) {
        instrument.attack = track.attack;
        instrument.release = track.release;
      }

      // ONLY reschedule if the track's notes actually changed or if it just got initialized!
      if (!prevTrack || prevTrack.notes !== track.notes || playlistChanged || shouldRecreate) {
          if (this.parts.has(track.id)) {
            this.parts.get(track.id)!.dispose();
            this.parts.delete(track.id);
          }

          const sourceEvents = arrangeFromPlaylist
            ? patternClips.flatMap((clip: any) => track.notes.map((note: any) => ({
                ...note,
                time: clip.start + note.time,
              })))
            : track.notes;

          const partEvents = sourceEvents.map((note: any) => {
              return { 
                  time: Math.round(note.time * (Tone.Transport.PPQ / 4)) + "i", 
                  pitch: note.pitch, 
                  velocity: note.velocity,
                  duration: Math.round(note.duration * (Tone.Transport.PPQ / 4)) + "i"
              };
          });

          const part = new Tone.Part((time, value) => {
              instrument.triggerAttackRelease(value.pitch, value.duration, time, value.velocity);
          }, partEvents).start(0);

          part.loop = false; // We use Transport loop
          this.parts.set(track.id, part);
      }
    });

    const activeClipIds = new Set(audioClips.map((clip: any) => clip.id));
    this.clipParts.forEach((part, clipId) => {
      if (!activeClipIds.has(clipId)) {
        part.dispose();
        this.clipParts.delete(clipId);
      }
    });
    this.clipPlayers.forEach((player, clipId) => {
      if (!activeClipIds.has(clipId)) {
        player.dispose();
        this.clipPlayers.delete(clipId);
      }
    });

    audioClips.forEach((clip: any) => {
      const prevClip = prevState?.playlistClips?.find((c: any) => c.id === clip.id);
      const shouldRecreate = !this.clipPlayers.has(clip.id) || prevClip?.audioUrl !== clip.audioUrl || prevClip?.start !== clip.start;

      if (shouldRecreate) {
        if (this.clipParts.has(clip.id)) {
          this.clipParts.get(clip.id)!.dispose();
          this.clipParts.delete(clip.id);
        }
        if (this.clipPlayers.has(clip.id)) {
          this.clipPlayers.get(clip.id)!.dispose();
          this.clipPlayers.delete(clip.id);
        }

        const player = new Tone.Player({ url: clip.audioUrl }).toDestination();
        this.clipPlayers.set(clip.id, player);
        const part = new Tone.Part((time) => {
          player.start(time);
        }, [{ time: Math.round(clip.start * (Tone.Transport.PPQ / 4)) + "i" }]).start(0);
        this.clipParts.set(clip.id, part);
      }
    });
  }

  public startTransport(ticks = Tone.Transport.ticks, delayMs = 0, bpm?: number) {
     if (!this.initialized) return;
     this.suppressStoreTransportUntil = performance.now() + delayMs + 160;
     if (typeof bpm === 'number') Tone.Transport.bpm.value = bpm;
     Tone.Transport.ticks = Math.max(0, ticks);
     Tone.Transport.start(`+${Math.max(0, delayMs) / 1000}`);
  }

  public stopTransport(loopStart = useDawStore.getState().loopStart) {
     if (!this.initialized) return;
     this.suppressStoreTransportUntil = performance.now() + 160;
     Tone.Transport.stop();
     Tone.Transport.ticks = Math.max(0, loopStart * (Tone.Transport.PPQ / 4));
     useDawStore.getState().setPlayheadPosition(loopStart);

     this.instruments.forEach(inst => {
        inst.releaseAll(Tone.now());
     });
  }

  // Method to play a specific sound via UI bypass (for Piano keys)
  public playPreview(trackId: string, pitch: string) {
     if (!this.initialized) return;
     const instrument = this.instruments.get(trackId);
     if (instrument) {
        instrument.triggerAttackRelease(pitch, 0.5, Tone.now(), 0.8);
     }
  }
}

export const engine = new AudioEngine();
