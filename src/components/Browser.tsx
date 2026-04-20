import React, { useRef, useState } from 'react';
import { useDawStore } from '../store/useDawStore';

const DEFAULT_PACKS = [
  { name: 'Current project', type: 'folder', children: [] },
  { name: 'Recent files', type: 'folder', children: [] },
  { name: 'Plugin database', type: 'folder', children: [] },
  { name: 'Plugin presets', type: 'folder', children: [] },
  { name: 'Channel presets', type: 'folder', children: [] },
  { name: 'Mixer presets', type: 'folder', children: [] },
  { name: 'Scores', type: 'folder', children: [] },
  { name: 'Backup', type: 'folder', children: [] },
  { name: 'Clipboard files', type: 'folder', children: [] },
  { name: 'Demo projects', type: 'folder', children: [] },
  { name: 'Envelopes', type: 'folder', children: [] },
  { name: 'Impulses', type: 'folder', children: [] },
  { name: 'Misc', type: 'folder', children: [] },
  { name: 'Packs', type: 'folder', children: [
     { name: 'Drums', type: 'folder', children: [
         { name: 'Kicks', type: 'folder', children: [{ name: 'Kick 808.wav', url: '' }, { name: 'Kick Basic.wav', url: '' }] },
         { name: 'Snares', type: 'folder', children: [{ name: 'Snare Clap.wav', url: '' }] }
     ]}
  ]},
  { name: 'Project bones', type: 'folder', children: [] },
  { name: 'Recorded', type: 'folder', children: [] },
  { name: 'Rendered', type: 'folder', children: [] },
  { name: 'Sliced audio', type: 'folder', children: [] },
  { name: 'Soundfonts', type: 'folder', children: [] },
  { name: 'Speech', type: 'folder', children: [] },
  { name: 'Templates', type: 'folder', children: [] },
];

export default function Browser() {
  const [expanded, setExpanded] = useState<string[]>(['Uploaded Sounds', 'Packs']);
  const { addTrack } = useDawStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadedSamples, setUploadedSamples] = useState<{name: string, url: string}[]>([]);

  const toggle = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const handleDoubleClick = (fileName: string, fileUrl: string) => {
    addTrack({
      id: `track-${Date.now()}`,
      name: fileName.replace('.wav', '').replace('.mp3', '').substring(0, 10),
      type: 'sampler',
      volume: 0.8, pan: 0, notes: [],
      attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.8,
      delayTime: 0, delayFeedback: 0,
      sampleUrl: fileUrl
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     
     const formData = new FormData();
     formData.append('sample', file);
     
     try {
       const ENV_BACKEND = import.meta.env.VITE_BACKEND_URL;
       const host = ENV_BACKEND ? ENV_BACKEND : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3001' : `http://${window.location.hostname}:3001`);
       const res = await fetch(`${host}/upload`, {
         method: 'POST', body: formData
       });
       if (!res.ok) throw new Error('Upload failed');
       const data = await res.json();
       
       setUploadedSamples(prev => [...prev, { name: file.name, url: data.url }]);
       setExpanded(prev => prev.includes('Uploaded Sounds') ? prev : [...prev, 'Uploaded Sounds']);
     } catch (err) {
       console.error(err);
     }
  };

  const renderItem = (item: any, depth: number = 0) => {
     const isExpanded = expanded.includes(item.name);
     const isFolder = item.type === 'folder' || item.children;
     
     return (
        <div key={item.name} className="flex flex-col">
           <div 
             className={`flex items-center py-[2px] cursor-pointer hover:bg-[#434F58] whitespace-nowrap overflow-hidden text-ellipsis border-t border-transparent group`}
             style={{ paddingLeft: `${4 + (depth * 12)}px` }}
             onClick={(e) => isFolder ? toggle(item.name, e) : null}
             onDoubleClick={() => !isFolder ? handleDoubleClick(item.name, item.url) : null}
           >
              {isFolder ? (
                 <>
                   <div className="w-[14px] flex justify-center text-[#748796] mt-[1px]">
                      {isExpanded ? '▾' : '▸'}
                   </div>
                   <div className="w-3 h-[10px] bg-[#6FA7B5] rounded-[1px] ml-1 mr-1.5 shadow-[inset_1px_1px_1px_rgba(255,255,255,0.4)] flex items-end">
                      <div className="w-full h-[3px] bg-[#538796] rounded-b-[1px]" />
                   </div>
                   <span className="text-[#A7BAC7] tracking-tight">{item.name}</span>
                 </>
              ) : (
                 <>
                   {/* Fl Studio sample icon: audio dot or waveform */}
                   <div className="w-3 h-3 flex items-center justify-center ml-[20px] mr-1.5 opacity-80 pointer-events-none">
                      <div className="w-1.5 h-1.5 bg-[#8DCC6C] rounded-full shadow-[0_0_2px_#8DCC6C]" />
                   </div>
                   <span className="text-[#A9CC8E] tracking-tight truncate group-hover:text-white transition-colors">{item.name}</span>
                 </>
              )}
           </div>
           
           {isFolder && isExpanded && item.children && (
              <div className="flex flex-col bg-[#353E44]">
                 {item.children.map((child: any) => renderItem(child, depth + 1))}
              </div>
           )}
        </div>
     );
  };

  return (
    <div className="w-[240px] h-full bg-[#353E44] flex flex-col border-r border-black shrink-0 text-[#adb6ba] z-10 font-sans shadow-[3px_0_10px_rgba(0,0,0,0.5)]">
       
       <div className="h-[24px] bg-[var(--fl-header)] px-2 flex items-center text-[11px] font-bold border-b border-[#22272A] justify-between shadow-sm">
           <span className="text-[#D0E2ED]">Browser - All</span>
           <span className="text-[#A1B8C7] hover:text-white cursor-pointer text-[10px]">▼</span>
       </div>
       
       <div className="flex-1 overflow-y-auto overflow-x-hidden pt-1 pb-4 text-[11px] font-semibold bg-[#3A454C] custom-scrollbar">
           
           {/* Upload UI Toolbar inside Browser */}
           <div className="mx-2 mb-2 pb-1 border-b border-[#2A3135] flex justify-between items-center mt-1">
              <div className="flex gap-1.5">
                 <div className="w-[18px] h-[18px] bg-[#4C5A63] border border-[#2A3135] rounded-sm shadow-[inset_1px_1px_2px_rgba(255,255,255,0.1)] flex justify-center items-center cursor-pointer hover:bg-[#5C6D78]">
                    <div className="w-2.5 h-[2px] bg-[#ABBAC4]" />
                 </div>
                 <div className="w-[18px] h-[18px] bg-[#4C5A63] border border-[#2A3135] rounded-sm shadow-[inset_1px_1px_2px_rgba(255,255,255,0.1)] flex justify-center items-center cursor-pointer hover:bg-[#5C6D78]">
                    <div className="w-1.5 h-1.5 border border-[#ABBAC4] rounded-sm" />
                 </div>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="fl-button text-[9px] px-2 h-[18px] rounded-[2px]"
              >
                 + Upload Sample
              </button>
              <input type="file" className="hidden" ref={fileInputRef} accept="audio/*" onChange={handleFileUpload} />
           </div>

           {/* User Uploads Extracted to match hierarchy */}
           {renderItem({
              name: 'Uploaded Sounds',
              type: 'folder',
              children: uploadedSamples.length > 0 ? uploadedSamples : [{ name: 'Right-click to upload...', url: '', type: 'dummy' }]
           })}

           {/* FL Default hierarchy mapped statically */}
           {DEFAULT_PACKS.map(pack => renderItem(pack))}
       </div>
    </div>
  );
}
