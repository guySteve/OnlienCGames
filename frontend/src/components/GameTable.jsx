/**
 * GameTable.jsx - No-Scroll Casino Game Table
 *
 * VegasCore 2.0 Features:
 * - 100dvh fixed viewport with zero scrolling
 * - Deep Emerald (#014421) felt aesthetic with curved table design
 * - Anime.js powered animations
 * - Fitts's Law optimized layout (thumb zone ergonomics)
 * - Safe area inset support for notched devices
 * - Visual feedback (glow effects) instead of text overlays
 * - Chip animations for wins/losses
 * - Immersive sound effects for player events
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useGameAnimations } from '../hooks/useGameAnimations';
import { useSoundEffects } from '../hooks/useSoundEffects';

// Card component with no framer-motion
const Card = ({ rank, suit, hidden, index = 0, size = 'normal', isWinner, isLoser, cardRef, fourColorMode = false }) => {
  // Four-color mode for accessibility (colorblind users)
  const getSuitColor = () => {
    if (fourColorMode) {
      switch (suit) {
        case '♥': return 'text-red-600';      // Hearts: Red
        case '♦': return 'text-blue-500';     // Diamonds: Blue
        case '♣': return 'text-emerald-600';  // Clubs: Green
        case '♠': return 'text-slate-900';    // Spades: Black
        default: return 'text-slate-900';
      }
    }
    return (suit === '♥' || suit === '♦') ? 'text-red-600' : 'text-slate-900';
  };

  const sizeClasses = {
    micro: 'w-8 h-11 text-xs',
    compact: 'w-12 h-16 text-sm',
    normal: 'w-16 h-22 text-base',
    large: 'w-24 h-34 text-xl'
  };

  const baseClasses = `
    ${sizeClasses[size]}
    rounded-lg shadow-lg transition-all duration-300
    ${isWinner ? 'ring-4 ring-yellow-400 shadow-yellow-400/50' : ''}
    ${isLoser ? 'opacity-60' : ''}
  `;

  if (hidden) {
    return (
      <div
        ref={cardRef}
        className={`${baseClasses} bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-dashed border-blue-400/50 flex items-center justify-center`}
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="w-3/4 h-3/4 rounded border border-blue-400/30 bg-blue-900/50" />
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`${baseClasses} bg-gradient-to-br from-white to-gray-100 border border-white/20 flex flex-col items-center justify-center p-1`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <span className={`font-bold leading-none ${getSuitColor()}`}>
        {rank}
      </span>
      <span className={`text-lg leading-none ${getSuitColor()}`}>
        {suit}
      </span>
    </div>
  );
};

// Chip Stack component
const ChipStack = ({ amount, chipRef }) => {
  const getChipCount = (amt) => {
    if (amt >= 500) return 5;
    if (amt >= 100) return 4;
    if (amt >= 50) return 3;
    if (amt >= 25) return 2;
    return 1;
  };

  const chipColors = [
    'bg-gradient-to-br from-red-500 to-red-700',
    'bg-gradient-to-br from-blue-500 to-blue-700',
    'bg-gradient-to-br from-green-500 to-green-700',
    'bg-gradient-to-br from-black to-gray-800',
    'bg-gradient-to-br from-purple-500 to-purple-700'
  ];

  return (
    <div ref={chipRef} className="flex flex-col-reverse items-center">
      {Array.from({ length: getChipCount(amount) }, (_, i) => (
        <div
          key={i}
          className={`w-8 h-8 rounded-full ${chipColors[i % chipColors.length]} border-2 border-white/30 shadow-md -mt-6 first:mt-0`}
          style={{ transform: `translateY(${i * -4}px)` }}
        />
      ))}
      <span className="mt-1 text-xs font-mono text-yellow-400 bg-black/60 px-2 py-0.5 rounded">
        ${amount}
      </span>
    </div>
  );
};

// Betting Spot component - represents one betting position
const BettingSpot = ({
  spot,
  seatIndex,
  spotIndex,
  onBet,
  onRemoveBet,
  myPlayerId,
  isWinner,
  isLoser
}) => {
  const hasBet = spot && spot.bet > 0;
  const isMyBet = hasBet && spot.playerId === myPlayerId;

  return (
    <div className="relative flex flex-col items-center">
      {/* Betting Circle */}
      <div
        onClick={() => hasBet ? null : onBet(seatIndex, spotIndex)}
        className={`
          w-16 h-16 rounded-full border-2 flex items-center justify-center
          transition-all duration-300 cursor-pointer
          ${hasBet
            ? `border-4 bg-black/50`
            : 'border-dashed border-yellow-500/30 bg-black/20 hover:bg-yellow-500/10 hover:border-yellow-500/60'
          }
          ${isWinner ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
          ${isLoser ? 'opacity-60' : ''}
        `}
        style={{
          borderColor: hasBet ? spot.playerColor : undefined,
          boxShadow: hasBet ? `0 0 20px ${spot.playerColor}80` : undefined
        }}
      >
        {hasBet ? (
          <div className="flex flex-col items-center">
            <ChipStack amount={spot.bet} />
          </div>
        ) : (
          <span className="text-yellow-500/40 text-xl">+</span>
        )}
      </div>

      {/* Card display */}
      {spot?.card && (
        <div className="mt-2">
          <Card
            {...spot.card}
            size="compact"
            isWinner={isWinner}
            isLoser={isLoser}
          />
        </div>
      )}

      {/* Player name tag */}
      {hasBet && (
        <div
          className="mt-1 text-xs px-2 py-0.5 rounded-full text-white font-medium"
          style={{ backgroundColor: spot.playerColor }}
        >
          {spot.playerName}
        </div>
      )}

      {/* Remove bet button (only for my bets) */}
      {isMyBet && (
        <button
          onClick={() => onRemoveBet(seatIndex, spotIndex)}
          className="mt-1 text-xs text-red-400/70 hover:text-red-400 underline"
        >
          Remove
        </button>
      )}
    </div>
  );
};

