import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useGameSocket = () => {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    const newSocket = io('/', {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('game_state', (state) => {
      setGameState(state);
    });

    newSocket.on('cards_dealt', (data) => {
      setLastEvent({ type: 'cards_dealt', data });
    });

    newSocket.on('round_result', (data) => {
      setLastEvent({ type: 'round_result', data });
    });

    // Social 2.0 Events
    newSocket.on('bingo_card_purchased', (data) => {
      setLastEvent({ type: 'bingo_card_purchased', data });
    });

    newSocket.on('mystery_drop', (data) => {
      setLastEvent({ type: 'mystery_drop', data });
    });

    newSocket.on('happy_hour_start', (data) => {
      setLastEvent({ type: 'happy_hour_start', data });
    });

    newSocket.on('happy_hour_end', (data) => {
      setLastEvent({ type: 'happy_hour_end', data });
    });

    newSocket.on('syndicate_update', (data) => {
      setLastEvent({ type: 'syndicate_update', data });
    });

    newSocket.on('treasury_contribution', (data) => {
      setLastEvent({ type: 'treasury_contribution', data });
    });

    newSocket.on('tip_received', (data) => {
      setLastEvent({ type: 'tip_received', data });
    });

    newSocket.on('streak_updated', (data) => {
      setLastEvent({ type: 'streak_updated', data });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  }, [socket]);

  return { socket, gameState, isConnected, lastEvent, emit };
};
