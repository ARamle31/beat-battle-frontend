import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../store/useLobbyStore';
import type { Role } from '../store/useLobbyStore';
import { socket, initSocket } from '../socket/socket';
import { 
  Activity, Users, Play, Radio, Fingerprint, Settings2
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { setLobbyState, publicRooms, matchDuration, matchMode } = useLobbyStore();
  
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
    socket.emit('join_room', { roomId: newRoomId, role: 'host', username, mode: matchMode });
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
        <div className="min-h-screen bg-[#060709] text-white flex flex-col items-center justify-center p-6 relative font-sans animation-fade-in overflow-hidden">
        <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
            
            <div className="flex items-center justify-center space-x-3 mb-10">
               <div className="w-10 h-10 border border-white/10 rounded-xl flex items-center justify-center bg-white/5 backdrop-blur-md shadow-2xl">
                 <Fingerprint className="w-5 h-5 text-white/80" />
               </div>
               <h1 className="text-2xl font-black tracking-widest text-white">WORKSPACE</h1>
            </div>
            
            <form onSubmit={handleSaveAlias} className="w-full flex flex-col gap-6 bg-[#0E1015] border border-white/5 p-8 rounded-3xl shadow-2xl">
                <div className="flex flex-col gap-3">
                   <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Producer Alias</label>
                   <input 
                      type="text" 
                      value={username}
                      onChange={e => setUsernameInput(e.target.value)}
                      className="w-full bg-[#060709] border border-white/10 rounded-xl px-5 py-4 text-white text-lg font-bold tracking-wide focus:outline-none focus:border-[#64B7EE] focus:ring-1 focus:ring-[#64B7EE] transition-all"
                      placeholder="Enter your name"
                      autoFocus
                      maxLength={16}
                   />
                </div>
                <button 
                  disabled={username.trim().length < 2}
                  type="submit"
                  className="w-full py-4 text-xs font-black uppercase tracking-widest bg-white text-black rounded-xl hover:bg-[#64B7EE] hover:text-white transition-all disabled:opacity-20 disabled:hover:bg-white disabled:hover:text-black shadow-[0_0_20px_rgba(100,183,238,0)] hover:shadow-[0_0_20px_rgba(100,183,238,0.3)] mt-2"
                >
                  Enter Studio
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
      <div className="min-h-screen bg-[#060709] text-white flex flex-col items-center py-10 px-6 lg:px-12 font-sans animation-fade-in selection:bg-[#64B7EE]/30 relative overflow-hidden">
      
      {/* Top Navigation / App Bar */}
      <div className="w-full max-w-6xl flex items-center justify-between z-10 mb-10 pb-6 border-b border-white/5">
         <div className="flex items-center space-x-4">
            <div className="w-10 h-10 border border-white/5 lg:border-white/10 rounded-2xl flex items-center justify-center bg-white/5 backdrop-blur-md">
                 <Activity className="w-5 h-5 text-[#64B7EE]" />
            </div>
            <div>
               <h1 className="text-xl font-black tracking-widest text-white">BEAT BATTLE</h1>
               <p className="text-[10px] text-white/40 tracking-widest uppercase font-bold">Collaborative Audio Engine</p>
            </div>
         </div>
         
         <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end hidden lg:flex">
               <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">Logged in as</span>
               <span className="text-xs font-black text-white hover:text-[#64B7EE] cursor-pointer transition-colors" onClick={() => setAliasSaved(false)}>{username}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#64B7EE] to-indigo-600 border border-white/20 flex items-center justify-center font-bold text-sm shadow-xl">
               {username.charAt(0).toUpperCase()}
            </div>
         </div>
      </div>

      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 relative z-10 items-stretch">
        
        {/* Left Column: Actions */}
        <div className="w-full lg:w-[320px] flex flex-col gap-6 shrink-0">
            
            {/* Host Section */}
            <div className="bg-[#0E1015] border border-white/5 p-6 rounded-3xl flex flex-col shadow-2xl relative overflow-hidden group">
               <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#FF7D2E]/5 blur-3xl rounded-full transition-all group-hover:bg-[#FF7D2E]/10" />
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                     <Settings2 size={14} className="text-white/60" />
                  </div>
                  <h3 className="text-xs font-black tracking-widest uppercase text-white/90">Host Session</h3>
               </div>
               
               <div className="flex flex-col gap-2 mb-5">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Session Mode</span>
                  <div className="relative flex bg-[#060709] border border-white/5 rounded-2xl p-1.5 h-[52px]">
                      {/* Sliding Pill Background */}
                      <div 
                         className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-transform duration-300 ease-out shadow-lg ${matchMode === 'battle' ? 'translate-x-0 bg-gradient-to-br from-[#FF7D2E] to-[#E55D10]' : 'translate-x-[calc(100%+8px)] bg-gradient-to-br from-[#64B7EE] to-[#3B82F6]'}`} 
                      />
                      
                      {/* Selection Buttons */}
                      <button 
                         onClick={() => setLobbyState({ matchMode: 'battle' })}
                         className={`flex-1 flex items-center justify-center relative z-10 font-black text-[10px] uppercase tracking-widest transition-colors duration-300 ${matchMode === 'battle' ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
                      >
                         Battle
                      </button>
                      <button 
                         onClick={() => setLobbyState({ matchMode: 'multiplayer' })}
                         className={`flex-1 flex items-center justify-center relative z-10 font-black text-[10px] uppercase tracking-widest transition-colors duration-300 ${matchMode === 'multiplayer' ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
                      >
                         Free Roam
                      </button>
                  </div>
               </div>

               <div className="flex justify-between items-center mb-6 bg-[#060709] rounded-2xl p-4 border border-white/5">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Time Limit</span>
                  <div className="flex items-center gap-2" style={{ opacity: matchMode === 'multiplayer' ? 0.3 : 1 }}>
                      <input 
                         type="number"
                         min={1}
                         max={60}
                         value={matchDuration}
                         disabled={matchMode === 'multiplayer'}
                         onChange={(e) => setLobbyState({ matchDuration: parseInt(e.target.value) || 10 })}
                         className="bg-transparent border-none w-8 text-right text-white font-black text-sm focus:outline-none disabled:bg-transparent"
                      />
                      <span className="text-[10px] font-bold text-white/40 uppercase">Min</span>
                  </div>
               </div>

               <button onClick={handleCreate} className="w-full py-3.5 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#FF7D2E] hover:text-white transition-all shadow-xl">
                 Create Room
               </button>
            </div>

            {/* Direct Connect */}
            <div className="bg-[#0E1015] border border-white/5 p-6 rounded-3xl flex flex-col shadow-2xl relative overflow-hidden group">
               <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-[#64B7EE]/5 blur-3xl rounded-full transition-all group-hover:bg-[#64B7EE]/10" />
               
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                     <Radio size={14} className="text-white/60" />
                  </div>
                  <h3 className="text-xs font-black tracking-widest uppercase text-white/90">Join Private</h3>
               </div>
               
               <div className="flex flex-col gap-2 mb-4">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Room Code</label>
                  <input 
                     type="text" 
                     value={roomId}
                     onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                     className="w-full bg-[#060709] border border-white/5 rounded-2xl px-5 py-4 text-center text-[#64B7EE] font-mono text-lg font-black tracking-[0.2em] focus:outline-none focus:border-[#64B7EE] transition-all uppercase"
                     placeholder="ENTER CODE"
                     maxLength={8}
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => setRoleInput('producer')} className={`py-3 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all ${role === 'producer' ? 'border-[#64B7EE] text-[#64B7EE] bg-[#64B7EE]/10' : 'border-white/5 text-white/40 hover:bg-white/5'}`}>Producer</button>
                  <button onClick={() => setRoleInput('judge')} className={`py-3 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all ${role === 'judge' ? 'border-[#64B7EE] text-[#64B7EE] bg-[#64B7EE]/10' : 'border-white/5 text-white/40 hover:bg-white/5'}`}>Judge</button>
               </div>

               <button 
                onClick={() => handleJoin(roomId)}
                disabled={!roomId || roomId.length < 3}
                className="w-full py-3.5 bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:hover:bg-white/10 shadow-xl"
               >
                 Connect
               </button>
            </div>

        </div>

        {/* Right Column: Public Radar */}
        <div className="bg-[#0E1015] border border-white/5 rounded-3xl flex flex-col flex-1 relative min-h-[500px] shadow-2xl overflow-hidden">
           
           <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#060709]/50">
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 px-3 py-1 bg-[#64B7EE]/10 rounded-full border border-[#64B7EE]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#64B7EE] animate-pulse shadow-[0_0_5px_#64B7EE]" />
                    <span className="text-[10px] font-black text-[#64B7EE] tracking-widest uppercase">Live</span>
                 </div>
                 <h2 className="font-black text-white tracking-widest uppercase text-sm">Session Browser</h2>
              </div>
              <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
                 {publicRooms.length} Matches Found
              </span>
           </div>

           <div className="flex-1 overflow-auto p-4 space-y-2 custom-scrollbar">
               {publicRooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/30">
                      <div className="w-16 h-16 border-2 border-white/10 border-t-white/30 rounded-full animate-spin mb-6" />
                      <span className="text-xs font-black tracking-widest uppercase">Scanning Network...</span>
                  </div>
               ) : (
                  publicRooms.map(room => (
                     <div key={room.id} className="bg-[#060709]/80 hover:bg-[#12141A] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between transition-all gap-4 group">
                         
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hidden sm:flex group-hover:scale-105 transition-transform group-hover:border-[#64B7EE]/30 group-hover:bg-[#64B7EE]/5">
                               <Play className="w-4 h-4 text-white/40 group-hover:text-[#64B7EE] transition-colors ml-1" />
                            </div>
                            
                            <div className="flex flex-col gap-1 w-24">
                               <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">Room ID</span>
                               <span className="text-sm font-black text-white font-mono tracking-widest">{room.id}</span>
                            </div>
                            
                            <div className="w-[1px] h-8 bg-white/5 hidden sm:block" />
                            
                            <div className="flex flex-col gap-2 flex-1 min-w-[150px]">
                               <div className="flex items-center gap-2">
                                 <span className={`text-[9px] px-2 py-0.5 rounded-full border uppercase font-black tracking-widest ${room.status === 'active' ? 'border-[#FF7D2E]/20 text-[#FF7D2E] bg-[#FF7D2E]/10' : 'border-[#64B7EE]/20 text-[#64B7EE] bg-[#64B7EE]/10'}`}>
                                   {room.status}
                                 </span>
                                 <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase flex items-center gap-1.5">
                                   <Users className="w-3 h-3 text-white/40" /> {room.usersCount} Players
                                 </span>
                               </div>
                            </div>
                         </div>

                         <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleJoin(room.id, 'producer')} className="py-2.5 px-6 bg-white hover:bg-[#64B7EE] hover:text-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                               Join
                            </button>
                            <button onClick={() => handleJoin(room.id, 'judge')} className="border border-white/10 bg-transparent text-white/80 hover:bg-white/10 hover:text-white rounded-xl py-2.5 px-4 text-[10px] font-black uppercase tracking-widest transition-all">
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
