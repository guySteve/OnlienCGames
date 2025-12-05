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

    // ===== BINGO EVENTS =====
    newSocket.on('bingo_card_purchased', (data) => {
      setLastEvent({ type: 'bingo_card_purchased', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bingo_ball_called', (data) => {
      setLastEvent({ type: 'bingo_ball_called', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bingo_game_started', (data) => {
      setLastEvent({ type: 'bingo_game_started', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bingo_round_reset', (data) => {
      setLastEvent({ type: 'bingo_round_reset', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bingo_room_created', (data) => {
      setLastEvent({ type: 'bingo_room_created', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bingo_room_joined', (data) => {
      setLastEvent({ type: 'bingo_room_joined', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bingo_winner', (data) => {
      setLastEvent({ type: 'bingo_winner', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bingo_pot_updated', (data) => {
      setLastEvent({ type: 'bingo_pot_updated', data });
      if (data.gameState) setGameState(data.gameState);
    });

    // ===== HEAD-TO-HEAD WAR EVENTS =====
    newSocket.on('private_war_created', (data) => {
      setLastEvent({ type: 'private_war_created', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('private_war_joined', (data) => {
      setLastEvent({ type: 'private_war_joined', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('opponent_joined', (data) => {
      setLastEvent({ type: 'opponent_joined', data });
      if (data.gameState) setGameState(data.gameState);
    });

    // ===== ROOM & GAME STATE EVENTS =====
    newSocket.on('room_created', (data) => {
      setLastEvent({ type: 'room_created', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('room_joined', (data) => {
      setLastEvent({ type: 'room_joined', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('seat_taken', (data) => {
      setLastEvent({ type: 'seat_taken', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('bet_placed', (data) => {
      setLastEvent({ type: 'bet_placed', data });
      if (data.gameState) setGameState(data.gameState);
    });

    newSocket.on('round_reset', (data) => {
      setLastEvent({ type: 'round_reset', data });
      if (data.gameState) setGameState(data.gameState);
    });

    // Social 2.0 Events

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
