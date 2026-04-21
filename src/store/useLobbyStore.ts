import { create } from 'zustand';

export type Role = 'host' | 'judge' | 'producer' | null;

interface User {
  id: string;
  role: Role;
  username: string;
}

interface RoomState {
  id: string;
  host: string;
  mode: 'battle' | 'multiplayer';
  status: 'waiting' | 'active' | 'finished' | 'voting' | 'awarded';
  users: User[];
  matchTimeRemaining: number;
  showcaseIndex?: number;
  showcaseQueue?: string[];
  votes?: Record<string, string>;
}

export interface PublicRoom {
  id: string;
  usersCount: number;
  status: 'waiting' | 'active';
  mode: 'battle' | 'multiplayer';
}

interface LobbyState {
  roomId: string | null;
  role: Role;
  username: string;
  room: RoomState | null;
  publicRooms: PublicRoom[];
  spectateTargetId: string | null; // For judges
  judgeWatching: string | null; // The exact producer username the judge is spectating
  matchDuration: number; // in minutes
  matchMode: 'battle' | 'multiplayer';
  
  setLobbyState: (state: Partial<LobbyState>) => void;
  setRoomState: (room: RoomState) => void;
  setPublicRooms: (rooms: PublicRoom[]) => void;
  setSpectateTargetId: (id: string | null) => void;
  setJudgeWatching: (username: string | null) => void;
  reset: () => void;
}

const savedUserStr = localStorage.getItem('beatbattle_user');
const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;

export const useLobbyStore = create<LobbyState>((set) => ({
  roomId: null,
  role: savedUser?.role || null,
  username: savedUser?.username || '',
  room: null,
  publicRooms: [],
  spectateTargetId: null,
  judgeWatching: null,
  matchDuration: 10, // Default 10 mins
  matchMode: 'battle',

  setLobbyState: (newState) => set((state) => {
     if (newState.username !== undefined || newState.role !== undefined) {
         localStorage.setItem('beatbattle_user', JSON.stringify({ 
            username: newState.username ?? state.username, 
            role: newState.role ?? state.role 
         }));
     }
     return { ...state, ...newState };
  }),
  setRoomState: (room) => set({ room }),
  setPublicRooms: (publicRooms) => set({ publicRooms }),
  setSpectateTargetId: (spectateTargetId) => set({ spectateTargetId }),
  setJudgeWatching: (judgeWatching) => set({ judgeWatching }),
  reset: () => set({ roomId: null, role: null, username: '', room: null, publicRooms: [], spectateTargetId: null, judgeWatching: null, matchDuration: 10, matchMode: 'battle' })
}));
