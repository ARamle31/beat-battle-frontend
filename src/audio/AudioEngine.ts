import * as Tone from 'tone';
import { useDawStore } from '../store/useDawStore';

class AudioEngine {
  private instruments: Map<string, Tone.PolySynth | Tone.Sampler> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private initialized = false;
  
  public analyser: Tone.Analyser;

  constructor() {
     this.analyser = new Tone.Analyser('waveform', 128);
  }

  async init() {
    if (this.initialized) return;
    await Tone.start();
    Tone.Transport.bpm.value = useDawStore.getState().bpm;
    
    // Connect master track to analyser
    Tone.Destination.connect(this.analyser);
    
    this.initialized = true;

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

    this.metronomeEventId = Tone.Transport.scheduleRepeat((time) => {
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
  private metronomeEventId: number | null = null;
  private isMetronomeOn = false;

  public setMetronome(state: boolean) {
     this.isMetronomeOn = state;
  }

  private updateLoopPoints(start: number, end: number, active: boolean) {
     if (active) {
        // Use EXACT ticks for zero-latency gapless looping (1 step = PPQ / 4 ticks)
        const ticksPerStep = Tone.Transport.PPQ / 4;
        Tone.Transport.setLoopPoints(`${start * ticksPerStep}i`, `${end * ticksPerStep}i`);
        Tone.Transport.loop = true;
     } else {
        Tone.Transport.loop = false;
     }
  }

  private syncState(state: any, prevState: any) {
    if (!this.initialized) return;

    if (state.isPlaying !== prevState.isPlaying) {
      if (state.isPlaying) {
        Tone.Transport.start();
      } else {
        Tone.Transport.stop();
        Tone.Transport.position = state.loopStart * Tone.Time("16n").toSeconds();
        state.setPlayheadPosition(state.loopStart);
        
        // Let instruments smoothly decay based on their set release envelope
        this.instruments.forEach(inst => {
            if (inst instanceof Tone.PolySynth || inst instanceof Tone.Sampler) {
                 inst.releaseAll(Tone.now());
            }
        });
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
      
      instrument.volume.value = Tone.gainToDb(track.volume);
      
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
      if (!prevTrack || prevTrack.notes !== track.notes || shouldRecreate) {
          if (this.parts.has(track.id)) {
            this.parts.get(track.id)!.dispose();
          }

          const groupedNotes: Record<number, { notes: string[], maxVelocity: number, duration: number }> = {};
          
          track.notes.forEach((note: any) => {
             const t = note.time;
             if (!groupedNotes[t]) {
                 groupedNotes[t] = { notes: [], maxVelocity: 0, duration: note.duration };
             }
             groupedNotes[t].notes.push(note.pitch);
             groupedNotes[t].maxVelocity = Math.max(groupedNotes[t].maxVelocity, note.velocity);
             groupedNotes[t].duration = Math.max(groupedNotes[t].duration, note.duration);
          });

          if ((this as any)[`scheduled_${track.id}`]) {
             (this as any)[`scheduled_${track.id}`].forEach((id: number) => Tone.Transport.clear(id));
          }
          (this as any)[`scheduled_${track.id}`] = [];

          Object.entries(groupedNotes).forEach(([timeStr, data]) => {
             const floatTime = parseFloat(timeStr);
             const timeInTicks = floatTime * (Tone.Transport.PPQ / 4) + "i"; 
             const durationInTicks = data.duration * (Tone.Transport.PPQ / 4) + "i";

             const schedId = Tone.Transport.schedule((time) => {
                if (instrument instanceof Tone.PolySynth) {
                   instrument.triggerRelease(data.notes, time - 0.001); 
                }
                instrument.triggerAttackRelease(data.notes, durationInTicks, time, data.maxVelocity);
             }, timeInTicks);
             
             (this as any)[`scheduled_${track.id}`].push(schedId);
          });
      }
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