import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../store/useLobbyStore';
import type { Role } from '../store/useLobbyStore';
import { socket, initSocket } from '../socket/socket';
import { 
  Activity, Users, RefreshCw, Plus, Play, Radio, Fingerprint, Settings2
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { setLobbyState, publicRooms, matchDuration } = useLobbyStore();
  
  const [roomId, setRoomIdInput] = useState('');
  const [username, setUsernameInput] = useState(localStorage.getItem('beatBattleAlias') || '');
  const [aliasSaved, setAliasSaved] = useState(!!localStorage.getItem('beatBattleAlias'));
  const [role, setRoleInput] = useState<Role>('producer');

  useEffect(() => {
    initSocket();
  }, []);

  const handleSaveAlias = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (username.trim().length > 1) {
      localStorage.setItem('beatBattleAlias', username.trim());
      setAliasSaved(true);
    }
  };

  const [isConnecting, setIsConnecting] = useState(false);

  const handleCreate = async () => {
    if (!username) return;
    setIsConnecting(true);
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    await import('../audio/AudioEngine').then(m => m.engine.init());
    setLobbyState({ roomId: newRoomId, username, role: 'host' });
    socket.emit('join_room', { roomId: newRoomId, role: 'host', username });
    setTimeout(() => navigate(`/room/${newRoomId}`), 400);
  };

  const handleJoin = async (targetRoomId: string, targetRole?: Role) => {
    const finalRole = targetRole || role;
    if (!targetRoomId || !username || !finalRole) return;
    setIsConnecting(true);
    await import('../audio/AudioEngine').then(m => m.engine.init());
    setLobbyState({ roomId: targetRoomId, username, role: finalRole });
    socket.emit('join_room', { roomId: targetRoomId, role: finalRole, username });
    setTimeout(() => navigate(`/room/${targetRoomId}`), 400);
  };

  const [showBoot, setShowBoot] = useState(!sessionStorage.getItem('ps2_boot_shown'));

  useEffect(() => {
    if (showBoot) {
      sessionStorage.setItem('ps2_boot_shown', '1');
      const timer = setTimeout(() => setShowBoot(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showBoot]);

  if (showBoot) {
    return (
      <div className="fixed inset-0 bg-[#0c0d10] z-[9999] flex flex-col items-center justify-center font-sans">
         <div className="animate-studio-boot flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border-4 border-white border-t-transparent animate-spin opacity-20" />
            <h1 className="text-white text-3xl font-black tracking-[0.5em] uppercase">BEAT BATTLE</h1>
            <h2 className="text-white/40 text-xs font-bold tracking-[0.3em] uppercase">Audio Session Initialization</h2>
         </div>
      </div>
    );
  }

  const ConnectingOverlay = () => isConnecting ? (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animation-fade-in">
       <div className="flex items-center gap-4 text-white">
          <div className="w-6 h-6 border-2 border-[#64B7EE] border-t-transparent rounded-full animate-spin" />
          <span className="font-bold tracking-widest text-[#64B7EE] uppercase">Syncing to Host...</span>
       </div>
    </div>
  ) : null;

  if (!aliasSaved) {
    return (
      <>
        <ConnectingOverlay />
        <div className="min-h-screen ps2-bg text-white flex flex-col items-center justify-center p-6 relative font-sans animate-ps2-menu">
        <div className="relative z-10 w-full max-w-sm flex flex-col items-center ps2-crystalline p-10 rounded shadow-2xl">
            <div className="w-16 h-16 border-2 border-[#64B7EE] rounded flex items-center justify-center mb-6 ps2-text-glow bg-black/30">
               <Fingerprint className="w-8 h-8 text-[#64B7EE]" />
            </div>
            <h1 className="text-3xl font-black italic tracking-widest mb-1 text-white ps2-text-glow">MEMORY CARD</h1>
            <p className="text-[#8ea1ab] text-[10px] font-bold tracking-[0.2em] uppercase mb-12 text-center">Format New Audio Producer</p>
            
            <form onSubmit={handleSaveAlias} className="w-full flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold text-[#8ea1ab] uppercase tracking-widest">Input Alias</label>
                   <input 
                      type="text" 
                      value={username}
                      onChange={e => setUsernameInput(e.target.value)}
                      className="w-full bg-black/50 border border-[#8ea1ab] rounded-sm px-4 py-4 text-white text-xl font-black tracking-widest focus:outline-none focus:border-[#64B7EE] transition-colors text-center shadow-inner uppercase"
                      autoFocus
                      maxLength={16}
                   />
                </div>
                <button 
                  disabled={username.trim().length < 2}
                  type="submit"
                  className="ps2-button w-full py-4 text-sm font-black uppercase tracking-[0.2em] mt-4"
                >
                  Save Data
                </button>
            </form>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <ConnectingOverlay />
      <div className="min-h-screen ps2-bg text-white flex flex-col items-center justify-center p-6 lg:p-12 font-sans animate-ps2-menu selection:bg-[#4A5661]/50">
      
      {/* Decorative Floating Grid Blocks */}
      <div className="absolute top-10 left-10 w-32 h-32 border border-[#64B7EE]/20 bg-[#64B7EE]/5 transform rotate-45 blur-sm" />
      <div className="absolute bottom-10 right-10 w-64 h-64 border border-[#64B7EE]/20 bg-[#64B7EE]/5 transform -rotate-12 blur-md" />

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8 relative z-10 items-stretch">
        
        {/* Left Column: Actions */}
        <div className="w-full md:w-[340px] flex flex-col gap-6 shrink-0">
            
            {/* Identity Card */}
            <div className="ps2-crystalline p-6 relative flex gap-4 items-center">
               <div className="w-12 h-16 bg-black/40 border border-[#CBDCE6] shadow-inner flex flex-col items-center py-2 shrink-0">
                  <div className="w-8 h-2 bg-[#CBDCE6]" />
                  <div className="flex-1" />
                  <div className="w-4 h-1 bg-[#8ea1ab] rounded-full mb-1" />
               </div>
               <div className="flex flex-col flex-1 truncate">
                  <p className="text-[10px] font-bold text-[#8ea1ab] tracking-widest uppercase">System User</p>
                  <h2 className="text-xl font-black tracking-widest text-white truncate ps2-text-glow">{username}</h2>
                  <button onClick={() => setAliasSaved(false)} className="text-[10px] font-bold text-[#64B7EE] uppercase hover:underline mt-1 text-left w-max">Unplug Card</button>
               </div>
            </div>

            {/* Host Section */}
            <div className="ps2-crystalline p-6 flex flex-col">
               <div className="flex items-center gap-3 mb-6 border-b border-[#8ea1ab]/30 pb-4">
                  <Settings2 size={18} className="text-[#64B7EE]" />
                  <h3 className="text-sm font-bold tracking-widest uppercase text-white ps2-text-glow">Create Battle</h3>
               </div>
               
               <div className="flex justify-between items-center mb-8 bg-black/30 p-4 border border-[#8ea1ab]/20">
                  <span className="text-xs font-bold text-[#8ea1ab] uppercase tracking-widest">Time Limit</span>
                  <div className="flex items-center gap-3">
                      <input 
                         type="number"
                         min={1}
                         max={60}
                         value={matchDuration}
                         onChange={(e) => setLobbyState({ matchDuration: parseInt(e.target.value) || 10 })}
                         className="bg-black border border-[#8ea1ab] w-12 py-1 text-center text-white font-mono text-lg focus:outline-none focus:border-[#64B7EE]"
                      />
                      <span className="text-[10px] font-bold text-[#8ea1ab] uppercase">Min</span>
                  </div>
               </div>

               <button onClick={handleCreate} className="ps2-button w-full py-4 text-xs font-black uppercase tracking-[0.2em]">
                 Initialize Match
               </button>
            </div>

            {/* Direct Connect */}
            <div className="ps2-crystalline p-6 flex flex-col">
               <div className="flex items-center gap-3 mb-6 border-b border-[#8ea1ab]/30 pb-4">
                  <Radio size={18} className="text-[#64B7EE]" />
                  <h3 className="text-sm font-bold tracking-widest uppercase text-white ps2-text-glow">System Link</h3>
               </div>
               
               <div className="flex flex-col gap-2 mb-6">
                  <label className="text-[10px] font-bold text-[#8ea1ab] uppercase tracking-widest">Target IP / Code</label>
                  <input 
                     type="text" 
                     value={roomId}
                     onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                     className="w-full bg-black/60 border border-[#8ea1ab] px-4 py-3 text-center text-white font-mono text-xl tracking-[0.3em] focus:outline-none focus:border-[#64B7EE] transition-colors uppercase shadow-inner"
                     placeholder="------"
                     maxLength={8}
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-2 mb-6">
                  <button onClick={() => setRoleInput('producer')} className={`ps2-button py-3 text-[10px] font-black tracking-widest uppercase ${role === 'producer' ? 'bg-[#cbdce6] border-[#2f3539]' : 'opacity-70'}`}>Producer</button>
                  <button onClick={() => setRoleInput('judge')} className={`ps2-button py-3 text-[10px] font-black tracking-widest uppercase ${role === 'judge' ? 'bg-[#cbdce6] border-[#2f3539]' : 'opacity-70'}`}>Spectator</button>
               </div>

               <button 
                onClick={() => handleJoin(roomId)}
                disabled={!roomId || roomId.length < 3}
                className="ps2-button w-full py-4 text-xs font-black uppercase tracking-[0.2em] disabled:opacity-50"
               >
                 Connect
               </button>
            </div>

        </div>

        {/* Right Column: Public Radar */}
        <div className="ps2-crystalline flex flex-col flex-1 relative min-h-[500px]">
           <div className="p-6 border-b border-[#8ea1ab]/30 flex justify-between items-center bg-black/20">
              <div className="flex items-center gap-3">
                 <Activity className="w-5 h-5 text-[#64B7EE] animate-pulse" />
                 <span className="font-black text-white px-2 tracking-[0.2em] uppercase text-lg ps2-text-glow">Browser</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-black/40 border border-[#8ea1ab]/50">
                 <span className="w-2 h-2 rounded-full bg-[#64B7EE] animate-pulse shadow-[0_0_8px_#64B7EE]" />
                 <span className="text-[10px] font-bold text-[#cbdce6] tracking-widest uppercase">{publicRooms.length} Online</span>
              </div>
           </div>

           <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
               {publicRooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-60 text-white">
                      <RefreshCw className="w-12 h-12 mb-6 animate-spin text-[#64B7EE]" />
                      <span className="text-sm font-bold tracking-[0.3em] uppercase ps2-text-glow">Scanning Network...</span>
                  </div>
               ) : (
                  publicRooms.map(room => (
                     <div key={room.id} className="bg-black/40 hover:bg-black/60 border border-[#8ea1ab] p-4 flex flex-col sm:flex-row sm:items-center justify-between transition-colors gap-6 sm:gap-4 group">
                         
                         <div className="flex items-center gap-6">
                            <div className="flex flex-col gap-1 w-24">
                               <span className="text-[9px] font-bold text-[#8ea1ab] tracking-widest uppercase">Room ID</span>
                               <span className="text-xl font-black text-white font-mono tracking-widest ps2-text-glow group-hover:text-[#64B7EE] transition-colors">{room.id}</span>
                            </div>
                            
                            <div className="w-[2px] h-10 bg-[#8ea1ab]/30 hidden sm:block" />
                            
                            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                               <span className={`w-max text-[10px] px-2 py-0.5 border uppercase font-black tracking-widest ${room.status === 'active' ? 'border-[#FF7D2E] text-[#FF7D2E] bg-[#FF7D2E]/10' : 'border-[#64B7EE] text-[#64B7EE] bg-[#64B7EE]/10'}`}>
                                 {room.status}
                               </span>
                               <span className="text-[10px] font-bold text-[#e8e9ea] tracking-widest uppercase flex items-center gap-2">
                                 <Users className="w-3 h-3 text-[#64B7EE]" /> {room.usersCount} Players
                               </span>
                            </div>
                         </div>

                         <div className="flex gap-3 shrink-0">
                            <button onClick={() => handleJoin(room.id, 'producer')} className="ps2-button py-2.5 px-6 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                               <Play size={12}/> Join
                            </button>
                            <button onClick={() => handleJoin(room.id, 'judge')} className="border-2 border-[#8ea1ab] bg-transparent text-white py-2.5 px-4 text-[10px] font-black uppercase tracking-widest hover:bg-[#8ea1ab] hover:text-black transition-colors">
                               Spectate
                            </button>
                         </div>
                     </div>
                  ))
               )}
           </div>
        </div>

      </div>
    </div>
    </>
  );
}
