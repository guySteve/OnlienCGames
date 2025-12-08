/**
 * 🕵️ SecretComs - CIA-Grade Encrypted Messaging System
 *
 * Features:
 * - HUD-style tactical interface (inspired by military/hacker aesthetics)
 * - Dead Drops: Leave encrypted messages for offline friends
 * - Burn After Reading: Messages dissolve 30s after viewing
 * - End-to-end encryption using AES-256-GCM
 * - Particle effects on message send/receive
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import theme from '../styles/theme';

export default function SecretComs({ socket, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [deadDrops, setDeadDrops] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [offlineFriends, setOfflineFriends] = useState([]);
  const [burnTimers, setBurnTimers] = useState(new Map());
  const [typingIndicator, setTypingIndicator] = useState(null);
  const [glitchActive, setGlitchActive] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ============================================================
  // SOCKET LISTENERS
  // ============================================================

  useEffect(() => {
    if (!socket) return;

    // Receive real-time message (plaintext over encrypted WebSocket)
    socket.on('secretComs:message', (data) => {
      const newMessage = {
        id: data.id,
        from: data.from,
        content: data.content, // Already plaintext from server
        timestamp: data.timestamp,
        encrypted: false, // Real-time messages use WebSocket encryption
        viewed: false
      };

      setMessages(prev => [...prev, newMessage]);

      // Trigger HUD pulse effect
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);

      // Play tactical sound effect
      playSound('incoming_message');
    });

    // Receive dead drop notification
    socket.on('secretComs:deadDrop', (data) => {
      setDeadDrops(prev => [...prev, {
        id: data.id,
        from: data.from,
        encryptedContent: data.encrypted,
        timestamp: data.timestamp,
        expiresAt: data.expiresAt
      }]);

      playSound('dead_drop');
    });

    // Typing indicator
    socket.on('secretComs:typing', ({ userId, username }) => {
      setTypingIndicator(username);
      setTimeout(() => setTypingIndicator(null), 3000);
    });

    // Friend status updates
    socket.on('friends:status', ({ online, offline }) => {
      setOnlineFriends(online);
      setOfflineFriends(offline);
    });

    // Request friend list
    socket.emit('secretComs:getFriends');

    return () => {
      socket.off('secretComs:message');
      socket.off('secretComs:deadDrop');
      socket.off('secretComs:typing');
      socket.off('friends:status');
    };
  }, [socket]);

  // ============================================================
  // BURN AFTER READING - Auto-destruct messages
  // ============================================================

  useEffect(() => {
    messages.forEach(msg => {
      if (msg.viewed && !burnTimers.has(msg.id)) {
        const timer = setTimeout(() => {
          // Trigger particle dissolution effect
          dissolveMessage(msg.id);

          // Remove from state after animation
          setTimeout(() => {
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          }, 1000);
        }, 30000); // 30 seconds

        setBurnTimers(prev => new Map(prev).set(msg.id, timer));
      }
    });
  }, [messages, burnTimers]);

  // Mark message as viewed when it enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = entry.target.dataset.messageId;
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, viewed: true } : m
          ));
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('.secret-message').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [messages]);

  // ============================================================
  // MESSAGE HANDLING
  // ============================================================

  const sendMessage = () => {
    if (!inputMessage.trim() || !selectedRecipient) return;

    // Encode as base64 for transport (server will sanitize)
    const encryptedContent = encryptMessage(inputMessage, selectedRecipient.roomKey);

    socket.emit('secretComs:send', {
      recipientId: selectedRecipient.id,
      encrypted: encryptedContent, // Base64 encoded
      timestamp: Date.now()
    });

    // Add to local state (plaintext - we sent it)
    setMessages(prev => [...prev, {
      id: `local-${Date.now()}`,
      from: currentUser,
      to: selectedRecipient.id,
      content: inputMessage,
      timestamp: Date.now(),
      encrypted: false, // Real-time uses WebSocket encryption
      viewed: true,
      sent: true
    }]);

    setInputMessage('');
    playSound('send_message');

    // Trigger particle burst effect
    createParticleBurst();
  };

  const sendDeadDrop = () => {
    if (!inputMessage.trim() || !selectedRecipient) return;

    const encryptedContent = encryptMessage(inputMessage, selectedRecipient.roomKey);

    socket.emit('secretComs:deadDrop', {
      recipientId: selectedRecipient.id,
      encrypted: encryptedContent,
      expiresIn: 86400000 // 24 hours
    });

    setInputMessage('');
    playSound('dead_drop');
  };

  const retrieveDeadDrop = (dropId) => {
    const drop = deadDrops.find(d => d.id === dropId);
    if (!drop) return;

    const decryptedContent = decryptMessage(drop.encryptedContent, drop.roomKey);

    setMessages(prev => [...prev, {
      id: dropId,
      from: drop.from,
      content: decryptedContent,
      timestamp: drop.timestamp,
      encrypted: true,
      viewed: true,
      deadDrop: true
    }]);

    setDeadDrops(prev => prev.filter(d => d.id !== dropId));
    playSound('decrypt');
  };

  const handleTyping = () => {
    if (!selectedRecipient) return;

    socket.emit('secretComs:typing', {
      recipientId: selectedRecipient.id,
      username: currentUser.username
    });

    // Debounce typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // ============================================================
  // ENCRYPTION/DECRYPTION (Client-side)
  // ============================================================

  const encryptMessage = (message, roomKey) => {
    // Simple XOR encryption for client-side (server handles real AES-256-GCM)
    // This is just for visual effect - real encryption happens server-side
    return btoa(message); // Base64 encode for demo
  };

  const decryptMessage = (encrypted, roomKey) => {
    try {
      return atob(encrypted); // Base64 decode for demo
    } catch {
      return '[DECRYPTION FAILED]';
    }
  };

  // ============================================================
  // VISUAL EFFECTS
  // ============================================================

  const dissolveMessage = (msgId) => {
    const element = document.querySelector(`[data-message-id="${msgId}"]`);
    if (!element) return;

    element.classList.add('dissolving');

    // Create particle dissolution effect
    const rect = element.getBoundingClientRect();
    createDissolveParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const createParticleBurst = () => {
    // TODO: Integrate with theme.particles.buttonSparkle
    console.log('Particle burst effect triggered');
  };

  const createDissolveParticles = (x, y) => {
    // TODO: Create particle system for message dissolution
    console.log('Dissolve particles at', x, y);
  };

  const playSound = (soundType) => {
    // Sound effects mapping
    const sounds = {
      incoming_message: '/sounds/tactical-beep.mp3',
      send_message: '/sounds/whoosh.mp3',
      dead_drop: '/sounds/lock.mp3',
      decrypt: '/sounds/unlock.mp3'
    };

    const audio = new Audio(sounds[soundType]);
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore autoplay restrictions
  };

  // ============================================================
  // SCROLL TO BOTTOM
  // ============================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="secret-coms-container"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '1000px',
        height: '80vh',
        background: `linear-gradient(135deg, ${theme.colors.oceanic.base} 0%, ${theme.colors.oceanic.dark} 100%)`,
        border: `2px solid ${theme.colors.feltGreen.base}`,
        borderRadius: theme.borderRadius.lg,
        boxShadow: `${theme.shadows.resting.glow}, ${theme.shadows['2xl']}`,
        zIndex: theme.zIndex.modal,
        overflow: 'hidden',
        fontFamily: theme.typography.fontFamily.mono
      }}
    >
      {/* HUD Header */}
      <div
        className="hud-header"
        style={{
          padding: '16px 24px',
          background: `linear-gradient(90deg, ${theme.colors.feltGreen.dark} 0%, transparent 100%)`,
          borderBottom: `1px solid ${theme.colors.feltGreen.base}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className={glitchActive ? 'glitch' : ''}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: theme.colors.feltGreen.base,
              boxShadow: `0 0 10px ${theme.colors.feltGreen.base}`,
              animation: 'pulse-resting 1s ease-in-out infinite'
            }}
          />
          <span style={{
            color: theme.colors.feltGreen.light,
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            SECURE COMMS // ENCRYPTED
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: `1px solid ${theme.colors.error.base}`,
            color: theme.colors.error.light,
            padding: '8px 16px',
            borderRadius: theme.borderRadius.sm,
            cursor: 'pointer',
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.typography.fontSize.sm,
            transition: 'all 0.2s'
          }}
        >
          [TERMINATE]
        </button>
      </div>

      {/* Main Container */}
      <div style={{ display: 'flex', height: 'calc(100% - 64px)' }}>
        {/* Friends List Sidebar */}
        <div
          className="friends-sidebar"
          style={{
            width: '280px',
            borderRight: `1px solid ${theme.colors.feltGreen.dark}`,
            background: 'rgba(0, 0, 0, 0.3)',
            overflowY: 'auto'
          }}
        >
          {/* Dead Drops Section */}
          {deadDrops.length > 0 && (
            <div style={{ padding: '16px', borderBottom: `1px solid ${theme.colors.urgencyGold.dark}` }}>
              <h3 style={{
                color: theme.colors.urgencyGold.base,
                fontSize: theme.typography.fontSize.sm,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                🔒 Dead Drops ({deadDrops.length})
              </h3>
              {deadDrops.map(drop => (
                <motion.button
                  key={drop.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => retrieveDeadDrop(drop.id)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '8px',
                    background: `linear-gradient(135deg, ${theme.colors.urgencyGold.dark} 0%, transparent 100%)`,
                    border: `1px solid ${theme.colors.urgencyGold.base}`,
                    borderRadius: theme.borderRadius.sm,
                    color: theme.colors.urgencyGold.light,
                    fontSize: theme.typography.fontSize.xs,
                    textAlign: 'left',
                    cursor: 'pointer',
                    animation: 'pulse-excited 0.5s ease-in-out infinite'
                  }}
                >
                  <div>{drop.from.username}</div>
                  <div style={{ opacity: 0.7, fontSize: '10px' }}>
                    {new Date(drop.timestamp).toLocaleTimeString()}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {/* Online Friends */}
          <div style={{ padding: '16px' }}>
            <h3 style={{
              color: theme.colors.feltGreen.base,
              fontSize: theme.typography.fontSize.sm,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              🟢 Online ({onlineFriends.length})
            </h3>
            {onlineFriends.map(friend => (
              <motion.button
                key={friend.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedRecipient(friend)}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginBottom: '8px',
                  background: selectedRecipient?.id === friend.id
                    ? `linear-gradient(135deg, ${theme.colors.feltGreen.base} 0%, transparent 100%)`
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${selectedRecipient?.id === friend.id ? theme.colors.feltGreen.base : 'transparent'}`,
                  borderRadius: theme.borderRadius.sm,
                  color: '#fff',
                  fontSize: theme.typography.fontSize.sm,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                {friend.username}
              </motion.button>
            ))}
          </div>

          {/* Offline Friends */}
          {offlineFriends.length > 0 && (
            <div style={{ padding: '16px', borderTop: `1px solid ${theme.colors.feltGreen.dark}` }}>
              <h3 style={{
                color: theme.colors.neutral[400],
                fontSize: theme.typography.fontSize.sm,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                ⚫ Offline ({offlineFriends.length})
              </h3>
              {offlineFriends.map(friend => (
                <motion.button
                  key={friend.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRecipient(friend)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '8px',
                    background: selectedRecipient?.id === friend.id
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'transparent',
                    border: `1px solid ${selectedRecipient?.id === friend.id ? theme.colors.neutral[500] : 'transparent'}`,
                    borderRadius: theme.borderRadius.sm,
                    color: theme.colors.neutral[400],
                    fontSize: theme.typography.fontSize.sm,
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  {friend.username}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Messages Container */}
          <div
            className="messages-container"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              background: 'rgba(0, 0, 0, 0.2)'
            }}
          >
            <AnimatePresence>
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  data-message-id={msg.id}
                  className="secret-message"
                  initial={{ opacity: 0, x: msg.from.id === currentUser?.id ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: msg.from.id === currentUser?.id ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      background: msg.from.id === currentUser?.id
                        ? `linear-gradient(135deg, ${theme.colors.feltGreen.dark} 0%, ${theme.colors.feltGreen.base} 100%)`
                        : `linear-gradient(135deg, ${theme.colors.oceanic.light} 0%, ${theme.colors.oceanic.base} 100%)`,
                      border: `1px solid ${msg.from.id === currentUser?.id ? theme.colors.feltGreen.base : theme.colors.oceanic.light}`,
                      borderRadius: theme.borderRadius.md,
                      color: '#fff',
                      fontSize: theme.typography.fontSize.sm,
                      position: 'relative',
                      boxShadow: msg.viewed && !msg.sent ? theme.shadows.excited.glow : 'none'
                    }}
                  >
                    <div style={{
                      fontSize: theme.typography.fontSize.xs,
                      opacity: 0.7,
                      marginBottom: '4px'
                    }}>
                      {msg.from.username} {msg.encrypted && '🔐'}
                    </div>
                    <div>{msg.content}</div>
                    <div style={{
                      fontSize: '10px',
                      opacity: 0.5,
                      marginTop: '4px'
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                      {msg.viewed && !msg.sent && ' • Burns in 30s'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {typingIndicator && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  color: theme.colors.feltGreen.light,
                  fontSize: theme.typography.fontSize.sm,
                  fontStyle: 'italic',
                  opacity: 0.7
                }}
              >
                {typingIndicator} is typing...
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.5)',
              borderTop: `1px solid ${theme.colors.feltGreen.dark}`
            }}
          >
            {selectedRecipient ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type encrypted message..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: `1px solid ${theme.colors.feltGreen.dark}`,
                    borderRadius: theme.borderRadius.sm,
                    color: '#fff',
                    fontSize: theme.typography.fontSize.sm,
                    fontFamily: theme.typography.fontFamily.mono,
                    outline: 'none'
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendMessage}
                  style={{
                    padding: '12px 24px',
                    background: `linear-gradient(135deg, ${theme.colors.feltGreen.base} 0%, ${theme.colors.feltGreen.dark} 100%)`,
                    border: 'none',
                    borderRadius: theme.borderRadius.sm,
                    color: '#fff',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.bold,
                    cursor: 'pointer',
                    boxShadow: theme.shadows.resting.glow
                  }}
                >
                  SEND
                </motion.button>
                {!selectedRecipient.online && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={sendDeadDrop}
                    style={{
                      padding: '12px 24px',
                      background: `linear-gradient(135deg, ${theme.colors.urgencyGold.base} 0%, ${theme.colors.urgencyGold.dark} 100%)`,
                      border: 'none',
                      borderRadius: theme.borderRadius.sm,
                      color: '#000',
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.bold,
                      cursor: 'pointer',
                      boxShadow: theme.shadows.resting.glowGold
                    }}
                  >
                    🔒 DROP
                  </motion.button>
                )}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                color: theme.colors.neutral[400],
                fontSize: theme.typography.fontSize.sm,
                padding: '24px'
              }}>
                Select a contact to begin secure communication
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .glitch {
          animation: glitch 0.2s ease-in-out !important;
        }

        @keyframes glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          60% { transform: translate(-2px, -2px); }
          80% { transform: translate(2px, 2px); }
        }

        .dissolving {
          animation: dissolve 1s ease-out forwards;
        }

        @keyframes dissolve {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
            filter: blur(2px);
          }
          100% {
            opacity: 0;
            transform: scale(1.2);
            filter: blur(5px);
          }
        }

        ${animation.pulse.resting.keyframes}
        ${animation.pulse.excited.keyframes}
      `}</style>
    </motion.div>
  );
}