// Table Seat component - contains 4 betting spots
const TableSeat = ({
  seat,
  seatIndex,
  onBet,
  onRemoveBet,
  myPlayerId,
  seatRef
}) => {
  // Position styles for curved table layout
  const positionStyles = {
    0: { bottom: '5%', left: '50%', transform: 'translateX(-50%)' }, // Center bottom
    1: { bottom: '15%', left: '15%' },
    2: { bottom: '30%', left: '5%' },
    3: { bottom: '30%', right: '5%' },
    4: { bottom: '15%', right: '15%' }
  };

  return (
    <div
      ref={seatRef}
      className="absolute flex gap-2"
      style={positionStyles[seatIndex]}
    >
      {/* 4 betting spots */}
      {seat.spots.map((spot, spotIndex) => (
        <BettingSpot
          key={spotIndex}
          spot={spot}
          seatIndex={seatIndex}
          spotIndex={spotIndex}
          onBet={onBet}
          onRemoveBet={onRemoveBet}
          myPlayerId={myPlayerId}
        />
      ))}

      {/* Seat number label */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-yellow-500/40">
        Seat {seatIndex + 1}
      </div>
    </div>
  );
};

// Main GameTable Component
const GameTable = ({ gameState, myPlayerId, onBet, onRemoveBet, onJoinGame, onLeaveGame }) => {
  const animations = useGameAnimations();
  const { playPlayerJoin, playPlayerLeave, playCardDeal, playWin, playLose, initAudio } = useSoundEffects();
  const tableRef = useRef(null);
  const dealerCardRef = useRef(null);
  const potRef = useRef(null);
  const seatRefs = useRef([]);

  // Get my player info
  const myPlayer = gameState?.players?.find(p => p.playerId === myPlayerId);
  const prevCardCountRef = useRef(0);

  // Initialize audio on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [initAudio]);

  // No player seat tracking needed in new multi-spot system

  // Play card deal sound when new cards are dealt
  useEffect(() => {
    // Count total cards on table
    const dealerCards = gameState?.houseCard ? 1 : 0;
    let playerCards = 0;

    // Count cards in all betting spots
    if (gameState?.seats) {
      for (const seat of gameState.seats) {
        for (const spot of seat.spots) {
          if (spot?.card) playerCards++;
        }
      }
    }

    const currentCardCount = dealerCards + playerCards;

    // Play sound if more cards appeared
    if (currentCardCount > prevCardCountRef.current && prevCardCountRef.current >= 0) {
      const newCards = currentCardCount - prevCardCountRef.current;
      // Play deal sound for each new card with slight delay
      for (let i = 0; i < newCards; i++) {
        setTimeout(() => playCardDeal(), i * 150);
      }
    }

    prevCardCountRef.current = currentCardCount;
  }, [gameState?.houseCard, gameState?.seats, playCardDeal]);

  // Determine winner/loser for visual feedback (per betting spot)
  const getWinnerLoserState = useCallback(() => {
    if (!gameState?.seats || !gameState?.houseCard) return {};

    const houseValue = gameState.houseCard.value || 0;
    const result = {};

    // Check each betting spot
    gameState.seats.forEach((seat, seatIdx) => {
      seat.spots.forEach((spot, spotIdx) => {
        if (spot?.card && spot.bet > 0) {
          const key = `${seatIdx}-${spotIdx}`;
          const spotValue = spot.card.value;

          if (spotValue > houseValue) {
            result[key] = 'winner';
          } else if (spotValue < houseValue) {
            result[key] = 'loser';
          }
        }
      });
    });

    return result;
  }, [gameState]);

  const winLoseState = getWinnerLoserState();

  // Animate pot when it changes
  useEffect(() => {
    if (potRef.current && gameState?.pot > 0) {
      animations.pulsePot(potRef.current);
    }
  }, [gameState?.pot, animations]);

  // Handle win animations with sound (for betting spots)
  useEffect(() => {
    Object.entries(winLoseState).forEach(([key, state]) => {
      const [seatIdx, spotIdx] = key.split('-');
      const seatRef = seatRefs.current[seatIdx];

      if (state === 'winner' && seatRef) {
        animations.winGlow(seatRef);
        playWin();
        // Confetti for winners
        const center = animations.getElementCenter(seatRef);
        animations.confetti(center, 15);
      } else if (state === 'loser' && seatRef) {
        animations.lossShake(seatRef);
        playLose();
      }
    });
  }, [winLoseState, animations, playWin, playLose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => animations.cleanup();
  }, [animations]);

  // Private War waiting state
  const isWaitingForOpponent = gameState?.isPrivate && gameState?.waitingForOpponent;

  return (
    <div className="game-container no-select">
      {/* Background Layer - Deep Emerald Felt Texture */}
      <div className="absolute inset-0 felt-bg-emerald" />

      {/* Spotlight Effect */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/60" />

      {/* Top Bar - Dealer/House Area (Respects Safe Area) */}
      <div className="absolute top-0 left-0 right-0 h-36 flex items-center justify-center z-30 pt-[var(--safe-area-top)]">
        <div className="flex flex-col items-center gap-2">
          {/* Dealer Title */}
          <div className="text-xs font-bold text-yellow-500/60 uppercase tracking-widest">
            Dealer
          </div>
          
          <div className="flex items-center gap-4 bg-black/50 backdrop-blur-md rounded-2xl px-6 py-4 border border-yellow-500/30 shadow-2xl">
            {/* Dealer Avatar - More prominent */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex items-center justify-center text-3xl shadow-xl border-2 border-yellow-300/50 animate-pulse-slow">
                {gameState?.gameType === 'BLACKJACK' ? '🎩' : '🃏'}
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-black animate-pulse" />
            </div>

            {/* Dealer Card(s) with dealing animation */}
            <div ref={dealerCardRef} className="flex gap-2 min-w-[120px] justify-center">
              {gameState?.houseCard ? (
                <div className="animate-deal-card">
                  <Card {...gameState.houseCard} size="normal" />
                </div>
              ) : gameState?.dealerHand?.length > 0 ? (
                gameState.dealerHand.map((card, i) => (
                  <div 
                    key={i} 
                    className="animate-deal-card"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <Card {...card} index={i} size="normal" hidden={i === 1 && gameState?.dealerHand?.length === 2 && gameState?.status !== 'RESOLVING'} />
                  </div>
                ))
              ) : (
                /* Card Shoe / Deck */
                <div className="relative">
                  <div className="w-16 h-22 rounded-lg bg-gradient-to-br from-blue-900 to-blue-950 border-2 border-blue-400/30 flex items-center justify-center shadow-xl">
                    <div className="w-12 h-16 rounded border border-blue-400/20 bg-blue-900/50 flex items-center justify-center">
                      <span className="text-blue-400/60 text-xs font-bold">DECK</span>
                    </div>
                  </div>
                  {/* Stacked cards effect */}
                  <div className="absolute -top-1 -left-1 w-16 h-22 rounded-lg bg-blue-950 border border-blue-400/20 -z-10" />
                  <div className="absolute -top-2 -left-2 w-16 h-22 rounded-lg bg-blue-950/80 border border-blue-400/10 -z-20" />
                </div>
              )}
            </div>

            {/* Pot Display */}
            {gameState?.pot > 0 && (
              <div
                ref={potRef}
                className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full px-5 py-3 border border-yellow-500/40 shadow-lg shadow-yellow-500/10"
              >
                <span className="text-yellow-400 font-mono font-bold text-xl">
                  ${gameState.pot.toLocaleString()}
                </span>
                <span className="text-yellow-500/60 text-xs ml-1">POT</span>
              </div>
            )}
          </div>
          
          {/* Dealer Status Message */}
          {gameState?.status && (
            <div className="text-sm font-medium text-white/80 bg-black/40 px-4 py-1 rounded-full">
              {gameState.status === 'PLACING_BETS' && '💰 Place your bets!'}
              {gameState.status === 'DEALING' && '🎴 Dealing cards...'}
              {gameState.status === 'PLAYER_TURN' && '🤔 Your turn'}
              {gameState.status === 'DEALER_TURN' && '🎩 Dealer\'s turn'}
              {gameState.status === 'RESOLVING' && '✨ Revealing...'}
              {gameState.status === 'COMPLETE' && '🏆 Round complete!'}
            </div>
          )}
        </div>
      </div>

      {/* Center Table Area - Curved Felt */}
      <div
        ref={tableRef}
        className="absolute inset-x-0 top-36 bottom-24 flex items-center justify-center"
      >
        {/* Table Surface - Elliptical */}
        <div className="relative w-full max-w-4xl h-full mx-4">
          {/* Table felt surface - Deep Emerald */}
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-[#026b3a] to-[#014421] border-8 border-amber-900 shadow-2xl overflow-hidden">
            {/* Table pattern */}
            <div className="absolute inset-4 rounded-[50%] border-2 border-yellow-600/20" />
            <div className="absolute inset-8 rounded-[50%] border border-yellow-600/10" />

            {/* Center logo/text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center opacity-20">
                <div className="text-3xl font-black text-yellow-500 tracking-widest">
                  {gameState?.gameType || 'CASINO WAR'}
                </div>
                {gameState?.isPrivate && (
                  <div className="text-sm text-yellow-400 mt-1">
                    PRIVATE GAME
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Seats with Betting Spots */}
          {gameState?.seats?.map((seat, seatIndex) => (
            <TableSeat
              key={seatIndex}
              seat={seat}
              seatIndex={seatIndex}
              onBet={onBet}
              onRemoveBet={onRemoveBet}
              myPlayerId={myPlayerId}
              seatRef={(el) => seatRefs.current[seatIndex] = el}
            />
          ))}
        </div>
      </div>

      {/* Private Game Waiting Overlay */}
      {isWaitingForOpponent && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900/90 rounded-2xl p-8 text-center border border-yellow-500/30 shadow-2xl max-w-sm">
            <div className="text-4xl mb-4 animate-bounce">⚔️</div>
            <h3 className="text-2xl font-bold text-white mb-2">Waiting for Opponent</h3>
            <p className="text-slate-400 mb-4">Share this code with your friend:</p>
            <div className="bg-black/50 rounded-xl px-6 py-4 border border-yellow-500/40">
              <span className="text-3xl font-mono font-bold text-yellow-400 tracking-widest">
                {gameState?.tableCode}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-4">Game will start when opponent joins</p>
          </div>
        </div>
      )}

      {/* Players HUD - Top Left */}
      {gameState?.players && gameState.players.length > 0 && (
        <div className="absolute top-20 left-4 bg-black/50 backdrop-blur-md rounded-xl p-3 border border-white/10 z-30 max-w-xs">
          <div className="text-xs text-yellow-500/60 uppercase mb-2 font-bold">Players</div>
          <div className="space-y-2">
            {gameState.players.map((player) => (
              <div
                key={player.playerId}
                className="flex items-center gap-2 text-sm"
                style={{ borderLeft: `3px solid ${player.color}`, paddingLeft: '8px' }}
              >
                <div className="flex-1">
                  <div className="text-white font-medium">{player.name}</div>
                  <div className="text-emerald-400 text-xs font-mono">${player.chips?.toLocaleString()}</div>
                </div>
                {player.playerId === myPlayerId && (
                  <span className="text-yellow-400 text-xs">YOU</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Status Bar - Royal Blue UI Chrome with Safe Area */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-[#2980B9]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-center z-30 pb-[var(--safe-area-bottom)]">
        <div className="text-center">
          {gameState?.status && (
            <div className={`
              text-lg font-medium px-6 py-2 rounded-full
              ${gameState?.bettingPhase
                ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
                : 'bg-yellow-500/20 text-yellow-100 border border-yellow-400/30'
              }
            `}>
              {gameState.status}
            </div>
          )}
          {!myPlayer && (
            <div className="text-white/80">
              Click "Join Game" to start playing
            </div>
          )}
        </div>
      </div>

      {/* Shoe (Deck) Position Indicator - Top Right */}
      <div className="absolute top-4 right-4 w-16 h-20 z-20">
        <div className="relative">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute w-12 h-16 rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600/30 shadow-md"
              style={{
                transform: `translateY(${i * -2}px) translateX(${i * 2}px)`,
                zIndex: 3 - i
              }}
            />
          ))}
        </div>
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/40">SHOE</span>
      </div>
    </div>
  );
};

export default GameTable;
