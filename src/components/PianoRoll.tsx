import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { useDawStore } from '../store/useDawStore';
import { useLobbyStore } from '../store/useLobbyStore';
import { socket } from '../socket/socket';
import { engine } from '../audio/AudioEngine';
import { Pencil, Brush, Ban, Magnet } from 'lucide-react';

const generateNotes = () => {
    const arr: string[] = [];
    const names = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
    for(let i=8; i>=1; i--) {
        names.forEach(n => arr.push(`${n}${i}`));
    }
    return arr;
};
const NOTES = generateNotes();
const STEPS = 128; // Extended
const CELL_WIDTH = 30; 
const CELL_HEIGHT = 16; // Thinner to fit more octaves smoothly

export default function PianoRoll() {
  const { 
    tracks, selectedTrackId, addNote, removeNote, updateNote, 
    playheadPosition, loopStart, loopEnd, setLoopPoints,
    snapInterval, setSnapInterval, lastNoteDuration, setLastNoteDuration
  } = useDawStore();
  const { role, room, username } = useLobbyStore();
  const dawStore = useDawStore();

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const isActiveShowcaseTarget = room?.status === 'voting' && room?.showcaseQueue?.[room?.showcaseIndex || 0] === username;
  const isMatchActive = room?.status === 'active' || isActiveShowcaseTarget;
  const isProducer = (role === 'producer' || role === 'host') && isMatchActive;

  const [activeTool, setActiveTool] = useState(0);

  const [dragAction, setDragAction] = useState<'move' | 'resize' | 'paint' | 'loop' | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  
  const [startMouseX, setStartMouseX] = useState(0);
  const [startMouseY, setStartMouseY] = useState(0);
  const [startDataValueX, setStartDataValueX] = useState(0);
  const [startDataValueY, setStartDataValueY] = useState(0);
  
  // Local drag state to bypass global Zustand renders and socket lag
  const [localDragDelta, setLocalDragDelta] = useState({ steps: 0, pitchIndex: 0, dur: 0 });
  
  // Lasso Selection State
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [lassoBox, setLassoBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [lassoStart, setLassoStart] = useState({ x: 0, y: 0 });
  
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const keysContainerRef = useRef<HTMLDivElement>(null);
  const rulerContainerRef = useRef<HTMLDivElement>(null);
  
  // Independent playhead GPU tracking avoiding massive React DOM flushes
  const playheadRef = useRef<HTMLDivElement>(null);
  const playheadGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     let animationFrame: number;
     const drawPlayhead = () => {
         let pos = dawStore.loopStart;
         if (dawStore.isPlaying) {
             const ticks = engine.analyser?.context?.transport?.ticks || Tone.Transport.ticks;
             const ticksPerSixteenth = Tone.Transport.PPQ / 4; 
             pos = ticks / ticksPerSixteenth;
         }
         if (playheadRef.current) playheadRef.current.style.left = `${pos * CELL_WIDTH}px`;
         if (playheadGridRef.current) playheadGridRef.current.style.left = `${pos * CELL_WIDTH}px`;
         
         animationFrame = requestAnimationFrame(drawPlayhead);
     };
     animationFrame = requestAnimationFrame(drawPlayhead);
     return () => cancelAnimationFrame(animationFrame);
  }, [dawStore.isPlaying, dawStore.loopStart]);

  // Sync scroll
  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
     if (keysContainerRef.current) keysContainerRef.current.scrollTop = e.currentTarget.scrollTop;
     if (rulerContainerRef.current) rulerContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  const handleKeysWheel = (e: React.WheelEvent) => {
     if (gridContainerRef.current) {
        gridContainerRef.current.scrollTop += e.deltaY;
     }
  };

  // Center on C5 on mount
  useEffect(() => {
     if (gridContainerRef.current && keysContainerRef.current) {
        const c5Index = NOTES.indexOf('C5');
        if (c5Index !== -1) {
           const scrollY = (c5Index * CELL_HEIGHT) - (gridContainerRef.current.clientHeight / 2) + 120;
           gridContainerRef.current.scrollTop = scrollY;
           keysContainerRef.current.scrollTop = scrollY;
        }
     }
  }, [selectedTrackId]); // Re-center occasionally when swapping

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || !isProducer || !isMatchActive || !selectedTrackId) return;
      
      // Undo / Redo
      if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          useDawStore.getState().undo();
          return;
      }
      if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
          e.preventDefault();
          useDawStore.getState().redo();
          return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace' || (e.ctrlKey && e.key.toLowerCase() === 'x')) {
          if (selectedNoteIds.length > 0) {
              e.preventDefault();
              useDawStore.getState().commitHistory();
              selectedNoteIds.forEach(id => {
                  useDawStore.getState().removeNote(selectedTrackId, id);
              });
              setSelectedNoteIds([]);
          }
           return;
      }
      
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
          e.preventDefault();
          if (selectedNoteIds.length === 0) return;
          
          const track = useDawStore.getState().tracks.find(t => t.id === selectedTrackId);
          if (!track) return;
          
          useDawStore.getState().commitHistory();
          
          let maxEndStep = 0;
          let minStartStep = Infinity;
          selectedNoteIds.forEach(id => {
              const note = track.notes.find(n => n.id === id);
              if (note) {
                 if (note.time + note.duration > maxEndStep) maxEndStep = note.time + note.duration;
                 if (note.time < minStartStep) minStartStep = note.time;
              }
          });
          
          const selectionLength = maxEndStep - minStartStep;
          if (selectionLength <= 0) return;
          
          const newIds: string[] = [];
          selectedNoteIds.forEach(id => {
              const note = track.notes.find(n => n.id === id);
              if (!note) return;
              const newNote = { ...note, id: `note-${Date.now()}-${Math.random()}`, time: note.time + selectionLength };
              useDawStore.getState().addNote(selectedTrackId, newNote);
              newIds.push(newNote.id);
          });
          setSelectedNoteIds(newIds);
          return;
      }
      
      if (e.altKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          let track = useDawStore.getState().tracks.find(t => t.id === selectedTrackId);
          if (!track || track.notes.length === 0) return;
          
          let targetIds = selectedNoteIds.length > 1 ? selectedNoteIds : track.notes.map(n => n.id);
          if (targetIds.length < 2) return;
          
          useDawStore.getState().commitHistory();
          
          const strumOffset = 0.125;
          const targetNotes = track.notes.filter(n => targetIds.includes(n.id));
          
          const timeGroups = targetNotes.reduce((acc, note) => {
              if (!acc[note.time]) acc[note.time] = [];
              acc[note.time].push(note);
              return acc;
          }, {} as Record<number, typeof targetNotes>);

          Object.values(timeGroups).forEach(group => {
              group.sort((a, b) => NOTES.indexOf(b.pitch) - NOTES.indexOf(a.pitch));
              group.forEach((note, index) => {
                   if (index > 0) {
                      useDawStore.getState().updateNote(selectedTrackId, note.id, { time: note.time + (strumOffset * index) });
                   }
              });
          });
          return;
      }
      
      if ((e.ctrlKey || e.shiftKey) && e.key.startsWith('Arrow')) {
          e.preventDefault();
          
          let track = useDawStore.getState().tracks.find(t => t.id === selectedTrackId);
          if (!track) return;
          
          let targetIds = selectedNoteIds.length > 0 ? selectedNoteIds : track.notes.map(n => n.id);
          if (targetIds.length === 0) return;
          
          useDawStore.getState().commitHistory();
          
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              let pitchIndexDelta = 0;
              if (e.ctrlKey) pitchIndexDelta = e.key === 'ArrowUp' ? -12 : 12; 
              else if (e.shiftKey) pitchIndexDelta = e.key === 'ArrowUp' ? -1 : 1;
              
              targetIds.forEach(id => {
                  const note = track!.notes.find(n => n.id === id);
                  if (!note) return;
                  let newPitchIndex = NOTES.indexOf(note.pitch) + pitchIndexDelta;
                  newPitchIndex = Math.max(0, Math.min(NOTES.length - 1, newPitchIndex));
                  useDawStore.getState().updateNote(selectedTrackId, id, { pitch: NOTES[newPitchIndex] });
              });
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              // Shift applies snap grid, Ctrl applies small nudges or larger jumps?
              // Standard FL: Shift+Arrow shifts by grid tick
              const snap = useDawStore.getState().snapInterval; 
              const nudgeAmount = (snap > 0 ? snap : 0.25) * (e.key === 'ArrowLeft' ? -1 : 1);
              
              targetIds.forEach(id => {
                  const note = track!.notes.find(n => n.id === id);
                  if (!note) return;
                  const newTime = Math.max(0, note.time + nudgeAmount);
                  useDawStore.getState().updateNote(selectedTrackId, id, { time: newTime });
              });
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProducer, isMatchActive, selectedNoteIds, selectedTrackId]);

  useEffect(() => {
    if (isProducer && isMatchActive && (window as any).hasRestored) {
      socket.emit('daw_state_update', { roomId: useLobbyStore.getState().roomId, state: useDawStore.getState() });
    }
  }, [dawStore.tracks, dawStore.bpm, dawStore.isPlaying, dawStore.loopStart, dawStore.loopEnd, isProducer, isMatchActive]);

  if (!selectedTrack) {
    return <div className="h-full flex items-center justify-center text-[#ff7d2e] font-bold">Select an instrument to open Piano Roll</div>;
  }

  const applySnap = (rawStep: number, isAltKeyDown: boolean) => {
     if (isAltKeyDown || snapInterval === 0) return rawStep; 
     return Math.round(rawStep / snapInterval) * snapInterval;
  };

  const getStepFromEvent = (e: React.MouseEvent, isAltKeyDown: boolean) => {
    if (!gridContainerRef.current) return 0;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + gridContainerRef.current.scrollLeft;
    const rawStep = x / CELL_WIDTH;
    return applySnap(rawStep, isAltKeyDown);
  };

  const getPitchFromEvent = (e: React.MouseEvent) => {
    if (!gridContainerRef.current) return 0;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + gridContainerRef.current.scrollTop;
    return Math.floor(y / CELL_HEIGHT);
  };

  const handleGridMouseDown = (e: React.MouseEvent) => {
    if (!isProducer || !isMatchActive || dragAction) return;
    
    if (e.button === 2) return; // Right-click should only delete notes, never place them on empty grid
    
    // Lasso Selection Initiator
    if (e.ctrlKey && e.button === 0) {
        const rect = gridContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const innerLeftStart = e.clientX - rect.left + gridContainerRef.current!.scrollLeft;
        const innerTopStart = e.clientY - rect.top + gridContainerRef.current!.scrollTop;
        
        setDragAction('lasso');
        setLassoStart({ x: innerLeftStart, y: innerTopStart });
        setLassoBox({ x: innerLeftStart, y: innerTopStart, w: 0, h: 0 });
        
        // Setup direct Window drag captures for flawless selection tracking regardless of DOM boundaries
        const moveLasso = (e2: MouseEvent) => {
            const innerLeft = e2.clientX - rect.left + gridContainerRef.current!.scrollLeft;
            const innerTop = e2.clientY - rect.top + gridContainerRef.current!.scrollTop;
            setLassoBox({
                 x: Math.min(innerLeftStart, innerLeft),
                 y: Math.min(innerTopStart, innerTop),
                 w: Math.abs(innerLeft - innerLeftStart),
                 h: Math.abs(innerTop - innerTopStart)
            });
        };
        const upLasso = (e3: MouseEvent) => {
            window.removeEventListener('mousemove', moveLasso);
            window.removeEventListener('mouseup', upLasso);
            
            const innerLeft = e3.clientX - rect.left + gridContainerRef.current!.scrollLeft;
            const innerTop = e3.clientY - rect.top + gridContainerRef.current!.scrollTop;
            const finalBoxX = Math.min(innerLeftStart, innerLeft);
            const finalBoxY = Math.min(innerTopStart, innerTop);
            const finalBoxW = Math.abs(innerLeft - innerLeftStart);
            const finalBoxH = Math.abs(innerTop - innerTopStart);

            const startStep = finalBoxX / CELL_WIDTH;
            const endStep = (finalBoxX + finalBoxW) / CELL_WIDTH;
            const startPitchIdx = Math.floor(finalBoxY / CELL_HEIGHT);
            const endPitchIdx = Math.ceil((finalBoxY + finalBoxH) / CELL_HEIGHT);
            
            // Allow microscopic tolerance of 0.05 step
            const ids = useDawStore.getState().tracks.find(t => t.id === selectedTrackId)?.notes.filter(n => {
               const pitchIdx = NOTES.indexOf(n.pitch);
               const noteEnd = n.time + n.duration;
               return pitchIdx >= startPitchIdx && pitchIdx <= endPitchIdx &&
                      n.time <= (endStep + 0.05) && noteEnd >= (startStep - 0.05);
            }).map(n => n.id) || [];
            
            setSelectedNoteIds(ids);
            setDragAction(null);
            setLassoBox(null);
        };
        window.addEventListener('mousemove', moveLasso);
        window.addEventListener('mouseup', upLasso);
        return;
    }

    const rect = gridContainerRef.current?.getBoundingClientRect();
    if (rect && e.clientY < rect.top) {
        setDragAction('loop');
        setStartMouseX(e.clientX);
        const step = getStepFromEvent(e, e.altKey);
        setStartDataValueX(step);
        setLoopPoints(step, loopEnd);
        return;
    }

    const step = getStepFromEvent(e, e.altKey);
    const pitchIndex = getPitchFromEvent(e);
    if (pitchIndex < 0 || pitchIndex >= NOTES.length) return;
    
    setSelectedNoteIds([]); // Deselect on blank click
    
    const pitch = NOTES[pitchIndex];
    if (activeTool === 0 || activeTool === 1) engine.playPreview(selectedTrack.id, pitch);

    const newNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      pitch, time: step, duration: lastNoteDuration, velocity: 0.8
    };

    dawStore.commitHistory();

    if (activeTool === 1) { 
       addNote(selectedTrack.id, newNote);
       setDragAction('paint');
    } else { 
       addNote(selectedTrack.id, newNote);
       setDragAction('move');
       setDragTargetId(newNote.id);
       setSelectedNoteIds([newNote.id]);
       setStartMouseX(step);
       setStartMouseY(pitchIndex);
       setStartDataValueX(step);
       setStartDataValueY(NOTES.indexOf(pitch));
    }
  };

  const handleNoteMouseDown = (e: React.MouseEvent, note: any) => {
    e.stopPropagation();
    if (!isProducer || !isMatchActive) return;
    if ((e.button === 2 && !e.ctrlKey) || (activeTool === 2 && !e.ctrlKey)) { 
      if (selectedNoteIds.includes(note.id)) {
           // Delete ALL selected notes if user right clicks any one of them
           selectedNoteIds.forEach(id => removeNote(selectedTrack.id, id));
           setSelectedNoteIds([]);
      } else {
           removeNote(selectedTrack.id, note.id);
      }
      return;
    }
    
    if (!e.ctrlKey && !selectedNoteIds.includes(note.id)) setSelectedNoteIds([]);
    if (e.ctrlKey) {
        setSelectedNoteIds(prev => prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]);
        return;
    }
    
    engine.playPreview(selectedTrack.id, note.pitch);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isRightEdge = e.clientX > rect.right - 10;
    
    const mouseStep = getStepFromEvent(e, false);
    const mousePitchIndex = getPitchFromEvent(e);

    if (isRightEdge) {
       setDragAction('resize');
       setDragTargetId(note.id);
       setStartMouseX(mouseStep);
       setStartDataValueX(note.duration);
       setLocalDragDelta({ steps: 0, pitchIndex: 0, dur: 0 });
    } else {
       let targetIdForMove = note.id;
       
       if (e.shiftKey && activeTool !== 2) {
           const track = selectedTrack;
           const newIds: string[] = [];
           const targetNotes = selectedNoteIds.includes(note.id) ? selectedNoteIds : [note.id];
           
           dawStore.commitHistory();
           
           targetNotes.forEach(id => {
               const nOld = track.notes.find(n => n.id === id);
               if (nOld) {
                   const nNew = { ...nOld, id: `note-${Date.now()}-${Math.random()}` };
                   useDawStore.getState().addNote(track.id, nNew);
                   newIds.push(nNew.id);
                   if (id === note.id) targetIdForMove = nNew.id;
               }
           });
           setSelectedNoteIds(newIds);
       }
       
       setDragAction('move');
       setDragTargetId(targetIdForMove);
       setStartMouseX(mouseStep);
       setStartMouseY(mousePitchIndex);
       setStartDataValueX(note.time);
       setStartDataValueY(NOTES.indexOf(note.pitch));
       setLocalDragDelta({ steps: 0, pitchIndex: 0, dur: 0 });
    }
  };

  const handleGlobeMouseMove = (e: React.MouseEvent) => {
    if (!dragAction || !isProducer) return;
    
    if (dragAction === 'paint') {
      const step = getStepFromEvent(e, e.altKey);
      const pitchIndex = getPitchFromEvent(e);
      if (pitchIndex >= 0 && pitchIndex < NOTES.length) {
         const pitch = NOTES[pitchIndex];
         const existingNote = selectedTrack.notes.find(n => n.pitch === pitch && Math.abs(n.time - step) < 0.1);
         if (!existingNote) {
            dawStore.commitHistory();
            engine.playPreview(selectedTrack.id, pitch);
            addNote(selectedTrack.id, { id: `note-${Date.now()}-${Math.random()}`, pitch, time: step, duration: lastNoteDuration, velocity: 0.8 });
         }
      }
      return;
    }

    // Coordinates are mathematically extracted from grid to bypass window scrolling interference
    const currentStep = getStepFromEvent(e, false);
    const currentPitchIndex = getPitchFromEvent(e);
    
    const rawStepsMoved = currentStep - startMouseX;
    const stepsMoved = snapInterval > 0 && !e.altKey ? Math.round(rawStepsMoved / snapInterval) * snapInterval : rawStepsMoved;

    if (dragAction === 'loop') {
      if (currentStep > startDataValueX) setLoopPoints(startDataValueX, currentStep);
      else setLoopPoints(currentStep, startDataValueX);
      return;
    }

    if (!dragTargetId) return;
    const note = selectedTrack.notes.find(n => n.id === dragTargetId);
    if (!note) return;

    if (dragAction === 'move') {
      const pitchIndexOffset = currentPitchIndex - startMouseY;
      
      if (pitchIndexOffset !== localDragDelta.pitchIndex) {
          const newPitchIndex = Math.max(0, Math.min(NOTES.length - 1, startDataValueY + pitchIndexOffset));
          engine.playPreview(selectedTrack.id, NOTES[newPitchIndex]);
      }
      
      setLocalDragDelta({ steps: stepsMoved, pitchIndex: pitchIndexOffset, dur: 0 });
    } else if (dragAction === 'resize') {
      setLocalDragDelta({ steps: 0, pitchIndex: 0, dur: stepsMoved });
    }
  };

  const handleGlobeMouseUp = () => {
    const isMultiDrag = dragTargetId && selectedNoteIds.includes(dragTargetId) && selectedNoteIds.length > 0;

    if (dragAction === 'move' && dragTargetId) {
      if (localDragDelta.steps !== 0 || localDragDelta.pitchIndex !== 0) dawStore.commitHistory();
      if (isMultiDrag) {
          selectedNoteIds.forEach(id => {
              const note = selectedTrack?.notes.find(n => n.id === id);
              if (!note) return;
              const newTime = Math.max(0, note.time + localDragDelta.steps);
              let newPitchIndex = NOTES.indexOf(note.pitch) + localDragDelta.pitchIndex;
              newPitchIndex = Math.max(0, Math.min(NOTES.length - 1, newPitchIndex));
              updateNote(selectedTrack.id, id, { time: newTime, pitch: NOTES[newPitchIndex] });
          });
      } else {
          const newTime = Math.max(0, startDataValueX + localDragDelta.steps);
          let newPitchIndex = startDataValueY + localDragDelta.pitchIndex;
          newPitchIndex = Math.max(0, Math.min(NOTES.length - 1, newPitchIndex));
          updateNote(selectedTrack.id, dragTargetId, { time: newTime, pitch: NOTES[newPitchIndex] });
      }
    } else if (dragAction === 'resize' && dragTargetId) {
      if (localDragDelta.dur !== 0) dawStore.commitHistory();
      const minDur = snapInterval > 0 ? snapInterval : 0.1;
      
      if (isMultiDrag) {
          selectedNoteIds.forEach(id => {
              const note = selectedTrack?.notes.find(n => n.id === id);
              if (!note) return;
              const newDur = Math.max(minDur, note.duration + localDragDelta.dur);
              updateNote(selectedTrack.id, id, { duration: newDur });
          });
          const targetNote = selectedTrack.notes.find(n => n.id === dragTargetId);
          if (targetNote) setLastNoteDuration(Math.max(minDur, targetNote.duration + localDragDelta.dur));
      } else {
          const newDur = Math.max(minDur, startDataValueX + localDragDelta.dur);
          updateNote(selectedTrack.id, dragTargetId, { duration: newDur });
          setLastNoteDuration(newDur); 
      }
    }
    // (Lasso resolution is also handled by the upLasso window closure now)

    setDragAction(null);
    setDragTargetId(null);
    setLassoBox(null);
    setLocalDragDelta({ steps: 0, pitchIndex: 0, dur: 0 });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--fl-bg-dark)] overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()} onMouseUp={handleGlobeMouseUp} onMouseLeave={handleGlobeMouseUp} onMouseMove={handleGlobeMouseMove}>
      
      <div className="h-[28px] bg-[var(--fl-header)] border-b border-[var(--fl-border)] shrink-0 flex items-center px-2 gap-2 shadow-[0_2px_5px_rgba(0,0,0,0.2)] z-20 relative">
          <div className="flex items-center gap-1">
             <button onClick={() => setActiveTool(0)} className={`fl-button w-[24px] h-[20px] ${activeTool === 0 ? 'active text-white' : 'text-[#a1b0b8]'}`}><Pencil size={12} /></button>
             <button onClick={() => setActiveTool(1)} className={`fl-button w-[24px] h-[20px] ${activeTool === 1 ? 'active text-white' : 'text-[#a1b0b8]'}`}><Brush size={13} /></button>
             <button onClick={() => setActiveTool(2)} className={`fl-button w-[24px] h-[20px] ${activeTool === 2 ? 'active text-red-400' : 'text-[#a1b0b8]'}`}><Ban size={12} strokeWidth={3} /></button>
          </div>
          <div className="w-[1px] h-4 bg-[var(--fl-border)] mx-1" />
          <div className="flex items-center gap-1">
              <div className="fl-button w-[24px] h-[20px] text-[#71df66] active"><Magnet size={12} strokeWidth={2.5} /></div>
              <select 
                  className="fl-button h-[20px] px-2 text-[10px] text-[var(--fl-text-bright)] focus:outline-none cursor-pointer bg-[#2a3034]"
                  value={snapInterval}
                  onChange={(e) => setSnapInterval(Number(e.target.value))}
              >
                 <option value={16} className="bg-[#2a3034] text-[#d0e2ed]">Bar</option>
                 <option value={4} className="bg-[#2a3034] text-[#d0e2ed]">Beat</option>
                 <option value={1} className="bg-[#2a3034] text-[#d0e2ed]">Step</option>
                 <option value={0.5} className="bg-[#2a3034] text-[#d0e2ed]">1/2 Step</option>
                 <option value={0.25} className="bg-[#2a3034] text-[#d0e2ed]">1/4 Step</option>
                 <option value={0.1666} className="bg-[#2a3034] text-[#d0e2ed]">1/6 Step</option>
                 <option value={0} className="bg-[#2a3034] text-[#d0e2ed]">None</option>
              </select>
          </div>
      </div>

      <div className="h-[24px] bg-[var(--fl-grid-light)] border-b border-[var(--fl-border)] ml-[60px] flex relative shrink-0 overflow-hidden cursor-crosshair" 
           ref={rulerContainerRef} onMouseDown={handleGridMouseDown}>
         <div className="absolute top-0 bottom-0 flex" style={{ width: STEPS * CELL_WIDTH }}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <div key={i} className={`h-full border-r border-[#181b1e]/50 flex items-end px-1 pb-1 box-border`} style={{ width: CELL_WIDTH }}>
                  {i % 4 === 0 && <span className="text-[10px] font-bold text-[#8a98a0] leading-none pointer-events-none">{(i/4) + 1}</span>}
              </div>
            ))}
         </div>
         <div className="absolute top-0 bottom-0 bg-[#D7555A] opacity-40 pointer-events-none" style={{ left: loopStart * CELL_WIDTH, width: (loopEnd - loopStart) * CELL_WIDTH }} />
         <div className="absolute top-0 h-1 bg-[#fc767b]" style={{ left: loopStart * CELL_WIDTH, width: (loopEnd - loopStart) * CELL_WIDTH }} />
         
         <div ref={playheadRef} className="absolute top-0 bottom-0 w-[2px] bg-[#7DE85D] z-50 pointer-events-none shadow-[0_0_4px_#71df66]" />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--fl-grid-dark)] relative">
        <div className="flex-1 flex overflow-hidden">
          {/* Keys Sidebar */}
          <div className="w-[60px] flex flex-col shrink-0 bg-[var(--fl-panel-bg)] border-r border-[var(--fl-border)] z-20 shadow-[3px_0_5px_rgba(0,0,0,0.3)] overflow-hidden" ref={keysContainerRef} onWheel={handleKeysWheel}>
            <div className="flex flex-col" style={{ height: NOTES.length * CELL_HEIGHT }}>
              {NOTES.map(note => {
                const isBlack = note.includes('#');
                const isC = note.includes('C') && !isBlack;
                return (
                  <div key={note} 
                      onMouseDown={() => engine.playPreview(selectedTrack.id, note.replace(/[5-8]/, '4'))} 
                      className={`w-full flex items-center justify-end pr-1 text-[9px] tracking-tight cursor-pointer border-b border-[var(--fl-border)] box-border
                      ${isBlack ? 'bg-[#22272A] hover:bg-[#2A3035]' : 'bg-[#DDE2E5] border-t border-t-white shadow-[inset_1px_1px_1px_rgba(0,0,0,0.1)] hover:bg-[#fff]'}
                      `}
                      style={{ height: CELL_HEIGHT }}>
                      {isC && <span className="scale-90 pr-0.5 text-[#3E4A53] font-bold">{note}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Note Grid */}
          <div className="flex-1 overflow-auto relative custom-scrollbar bg-[var(--fl-grid-dark)]" ref={gridContainerRef} onScroll={handleGridScroll}>
            <div className="absolute top-0 left-0 flex flex-col pointer-events-none" style={{ width: STEPS * CELL_WIDTH, height: NOTES.length * CELL_HEIGHT }}>
               {NOTES.map((note, idx) => {
                  const intervalTicks = snapInterval > 0 && snapInterval < 1 ? snapInterval : 1;
                  const pxPerLine = intervalTicks * CELL_WIDTH;
                  const linesPerBeat = Math.round(4 / intervalTicks);
                  let stops = [];
                  for(let i=0; i<linesPerBeat; i++) {
                      const offset = i * pxPerLine;
                      const width = i === 0 ? 2 : 1;
                      const color = i === 0 ? 'rgba(120,135,145,0.3)' : 'rgba(24,27,30,0.5)';
                      stops.push(`${color} ${offset}px, ${color} ${offset + width}px, transparent ${offset + width}px, transparent ${offset + pxPerLine}px`);
                  }
                  
                  return (
                    <div key={note} className={`w-full box-border border-b border-[var(--fl-border)] ${note.includes('#') ? 'bg-[#181b1e]/40' : 'bg-transparent'}`} 
                         style={{ 
                            height: CELL_HEIGHT, 
                            backgroundSize: `${CELL_WIDTH * 4}px 100%`,
                            backgroundImage: `linear-gradient(to right, ${stops.join(', ')})`
                         }} 
                    />
                  );
               })}
            </div>

            <div className="absolute top-0 left-0 flex flex-col" style={{ width: STEPS * CELL_WIDTH, height: NOTES.length * CELL_HEIGHT }} onMouseDown={handleGridMouseDown}>
               <div className="w-full h-full" />
               {/* Extended Playhead Line over grids */}
               <div ref={playheadGridRef} className="absolute top-0 bottom-0 w-[2px] bg-[#7DE85D]/60 shadow-[0_0_8px_#7DE85D] pointer-events-none z-[40] transition-transform duration-75" style={{ transform: 'translateX(-50%)' }} />
            </div>

            {/* Notes Layer */}
            {selectedTrack.notes.map(note => {
               const isDraggingSelected = dragTargetId && selectedNoteIds.includes(dragTargetId!) && selectedNoteIds.includes(note.id);
               const isDragging = dragTargetId === note.id || isDraggingSelected;
               
               const renderTime = (isDragging && dragAction === 'move') 
                   ? Math.max(0, note.time + localDragDelta.steps) 
                   : note.time;
               
               let renderPitchIndex = NOTES.indexOf(note.pitch);
               if (isDragging && dragAction === 'move') {
                  renderPitchIndex = Math.max(0, Math.min(NOTES.length - 1, renderPitchIndex + localDragDelta.pitchIndex));
               }
               const yOffset = renderPitchIndex * CELL_HEIGHT;
               
               const minDurRender = snapInterval > 0 ? snapInterval : 0.1;
               const renderDur = (isDragging && dragAction === 'resize') 
                   ? Math.max(minDurRender, note.duration + localDragDelta.dur) 
                   : note.duration;
                   
               const isSelected = selectedNoteIds.includes(note.id);

               return (
                 <div key={note.id} 
                      onMouseDown={(e) => handleNoteMouseDown(e, note)}
                      className={`absolute fl-note flex items-center cursor-move shadow-[2px_2px_5px_rgba(0,0,0,0.4)] transition-colors ${isSelected ? '!bg-[#ff4444] border-[1px] !border-[#ffbbbb] z-50 shadow-[0_0_10px_rgba(255,50,50,0.7)]' : ''}`}
                      style={{ 
                         left: renderTime * CELL_WIDTH, 
                         top: yOffset, 
                         width: Math.max(2, renderDur * CELL_WIDTH), 
                         height: CELL_HEIGHT,
                      }}>
                     <div className={`absolute left-1 top-[2px] bottom-[2px] w-1.5 opacity-40 flex flex-col justify-between pointer-events-none ${isSelected ? 'brightness-200' : ''}`}>
                         <div className="w-full h-[1px] bg-black"/>
                         <div className="w-full h-[1px] bg-black"/>
                         <div className="w-full h-[1px] bg-black"/>
                     </div>
                     <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/40 transition-colors bg-white/10 rounded-r-[2px]" />
                 </div>
               );
            })}

            {/* Lasso Box Overlay */}
            {lassoBox && (
                 <div className="absolute border border-red-500 bg-red-500/20 pointer-events-none z-[100]"
                      style={{ left: lassoBox.x, top: lassoBox.y, width: lassoBox.w, height: lassoBox.h }} />
            )}
          </div>
        </div>

        {/* Velocity Automation */}
        <div className="h-[80px] bg-[var(--fl-panel-bg)] border-t border-[var(--fl-border)] flex shrink-0 shadow-[inset_0_3px_5px_rgba(0,0,0,0.2)] z-30">
           <div className="w-[60px] bg-[var(--fl-step-dark)] border-r border-[var(--fl-border)] flex flex-col px-1.5 py-1.5 text-[9px] font-bold text-[#e7ecef]">
              <div className="flex items-center gap-1 opacity-80 cursor-pointer text-white hover:text-white">
                 Control
                 <span className="text-[7px]">▼</span>
              </div>
              <div className="text-[var(--fl-text)] opacity-80 mt-1">Velocity</div>
           </div>
           
           <div className="flex-1 overflow-hidden" ref={(el) => { if(el && gridContainerRef.current) { el.scrollLeft = gridContainerRef.current.scrollLeft }}}>
                <div className="h-full flex items-end relative border-b border-[var(--fl-border)] bg-[#22272A] pb-[1px]" style={{ width: STEPS * CELL_WIDTH }}>
                   <div className="absolute inset-0 pointer-events-none" style={{
                      backgroundSize: `${CELL_WIDTH * 4}px 100%`,
                      backgroundImage: (() => {
                          const intervalTicks = snapInterval > 0 && snapInterval < 1 ? snapInterval : 1;
                          const pxPerLine = intervalTicks * CELL_WIDTH;
                          const linesPerBeat = Math.round(4 / intervalTicks);
                          let stops = [];
                          for(let i=0; i<linesPerBeat; i++) {
                              const offset = i * pxPerLine;
                              const width = i === 0 ? 2 : 1;
                              const color = i === 0 ? 'rgba(120,135,145,0.3)' : 'rgba(24,27,30,0.5)';
                              stops.push(`${color} ${offset}px, ${color} ${offset + width}px, transparent ${offset + width}px, transparent ${offset + pxPerLine}px`);
                          }
                          return `linear-gradient(to right, ${stops.join(', ')})`;
                      })()
                   }} />

                  {selectedTrack.notes.map(note => (
                       <div key={'vel-'+note.id} className="absolute bottom-0 w-[4px] cursor-ns-resize group" 
                            style={{ left: (note.time * CELL_WIDTH) + (CELL_WIDTH/2) - 2, height: `${Math.max(10, note.velocity * 100)}%` }}
                             onMouseDown={(e) => {
                                 if (!isProducer || !isMatchActive) return;
                                 e.preventDefault();
                                 e.stopPropagation();
                                 useDawStore.getState().commitHistory();
                                 if (!selectedNoteIds.includes(note.id)) setSelectedNoteIds([note.id]);
                                 const startY = e.clientY;
                                 const startVel = note.velocity;
                                 const handleVelMove = (eMove: MouseEvent) => {
                                     const delta = startY - eMove.clientY;
                                     const newVel = Math.max(0, Math.min(1, startVel + (delta * 0.01)));
                                     const targetIds = selectedNoteIds.includes(note.id) ? selectedNoteIds : [note.id];
                                     targetIds.forEach(id => {
                                         const n = selectedTrack.notes.find(nn => nn.id === id);
                                         if (n) {
                                              updateNote(selectedTrack.id, id, { velocity: Math.max(0, Math.min(1, n.velocity + (newVel - startVel))) });
                                         }
                                     });
                                 };
                                 const handleVelUp = () => { window.removeEventListener('mousemove', handleVelMove); window.removeEventListener('mouseup', handleVelUp); };
                                 window.addEventListener('mousemove', handleVelMove); window.addEventListener('mouseup', handleVelUp);
                             }}
                       >
                          <div className={`w-full h-full rounded-t-[1px] transition-all 
                               ${selectedNoteIds.includes(note.id) ? 'bg-[#ff4444] shadow-[0_0_5px_#ff4444,inset_1px_0_1px_rgba(255,255,255,0.5)]' : 'bg-[var(--fl-green)] shadow-[0_0_3px_var(--fl-green),inset_1px_0_1px_rgba(255,255,255,0.4)] group-hover:brightness-125'}`} />
                          <div className="absolute top-[-5px] left-[-3px] right-[-3px] h-3 bg-transparent" />
                       </div>
                  ))}
               </div>
           </div>
        </div>

      </div>
    </div>
  );
}
