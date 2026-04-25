import React, { useRef } from 'react';
import { useDawStore } from '../store/useDawStore';
import { useLobbyStore } from '../store/useLobbyStore';
import { socket } from '../socket/socket';

export default function ChannelSettings() {
  const { tracks, updateTrack, selectedTrackId, activeWindow, setActiveWindow } = useDawStore();
  const { role, room, username } = useLobbyStore();
  const dawStore = useDawStore();
  
  const windowRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 600, y: 80 });
  
  const isActiveShowcaseTarget = room?.status === 'voting' && room?.showcaseQueue?.[room?.showcaseIndex || 0] === username;
  const isMatchActive = room?.status === 'active' || isActiveShowcaseTarget;
  const isProducer = (role === 'producer' || role === 'host') && isMatchActive;

  const Knob = ({ param, trackId, label, min, max }: { param: string, trackId: string, label: string, min: number, max: number }) => {
    const track = dawStore.tracks.find(t => t.id === trackId);
    const val = track ? (track as any)[param] : 0.5;
    const pct = (val - min) / (max - min);
    const deg = -130 + (pct * 260);

    const handleKnobDrag = (e: React.MouseEvent) => {
       if (!isProducer) return;
       e.preventDefault();
       const startY = e.clientY;
       const startVal = val;
       const handleMove = (eMove: MouseEvent) => {
          const delta = startY - eMove.clientY;
          let newPct = (startVal - min) / (max - min) + (delta * 0.01);
          newPct = Math.max(0, Math.min(1, newPct));
          updateTrack(trackId, { [param]: min + (newPct * (max - min)) });
       };
       const handleUp = () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
       };
       window.addEventListener('mousemove', handleMove);
       window.addEventListener('mouseup', handleUp);
    };

    return (
      <div className="flex flex-col items-center gap-1">
         <div 
           className="fl-knob scale-125 my-1" 
           onMouseDown={handleKnobDrag}
           style={{ "--knob-deg": `${deg}deg` } as React.CSSProperties}
         />
         <span className="text-[9px] font-bold text-[#96A8B3] uppercase tracking-widest mt-1">{label}</span>
      </div>
    );
  };
  
  const handleHeaderDrag = (e: React.MouseEvent) => {
     e.preventDefault();
     const startX = e.clientX;
     const startY = e.clientY;
     const initialPos = { ...posRef.current };

     const handleMove = (eM: MouseEvent) => {
        posRef.current = {
           x: initialPos.x + (eM.clientX - startX),
           y: initialPos.y + (eM.clientY - startY)
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
             socket.emit('ui_interaction', { roomId: room.id, type: 'channel_settings_pos', value: posRef.current });
         }
     };
     window.addEventListener('mousemove', handleMove);
     window.addEventListener('mouseup', handleUp);
  };

  React.useEffect(() => {
     const handleUiInteraction = (data: any) => {
         if (data.senderId === socket.id) return;
         const currentRoom = useLobbyStore.getState().room;
         const targetWatching = useLobbyStore.getState().judgeWatching;
         const shouldApply =
            (role === 'judge' && targetWatching === data.username) ||
            currentRoom?.mode === 'multiplayer';

         if (shouldApply) {
              if (data.type === 'channel_settings_pos') {
                  posRef.current = data.value;
                  if (windowRef.current) {
                      windowRef.current.style.left = `${data.value.x}px`;
                      windowRef.current.style.top = `${data.value.y}px`;
                  }
              }
         }
     };
     socket.on('ui_interaction', handleUiInteraction);
     return () => {
         socket.off('ui_interaction', handleUiInteraction);
     };
  }, [role]);

  if (activeWindow !== 'channelSettings' || !selectedTrackId) return null;
  const track = tracks.find(t => t.id === selectedTrackId);
  if (!track) return null;

  return (
    <div ref={windowRef} className="absolute w-[350px] fl-window flex flex-col pointer-events-auto z-50 shadow-[6px_6px_20px_rgba(0,0,0,0.8)]" style={{ left: posRef.current.x, top: posRef.current.y }}>
       <div className="fl-window-header h-[24px] px-2 flex justify-between items-center text-[11px] font-bold tracking-tight cursor-default" onMouseDown={handleHeaderDrag}>
          <div className="flex items-center gap-2 pointer-events-none">
             <div className="w-3 h-3 flex flex-col justify-between py-[3px]">
               <div className="w-full h-[1px] bg-[var(--fl-text-bright)]" />
             </div>
             Channel settings - {track.name}
          </div>
          <div className="flex items-center gap-1.5 h-full py-[3px]">
             <div className="fl-button w-[14px] h-[14px]" onMouseDown={e => e.stopPropagation()} onClick={() => setActiveWindow(null)}>
                <div className="font-black text-[9px]">X</div>
             </div>
          </div>
       </div>

       <div className="p-3 bg-[var(--fl-panel-bg)] flex flex-col gap-4 text-[var(--fl-text-bright)]">
          {/* Header Track Select */}
          <div className="flex items-center gap-4 bg-[var(--fl-grid-dark)] p-2 border border-[var(--fl-border)] shadow-inner">
              <div className="w-[80px] h-10 bg-[#3F484E] border border-[var(--fl-border)] flex items-center justify-center font-bold shadow-[inset_1px_1px_2px_rgba(255,255,255,0.1)]">
                 {track.type.toUpperCase()}
              </div>
              <div className="flex flex-col">
                 <span className="font-bold text-lg text-white">{track.name}</span>
                 <span className="text-[10px] text-[var(--fl-green)] tracking-widest font-mono">TARGET: MASTER</span>
              </div>
          </div>

          {track.type === 'synth' && (
             <div className="fl-group-box p-3">
                 <div className="text-[10px] uppercase font-bold text-[var(--fl-text)] mb-2 border-b border-[var(--fl-border)] pb-1 tracking-widest">Oscillator Target</div>
                 <div className="flex gap-2">
                     {['sawtooth', 'square', 'triangle', 'sine'].map(type => (
                        <button 
                          key={type}
                          className={`flex-1 py-1.5 text-[10px] font-bold fl-button ${track.oscillatorType === type ? 'active text-[var(--fl-green)] shadow-[inset_1px_1px_5px_rgba(0,0,0,0.6)]' : ''}`}
                          onClick={() => isProducer && updateTrack(track.id, { oscillatorType: type as any })}
                        >
                           {type.toUpperCase().substring(0, 3)}
                        </button>
                     ))}
                 </div>
             </div>
          )}

          <div className="fl-group-box p-3 grid grid-cols-4 gap-2 text-center">
             <div className="col-span-4 text-left border-b border-[var(--fl-border)] pb-1 mb-2 text-[10px] font-bold tracking-widest text-[var(--fl-text)] uppercase">ENVELOPE</div>
             <Knob param="attack" trackId={track.id} label="ATT" min={0} max={2} />
             <Knob param="decay" trackId={track.id} label="DEC" min={0} max={2} />
             <Knob param="sustain" trackId={track.id} label="SUS" min={0} max={1} />
             <Knob param="release" trackId={track.id} label="REL" min={0} max={4} />
          </div>
       </div>
    </div>
  );
}
