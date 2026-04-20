import React, { useRef, useState, useEffect } from 'react';
import { useDawStore } from '../store/useDawStore';
import { useLobbyStore } from '../store/useLobbyStore';

import * as Tone from 'tone';

export default function ChannelRack() {
  const { tracks, updateTrack, selectedTrackId, setSelectedTrackId, isChannelRackOpen, setIsChannelRackOpen } = useDawStore();
  const dawStore = useDawStore();
  const { role, room, username } = useLobbyStore();
  const isActiveShowcaseTarget = room?.status === 'voting' && room?.showcaseQueue?.[room?.showcaseIndex || 0] === username;
  const isMatchActive = room?.status === 'active' || isActiveShowcaseTarget;
  const isProducer = (role === 'producer' || role === 'host') && isMatchActive;

  const STEPS = 16;

  const toggleStep = (trackId: string, step: number) => {
    if (!isProducer || !isMatchActive) return;
    const track = dawStore.tracks.find(t => t.id === trackId);
    if (!track) return;
    const existing = track.notes.find(n => n.time === step && n.pitch === 'C5');
    if (existing) {
      dawStore.removeNote(trackId, existing.id);
    } else {
      dawStore.addNote(trackId, {
        id: `note-${Date.now()}-${Math.random()}`,
        pitch: 'C5',
        time: step,
        duration: 0.25, // 1 sixteenth
        velocity: 0.8
      });
    }
  };

  useEffect(() => {
     let afId: number;
     const drawPlayhead = () => {
         if (dawStore.isPlaying) {
             const ticks = Tone.Transport.ticks;
             const ticksPer16th = Tone.Transport.PPQ / 4; 
             const pos = ticks / ticksPer16th;
             const activeStep = Math.floor(pos) % STEPS;
             
             for(let i = 0; i < STEPS; i++) {
                 const elements = document.querySelectorAll(`[id^="step-overlay-${i}-"]`);
                 elements.forEach(el => {
                     (el as HTMLElement).style.opacity = i === activeStep ? '1' : '0';
                 });
             }
         } else {
             for(let i = 0; i < STEPS; i++) {
                 const elements = document.querySelectorAll(`[id^="step-overlay-${i}-"]`);
                 elements.forEach(el => {
                     (el as HTMLElement).style.opacity = '0';
                 });
             }
         }
         afId = requestAnimationFrame(drawPlayhead);
     };
     drawPlayhead();
     return () => cancelAnimationFrame(afId);
  }, [dawStore.isPlaying]);

  // Custom Knob interaction component
  const Knob = ({ trackId, param }: { trackId: string, param: 'volume' | 'pan' }) => {
    const track = dawStore.tracks.find(t => t.id === trackId);
    const val = track ? track[param] : 0.5;
    const isVol = param === 'volume';
    const min = isVol ? 0 : -1;
    const max = 1;
    
    // Scale value to degrees (-130 to 130)
    const pct = (val - min) / (max - min);
    const deg = -130 + (pct * 260);

    const handleKnobDrag = (e: React.MouseEvent) => {
       if (!isProducer || !isMatchActive) return;
       e.preventDefault();
       const startY = e.clientY;
       const startVal = val;

       const handleMove = (eMove: MouseEvent) => {
          const delta = startY - eMove.clientY;
          let newPct = (startVal - min) / (max - min) + (delta * 0.01);
          newPct = Math.max(0, Math.min(1, newPct));
          const newVal = min + (newPct * (max - min));
          updateTrack(trackId, { [param]: newVal });
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
         className="fl-knob scale-90" 
         onMouseDown={handleKnobDrag}
         title={`${param}: ${val.toFixed(2)}`}
         style={{ "--knob-deg": `${deg}deg` } as React.CSSProperties}
      />
    );
  };

  const windowRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 15, y: 20 });

  const handleHeaderDrag = (e: React.MouseEvent) => {
     e.preventDefault();
     const startX = e.clientX;
     const startY = e.clientY;
     const initialPos = { ...posRef.current };

     const handleMove = (moveEvent: MouseEvent) => {
        posRef.current = {
           x: initialPos.x + (moveEvent.clientX - startX),
           y: initialPos.y + (moveEvent.clientY - startY)
        };
        if (windowRef.current) {
           windowRef.current.style.left = `${posRef.current.x}px`;
           windowRef.current.style.top = `${posRef.current.y}px`;
        }
     };

     const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        if (isProducer && room?.id) {
            import('../socket/socket').then(({ socket }) => {
                 socket.emit('ui_interaction', { roomId: room.id, type: 'channel_rack_pos', value: posRef.current });
            });
        }
     };

     window.addEventListener('mousemove', handleMove);
     window.addEventListener('mouseup', handleUp);
  };

  useEffect(() => {
     const handleUiInteraction = (data: any) => {
         if (role === 'judge') {
              const targetWatching = useLobbyStore.getState().judgeWatching;
              if (targetWatching === data.username && data.type === 'channel_rack_pos') {
                  posRef.current = data.value;
                  if (windowRef.current) {
                      windowRef.current.style.left = `${data.value.x}px`;
                      windowRef.current.style.top = `${data.value.y}px`;
                  }
              }
         }
     };
     import('../socket/socket').then(({ socket }) => {
         socket.on('ui_interaction', handleUiInteraction);
     });
     return () => {
         import('../socket/socket').then(({ socket }) => {
             socket.off('ui_interaction', handleUiInteraction);
         });
     };
  }, [role]);

  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(isChannelRackOpen);

  useEffect(() => {
     if (isChannelRackOpen) {
         setShouldRender(true);
         setIsAnimatingOut(false);
     } else if (shouldRender) {
         setIsAnimatingOut(true);
         const t = setTimeout(() => setShouldRender(false), 300);
         return () => clearTimeout(t);
     }
  }, [isChannelRackOpen]);

  if (!shouldRender && !isChannelRackOpen) {
      return (
         <div 
           className="absolute z-10 bg-[#282e32] border border-[#4f5960] py-1 px-3 rounded shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-pointer hover:bg-[#3b4349] transition-all flex items-center gap-3 animate-pulse"
           style={{ left: posRef.current.x, top: posRef.current.y }}
           onClick={() => setIsChannelRackOpen(true)}
         >
            <div className="w-4 h-4 bg-[var(--fl-green)] rounded-[1px] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.5)] flex flex-col justify-evenly p-[2px]">
               <div className="w-full h-[2px] bg-black/60 rounded" />
               <div className="w-full h-[2px] bg-black/60 rounded" />
               <div className="w-full h-[2px] bg-black/60 rounded" />
            </div>
            <span className="text-[11px] font-black text-white uppercase tracking-widest">Restore Channel Rack</span>
         </div>
      );
  }

  return (
    <div 
      ref={windowRef} 
      className={`absolute w-[510px] fl-window flex flex-col pointer-events-auto transition-all duration-300 ${isAnimatingOut ? 'scale-0 opacity-0 -translate-y-10' : 'scale-100 opacity-100 translate-y-0'}`} 
      style={{ zIndex: 10, left: posRef.current.x, top: posRef.current.y, transformOrigin: 'top left' }}
    >
        <div className="fl-window-header h-[24px] px-2 flex justify-between items-center text-[11px] font-bold tracking-tight cursor-default" onMouseDown={handleHeaderDrag}>
          <div className="flex items-center gap-2 pointer-events-none">
             <div className="w-3 h-3 flex flex-col justify-between py-[3px]">
               <div className="w-full h-[1px] bg-[var(--fl-text-bright)]" />
               <div className="w-full h-[1px] bg-[var(--fl-text-bright)]" />
               <div className="w-full h-[1px] bg-[var(--fl-text-bright)]" />
             </div>
             Channel rack
          </div>
          <div className="flex items-center gap-1.5 h-full py-[3px]">
             <div className="w-[1px] h-full bg-[var(--fl-border)] border-r border-[#4f5960] mx-1 mr-2" />
             <div className="fl-button w-[16px] h-[16px]" onMouseDown={(e) => e.stopPropagation()}><div className="w-1.5 h-[1.5px] bg-white"/></div>
             <div className="fl-button w-[16px] h-[16px] font-black text-[9px]" onMouseDown={(e) => { e.stopPropagation(); setIsChannelRackOpen(false); }}>X</div>
          </div>
       </div>

       <div className="p-1.5 pb-4 flex flex-col gap-[3px] bg-[var(--fl-panel-bg)]">
          {tracks.map(track => {
             const isSelected = track.id === selectedTrackId;
             return (
               <div key={track.id} className="flex h-[28px] items-center bg-[#282e32] border border-[var(--fl-border)] rounded-[2px] border-b-[#404950] border-r-[#404950] shadow-sm pr-1 group">
                  
                  {/* Indicator Light */}
                  <div className={`w-[8px] h-[18px] ml-1 mr-1 border border-[var(--fl-border)] rounded-[2px] cursor-pointer shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]
                      ${isSelected ? 'bg-[var(--fl-green)] shadow-[0_0_5px_var(--fl-green),inset_1px_1px_2px_rgba(255,255,255,0.4)]' : 'bg-[#181b1e]'}`} 
                      onClick={() => setSelectedTrackId(track.id)}
                  />

                  {/* Pan/Vol Knobs */}
                  <div className="flex gap-[3px] mr-1">
                     <Knob trackId={track.id} param="pan" />
                     <Knob trackId={track.id} param="volume" />
                  </div>

                  {/* Channel Button */}
                  <div 
                    className={`h-[85%] w-[100px] mr-2 border border-[var(--fl-border)] rounded-[2px] px-2 flex justify-between items-center text-[11px] font-bold cursor-pointer select-none transition-all
                      ${isSelected ? 'bg-[#3b4349] text-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]' : 'bg-[#32393e] text-[var(--fl-text)] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.1)] hover:bg-[#3b4349]'}`}
                    onDoubleClick={() => { setSelectedTrackId(track.id); dawStore.setActiveWindow('channelSettings'); }}
                    onClick={() => { setSelectedTrackId(track.id); dawStore.setActiveWindow('pianoRoll'); }}
                  >
                     <span className="truncate drop-shadow-md">{track.name}</span>
                  </div>

                  {/* Step Sequencer Grid */}
                  <div className="flex h-full items-center bg-transparent py-1 ml-0.5">
                     {Array.from({ length: STEPS }).map((_, i) => {
                        const isActive = track.notes.some(n => Math.abs(n.time - (i * 0.25)) < 0.05 && n.pitch === 'C5');
                        const isRed = Math.floor(i / 4) % 2 === 1;
                        
                        let stepClass = isRed ? 'step-red' : 'step-dark';
                        if (isActive) stepClass = 'step-active';
                        else if (!isRed) stepClass = 'step-light';
                        
                        return (
                           <div 
                             key={i} 
                             className={`step-item cursor-pointer flex items-end justify-center pb-[1px] ${stepClass} relative overflow-hidden`}
                             onClick={() => toggleStep(track.id, i * 0.25)}
                           >
                             <div id={`step-overlay-${i}-${track.id}`} className="absolute inset-0 bg-[#e7ecef]/20 pointer-events-none transition-opacity duration-75 opacity-0" />
                           </div>
                        );
                     })}
                  </div>
               </div>
             );
          })}

          <div className="flex h-6 mt-1 ml-1 items-center gap-1 opacity-60">
             <div className="w-6 h-6 flex justify-center items-center fl-button text-[18px] hover:text-white cursor-pointer">+</div>
          </div>
       </div>
    </div>
  );
}
