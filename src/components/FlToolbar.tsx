import React, { useEffect, useRef, useState } from 'react';
import { useDawStore } from '../store/useDawStore';
import { useLobbyStore } from '../store/useLobbyStore';
import { engine } from '../audio/AudioEngine';
import { Magnet, ListMusic } from 'lucide-react';
import * as Tone from 'tone';
import { NETWORK_LEAD_MS, getNetworkStats, getServerNow, socket, subscribeNetworkStats } from '../socket/socket';

export default function FlToolbar({ 
  audioInited, 
  setAudioInited 
}: { 
  audioInited: boolean, 
  setAudioInited: (v: boolean) => void 
}) {
  const { bpm, setBpm, isPlaying, setIsPlaying, isChannelRackOpen, setIsChannelRackOpen, metronome, setMetronome } = useDawStore();
  const { room, role } = useLobbyStore();
  const isProducer = role === 'producer' || role === 'host';
  const isMatchActive = room?.status === 'active';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cpuUsage, setCpuUsage] = useState(0);
  const [networkStats, setNetworkStats] = useState(getNetworkStats());

  const togglePlayback = async () => {
    if (!audioInited) {
      await engine.init();
      setAudioInited(true);
    }
    const nextIsPlaying = !isPlaying;
    const ticks = Tone.Transport.ticks;
    const serverStartAt = nextIsPlaying ? getServerNow() + NETWORK_LEAD_MS : getServerNow();

    if (nextIsPlaying) {
      engine.startTransport(ticks, NETWORK_LEAD_MS, bpm);
    } else {
      engine.stopTransport(useDawStore.getState().loopStart);
    }

    setIsPlaying(nextIsPlaying);

    if (room?.id) {
      socket.emit('transport_control', {
        roomId: room.id,
        action: nextIsPlaying ? 'play' : 'stop',
        ticks,
        bpm,
        serverStartAt,
      });
    }
  };
  
  const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => subscribeNetworkStats(setNetworkStats), []);

  // Oscilloscope drawing logic
  useEffect(() => {
     let animationId: number;
     const draw = () => {
         const ctx = canvasRef.current?.getContext('2d');
         if (!ctx || !canvasRef.current) return;
         ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
         
         if (audioInited && engine.analyser) {
             const vals = engine.analyser.getValue() as Float32Array;
             ctx.beginPath();
             ctx.strokeStyle = '#64B7EE';
             ctx.lineWidth = 1.5;
             const sliceWidth = canvasRef.current.width / vals.length;
             let x = 0;
             for (let i = 0; i < vals.length; i++) {
                 // The analyser might not be returning standard floats if it's inactive, handle safely
                 const raw = typeof vals[i] === 'number' ? vals[i] : 0;
                 const v = (raw * 0.5) + 0.5;
                 const y = v * canvasRef.current.height;
                 if (i === 0) ctx.moveTo(x, y);
                 else ctx.lineTo(x, y);
                 x += sliceWidth;
             }
             ctx.stroke();
         } else {
             // Draw flat idle line
             ctx.beginPath();
             ctx.strokeStyle = '#64B7EE';
             ctx.lineWidth = 1;
             ctx.moveTo(0, canvasRef.current.height / 2);
             ctx.lineTo(canvasRef.current.width, canvasRef.current.height / 2);
             ctx.stroke();
         }

         animationId = requestAnimationFrame(draw);
     };
     draw();
     return () => cancelAnimationFrame(animationId);
  }, [audioInited, isPlaying]);

  useEffect(() => {
     const intervalId = window.setInterval(() => {
        setCpuUsage(Math.floor(Math.random() * 5) + (isPlaying ? 12 : 1));
     }, 650);
     return () => window.clearInterval(intervalId);
  }, [isPlaying]);

  // Realtime Judge Synchronization Emitter
  useEffect(() => {
     if (!isPlaying || !isProducer || !room?.id) return;
     if (room?.mode === 'multiplayer' && role !== 'host') return; // Host acts as master clock
     
     const intervalId = window.setInterval(() => {
         socket.volatile.emit('playhead_sync', {
           roomId: room.id,
           ticks: Tone.Transport.ticks,
           bpm,
           serverSentAt: getServerNow(),
         });
     }, 250);
     return () => window.clearInterval(intervalId);
  }, [isPlaying, isProducer, room?.id, room?.mode, role, bpm]);

  // Master Volume and Pan native interactions
  const [masterVol, setMasterVol] = useState(0.8);
  const [masterPan, setMasterPan] = useState(0.5);

  useEffect(() => {
     Tone.Destination.volume.value = Tone.gainToDb(masterVol);
  }, [masterVol]);

  const MasterKnob = ({ val, setVal, type }: { val: number, setVal: (v: number) => void, type: 'vol'|'pan' }) => {
    const min = 0;
    const max = 1;
    const pct = (val - min) / (max - min);
    const deg = -130 + (pct * 260);

    const handleDrag = (e: React.MouseEvent) => {
       if (!isProducer) return;
       e.preventDefault();
       const startY = e.clientY;
       const startVal = val;
       const handleMove = (eMove: MouseEvent) => {
          const delta = startY - eMove.clientY;
          let newPct = (startVal - min) / (max - min) + (delta * 0.01);
          newPct = Math.max(0, Math.min(1, newPct));
          setVal(min + (newPct * (max - min)));
       };
       const handleUp = () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
       };
       window.addEventListener('mousemove', handleMove);
       window.addEventListener('mouseup', handleUp);
    };
    return (
       <div 
         className="fl-knob scale-[0.80]" 
         onMouseDown={handleDrag}
         title={`Master ${type.toUpperCase()}`}
         style={{ "--knob-deg": `${deg}deg` } as React.CSSProperties}
       />
    );
  };

  const handleBpmDrag = (e: React.MouseEvent) => {
       if (!isProducer) return;
       e.preventDefault();
       const startY = e.clientY;
       const startVal = bpm;
       const handleMove = (eMove: MouseEvent) => {
          const delta = startY - eMove.clientY;
          let newBpm = Math.round(startVal + (delta * 0.25));
          newBpm = Math.max(60, Math.min(240, newBpm));
          setBpm(newBpm);
       };
       const handleUp = () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
       };
       window.addEventListener('mousemove', handleMove);
       window.addEventListener('mouseup', handleUp);
  };

  const panelStyle = "bg-gradient-to-b from-[#444c50] to-[#2c3236] border border-[#1b1f22] rounded-[3px] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.1),_1px_1px_3px_rgba(0,0,0,0.3)] p-1 flex items-center gap-1.5 h-[42px]";

  return (
    <div className="h-[74px] bg-[#22272a] border-b border-[#111] flex flex-col shrink-0 select-none shadow-[0_2px_10px_rgba(0,0,0,0.5)] z-50">
      {/* Top Menu Bar */}
      <div className="h-5 flex items-center px-2 text-[10px] font-bold text-[var(--fl-text)] gap-3 bg-gradient-to-b from-[#353b3f] to-[#2b3034] shadow-sm">
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">FILE</span>
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">EDIT</span>
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">ADD</span>
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">PATTERNS</span>
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">VIEW</span>
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">OPTIONS</span>
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">TOOLS</span>
        <span className="hover:text-white cursor-pointer hover:bg-white/10 px-2 h-full flex items-center rounded-sm">HELP</span>
        
        <div className="flex-1" />
        {/* Timer display on right side of menu */}
        <div className="text-[10px] flex items-center gap-2 pr-2 font-mono">
            <span className="text-[var(--fl-orange)] drop-shadow-[0_0_2px_var(--fl-orange)]">{room ? formatTime(room.matchTimeRemaining) : ''}</span>
            <span className="text-[var(--fl-text)] tracking-widest">[{role ? role.toUpperCase() : 'GUEST'}]</span>
        </div>
      </div>

      {/* Main Toolbar */}
      <div className="flex-1 px-2 flex items-center gap-2 bg-gradient-to-b from-[#3c4448] to-[#2d3236] border-t border-[#4f585d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] pb-1.5 pt-1.5">
        
        {/* Master Panel */}
        <div className={panelStyle}>
            <MasterKnob val={masterVol} setVal={setMasterVol} type="vol" />
            <div className="w-[1px] h-6 bg-[#1b1f22] border-r border-[#465056] mx-0.5" />
            <MasterKnob val={masterPan} setVal={setMasterPan} type="pan" />
        </div>

        {/* Status Panel LCD */}
        <div className={panelStyle}>
            <div className="w-[160px] h-[34px] bg-[#1a1e22] border border-[#111] rounded-[2px] shadow-[inset_1px_1px_4px_rgba(0,0,0,0.9)] flex flex-col justify-center items-center relative overflow-hidden">
                 <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 1px, #fff 1px, #fff 2px)' }} />
                 {isMatchActive ? (
                    <>
                       <div className="text-[var(--fl-orange)] text-[14px] font-mono font-black tracking-widest textShadow drop-shadow-[0_0_4px_var(--fl-orange)] opacity-90">
                          {formatTime(room?.matchTimeRemaining || 0)}
                       </div>
                    </>
                 ) : (
                    <div className="text-[var(--fl-green)] text-[12px] font-mono font-bold tracking-widest textShadow drop-shadow-[0_0_4px_var(--fl-green)] opacity-90">
                       {isPlaying ? 'PLAYING...' : 'STUDIO MATCH'}
                    </div>
                 )}
            </div>
        </div>

        {/* Mode & Transport */}
        <div className={panelStyle}>
           <div className="flex flex-col gap-[2px]">
               <button className="fl-button w-[38px] h-[16px] text-[8px] active text-[var(--fl-green)] font-bold">PAT</button>
               <button className="fl-button w-[38px] h-[16px] text-[8px] font-bold">SONG</button>
           </div>
           
           <div className="flex flex-col ml-1 items-center justify-center border-l border-[#111] border-r border-r-[#4f585d] px-1 h-[34px]">
               <button 
                  onClick={() => isProducer && setMetronome(!metronome)}
                  className={`w-[24px] h-[24px] flex items-center justify-center rounded-[2px] transition-all border border-[#111] shadow-[0_1px_1px_rgba(255,255,255,0.05)]
                  ${metronome ? 'bg-[#3b444b] text-[var(--fl-orange)] drop-shadow-[0_0_3px_var(--fl-orange)]' : 'bg-gradient-to-b from-[#2a3034] to-[#21262a] text-gray-500 hover:text-gray-400'}`}
                  title="Metronome"
                  style={{ pointerEvents: isProducer ? 'auto' : 'none' }}
               >
                  <svg width="12" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m8 2 8 0"/><path d="m9 22 6 0"/><path d="m12 15 4-8"/></svg>
               </button>
           </div>

           <div className="flex items-center gap-[3px] ml-0.5" style={{ pointerEvents: isProducer ? 'auto' : 'none' }}>
               <button onClick={() => isProducer && togglePlayback()} className={`w-[34px] h-[34px] bg-gradient-to-b from-[#3a444a] to-[#2a3034] border border-[#111] border-b-[#4f585d] flex items-center justify-center rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] hover:brightness-125 ${isPlaying ? 'bg-gradient-to-b from-[#1a1e22] to-[#111] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.8)] border-b-[#111]' : ''}`}>
                 <div className={`w-0 h-0 border-t-[6px] border-b-[6px] border-l-[9px] border-transparent ${isPlaying ? 'border-l-[var(--fl-green)] drop-shadow-[0_0_4px_var(--fl-green)]' : 'border-l-[var(--fl-text-bright)]'}`} />
               </button>
               <button onClick={() => isProducer && setIsPlaying(false)} className="w-[34px] h-[34px] bg-gradient-to-b from-[#3a444a] to-[#2a3034] border border-[#111] border-b-[#4f585d] flex items-center justify-center rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] hover:brightness-125">
                 <div className="w-[10px] h-[10px] bg-[var(--fl-text-bright)]" />
               </button>
               <button className="w-[34px] h-[34px] bg-gradient-to-b from-[#3a444a] to-[#2a3034] border border-[#111] border-b-[#4f585d] flex items-center justify-center rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] hover:brightness-125">
                 <div className="w-[11px] h-[11px] rounded-full bg-[#f44336] opacity-70" />
               </button>
           </div>
        </div>

        {/* Tempo Panel */}
        <div className={panelStyle}>
            <div className="h-[34px] w-[86px] bg-[#1a1e22] border border-[#111] shadow-[inset_1px_1px_4px_rgba(0,0,0,0.9)] flex justify-center items-center font-bold text-[var(--fl-orange)] font-mono leading-tight rounded-[2px] cursor-ns-resize relative overflow-hidden"
                 onMouseDown={handleBpmDrag}>
                 <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 1px, #fff 1px, #fff 2px)' }} />
                 <div className="text-[24px] flex items-baseline drop-shadow-[0_0_4px_var(--fl-orange)] opacity-90">{bpm}<span className="text-[12px] ml-1 mb-1 opacity-60">.00</span></div>
            </div>
        </div>

        {/* Tools & Windows Panel */}
        <div className={panelStyle + " gap-[1px]"}>
            <div className="flex items-center gap-[2px]">
               <button 
                  onClick={() => setIsChannelRackOpen(!isChannelRackOpen)}
                  className={`w-[26px] h-[26px] flex items-center justify-center rounded-[2px] transition-colors border border-transparent 
                  ${isChannelRackOpen ? 'bg-[#3b444b] border-[#111] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.05),0_0_8px_rgba(255,255,255,0.1)] text-[#64B7EE] drop-shadow-[0_0_2px_#64B7EE]' : 'hover:bg-[#3b444b] text-[var(--fl-text)]'}`}
                  title="Toggle Channel Rack"
               >
                   <ListMusic size={14} />
               </button>
            </div>
            <div className="w-[1px] h-6 bg-[#1b1f22] border-r border-[#465056] mx-1" />
            <div className="flex flex-col gap-[2px]">
               <div className="flex gap-[2px]">
                  <button className="fl-button w-[38px] h-[16px] flex items-center justify-center text-[var(--fl-green)] shadow-inner"><Magnet size={10} strokeWidth={2.5} /></button>
                  <button className="fl-button w-[64px] h-[16px] text-[8px] text-left px-1.5 flex justify-between items-center text-[var(--fl-text-bright)]">Line <span className="text-[6px] text-[#788791] scale-x-125">▼</span></button>
               </div>
               <div className="flex gap-[2px]">
                  <button className="fl-button flex-1 h-[16px] text-[9px] px-1.5 text-left w-[84px] text-[var(--fl-text-bright)]">Pattern 1</button>
                  <button className="fl-button w-[18px] h-[16px] text-[11px] pb-0.5 cursor-pointer flex justify-center items-center font-bold font-mono text-[#8ca0aa]">+</button>
               </div>
            </div>
        </div>
        
        {/* Oscilloscope Panel */}
        <div className={panelStyle}>
            <div className="w-[160px] h-[34px] bg-[#1a1e22] border border-[#111] shadow-[inset_1px_1px_4px_rgba(0,0,0,0.9)] rounded-[2px] relative overflow-hidden">
                 <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 1px, #fff 1px, #fff 2px)' }} />
                 <canvas ref={canvasRef} width={160} height={34} className="w-full h-full opacity-100 mix-blend-screen drop-shadow-[0_0_3px_#64B7EE]" />
            </div>
        </div>

        <div className="flex-1" />

        {/* CPU/Memory */}
        <div className="flex flex-col gap-[1px] items-end px-4 text-[var(--fl-text-bright)] font-mono text-[9px] font-bold opacity-70 border-l border-[#1b1f22] shadow-[-1px_0_0_rgba(255,255,255,0.03)] h-[32px] justify-center">
           <div className="flex items-center gap-2"><span className="text-[var(--fl-text)] w-6 text-left">NET</span> <span className="w-10 text-right">{networkStats.synced ? networkStats.latencyMs : 0}</span><span className="text-[var(--fl-text)]">MS</span></div>
           <div className="flex items-center gap-2"><span className="text-[var(--fl-text)] w-6 text-left">RAM</span> <span className="w-10 text-right">{100 + Math.floor(cpuUsage * 0.5)}</span><span className="text-[var(--fl-text)]">MB</span></div>
           <div className="flex items-center gap-2"><span className="text-[var(--fl-text)] w-6 text-left">CPU</span> <span className="w-10 text-right">{cpuUsage}</span><span className="text-[var(--fl-text)]">%</span></div>
        </div>
      </div>
    </div>
  );
}
