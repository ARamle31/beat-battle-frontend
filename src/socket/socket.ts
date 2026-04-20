import { io } from 'socket.io-client';
import { useLobbyStore } from '../store/useLobbyStore';
import { useDawStore } from '../store/useDawStore';

// Fallback to exactly 'localhost' for local development, or import.meta.env.VITE_BACKEND_URL for production
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : `http://${window.location.hostname}:3001`);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});

export const initSocket = () => {
  if (socket.connected) return;

  socket.connect();

  socket.on('connect', () => {
    console.log('Connected to socket server');
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

  // Relay producer state to judge
  socket.on('producer_state_update', (data) => {
    const { role, spectateTargetId } = useLobbyStore.getState();
    // Only apply if I am a judge AND this producer is the one I am spectating
    if (role === 'judge' && spectateTargetId === data.producerId) {
      useDawStore.getState().setState(data.state);
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from socket server');
  });
};
