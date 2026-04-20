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

  const handleCreate = async () => {
    if (!username) return;
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    await import('../audio/AudioEngine').then(m => m.engine.init());
    setLobbyState({ roomId: newRoomId, username, role: 'host' });
    socket.emit('join_room', { roomId: newRoomId, role: 'host', username });
    navigate(`/room/${newRoomId}`);
  };

  const handleJoin = async (targetRoomId: string, targetRole?: Role) => {
    const finalRole = targetRole || role;
    if (!targetRoomId || !username || !finalRole) return;
    await import('../audio/AudioEngine').then(m => m.engine.init());
    setLobbyState({ roomId: targetRoomId, username, role: finalRole });
    socket.emit('join_room', { roomId: targetRoomId, role: finalRole, username });
    navigate(`/room/${targetRoomId}`);
  };

  if (!aliasSaved) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]" 
             style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
            <Activity className="w-12 h-12 text-[#FF7D2E] mb-6" />
            <h1 className="text-2xl font-black italic tracking-tighter mb-1 text-white">BEAT BATTLE</h1>
            <p className="text-[#8f969b] text-[10px] font-bold tracking-[0.2em] uppercase mb-12 text-center">Global Studio Session</p>
            
            <form onSubmit={handleSaveAlias} className="w-full flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-bold text-[#8f969b] uppercase tracking-widest px-1">Producer Alias</label>
                   <div className="relative">
                     <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8f969b]" />
                     <input 
                        type="text" 
                        value={username}
                        onChange={e => setUsernameInput(e.target.value)}
                        placeholder="ENTER ALIAS"
                        className="w-full bg-[#13161a] border border-[#23272d] rounded-sm px-12 py-3 text-white text-sm font-bold tracking-wider placeholder:text-[#41474d] focus:outline-none focus:border-[#FF7D2E] transition-colors"
                        autoFocus
                        maxLength={16}
                     />
                   </div>
                </div>
                <button 
                  disabled={username.trim().length < 2}
                  type="submit"
                  className="w-full py-4 rounded-sm bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-[#FF7D2E] hover:text-white transition-all disabled:opacity-20 disabled:hover:bg-white disabled:hover:text-black mt-4 shadow-sm"
                >
                  Connect
                </button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center p-6 lg:p-12 font-sans selection:bg-[#4A5661]/50">
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6 relative z-10 items-stretch">
        
        {/* Left Column: Actions */}
        <div className="w-full md:w-[340px] flex flex-col gap-6 shrink-0">
            
            {/* Identity Card */}
            <div className="bg-[#131518] border border-[#212429] rounded-none p-5 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-[#FF7D2E]" />
               <p className="text-[9px] font-bold text-[#8f969b] tracking-widest uppercase mb-1">Authenticated As</p>
               <div className="flex items-end justify-between gap-4 mt-2">
                  <h2 className="text-xl font-black tracking-widest text-[#e8e9ea] truncate flex-1">{username}</h2>
                  <button onClick={() => setAliasSaved(false)} className="text-[10px] font-bold text-[#FF7D2E] uppercase hover:underline shrink-0">Edit</button>
               </div>
            </div>

            {/* Host Section */}
            <div className="bg-[#131518] border border-[#212429] rounded-none p-6 flex flex-col">
               <div className="flex items-center gap-3 mb-6 border-b border-[#212429] pb-4">
                  <Settings2 size={16} className="text-[#8f969b]" />
                  <h3 className="text-xs font-bold tracking-widest uppercase text-[#e8e9ea]">Session Config</h3>
               </div>
               
               <div className="flex flex-col gap-2 mb-8 mt-2">
                  <label className="text-[10px] font-bold text-[#8f969b] uppercase tracking-widest">Match Duration (Minutes)</label>
                  <input 
                     type="number"
                     min={1}
                     max={60}
                     value={matchDuration}
                     onChange={(e) => setLobbyState({ matchDuration: parseInt(e.target.value) || 10 })}
                     className="bg-[#0c0d0e] border border-[#212429] rounded-sm px-4 py-3 text-[#e8e9ea] font-mono text-lg focus:outline-none focus:border-[#FF7D2E] transition-colors"
                  />
               </div>

               <button 
                onClick={handleCreate}
                className="w-full py-4 bg-[#FF7D2E] text-black font-black text-xs uppercase tracking-[0.2em] hover:bg-white transition-colors"
               >
                 Host Match
               </button>
            </div>

            {/* Direct Connect */}
            <div className="bg-[#131518] border border-[#212429] rounded-none p-6 flex flex-col">
               <div className="flex items-center gap-3 mb-6 border-b border-[#212429] pb-4">
                  <Radio size={16} className="text-[#8f969b]" />
                  <h3 className="text-xs font-bold tracking-widest uppercase text-[#e8e9ea]">Direct Link</h3>
               </div>
               
               <div className="flex flex-col gap-2 mb-6 mt-2">
                  <label className="text-[10px] font-bold text-[#8f969b] uppercase tracking-widest">Room Code</label>
                  <input 
                     type="text" 
                     value={roomId}
                     onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                     className="w-full bg-[#0c0d0e] border border-[#212429] rounded-sm px-4 py-3 text-center text-[#64B7EE] font-mono font-black tracking-[0.3em] focus:outline-none focus:border-[#64B7EE] transition-colors uppercase"
                     placeholder="XXXXXX"
                     maxLength={8}
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-2 mb-6">
                  <button onClick={() => setRoleInput('producer')} className={`py-3 border text-[10px] font-bold tracking-widest uppercase transition-colors ${role === 'producer' ? 'bg-[#212429] border-[#e8e9ea] text-white' : 'bg-[#0c0d0e] border-[#212429] text-[#8f969b] hover:bg-[#131518]'}`}>Producer</button>
                  <button onClick={() => setRoleInput('judge')} className={`py-3 border text-[10px] font-bold tracking-widest uppercase transition-colors ${role === 'judge' ? 'bg-[#212429] border-[#e8e9ea] text-white' : 'bg-[#0c0d0e] border-[#212429] text-[#8f969b] hover:bg-[#131518]'}`}>Spectator</button>
               </div>

               <button 
                onClick={() => handleJoin(roomId)}
                disabled={!roomId || roomId.length < 3}
                className="w-full py-4 bg-[#e8e9ea] text-black font-black text-xs disabled:opacity-20 uppercase tracking-[0.2em] hover:bg-white transition-colors"
               >
                 Connect
               </button>
            </div>

        </div>

        {/* Right Column: Public Radar */}
        <div className="bg-[#131518] border border-[#212429] rounded-none flex flex-col flex-1 relative overflow-hidden min-h-[500px]">
           <div className="p-6 border-b border-[#212429] flex justify-between items-center bg-[#0c0d0e]/50">
              <div className="flex items-center gap-3">
                 <Activity className="w-5 h-5 text-[#64B7EE] animate-pulse" />
                 <span className="font-bold text-[#e8e9ea] tracking-[0.2em] uppercase text-sm">Public Encounters</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-[#64B7EE] animate-pulse" />
                 <span className="text-[10px] font-bold text-[#8f969b] tracking-widest uppercase">{publicRooms.length} Active</span>
              </div>
           </div>

           <div className="flex-1 overflow-auto p-6 space-y-3 custom-scrollbar bg-[#0c0d0e]/30">
               {publicRooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 text-[#8f969b]">
                      <RefreshCw className="w-8 h-8 mb-6 animate-spin-slow text-[#64B7EE]" />
                      <span className="text-xs font-bold tracking-[0.3em] uppercase">No Signals Detected</span>
                  </div>
               ) : (
                  publicRooms.map(room => (
                     <div key={room.id} className="group bg-[#0c0d0e] hover:bg-[#191b1f] border border-[#212429] p-5 flex flex-col sm:flex-row sm:items-center justify-between transition-colors gap-6 sm:gap-4 relative">
                         
                         <div className="flex items-center gap-6">
                            <div className="flex flex-col gap-1 w-24">
                               <span className="text-[9px] font-bold text-[#8f969b] tracking-widest uppercase">ID</span>
                               <span className="text-lg font-black text-[#e8e9ea] font-mono tracking-widest">{room.id}</span>
                            </div>
                            
                            <div className="w-[1px] h-8 bg-[#212429] hidden sm:block" />
                            
                            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                               <span className={`w-max text-[9px] px-2 py-0.5 rounded-sm uppercase font-black tracking-widest ${room.status === 'active' ? 'bg-[#FF7D2E]/10 text-[#FF7D2E]' : 'bg-[#7ae15a]/10 text-[#7ae15a]'}`}>
                                 {room.status}
                               </span>
                               <span className="text-[10px] font-bold text-[#8f969b] tracking-widest uppercase flex items-center gap-2">
                                 <Users className="w-3 h-3" /> {room.usersCount} Players
                               </span>
                            </div>
                         </div>

                         <div className="flex gap-3 shrink-0 sm:border-l sm:border-[#212429] sm:pl-6">
                            <button onClick={() => handleJoin(room.id, 'producer')} className="py-2.5 px-6 border border-[#212429] bg-[#e8e9ea] text-[10px] font-black text-black hover:bg-white uppercase tracking-widest transition-colors flex items-center gap-2">
                               <Play size={10}/> Join
                            </button>
                            <button onClick={() => handleJoin(room.id, 'judge')} className="py-2.5 px-5 border border-[#212429] bg-transparent text-[10px] font-black text-[#8f969b] hover:text-white hover:border-[#8f969b] uppercase tracking-widest transition-colors">
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
  );
}
