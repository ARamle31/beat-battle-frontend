import { useEffect, useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { socket } from '../socket/socket';
import { useLobbyStore } from '../store/useLobbyStore';

type CursorPacket = {
  senderId?: string;
  username: string;
  nx?: number;
  ny?: number;
  x?: number;
  y?: number;
  seq?: number;
};

type CursorView = {
  username: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lastSeen: number;
  seq: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export default function CursorsOverlay() {
  const [users, setUsers] = useState<string[]>([]);
  const cursorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cursorsRef = useRef<Record<string, CursorView>>({});
  const pendingPointerRef = useRef<{ nx: number; ny: number; x: number; y: number } | null>(null);
  const rafEmitRef = useRef<number | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    let animationFrame = 0;

    const render = () => {
      const now = performance.now();
      let removed = false;

      Object.entries(cursorsRef.current).forEach(([username, cursor]) => {
        if (now - cursor.lastSeen > 5000) {
          delete cursorsRef.current[username];
          removed = true;
          return;
        }

        cursor.x += (cursor.targetX - cursor.x) * 0.38;
        cursor.y += (cursor.targetY - cursor.y) * 0.38;

        const element = cursorRefs.current[username];
        if (element) {
          element.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
        }
      });

      if (removed) {
        setUsers(Object.keys(cursorsRef.current));
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    const handleCursorMove = (data: CursorPacket) => {
      if (!data.username || data.senderId === socket.id) return;
      const current = cursorsRef.current[data.username];
      const targetX = typeof data.nx === 'number' ? clamp01(data.nx) * window.innerWidth : data.x ?? 0;
      const targetY = typeof data.ny === 'number' ? clamp01(data.ny) * window.innerHeight : data.y ?? 0;
      const seq = data.seq ?? 0;

      if (current && seq < current.seq) return;

      cursorsRef.current[data.username] = {
        username: data.username,
        x: current?.x ?? targetX,
        y: current?.y ?? targetY,
        targetX,
        targetY,
        lastSeen: performance.now(),
        seq,
      };

      if (!current) {
        setUsers(Object.keys(cursorsRef.current));
      }
    };

    const flushPointer = () => {
      rafEmitRef.current = null;
      const pointer = pendingPointerRef.current;
      pendingPointerRef.current = null;
      if (!pointer || !socket.connected) return;

      const { role, username, room } = useLobbyStore.getState();
      if ((role !== 'producer' && role !== 'host') || !room?.id || !username) return;

      socket.volatile.emit('cursor_move', {
        roomId: room.id,
        nx: pointer.nx,
        ny: pointer.ny,
        x: pointer.x,
        y: pointer.y,
        seq: ++seqRef.current,
      });
    };

    const emitPointerMove = (event: PointerEvent) => {
      const { role, room } = useLobbyStore.getState();
      if ((role !== 'producer' && role !== 'host') || !room?.id) return;

      pendingPointerRef.current = {
        nx: clamp01(event.clientX / Math.max(window.innerWidth, 1)),
        ny: clamp01(event.clientY / Math.max(window.innerHeight, 1)),
        x: event.clientX,
        y: event.clientY,
      };

      if (rafEmitRef.current === null) {
        rafEmitRef.current = requestAnimationFrame(flushPointer);
      }
    };

    socket.on('cursor_move', handleCursorMove);
    window.addEventListener('pointermove', emitPointerMove, { passive: true });

    return () => {
      socket.off('cursor_move', handleCursorMove);
      window.removeEventListener('pointermove', emitPointerMove);
      if (rafEmitRef.current !== null) cancelAnimationFrame(rafEmitRef.current);
    };
  }, []);

  return (
    <>
      {users.map(username => (
        <div
          key={username}
          ref={element => {
            cursorRefs.current[username] = element;
          }}
          className="fixed left-0 top-0 pointer-events-none z-[99999] will-change-transform"
        >
          <MousePointer2 className="w-5 h-5 -ml-1 -mt-1 fill-white text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]" />
          <div className="absolute top-5 left-3 border border-black/25 bg-[#ff9f43] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-black shadow-xl">
            {username}
          </div>
        </div>
      ))}
    </>
  );
}
