import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../store/useLobbyStore';
import type { Role } from '../store/useLobbyStore';
import { socket, initSocket } from '../socket/socket';
import { 
  Music, Eye, Users, RefreshCw, Activity, 
  ChevronRight, Sparkles, Plus, Clock 
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { setLobbyState, publicRooms, matchDuration } = useLobbyStore();
  
  const [roomId, setRoomIdInput] = useState('');
  const [username, setUsernameInput] = useState('');
  const [role, setRoleInput] = useState<Role>('producer');

  useEffect(() => {
    initSocket();
  }, []);

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

  return (
    <div className="min-h-screen bg-[var(--fl-bg-dark)] text-[var(--fl-text-bright)] flex flex-col items-center justify-center p-6 font-sans selection:bg-[#4A5661]/50 cursor-default select-none">
      
      {/* Industrial Background Grid Lines */}
      <div className="fixed inset-0 pointer-events-none opacity-5" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="fl-window w-full max-w-2xl shadow-[10px_10px_30px_rgba(0,0,0,0.8)] z-10 flex flex-col relative overflow-hidden">
        
        {/* Simplified Application Header */}
        <div className="fl-window-header h-[36px] px-4 flex justify-between items-center bg-gradient-to-r from-[#4A5661] to-[#2F3539] border-b border-[var(--fl-border)] text-white">
           <div className="flex items-center gap-3">
              <Activity size={16} className="text-[var(--fl-orange)]" />
              <span className="font-bold tracking-widest uppercase text-sm">BEAT BATTLE STUDIO <span className="text-[10px] opacity-70 ml-1">LOBBY TERMINAL</span></span>
           </div>
        </div>

        <div className="flex flex-col bg-[var(--fl-panel-bg)] p-6 gap-6">
          
          {/* Main Controls - Create & Join */}
          <div className="grid grid-cols-2 gap-6">
             <div className="fl-group-box p-4 flex flex-col gap-4">
                 <div className="flex justify-between items-center border-b border-[var(--fl-border)] pb-2 mb-1">
                    <span className="text-[11px] uppercase font-bold tracking-widest text-[#7C8991]">Host Project</span>
                    <Plus size={14} className="text-[var(--fl-green)]" />
                 </div>
                 
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--fl-text)]">PRODUCER ALIAS</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="bg-[#22272a] border border-[#141618] px-3 py-2 text-[13px] text-white font-bold focus:outline-none focus:border-[var(--fl-orange)] shadow-inner rounded-[2px]"
                      placeholder="Your Name"
                    />
                 </div>

                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--fl-text)]">SESSION LENGTH</label>
                    <div className="flex bg-[#22272a] border border-[#141618] rounded-[2px] shadow-inner overflow-hidden">
                        <input 
                          type="number"
                          value={matchDuration}
                          onChange={(e) => setLobbyState({ matchDuration: parseInt(e.target.value) || 1 })}
                          className="bg-transparent px-3 py-2 text-[13px] text-white font-bold focus:outline-none w-full"
                        />
                        <div className="bg-[#1A1D20] px-4 flex items-center justify-center border-l border-[#141618] text-[10px] font-bold text-[#7C8991]">MIN</div>
                    </div>
                 </div>

                 <button 
                  onClick={handleCreate}
                  disabled={!username}
                  className="fl-button h-[36px] mt-2 font-black text-[12px] bg-[#3B454D] hover:bg-black disabled:opacity-50 uppercase tracking-widest text-[var(--fl-green)] hover:text-white transition-all shadow-md"
                 >
                   HOST A MATCH
                 </button>
             </div>

             <div className="fl-group-box p-4 flex flex-col gap-4">
                 <div className="flex justify-between items-center border-b border-[var(--fl-border)] pb-2 mb-1">
                    <span className="text-[11px] uppercase font-bold tracking-widest text-[#7C8991]">Connect directly</span>
                    <Users size={14} className="text-[var(--fl-blue)]" />
                 </div>
                 
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--fl-text)]">ROOM CODE</label>
                    <input 
                      type="text" 
                      value={roomId}
                      onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                      className="bg-[#22272a] border border-[#141618] px-3 py-2 text-[16px] text-center text-[var(--fl-orange)] font-black tracking-[0.3em] focus:outline-none focus:border-[var(--fl-blue)] rounded-[2px] shadow-inner"
                      placeholder="ENTER CODE"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button 
                     onClick={() => setRoleInput('producer')}
                     className={`fl-button h-[36px] font-bold text-[10px] uppercase tracking-wider ${role === 'producer' ? 'bg-[#22272a] text-[var(--fl-text-bright)] border-[var(--fl-blue)] shadow-[inset_0_0_8px_rgba(100,183,238,0.3)]' : 'text-[#7C8991]'}`}
                    >
                      PRODUCER
                    </button>
                    <button 
                     onClick={() => setRoleInput('judge')}
                     className={`fl-button h-[36px] font-bold text-[10px] uppercase tracking-wider ${role === 'judge' ? 'bg-[#22272a] text-[var(--fl-text-bright)] border-[var(--fl-blue)] shadow-[inset_0_0_8px_rgba(100,183,238,0.3)]' : 'text-[#7C8991]'}`}
                    >
                      SPECTATOR
                    </button>
                 </div>

                 <button 
                  onClick={() => handleJoin(roomId)}
                  disabled={!username || !roomId}
                  className="fl-button h-[36px] mt-2 font-black text-[12px] disabled:opacity-50 uppercase tracking-widest text-[var(--fl-blue)] hover:text-white transition-colors"
                 >
                   MANUAL CONNECT
                 </button>
             </div>
          </div>

          {/* Active Lobbies */}
          <div className="fl-group-box p-4 bg-[var(--fl-grid-dark)] flex flex-col h-[250px]">
             <div className="flex justify-between items-center border-b border-[var(--fl-border)] pb-2 mb-3">
                 <span className="text-[11px] uppercase font-bold tracking-widest text-[#7C8991]">Active Public Lobbies</span>
                 <span className="text-[10px] font-bold text-[var(--fl-orange)] animate-pulse">{publicRooms.length} Sessions detected</span>
             </div>

             <div className="flex-1 overflow-auto custom-scrollbar bg-[#1A1D20] border border-[#141618] rounded-[2px] shadow-inner p-2 space-y-2">
                 {publicRooms.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-white">
                        <RefreshCw className="w-6 h-6 mb-2 animate-spin-slow" />
                        <span className="text-[10px] font-bold tracking-widest uppercase">Scanning frequencies...</span>
                    </div>
                 ) : (
                    publicRooms.map(room => (
                       <div key={room.id} className="bg-[#242A2E] hover:bg-[#2C3338] border border-[var(--fl-border)] p-3 rounded-[2px] flex items-center justify-between transition-colors shadow-sm cursor-pointer">
                           <div className="flex items-center gap-4">
                              <span className="text-[14px] font-black text-white font-mono tracking-wider">{room.id}</span>
                              <div className="h-[20px] w-[1px] bg-[#141618]" />
                              <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold ${room.status === 'active' ? 'text-[var(--fl-orange)] border-[var(--fl-orange)]' : 'text-[var(--fl-green)] border-[var(--fl-green)]'}`}>
                                {room.status}
                              </span>
                              <span className="text-[9px] font-bold text-[#7C8991] tracking-widest ml-2">
                                PLAYERS: {room.usersCount}/4
                              </span>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => handleJoin(room.id, 'producer')} className="fl-button h-[24px] px-4 text-[10px] font-bold text-white uppercase tracking-widest">JOIN</button>
                              <button onClick={() => handleJoin(room.id, 'judge')} className="fl-button h-[24px] px-4 text-[10px] font-bold text-[var(--fl-text)] hover:text-white uppercase tracking-widest">WATCH</button>
                           </div>
                       </div>
                    ))
                 )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
