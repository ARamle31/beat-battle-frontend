import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../store/useLobbyStore';
import { useDawStore } from '../store/useDawStore';
import { socket, initSocket } from '../socket/socket';
import { MousePointer2, Volume2 } from 'lucide-react';
import ChannelSettings from '../components/ChannelSettings';
import PianoRoll from '../components/PianoRoll';
import FlToolbar from '../components/FlToolbar';
import Browser from '../components/Browser';
import ChannelRack from '../components/ChannelRack';
import { engine } from '../audio/AudioEngine';
import * as Tone from 'tone';

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, username, room, judgeWatching, setJudgeWatching } = useLobbyStore();
  const dawState = useDawStore();
  const [audioInited, setAudioInited] = useState(false);
  const isProducer = role === 'producer' || role === 'host';

  const [directJoinRole, setDirectJoinRole] = useState<'producer'|'judge'>('producer');
  const [directJoinUser, setDirectJoinUser] = useState('');
  const [cursors, setCursors] = useState<Record<string, {x: number, y: number}>>({});

  const pianoRollWindowRef = useRef<HTMLDivElement>(null);
  const pianoRollPosRef = useRef({ x: 60, y: 280, w: 900, h: 480, isMaximized: false, storedX: 60, storedY: 280, storedW: 900, storedH: 480 });
  // judgeWatching now globally managed via Zustand

  const handlePianoRollDrag = (e: React.MouseEvent) => {
     e.preventDefault();
     const startX = e.clientX;
     const startY = e.clientY;
     const initPos = { ...pianoRollPosRef.current };

     const handleMove = (eM: MouseEvent) => {
        pianoRollPosRef.current = {
           ...initPos,
           x: initPos.x + (eM.clientX - startX),
           y: initPos.y + (eM.clientY - startY),
        };
        if (pianoRollWindowRef.current) {
            pianoRollWindowRef.current.style.left = `${pianoRollPosRef.current.x}px`;
            pianoRollWindowRef.current.style.top = `${pianoRollPosRef.current.y}px`;
        }
     };
     const handleUp = () => { 
         window.removeEventListener('mousemove', handleMove); 
         window.removeEventListener('mouseup', handleUp); 
         if (isProducer) socket.emit('ui_interaction', { roomId: id, type: 'piano_roll_pos', value: pianoRollPosRef.current });
     };
     window.addEventListener('mousemove', handleMove);
     window.addEventListener('mouseup', handleUp);
  };

  const handlePianoRollResize = (e: React.MouseEvent) => {
     e.preventDefault();
     e.stopPropagation();
     const startX = e.clientX;
     const startY = e.clientY;
     const initW = pianoRollPosRef.current.w;
     const initH = pianoRollPosRef.current.h;

     const handleMove = (eM: MouseEvent) => {
        pianoRollPosRef.current = {
           ...pianoRollPosRef.current,
           w: Math.max(400, initW + (eM.clientX - startX)),
           h: Math.max(250, initH + (eM.clientY - startY)),
        };
        if (pianoRollWindowRef.current) {
            pianoRollWindowRef.current.style.width = `${pianoRollPosRef.current.w}px`;
            pianoRollWindowRef.current.style.height = `${pianoRollPosRef.current.h}px`;
        }
     };
     const handleUp = () => { 
         window.removeEventListener('mousemove', handleMove); 
         window.removeEventListener('mouseup', handleUp); 
         if (isProducer) socket.emit('ui_interaction', { roomId: id, type: 'piano_roll_pos', value: pianoRollPosRef.current });
     };
     window.addEventListener('mousemove', handleMove);
     window.addEventListener('mouseup', handleUp);
  };

  const toggleMaximize = (e: React.MouseEvent | null, forcedValue?: boolean) => {
     if (e) e.stopPropagation();
     const pos = pianoRollPosRef.current;
     const willMaximize = forcedValue !== undefined ? forcedValue : !pos.isMaximized;
     if (!willMaximize) {
         pianoRollPosRef.current = { ...pos, isMaximized: false };
         if (pianoRollWindowRef.current) {
             pianoRollWindowRef.current.style.width = `${pos.storedW}px`;
             pianoRollWindowRef.current.style.height = `${pos.storedH}px`;
             pianoRollWindowRef.current.style.left = `${pos.storedX}px`;
             pianoRollWindowRef.current.style.top = `${pos.storedY}px`;
             pianoRollWindowRef.current.style.right = 'auto';
             pianoRollWindowRef.current.style.bottom = 'auto';
         }
     } else {
        pianoRollPosRef.current = { 
           ...pos, isMaximized: true, storedX: pos.x, storedY: pos.y, storedW: pos.w, storedH: pos.h 
        };
        if (pianoRollWindowRef.current) {
            pianoRollWindowRef.current.style.width = 'auto';
            pianoRollWindowRef.current.style.height = 'auto';
            pianoRollWindowRef.current.style.left = '0px';
            pianoRollWindowRef.current.style.top = '0px';
            pianoRollWindowRef.current.style.right = '0px';
            pianoRollWindowRef.current.style.bottom = '0px';
        }
     }
     
     if (e && isProducer) {
         socket.emit('ui_interaction', { roomId: id, type: 'maximize_pianoroll', value: willMaximize });
     }
  };

  useEffect(() => {
    initSocket();
    if (!role || !username || !id) return;
    
    // Explicitly join room if we navigated here via direct URL with LocalStorage initialized
    if (!room) {
        useLobbyStore.getState().setLobbyState({ roomId: id });
        socket.emit('join_room', { roomId: id, role, username });
    }
    
    const handleJoinRejected = (data: any) => {
        alert(data.reason || 'Cannot join match.');
        useLobbyStore.getState().reset();
        navigate('/');
    };

    const handleCursorMove = (data: any) => {
       if (data.username === useLobbyStore.getState().username) return;
       setCursors(prev => ({ ...prev, [data.username]: { x: data.x, y: data.y } }));
    };
    
    // Bind socket persistence sync for Judges and recovering Producers
    const handleStateUpdate = (data: any) => {
        const isMe = useLobbyStore.getState().username === data.username;
        const currentRoom = useLobbyStore.getState().room;
        
        if (isMe && !(window as any).hasRestored) {
            (window as any).hasRestored = true;
            if (data.hasState && data.state) {
                data.state.isChannelRackOpen = true; 
                useDawStore.setState(data.state);
            }
            return;
        }

        const role = useLobbyStore.getState().role;
        const isShowcaseTarget = currentRoom?.status === 'voting' && currentRoom?.showcaseQueue?.[currentRoom.showcaseIndex || 0] === data.username;
        
        if (role === 'judge') {
            if (!(window as any).judgeMap) (window as any).judgeMap = {};
            if (data.hasState && data.state) (window as any).judgeMap[data.username] = data.state;
            const targetWatching = judgeWatching || data.username;
            if (!judgeWatching) setJudgeWatching(data.username);
            if (targetWatching === data.username) useDawStore.setState(data.state);
        } else if (isShowcaseTarget && !isMe) {
            // Lock all users into viewing the target
            if (data.hasState && data.state) {
                useDawStore.setState(data.state);
            }
        } else if (currentRoom?.mode === 'multiplayer' && !isMe) {
            if (data.hasState && data.state) {
                const localHistory = useDawStore.getState().history;
                const localFuture = useDawStore.getState().future;
                (window as any).isIncomingNetworkUpdate = true;
                useDawStore.setState({ ...data.state, history: localHistory, future: localFuture });
            }
        }
    };
    
    const handlePlayheadSync = (data: any) => {
        if (useLobbyStore.getState().role === 'judge') {
             const targetWatching = useLobbyStore.getState().judgeWatching;
             if (targetWatching === data.username) {
                  // Only sync if desynced by more than ~1/16th note (120 PPQ approx 100ms) to avoid jitter
                  if (Math.abs(Tone.Transport.ticks - data.ticks) > 50) {
                      engine.analyser?.context?.transport ? 
                           (engine.analyser.context.transport.ticks = data.ticks) : 
                           (Tone.Transport.ticks = data.ticks);
                  }
             }
        }
    };
    
    const handleUiInteraction = (data: any) => {
         const currentRoom = useLobbyStore.getState().room;
         const isMe = data.username === useLobbyStore.getState().username;
         if (isMe) return;

         let shouldApply = false;
         if (useLobbyStore.getState().role === 'judge') {
              const targetWatching = useLobbyStore.getState().judgeWatching;
              if (targetWatching === data.username) shouldApply = true;
         } else if (currentRoom?.mode === 'multiplayer') {
              shouldApply = true;
         }

         if (shouldApply) {
             if (data.type === 'maximize_pianoroll') {
                 toggleMaximize(null, data.value);
             }
             if (data.type === 'piano_roll_pos') {
                 pianoRollPosRef.current = { ...pianoRollPosRef.current, ...data.value };
                 if (pianoRollWindowRef.current) {
                     pianoRollWindowRef.current.style.left = `${data.value.x}px`;
                     pianoRollWindowRef.current.style.top = `${data.value.y}px`;
                     if (data.value.w) pianoRollWindowRef.current.style.width = `${data.value.w}px`;
                     if (data.value.h) pianoRollWindowRef.current.style.height = `${data.value.h}px`;
                 }
             }
         }
    };
    
    socket.on('producer_state_update', handleStateUpdate);
    socket.on('playhead_sync', handlePlayheadSync);
    socket.on('ui_interaction', handleUiInteraction);
    socket.on('cursor_move', handleCursorMove);
    socket.on('join_rejected', handleJoinRejected);
    return () => { 
        socket.off('producer_state_update', handleStateUpdate); 
        socket.off('playhead_sync', handlePlayheadSync);
        socket.off('ui_interaction', handleUiInteraction);
        socket.off('cursor_move', handleCursorMove);
        socket.off('join_rejected', handleJoinRejected);
    };
  }, [role, username, navigate, judgeWatching]);

  // Auto-spectate first producer if judge
  useEffect(() => {
     if (role === 'judge' && room?.users) {
        const producers = room.users.filter(u => u.role === 'producer' || u.role === 'host');
        if (producers.length > 0 && !judgeWatching) {
            setJudgeWatching(producers[0].username);
            if ((window as any).judgeMap?.[producers[0].username]) {
                useDawStore.setState((window as any).judgeMap[producers[0].username]);
            }
        }
     }
  }, [role, room?.users, judgeWatching, setJudgeWatching]);

  // Bind outgoing daw_state_update
  useEffect(() => {
    if (!isProducer || !id) return;
    return useDawStore.subscribe((state, prevState) => {
       // Filter out playhead position from causing massive web socket floods
       if (state.playheadPosition !== prevState.playheadPosition && Object.keys(state).length === 1) return;
       if ((window as any).isIncomingNetworkUpdate) {
           (window as any).isIncomingNetworkUpdate = false;
           return;
       }
       socket.emit('daw_state_update', { roomId: id, state });
    });
  }, [isProducer, id]);

  // Global Keybinds
  useEffect(() => {
     const handleKeyDown = async (e: KeyboardEvent) => {
        if (e.code === 'Space' && e.target === document.body) {
           e.preventDefault();
           if (!audioInited) {
             await engine.init();
             setAudioInited(true);
           }
           useDawStore.getState().setIsPlaying(!useDawStore.getState().isPlaying);
        }

        if (useLobbyStore.getState().role === 'judge' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
           const currentRoom = useLobbyStore.getState().room;
           if (!currentRoom) return;
           const validUsers = currentRoom.users.filter(u => u.role === 'producer' || u.role === 'host');
           const idx = validUsers.findIndex(u => u.username === useLobbyStore.getState().judgeWatching);
           let nextIdx = idx;
           
           if (e.code === 'ArrowRight') nextIdx = (idx + 1) % validUsers.length;
           if (e.code === 'ArrowLeft') nextIdx = idx <= 0 ? validUsers.length - 1 : idx - 1;
           
           const nextUser = validUsers[nextIdx];
           if (nextUser) {
               useLobbyStore.getState().setJudgeWatching(nextUser.username);
               import('../socket/socket').then(({ socket }) => socket.emit('request_state_sync', { roomId: id, targetUsername: nextUser.username }));
           }
        }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioInited]);

  const handleStartMatch = () => {
    if (role === 'host' && id) socket.emit('start_match', { roomId: id, duration: useLobbyStore.getState().matchDuration });
  };

  const handleSyncAudio = async () => {
    if (!audioInited) {
      await engine.init();
      setAudioInited(true);
    }
  };

  if (!role || !username) return (
     <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center p-6 text-white font-sans">
       <div className="bg-[#15171c] p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6 w-full max-w-sm">
         <h2 className="text-2xl font-black text-center tracking-widest text-[#64B7EE] drop-shadow-[0_0_5px_#64B7EE]">JOIN ROOM {id}</h2>
         <input 
            type="text" 
            className="w-full bg-[#0c0d10] border border-white/5 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#64B7EE]/50 transition-all placeholder:text-slate-700" 
            placeholder="Username" 
            value={directJoinUser}
            onChange={e => setDirectJoinUser(e.target.value)} 
         />
         <div className="grid grid-cols-2 gap-3">
             <button className={`py-3 rounded-xl border-2 font-black text-xs transition-all ${directJoinRole === 'producer' ? 'bg-[#3b82f6] border-[#3b82f6] text-white' : 'bg-[#15171c] border-white/5 text-slate-500 hover:border-white/10'}`} onClick={() => setDirectJoinRole('producer')}>PRODUCER</button>
             <button className={`py-3 rounded-xl border-2 font-black text-xs transition-all ${directJoinRole === 'judge' ? 'bg-[#3b82f6] border-[#3b82f6] text-white' : 'bg-[#15171c] border-white/5 text-slate-500 hover:border-white/10'}`} onClick={() => setDirectJoinRole('judge')}>JUDGE</button>
         </div>
         <button 
           disabled={!directJoinUser}
           onClick={async () => {
              await import('../audio/AudioEngine').then(m => m.engine.init());
              setAudioInited(true);
              useLobbyStore.getState().setLobbyState({ roomId: id, username: directJoinUser, role: directJoinRole });
              socket.emit('join_room', { roomId: id, role: directJoinRole, username: directJoinUser });
           }} 
           className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-slate-200 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
         >
           JOIN MATCH
         </button>
       </div>
     </div>
  );

  if (!room) return <div className="min-h-screen bg-[var(--fl-bg-dark)] text-slate-400 flex items-center justify-center font-mono tracking-widest">INITIALIZING_SESSION...</div>;

  const isMatchActive = room.status === 'active';

  return (
    <div className="h-screen w-screen flex flex-col font-sans select-none text-[11px] animation-fade-in" style={{ backgroundColor: 'var(--fl-bg-dark)' }}>
      {/* FL Studio Top Toolbar */}
      <FlToolbar audioInited={audioInited} setAudioInited={setAudioInited} />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side Browser */}
        <Browser />

        {/* Desktop Surface */}
        <div 
           className="flex-1 relative overflow-hidden bg-[var(--fl-bg-dark)]"
           onMouseMove={(e) => {
               if (role !== 'producer' && role !== 'host') return;
               const rect = e.currentTarget.getBoundingClientRect();
               const t = Date.now();
               if ((window as any).lastCursorEmit && t - (window as any).lastCursorEmit < 20) return;
               (window as any).lastCursorEmit = t;
               const xPct = ((e.clientX - rect.left) / rect.width) * 100;
               const yPct = ((e.clientY - rect.top) / rect.height) * 100;
               socket.emit('cursor_move', { roomId: id, username, x: xPct, y: yPct });
           }}
        >
           
           {Object.entries(cursors).map(([uname, pos]) => (
               <div key={uname} className="absolute pointer-events-none z-[9999]" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transition: 'all 0.05s linear' }}>
                  <svg className="w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" viewBox="0 0 24 24" fill="currentColor" stroke="black" strokeWidth="1.5" style={{ transform: 'rotate(-25deg)', transformOrigin: 'top left' }}>
                     <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42a.5.5 0 0 0 .35-.85L5.5 3.21Z" />
                  </svg>
                  <div className="absolute top-5 left-3 bg-[#FF7D2E] text-black text-[10px] font-black px-1.5 py-0.5 rounded-sm whitespace-nowrap shadow-xl border border-black/20 uppercase tracking-widest">{uname}</div>
               </div>
           ))}

           {role === 'judge' && (
              <div 
                 className="absolute inset-0 z-[300] cursor-not-allowed pointer-events-auto" 
                 title="Judges have view-only access"
                 onContextMenu={(e) => e.preventDefault()}
                 onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                 onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                 onMouseUp={(e) => { e.preventDefault(); e.stopPropagation(); }}
              />
           )}
           
           {/* Authentic Desktop Background Textures */}
           <div className="absolute inset-0 pointer-events-none opacity-5" 
                style={{ backgroundImage: 'linear-gradient(var(--fl-border) 1px, transparent 1px), linear-gradient(90deg, var(--fl-border) 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
           
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
              <h1 className="text-[140px] font-black italic tracking-tighter text-white drop-shadow-2xl">FL STUDIO</h1>
           </div>

           {/* Cursors */}
           {Object.entries(cursors).map(([uName, pos]) => {
                const isActiveTarget = room?.showcaseQueue?.[room.showcaseIndex || 0] === uName || judgeWatching === uName;
                if (!isActiveTarget && role === 'judge') return null;
                
                return (
                   <div key={uName} className="absolute z-[600] pointer-events-none transition-all duration-75 ease-linear" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
                      <MousePointer2 className="w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] fill-white -ml-1 -mt-1" />
                      <div className="bg-[#ff7d2e] text-black font-black uppercase text-[9px] px-1.5 py-0.5 rounded-sm shadow-md translate-y-1">
                         {uName}
                      </div>
                   </div>
                );
            })}

           {/* Overlays */}
           {role === 'judge' && room.users.some(u => u.role !== 'judge') && (
               <>
                   {/* Spectating Indicator */}
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center pointer-events-none bg-black/60 px-8 py-3 rounded-2xl backdrop-blur-md border border-[var(--fl-border)] shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                      <div className="text-[#ff7d2e] font-black text-2xl tracking-widest textShadow animate-pulse">
                          SPECTATING: {judgeWatching}
                      </div>
                      <div className="text-white/50 font-bold tracking-widest uppercase text-[10px]">
                          Read-only Mode
                      </div>
                   </div>

                   {/* Navigation Arrows */}
                   <div className="absolute inset-y-0 left-4 px-2 flex items-center z-[110]">
                       <button 
                           className="bg-black/40 hover:bg-[#ff7d2e] text-white p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:border-white transition-all shadow-xl hover:scale-110 flex items-center justify-center opacity-70 hover:opacity-100"
                           onClick={() => {
                               const validUsers = room.users.filter(u => u.role === 'producer' || u.role === 'host');
                               const idx = validUsers.findIndex(u => u.username === judgeWatching);
                               const nextIdx = idx <= 0 ? validUsers.length - 1 : idx - 1;
                               const nextUser = validUsers[nextIdx];
                               if (nextUser) {
                                   setJudgeWatching(nextUser.username);
                                   import('../socket/socket').then(({ socket }) => socket.emit('request_state_sync', { roomId: id, targetUsername: nextUser.username }));
                               }
                           }}
                       >
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                       </button>
                   </div>
                   
                   <div className="absolute inset-y-0 right-4 px-2 flex items-center z-[110]">
                       <button 
                           className="bg-black/40 hover:bg-[#ff7d2e] text-white p-3 rounded-xl backdrop-blur-sm border border-white/10 hover:border-white transition-all shadow-xl hover:scale-110 flex items-center justify-center opacity-70 hover:opacity-100"
                           onClick={() => {
                               const validUsers = room.users.filter(u => u.role === 'producer' || u.role === 'host');
                               const idx = validUsers.findIndex(u => u.username === judgeWatching);
                               const nextIdx = (idx + 1) % validUsers.length;
                               const nextUser = validUsers[nextIdx];
                               if (nextUser) {
                                   setJudgeWatching(nextUser.username);
                                   import('../socket/socket').then(({ socket }) => socket.emit('request_state_sync', { roomId: id, targetUsername: nextUser.username }));
                               }
                           }}
                       >
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                       </button>
                   </div>
               </>
           )}

           {(!isMatchActive && room.status === 'waiting') && (
             <div className="absolute inset-0 z-[100] bg-[#0c0d10]/95 backdrop-blur-xl flex flex-col items-center justify-center p-12 animation-fade-in">
               
               <div className="flex flex-col items-center max-w-4xl w-full">
                  <div className="inline-flex items-center gap-2 bg-[#15171c] border border-white/5 px-4 py-1.5 rounded-full mb-6">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Match Lobby</span>
                  </div>
                  
                  <h1 className="text-6xl font-black text-white tracking-tighter text-center mb-2 drop-shadow-2xl">
                     AWAITING <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">PLAYERS</span>
                  </h1>
                  <p className="text-slate-500 font-bold mb-12 tracking-widest uppercase text-sm">Room Code: <span className="text-white bg-white/10 px-2 py-0.5 rounded ml-2">{id}</span></p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-12">
                     {room.users.map((u, i) => (
                        <div key={u.id + i} className="bg-[#15171c] hover:bg-[#1a1d24] transition-all border border-white/5 rounded-3xl p-6 flex flex-col items-center gap-4 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                           <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1a1d24] to-[#0c0d10] border-2 border-white/10 flex items-center justify-center shadow-2xl relative">
                              {u.role === 'host' && <div className="absolute -top-2 bg-yellow-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Host</div>}
                              {u.role === 'judge' ? <Volume2 className="w-6 h-6 text-slate-400" /> : <div className="w-6 h-6 rounded-sm bg-blue-500/20 border border-blue-400" />}
                           </div>
                           <div className="text-center">
                              <div className="text-white font-black text-lg truncate max-w-[120px]">{u.username}</div>
                              <div className={`text-[10px] font-bold uppercase tracking-widest ${u.role === 'judge' ? 'text-slate-500' : 'text-blue-400'}`}>{u.role}</div>
                           </div>
                        </div>
                     ))}
                  </div>

                  {role === 'host' ? (
                     <div className="flex flex-col items-center gap-3">
                         <button onClick={handleStartMatch} className="group relative bg-[#0c0d10] text-white hover:text-blue-300 font-black text-2xl uppercase tracking-[0.2em] px-16 py-6 rounded-full border border-white/10 transition-all hover:bg-white/5 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <span className="relative z-10 flex items-center gap-4">Start Battle <span className="text-blue-500">&rarr;</span></span>
                         </button>
                         <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">
                            MATCH DURATION: <span className="text-[#FF7D2E]">{useLobbyStore.getState().matchDuration} MINUTES</span>
                         </span>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-white/5 border-t-white/50 rounded-full animate-spin" />
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Waiting for host</span>
                     </div>
                  )}
               </div>
             </div>
           )}

           {room.status === 'voting' && (
               <div className="absolute top-[80px] left-1/2 -translate-x-1/2 z-[100] bg-black/80 backdrop-blur-md border-[2px] border-[var(--fl-green)] p-4 rounded text-center shadow-[0_0_30px_rgba(141,204,108,0.3)]">
                   <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Showcase Mode</div>
                   <div className="text-2xl font-black font-mono text-[var(--fl-green)] uppercase tracking-wider mb-2">
                       Now Playing: <span className="text-white">{room.showcaseQueue?.[room.showcaseIndex || 0]}</span>
                   </div>
                   {room.showcaseQueue?.[room.showcaseIndex || 0] === useLobbyStore.getState().username && (
                       <button className="fl-button px-6 py-2 mt-2 font-black uppercase text-sm animate-pulse shadow-[0_0_15px_var(--fl-green)]"
                               onClick={(e) => { 
                                    e.stopPropagation();
                                    import('../socket/socket').then(({ socket }) => socket.emit('end_showcase_turn', { roomId: id, username })); 
                               }}>
                           End My Turn
                       </button>
                   )}
               </div>
           )}

           {room.status === 'awarded' && (
               <div className="absolute inset-0 z-[200] bg-[#1a1e22]/95 backdrop-blur-xl flex flex-col items-center justify-center">
                   <div className="bg-[#242A2E] border border-[var(--fl-border)] p-12 text-center rounded-xl shadow-[0_0_100px_rgba(255,125,46,0.3)] max-w-3xl w-full">
                       <h2 className="text-5xl font-black text-[#ff7d2e] uppercase tracking-widest mb-4">🏆 Voting Phase</h2>
                       <p className="text-gray-400 font-bold text-lg mb-8">Select the producer with the best beat.</p>
                       
                       <div className="flex gap-4 justify-center mb-8 flex-wrap">
                           {room.showcaseQueue?.map(prod => {
                               const vCount = Object.values(room.votes || {}).filter(v => v === prod).length;
                               const hasVoted = !!room.votes?.[useLobbyStore.getState().username];
                               return (
                                   <div key={prod} className="flex flex-col items-center gap-3">
                                       <button 
                                          className={`px-8 py-6 rounded border-2 transition-all font-black text-2xl uppercase tracking-widest ${room.votes?.[useLobbyStore.getState().username] === prod ? 'border-green-500 bg-green-500/20 text-white shadow-[0_0_20px_green]' : 'border-[#445] bg-[#111] text-gray-300 hover:border-[#ff7d2e] hover:text-[#ff7d2e]'}`}
                                          disabled={hasVoted}
                                          onClick={() => import('../socket/socket').then(({ socket }) => socket.emit('submit_vote', { roomId: id, fromUsername: useLobbyStore.getState().username, forUsername: prod }))}
                                       >
                                           {prod}
                                       </button>
                                       <span className="text-4xl font-black text-white">{vCount}</span>
                                   </div>
                               );
                           })}
                       </div>

                       <div className="mt-8 border-t border-[#333] pt-8">
                           <button className="text-sm font-bold text-gray-500 hover:text-white transition-colors" onClick={() => window.location.href = '/'}>LEAVE MATCH</button>
                       </div>
                   </div>
               </div>
           )}

           {/* FL Studio Windows */}
           <div className="absolute inset-0 z-0" style={{ pointerEvents: role === 'judge' ? 'none' : 'auto' }}>
               <ChannelRack />
               <ChannelSettings />

               <div ref={pianoRollWindowRef} className={`absolute fl-window flex flex-col ${role === 'judge' ? 'pointer-events-none' : 'pointer-events-auto'}`} style={{ zIndex: 5, left: pianoRollPosRef.current.x, top: pianoRollPosRef.current.y, width: pianoRollPosRef.current.w, height: pianoRollPosRef.current.h }}>
                  {/* Piano Roll Window Header */}
                  <div className="fl-window-header h-[22px] px-2 flex justify-between items-center text-[11px] font-bold tracking-tight cursor-default" onMouseDown={handlePianoRollDrag} onDoubleClick={(e) => toggleMaximize(e)}>
                     <div className="flex items-center gap-2 pointer-events-none">
                        <span className="text-[#7ae15a] scale-110">≣</span> Piano roll - {dawState.tracks.find(t => t.id === dawState.selectedTrackId)?.name || 'Sampler'}
                     </div>
                     <div className="flex items-center gap-1.5 h-full py-[3px]">
                       <div className="w-[1px] h-full bg-[#1a1e22] border-r border-[#50585d] mx-1 mr-2" />
                       <div className="w-[14px] h-[14px] bg-[#4f585d] border border-[#1a1e22] rounded-[1px] flex justify-center items-center cursor-pointer hover:bg-[#606a6e] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.2)]" onMouseDown={(e) => e.stopPropagation()}><div className="w-1.5 h-[1.5px] bg-white"/></div>
                       <div className="w-[14px] h-[14px] bg-[#4f585d] border border-[#1a1e22] rounded-[1px] flex justify-center items-center cursor-pointer hover:bg-[#606a6e] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.2)]" onMouseDown={(e) => toggleMaximize(e)}><div className="w-[6px] h-[6px] border border-white"/></div>
                       <div className="w-[14px] h-[14px] bg-[#4f585d] border border-[#1a1e22] rounded-[1px] flex justify-center items-center cursor-pointer hover:bg-[#606a6e] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.2)] font-black text-[9px] text-white" onMouseDown={(e) => e.stopPropagation()}>X</div>
                     </div>
                  </div>
                  
                  {/* Piano Roll content */}
                  <div className="flex-1 overflow-hidden relative flex flex-col bg-[#353b3f]">
                     <PianoRoll />
                  </div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-50 flex items-end justify-end p-[4px] opacity-70 hover:opacity-100" onMouseDown={handlePianoRollResize}>
                       <div className="w-2.5 h-2.5 border-r-[2px] border-b-[2px] border-[#a0aab0]" />
                  </div>
               </div>
           </div>

        </div>
      </div>
    </div>
  );
}
