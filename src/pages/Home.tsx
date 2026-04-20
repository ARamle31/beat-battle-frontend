import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../store/useLobbyStore';
import type { Role } from '../store/useLobbyStore';
import { socket, initSocket } from '../socket/socket';
import { 
  Activity, Users, RefreshCw, Plus, Play, Radio, Fingerprint
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
      <div className="min-h-screen bg-[#0A0C0E] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="relative z-10 w-full max-w-md bg-[#13161A] p-10 rounded-2xl border border-white/5 shadow-2xl flex flex-col items-center">
            <Activity className="w-16 h-16 text-[#FF7D2E] mb-6 drop-shadow-[0_0_15px_#FF7D2E]" />
            <h1 className="text-3xl font-black italic tracking-tighter mb-2">BEAT BATTLE</h1>
            <p className="text-[#7C8991] text-xs font-bold tracking-widest uppercase mb-10 text-center">Global Studio Session Authenticator</p>
            
            <form onSubmit={handleSaveAlias} className="w-full flex flex-col gap-4">
                <div className="relative group">
                   <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4A5661] group-focus-within:text-[#FF7D2E] transition-colors" />
                   <input 
                      type="text" 
                      value={username}
                      onChange={e => setUsernameInput(e.target.value)}
                      placeholder="ENTER PRODUCER ALIAS"
                      className="w-full bg-[#0A0C0E] border border-white/10 rounded-xl px-12 py-4 text-white font-bold tracking-widest placeholder:text-[#4A5661] focus:outline-none focus:border-[#FF7D2E] focus:ring-1 focus:ring-[#FF7D2E] transition-all"
                      autoFocus
                      maxLength={16}
                   />
                </div>
                <button 
                  disabled={username.trim().length < 2}
                  type="submit"
                  className="w-full py-4 rounded-xl bg-white text-black font-black uppercase tracking-widest hover:bg-[#FF7D2E] hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black mt-2"
                >
                  INITIALIZE SYSTEM
                </button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--fl-bg-dark)] text-[var(--fl-text-bright)] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#4A5661]/50">
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div className="w-full max-w-5xl flex gap-4 h-[600px] z-10 relative">
        
        {/* Left Panel: Profile & Direct Actions */}
        <div className="w-[320px] shrink-0 flex flex-col gap-4 h-full">
            
            {/* Identity Card */}
            <div className="fl-window rounded-xl overflow-hidden shadow-2xl relative border-t-2 border-[#FF7D2E]">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF7D2E]/10 blur-3xl" />
               <div className="p-6 relative z-10">
                  <p className="text-[10px] font-bold text-[#7C8991] tracking-widest uppercase mb-1">Authenticated As</p>
                  <div className="flex items-center justify-between">
                     <h2 className="text-2xl font-black tracking-tight text-white">{username}</h2>
                     <button onClick={() => setAliasSaved(false)} className="text-[10px] font-bold text-slate-500 hover:text-white underline">EDIT</button>
                  </div>
               </div>
            </div>

            {/* Host Match */}
            <div className="fl-window rounded-xl p-6 shadow-2xl flex-1 flex flex-col">
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-[#64B7EE]/20 flex items-center justify-center"><Plus size={16} className="text-[#64B7EE]" /></div>
                  <h3 className="text-sm font-bold tracking-widest uppercase text-white">Create Lobby</h3>
               </div>
               
               <div className="flex flex-col gap-2 mb-8 flex-1">
                  <label className="text-[10px] font-bold text-[#7C8991] uppercase tracking-widest">Match Duration (Minutes)</label>
                  <div className="flex bg-[#13161A] border border-white/5 rounded-lg overflow-hidden">
                      <input 
                        type="number"
                        value={matchDuration}
                        onChange={(e) => setLobbyState({ matchDuration: parseInt(e.target.value) || 1 })}
                        className="bg-transparent px-4 py-3 text-white font-black text-lg focus:outline-none w-full"
                      />
                  </div>
               </div>

               <button 
                onClick={handleCreate}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#64B7EE] to-[#3b82f6] text-white font-black shadow-[0_0_20px_rgba(100,183,238,0.3)] hover:shadow-[0_0_30px_rgba(100,183,238,0.6)] uppercase tracking-widest transition-all"
               >
                 HOST MATCH
               </button>
            </div>

            {/* Direct Connect */}
            <div className="fl-window rounded-xl p-6 shadow-2xl flex flex-col gap-4">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-xs font-bold tracking-widest uppercase text-white">Direct Connect</h3>
                 <Users size={14} className="text-[#7C8991]" />
               </div>
               
               <input 
                  type="text" 
                  value={roomId}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  className="w-full bg-[#13161A] border border-white/5 rounded-lg px-4 py-3 text-center text-[#FF7D2E] font-black tracking-[0.3em] focus:outline-none focus:border-[#FF7D2E]"
                  placeholder="ENTER CODE"
               />
               
               <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setRoleInput('producer')} className={`py-2 rounded border font-bold text-[10px] tracking-widest uppercase transition-all ${role === 'producer' ? 'bg-[#FF7D2E]/20 text-[#FF7D2E] border-[#FF7D2E]' : 'bg-[#13161A] border-transparent text-[#7C8991] hover:bg-white/5'}`}>Producer</button>
                  <button onClick={() => setRoleInput('judge')} className={`py-2 rounded border font-bold text-[10px] tracking-widest uppercase transition-all ${role === 'judge' ? 'bg-[#64B7EE]/20 text-[#64B7EE] border-[#64B7EE]' : 'bg-[#13161A] border-transparent text-[#7C8991] hover:bg-white/5'}`}>Spectator</button>
               </div>

               <button 
                onClick={() => handleJoin(roomId)}
                disabled={!roomId}
                className="w-full py-3 rounded-lg border border-white/10 hover:border-white/50 text-white font-black disabled:opacity-30 uppercase tracking-widest transition-all text-xs"
               >
                 CONNECT
               </button>
            </div>

        </div>

        {/* Right Panel: Lobby Radar */}
        <div className="fl-window flex-1 rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#64B7EE]/5 blur-[100px] pointer-events-none" />
           
           <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div className="flex items-center gap-3">
                 <Radio className="w-5 h-5 text-[#64B7EE] animate-pulse" />
                 <span className="font-black text-white tracking-widest uppercase text-lg">Radar Frequencies</span>
              </div>
              <div className="flex items-center gap-2 bg-[#64B7EE]/10 px-3 py-1.5 rounded-full border border-[#64B7EE]/20">
                 <span className="w-2 h-2 rounded-full bg-[#64B7EE] animate-pulse" />
                 <span className="text-[10px] font-bold text-[#64B7EE] tracking-widest uppercase">{publicRooms.length} SIGNALS FOUND</span>
              </div>
           </div>

           <div className="flex-1 overflow-auto p-6 space-y-3 custom-scrollbar">
               {publicRooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-white">
                      <RefreshCw className="w-10 h-10 mb-4 animate-spin-slow" />
                      <span className="text-xs font-black tracking-[0.2em] uppercase">Scanning for active sessions...</span>
                  </div>
               ) : (
                  publicRooms.map(room => (
                     <div key={room.id} className="group bg-[#13161A] hover:bg-[#1C2026] border border-white/5 hover:border-[#64B7EE]/50 p-5 rounded-xl flex items-center justify-between transition-all duration-300 shadow-md transform hover:-translate-y-1 relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-r from-[#64B7EE]/0 via-[#64B7EE]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         
                         <div className="flex items-center gap-6 relative z-10 w-full">
                            <div className="flex flex-col">
                               <span className="text-xs font-bold text-[#7C8991] tracking-widest uppercase mb-1">Session ID</span>
                               <span className="text-xl font-black text-white font-mono tracking-widest">{room.id}</span>
                            </div>
                            
                            <div className="h-[30px] w-[2px] bg-white/5" />
                            
                            <div className="flex flex-col flex-1">
                               <span className={`w-max text-[9px] px-2 py-1 rounded bg-black/50 border uppercase font-black tracking-widest mb-1 ${room.status === 'active' ? 'text-[#FF7D2E] border-[#FF7D2E]' : 'text-[#7ae15a] border-[#7ae15a]'}`}>
                                 {room.status}
                               </span>
                               <span className="text-[10px] font-bold text-[#7C8991] tracking-widest uppercase">
                                 {room.usersCount} / 4 PRODUCERS CONNECTED
                               </span>
                            </div>

                            <div className="flex gap-2 shrink-0">
                               <button onClick={() => handleJoin(room.id, 'producer')} className="py-2.5 px-6 rounded border border-white/10 hover:border-white text-[11px] font-black text-white hover:bg-white hover:text-black uppercase tracking-widest transition-all flex items-center gap-2">
                                  <Play size={12}/> JOIN
                               </button>
                               <button onClick={() => handleJoin(room.id, 'judge')} className="py-2.5 px-5 rounded border border-transparent hover:border-white/20 text-[11px] font-black text-[#7C8991] hover:text-white uppercase tracking-widest transition-all">
                                  SPECTATE
                               </button>
                            </div>
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
