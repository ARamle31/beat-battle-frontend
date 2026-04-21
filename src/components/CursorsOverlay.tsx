import React, { useEffect, useState } from 'react';
import { socket } from '../socket/socket';
import { useLobbyStore } from '../store/useLobbyStore';

export default function CursorsOverlay() {
  const [cursors, setCursors] = useState<{ [user: string]: {x: number, y: number} }>({});

  useEffect(() => {
    const handleCursorMove = (data: any) => {
      if (data.senderId === socket.id) return;
      setCursors(prev => ({ ...prev, [data.username]: { x: data.x, y: data.y } }));
    };

    socket.on('cursor_move', handleCursorMove);

    const emitMouseMove = (e: MouseEvent) => {
        const { role, username, room } = useLobbyStore.getState();
        if ((role !== 'producer' && role !== 'host') || !room?.id) return;
        const t = Date.now();
        if ((window as any).lastCursorEmit && t - (window as any).lastCursorEmit < 20) return;
        (window as any).lastCursorEmit = t;
        socket.emit('cursor_move', { roomId: room.id, username, senderId: socket.id, x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', emitMouseMove);

    return () => {
      socket.off('cursor_move', handleCursorMove);
      window.removeEventListener('mousemove', emitMouseMove);
    };
  }, []);

  return (
    <>
      {Object.entries(cursors).map(([uname, pos]) => (
        <div key={uname} className="fixed pointer-events-none z-[99999] -translate-x-[5px] -translate-y-[3px]" style={{ left: `${pos.x}px`, top: `${pos.y}px`, transition: 'all 0.05s linear' }}>
          <svg className="w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" viewBox="0 0 24 24" fill="currentColor" stroke="black" strokeWidth="1.5" style={{ transform: 'rotate(-25deg)', transformOrigin: 'top left' }}>
            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42a.5.5 0 0 0 .35-.85L5.5 3.21Z" />
          </svg>
          <div className="absolute top-5 left-3 bg-[#FF7D2E] text-black text-[10px] font-black px-1.5 py-0.5 rounded-sm whitespace-nowrap shadow-xl border border-black/20 uppercase tracking-widest">
             {uname}
          </div>
        </div>
      ))}
    </>
  );
}
