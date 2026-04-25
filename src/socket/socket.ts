import { io } from 'socket.io-client';
import { useLobbyStore } from '../store/useLobbyStore';

// Fallback to exactly 'localhost' for local development, or import.meta.env.VITE_BACKEND_URL for production
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : `http://${window.location.hostname}:3001`);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 300,
  reconnectionDelayMax: 1500,
});

export const NETWORK_LEAD_MS = 80;

type NetworkStats = {
  latencyMs: number;
  offsetMs: number;
  synced: boolean;
};

let listenersInitialized = false;
let clockTimer: number | null = null;
let networkStats: NetworkStats = {
  latencyMs: 0,
  offsetMs: 0,
  synced: false,
};
const networkSubscribers = new Set<(stats: NetworkStats) => void>();

const publishNetworkStats = () => {
  const snapshot = { ...networkStats };
  networkSubscribers.forEach(listener => listener(snapshot));
};

const sendClockPing = () => {
  if (!socket.connected) return;
  socket.emit('clock_ping', { clientSentAt: Date.now() });
};

export const getServerNow = () => Date.now() + networkStats.offsetMs;

export const getNetworkStats = () => ({ ...networkStats });

export const subscribeNetworkStats = (listener: (stats: NetworkStats) => void) => {
  networkSubscribers.add(listener);
  listener(getNetworkStats());
  return () => {
    networkSubscribers.delete(listener);
  };
};

export const initSocket = () => {
  if (!listenersInitialized) {
    listenersInitialized = true;

    socket.on('connect', () => {
      console.log('Connected to socket server');
      sendClockPing();
    });

    socket.on('clock_pong', ({ clientSentAt, serverTime }: { clientSentAt: number; serverTime: number }) => {
      const clientReceivedAt = Date.now();
      const roundTrip = Math.max(0, clientReceivedAt - clientSentAt);
      const latencyMs = roundTrip / 2;
      const estimatedServerNow = serverTime + latencyMs;
      const offsetMs = estimatedServerNow - clientReceivedAt;
      const smoothing = networkStats.synced ? 0.2 : 1;

      networkStats = {
        latencyMs: Math.round(networkStats.latencyMs + ((latencyMs - networkStats.latencyMs) * smoothing)),
        offsetMs: networkStats.offsetMs + ((offsetMs - networkStats.offsetMs) * smoothing),
        synced: true,
      };
      publishNetworkStats();
    });

    socket.on('room_state_update', (roomState) => {
      useLobbyStore.getState().setRoomState(roomState);
    });

    socket.on('room_list_update', (publicRooms) => {
      useLobbyStore.getState().setPublicRooms(publicRooms);
    });

    socket.on('timer_update', (data) => {
      const room = useLobbyStore.getState().room;
      if (room) {
        useLobbyStore.getState().setRoomState({
          ...room,
          matchTimeRemaining: data.time,
          status: data.status
        });
      }
    });

    socket.on('match_started', (data) => {
      const room = useLobbyStore.getState().room;
      if (room) {
        useLobbyStore.getState().setRoomState({
          ...room,
          status: data.status,
          matchTimeRemaining: data.time
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });
  }

  if (clockTimer === null) {
    clockTimer = window.setInterval(sendClockPing, 5000);
  }

  if (!socket.connected) {
    socket.connect();
  } else {
    sendClockPing();
  }
};
