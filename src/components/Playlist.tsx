import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { FileAudio, Music2, Plus } from 'lucide-react';
import { useDawStore, type PlaylistClip } from '../store/useDawStore';
import { useLobbyStore } from '../store/useLobbyStore';

const STEPS = 256;
const CELL_WIDTH = 28;
const LANE_HEIGHT = 56;
const LANES = 16;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const createPatternClip = (start: number, lane: number): PlaylistClip => ({
  id: `clip-pattern-${Date.now()}-${Math.random()}`,
  type: 'pattern',
  name: 'Pattern 1',
  start,
  duration: 16,
  lane,
  patternId: 'pattern-1',
  color: '#8dcc6c',
});

export default function Playlist() {
  const {
    playlistClips,
    selectedPlaylistClipIds,
    addPlaylistClip,
    updatePlaylistClip,
    setSelectedPlaylistClipIds,
  } = useDawStore();
  const { role, room, username } = useLobbyStore();
  const gridRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; start: number; lane: number } | null>(null);

  const isActiveShowcaseTarget = room?.status === 'voting' && room?.showcaseQueue?.[room?.showcaseIndex || 0] === username;
  const isMatchActive = room?.status === 'active' || isActiveShowcaseTarget || room?.mode === 'multiplayer';
  const canEdit = (role === 'producer' || role === 'host') && isMatchActive;

  useEffect(() => {
    let animationFrame = 0;
    const draw = () => {
      if (playheadRef.current) {
        const ticksPerSixteenth = Tone.Transport.PPQ / 4;
        const step = Tone.Transport.ticks / ticksPerSixteenth;
        playheadRef.current.style.transform = `translate3d(${step * CELL_WIDTH}px, 0, 0)`;
      }
      animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const getGridPoint = (event: React.MouseEvent) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || !gridRef.current) return { start: 0, lane: 0 };
    const x = event.clientX - rect.left + gridRef.current.scrollLeft;
    const y = event.clientY - rect.top + gridRef.current.scrollTop;
    return {
      start: Math.max(0, Math.floor(x / CELL_WIDTH)),
      lane: clamp(Math.floor(y / LANE_HEIGHT), 0, LANES - 1),
    };
  };

  const handleGridMouseDown = (event: React.MouseEvent) => {
    if (!canEdit || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-playlist-clip]')) return;
    const point = getGridPoint(event);
    addPlaylistClip(createPatternClip(point.start, point.lane));
  };

  const handleClipMouseDown = (event: React.MouseEvent, clip: PlaylistClip) => {
    if (!canEdit || event.button !== 0) return;
    event.stopPropagation();
    setSelectedPlaylistClipIds(event.ctrlKey
      ? selectedPlaylistClipIds.includes(clip.id)
        ? selectedPlaylistClipIds.filter(id => id !== clip.id)
        : [...selectedPlaylistClipIds, clip.id]
      : [clip.id]
    );

    const startX = event.clientX;
    const startY = event.clientY;
    const originStart = clip.start;
    const originLane = clip.lane;

    const handleMove = (moveEvent: MouseEvent) => {
      const deltaSteps = Math.round((moveEvent.clientX - startX) / CELL_WIDTH);
      const deltaLane = Math.round((moveEvent.clientY - startY) / LANE_HEIGHT);
      setDragPreview({
        id: clip.id,
        start: Math.max(0, originStart + deltaSteps),
        lane: clamp(originLane + deltaLane, 0, LANES - 1),
      });
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      setDragPreview(prev => {
        if (prev?.id === clip.id) {
          updatePlaylistClip(clip.id, { start: prev.start, lane: prev.lane });
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#2e3a40] text-[#b5c5cc]">
      <div className="playlist-titlebar h-[26px] shrink-0 border-b border-[#151a1d] bg-gradient-to-b from-[#526069] to-[#3a454b] flex items-center justify-between px-2">
        <div className="flex items-center gap-2 font-bold text-[12px] text-[#e4eef2]">
          <span className="text-[#d0e7f2]">▸</span>
          <span>Playlist - Arrangement</span>
          <span className="text-[#8fa0a8]">▸</span>
          <span>Pattern 1</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="fl-button h-[18px] px-2 text-[9px] text-[#cbdce6]">SONG</span>
          <span className="fl-button h-[18px] px-2 text-[9px] text-[#ff9f43]">PAT</span>
        </div>
      </div>

      <div className="h-[34px] shrink-0 border-b border-[#182024] bg-[#364248] flex">
        <div className="w-[160px] border-r border-[#151a1d] flex items-center gap-1 px-2">
          <button className="fl-button h-[22px] w-[28px] text-[#d8ebf3]" title="Add pattern">
            <Plus size={13} />
          </button>
          <button className="fl-button h-[22px] px-2 text-[10px] text-[#d8ebf3]">NOTE</button>
          <button className="fl-button h-[22px] px-2 text-[10px] text-[#91a2ab]">CHAN</button>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 flex" style={{ width: STEPS * CELL_WIDTH }}>
            {Array.from({ length: STEPS / 4 }).map((_, bar) => (
              <div key={bar} className="h-full border-r border-[#162126] flex items-end px-1 pb-1 text-[10px] font-bold text-[#8ea0a8]" style={{ width: CELL_WIDTH * 4 }}>
                {bar + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-[160px] shrink-0 border-r border-[#151a1d] bg-[#2b353b] flex">
          <div className="w-[140px] border-r border-[#14191c]">
            <button
              className="w-full h-[30px] border border-[#8dcc6c] bg-[#3f4d52] text-left px-2 font-bold text-[#dce9ef] flex items-center gap-2"
              onClick={() => canEdit && addPlaylistClip(createPatternClip(0, 0))}
            >
              <span className="w-2 h-2 bg-[#ff5b62] rotate-45" />
              Pattern 1
            </button>
          </div>
          <div className="w-[20px] bg-[#242d32] flex items-end justify-center pb-2 text-[#d7edf4] font-black">+</div>
        </div>

        <div
          ref={gridRef}
          data-testid="playlist-grid"
          className="relative flex-1 overflow-auto custom-scrollbar bg-[#263238]"
          onMouseDown={handleGridMouseDown}
        >
          <div className="relative" style={{ width: STEPS * CELL_WIDTH, height: LANES * LANE_HEIGHT }}>
            <div className="absolute inset-0 pointer-events-none playlist-grid-bg" />
            <div ref={playheadRef} className="absolute top-0 bottom-0 left-0 z-30 w-[2px] bg-[#a7ff7a] shadow-[0_0_6px_#7de85d] pointer-events-none will-change-transform" />

            {Array.from({ length: LANES }).map((_, lane) => (
              <div key={lane} className="absolute left-0 right-0 border-b border-[#121b20]" style={{ top: lane * LANE_HEIGHT, height: LANE_HEIGHT }}>
                <div className="sticky left-0 z-10 h-full w-[100px] border-r border-[#172126] bg-[#3d484d] px-2 py-1 text-[#87969d] font-bold">
                  <div>Track {lane + 1}</div>
                  <div className="mt-4 text-[14px] leading-none text-[#8dcc6c]">...</div>
                </div>
              </div>
            ))}

            {playlistClips.map(clip => {
              const preview = dragPreview?.id === clip.id ? dragPreview : null;
              const left = (preview?.start ?? clip.start) * CELL_WIDTH;
              const top = (preview?.lane ?? clip.lane) * LANE_HEIGHT + 6;
              const selected = selectedPlaylistClipIds.includes(clip.id);
              const color = clip.color || (clip.type === 'audio' ? '#58b8d8' : '#8dcc6c');

              return (
                <div
                  key={clip.id}
                  data-playlist-clip
                  onMouseDown={(event) => handleClipMouseDown(event, clip)}
                  className={`absolute z-20 h-[34px] border shadow-[2px_2px_4px_rgba(0,0,0,0.35)] cursor-move overflow-hidden ${selected ? 'ring-1 ring-white' : ''}`}
                  style={{
                    left,
                    top,
                    width: Math.max(36, clip.duration * CELL_WIDTH),
                    backgroundColor: color,
                    borderColor: selected ? '#ffffff' : '#192225',
                  }}
                  title={clip.name}
                >
                  <div className="h-[15px] bg-black/18 border-b border-black/20 px-1 flex items-center gap-1 text-[10px] font-black text-[#101516]">
                    {clip.type === 'audio' ? <FileAudio size={10} /> : <Music2 size={10} />}
                    <span className="truncate">{clip.name}</span>
                  </div>
                  <div className="absolute inset-x-1 bottom-1 top-[18px] opacity-50">
                    {clip.type === 'audio' ? (
                      <div className="h-full bg-[repeating-linear-gradient(90deg,rgba(0,0,0,0.45)_0_2px,transparent_2px_7px)]" />
                    ) : (
                      <div className="h-full bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.28)_0_2px,transparent_2px_6px)]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
