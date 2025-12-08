// @/components/LetItRideTable.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Card = ({ card, isVisible = true }) => {
    if (!isVisible) {
        return <div className="w-24 h-36 bg-gray-700 rounded-lg shadow-lg border-2 border-gray-500" />;
    }
    return (
        <div className="w-24 h-36 bg-white rounded-lg shadow-lg flex flex-col items-center justify-center text-black">
            <div className="text-4xl">{card.suit}</div>
            <div className="text-2xl font-bold">{card.rank}</div>
        </div>
    );
};

const BetCircle = ({ label, amount, isActive }) => (
    <div className="flex flex-col items-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${isActive ? 'border-yellow-400 bg-yellow-500/20' : 'border-gray-600 bg-gray-800'}`}>
            <span className={`text-2xl font-bold ${isActive ? 'text-yellow-300' : 'text-gray-500'}`}>${amount}</span>
        </div>
        <span className="mt-2 text-sm font-bold text-white">{label}</span>
    </div>
);

export default function LetItRideTable({ socket, gameState, user }) {
    const [player, setPlayer] = useState(null);
    const [communityCards, setCommunityCards] = useState([null, null]);
    const [decisionPhase, setDecisionPhase] = useState(1);
    const [handResult, setHandResult] = useState(null);

    useEffect(() => {
        const handleStateUpdate = (data) => {
            if (data.gameState) {
                const myPlayer = data.gameState.players.find(p => p.userId === user.id);
                setPlayer(myPlayer);
                setCommunityCards(data.gameState.communityCards || [null, null]);
                setDecisionPhase(data.gameState.currentDecisionPhase);
            }
        };

        const handleHandComplete = (data) => {
            setHandResult(data);
            setTimeout(() => {
                setHandResult(null);
                handleStateUpdate(data);
            }, 5000); // Show result for 5 seconds
        }

        socket.on('game_state_update', handleStateUpdate);
        socket.on('hand_complete', handleHandComplete);

        // Set initial state
        handleStateUpdate({ gameState });

        return () => {
            socket.off('game_state_update', handleStateUpdate);
            socket.off('hand_complete', handleHandComplete);
        };
    }, [socket, user.id, gameState]);

    const handlePullBet = (betNumber) => {
        socket.emit('lir_decision', { decision: 'PULL_BACK', betNumber });
    };

    const handleLetItRide = (betNumber) => {
        socket.emit('lir_decision', { decision: 'LET_IT_RIDE', betNumber });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-gray-900 to-indigo-900 text-white flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl font-bold text-yellow-400 mb-8">Let It Ride</h1>
            
            {/* Community Cards */}
            <div className="mb-8">
                <h2 className="text-center text-xl mb-4">Community Cards</h2>
                <div className="flex gap-4">
                    <Card card={communityCards[0]} isVisible={decisionPhase > 1} />
                    <Card card={communityCards[1]} isVisible={decisionPhase > 2} />
                </div>
            </div>

            {player ? (
                <>
                    {/* Player Hand */}
                    <div className="mb-8">
                        <h2 className="text-center text-xl mb-4">Your Hand</h2>
                        <div className="flex gap-4">
                            {player.hand.map((card, i) => <Card key={i} card={card} />)}
                        </div>
                    </div>

                    {/* Bets */}
                    <div className="mb-8">
                        <h2 className="text-center text-xl mb-4">Your Bets</h2>
                        <div className="flex gap-8">
                            <BetCircle label="Bet 1" amount={player.bets.bet1.amount} isActive={player.bets.bet1.active} />
                            <BetCircle label="Bet 2" amount={player.bets.bet2.amount} isActive={player.bets.bet2.active} />
                            <BetCircle label="Bet 3" amount={player.bets.bet3.amount} isActive={player.bets.bet3.active} />
                        </div>
                    </div>

                    {/* Decision Buttons */}
                    {decisionPhase < 3 && (
                        <div>
                             <h2 className="text-center text-xl mb-4">Your Move (Bet {decisionPhase})</h2>
                             <div className="flex gap-4">
                                <button
                                    onClick={() => handlePullBet(decisionPhase)}
                                    className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-bold"
                                >
                                    Pull Bet
                                </button>
                                <button
                                    onClick={() => handleLetItRide(decisionPhase)}
                                    className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold"
                                >
                                    Let It Ride
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <p>Waiting to join game...</p>
            )}
        </div>
    );
}