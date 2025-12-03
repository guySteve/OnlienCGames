// Client for lobby, chat, auth, visual table, multi-seat War, and auto-dealer
let socket;
let gameState = null;
let roomId = null;
let startingChips = 1000;
let auth = { authenticated: false, user: null };
// Multi-seat support: array of seat indices the user occupies
let mySeats = []; // Array of seat indices

async function fetchMe() {
  try { 
    const r = await fetch('/me'); 
    auth = await r.json(); 
    
    // Show avatar setup for new users
    if (auth.authenticated && auth.user.needsAvatarSetup) {
      setTimeout(() => openProfileModal(), 500);
    }
  } catch { 
    auth = { authenticated: false }; 
  }
  renderAuth();
}

function initSocket() {
  if (socket) return;
  socket = io();
  // Lobby
  socket.on('rooms_list', renderRooms);
  socket.on('rooms_update', renderRooms);
  socket.on('lobby_message', addLobbyMessage);
  // Friends and invites
  socket.on('friend_request', handleFriendRequest);
  socket.on('table_invite', handleTableInvite);
  socket.on('invite_accepted', handleInviteAccepted);
  socket.on('chips_received', handleChipsReceived);
  // Room
  socket.on('room_created', (data) => { 
    roomId = data.roomId; 
    gameState = data.gameState; 
    startingChips = data.startingChips || 1000;
    mySeats = []; // Start as observer
    showGame(); 
    renderTable(); 
  });
  socket.on('room_joined', (data) => {
    roomId = data.roomId;
    gameState = data.gameState;
    startingChips = data.startingChips || 1000;
    mySeats = []; // Start as observer
    showGame();
    renderTable();
  });
  socket.on('observer_joined', (data) => { 
    gameState = data.gameState;
    renderTable(); 
  });
  socket.on('seat_taken', (data) => { 
    gameState = data.gameState;
    updateMySeats();
    renderTable(); 
  });
  socket.on('seat_left', (data) => { 
    gameState = data.gameState;
    updateMySeats();
    renderTable(); 
  });
  socket.on('game_state', (data) => { gameState = data.gameState; updateMySeats(); renderTable(); });
  socket.on('bet_placed', (data) => { gameState = data.gameState; renderTable(); });
  socket.on('bets_locked', (data) => { gameState = data.gameState; log("Bets locked"); renderTable(); });
  socket.on('cards_dealt', (data) => { gameState = data.gameState; renderTable(); });
  socket.on('house_reveal', (data) => { gameState = data.gameState; log("House reveals card"); renderTable(); });
  socket.on('round_result', (data) => { gameState = data.gameState; showRoundResult(data.result); renderTable(); });
  socket.on('round_reset', (data) => { gameState = data.gameState; resetRoundUI(); renderTable(); });
  socket.on('game_over', (data) => { gameState = data.finalState; showGameOver(data.standings); });
  socket.on('room_message', addRoomMessage);
  socket.on('player_disconnected', (data) => { gameState = data.gameState; updateMySeats(); renderTable(); addRoomMessage({from:'System', msg:'A player disconnected', at:Date.now()}); });
  socket.on('error', (e) => alert(e.message));
  
  // Bingo events
  socket.on('bingo_room_created', (data) => {
    roomId = data.roomId;
    bingoGameState = data.gameState;
    bingoCards = [];
    showBingoGame();
  });
  socket.on('bingo_room_joined', (data) => {
    roomId = data.roomId;
    bingoGameState = data.gameState;
    bingoCards = data.cards || [];
    showBingoGame();
    renderBingoCards();
  });
  socket.on('bingo_card_purchased', (data) => {
    bingoCards = data.cards;
    bingoGameState = data.gameState;
    renderBingoCards();
    auth.user.chipBalance -= 1; // Optimistic update
    renderAuth();
  });
  socket.on('bingo_ball_called', handleBingoBallCalled);
  socket.on('bingo_game_started', (data) => {
    bingoGameState = data.gameState;
    alert('Bingo game starting! Get ready!');
  });
  socket.on('bingo_winner', (data) => {
    bingoGameState = data.gameState;
    if (data.winner) {
      showNotification(`🎉 BINGO! ${data.winner.name} wins with ${data.winner.pattern}! Pot: ${data.pot} chips`);
    }
  });
  socket.on('bingo_pot_updated', (data) => {
    bingoGameState = data.gameState;
    if (bingoGameState) renderBingoUI();
  });
  socket.on('bingo_round_reset', (data) => {
    bingoGameState = data.gameState;
    bingoCards = [];
    selectedBingoCard = null;
    showNotification(data.message || '🎱 New round starting!');
    renderBingoUI();
  });
  
  // Admin events
  socket.on('banned', (data) => {
    alert(`You have been banned. Reason: ${data.reason}`);
    window.location.href = '/';
  });
  
  socket.on('admin_broadcast', (data) => {
    showNotification(`📢 Admin Announcement: ${data.message}`);
  });
  
  socket.on('chat_filtered', (data) => {
    if (data.severity === 'low') {
      console.warn('Your message was filtered:', data.reason);
    } else {
      showNotification(`⚠️ ${data.reason}`);
    }
  });
}

// Update mySeats array based on current gameState
function updateMySeats() {
  if (!gameState || !socket) return;
  const mySocketId = socket.id;
  mySeats = [];
  gameState.seats.forEach((seat, i) => {
    if (!seat.empty && seat.socketId === mySocketId) {
      mySeats.push(i);
    }
  });
}

function renderAuth() {
  const btn = document.getElementById('loginBtn');
  const prof = document.getElementById('profile');
  const editBtn = document.getElementById('editProfileBtn');
  const adminBtn = document.getElementById('adminBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (auth.authenticated) {
    btn.style.display = 'none';
    prof.style.display = 'flex';
    prof.querySelector('img').src = auth.user.customAvatar || auth.user.photo || '';
    prof.querySelector('span').textContent = auth.user.nickname || auth.user.displayName;
    if (editBtn) editBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    
    // Show admin button if user is admin
    if (adminBtn && auth.user.isAdmin) {
      adminBtn.style.display = 'inline-block';
    }
    
    // Update global chip count
    const chipDisplay = document.getElementById('globalChipCount');
    if (chipDisplay) {
      chipDisplay.style.display = 'flex';
      chipDisplay.textContent = auth.user.chipBalance.toLocaleString();
    }
  } else {
    btn.style.display = 'inline-block';
    prof.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    
    const chipDisplay = document.getElementById('globalChipCount');
    if (chipDisplay) chipDisplay.style.display = 'none';
  }
}

// Avatar state
let currentAvatarTab = 'generated';
let currentAvatarSeed = null;
let currentAvatarStyle = 'adventurer';

// Profile editing
function openProfileModal() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('nicknameInput').value = auth.user?.nickname || auth.user?.displayName || '';
  
  // Check if user has custom avatar
  const customAvatar = auth.user?.customAvatar || '';
  if (customAvatar && !customAvatar.includes('api.dicebear.com')) {
    // Custom URL
    switchAvatarTab('custom');
    document.getElementById('avatarInput').value = customAvatar;
  } else {
    // Generated avatar - extract seed and style if available
    switchAvatarTab('generated');
    if (customAvatar.includes('api.dicebear.com')) {
      const urlMatch = customAvatar.match(/\/([^\/]+)\/svg\?seed=([^&]+)/);
      if (urlMatch) {
        currentAvatarStyle = urlMatch[1];
        currentAvatarSeed = urlMatch[2];
        document.getElementById('avatarStyle').value = currentAvatarStyle;
        document.getElementById('avatarSeed').value = currentAvatarSeed;
      }
    } else {
      // New avatar
      currentAvatarSeed = generateSeed();
      document.getElementById('avatarSeed').value = currentAvatarSeed;
    }
    updateAvatarPreview();
  }
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.style.display = 'none';
}

async function saveProfile() {
  const nickname = document.getElementById('nicknameInput').value.trim();
  let avatar = '';
  
  if (currentAvatarTab === 'custom') {
    avatar = document.getElementById('avatarInput').value.trim();
  } else {
    // Generated avatar
    const seed = document.getElementById('avatarSeed').value;
    const style = document.getElementById('avatarStyle').value;
    avatar = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
  }
  
  try {
    const res = await fetch('/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, avatar })
    });
    const data = await res.json();
    if (data.ok) {
      auth.user.nickname = data.profile.nickname;
      auth.user.customAvatar = data.profile.avatar;
      renderAuth();
      closeProfileModal();
    } else {
      alert(data.error || 'Failed to save profile');
    }
  } catch (e) {
    alert('Error saving profile');
  }
}

// Avatar functions
function switchAvatarTab(tab) {
  currentAvatarTab = tab;
  const tabs = document.querySelectorAll('.avatar-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  if (tab === 'generated') {
    tabs[0].classList.add('active');
    document.getElementById('generatedTab').style.display = 'block';
    document.getElementById('customTab').style.display = 'none';
  } else {
    tabs[1].classList.add('active');
    document.getElementById('generatedTab').style.display = 'none';
    document.getElementById('customTab').style.display = 'block';
  }
}

function generateSeed() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function updateAvatarPreview() {
  const style = document.getElementById('avatarStyle').value;
  const seed = document.getElementById('avatarSeed').value || generateSeed();
  currentAvatarStyle = style;
  currentAvatarSeed = seed;
  
  document.getElementById('avatarSeed').value = seed;
  
  const previewEl = document.getElementById('avatarPreview');
  if (previewEl) {
    previewEl.innerHTML = `<img src="https://api.dicebear.com/9.x/${style}/svg?seed=${seed}" alt="Avatar Preview" class="avatar-preview-img" />`;
  }
}

function randomizeAvatar() {
  currentAvatarSeed = generateSeed();
  document.getElementById('avatarSeed').value = currentAvatarSeed;
  updateAvatarPreview();
}

// Lobby UI
function renderRooms(list) {
  const el = document.getElementById('rooms');
  el.innerHTML = '';
  if (!list || list.length === 0) { el.innerHTML = '<div class="empty">No active tables. Start the first game!</div>'; return; }
  list.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-card';
    
    let icon = '🃏';
    let name = 'War';
    if (r.gameType === 'BINGO') { icon = '🎱'; name = 'Bingo'; }
    if (r.gameType === 'BLACKJACK') { icon = '♠️'; name = 'Blackjack'; }
    
    div.innerHTML = `<div><div class="room-id">${icon} ${name} Table ${r.roomId.substring(0,6)}</div><div style="font-size:.9em;opacity:.8">${r.seatedCount} Players | ${r.observerCount} Watching</div></div><button class="btn btn-success">Join Table</button>`;
    div.querySelector('button').onclick = () => joinRoom(r.roomId);
    el.appendChild(div);
  });
}
function sendLobbyChat() {
  const input = document.getElementById('lobbyChatInput');
  const msg = input.value.trim(); if (!msg) return;
  socket.emit('lobby_chat', msg); input.value = '';
}
function addLobbyMessage(m) {
  const box = document.getElementById('lobbyChatBox');
  const row = document.createElement('div'); row.className='chat-row';
  row.innerHTML = `${m.photo?`<img class="avatar" src="${m.photo}">`:''}<b>${ClientCrypto.sanitize(m.from)}:</b> ${ClientCrypto.sanitize(m.msg)}`;
  box.appendChild(row); box.scrollTop = box.scrollHeight;
}

// Game UI
function createRoom() {
  initSocket();
  socket.emit('create_room', { startingChips: 1000 });
}
function createBlackjackRoom() {
  initSocket();
  socket.emit('create_blackjack_room');
}
function joinRoom(id) {
  initSocket();
  socket.emit('join_room', { roomId: id, startingChips: 1000 });
}
function sendRoomChat() {
  const input = document.getElementById('roomChatInput'); const msg = input.value.trim(); if (!msg) return;
  socket.emit('room_chat', msg); input.value = '';
}
function addRoomMessage(m) {
  const box = document.getElementById('roomChatBox');
  const row = document.createElement('div'); row.className='chat-row';
  row.innerHTML = `${m.photo?`<img class="avatar" src="${m.photo}">`:''}<b>${ClientCrypto.sanitize(m.from)}:</b> ${ClientCrypto.sanitize(m.msg)}`;
  box.appendChild(row); box.scrollTop = box.scrollHeight;
}

async function claimDailyReward() {
  try {
    const res = await fetch('/api/daily-reward', { method: 'POST' });
    const data = await res.json();
    
    if (data.success) {
      alert(`🎁 Daily Reward Claimed!\n\n+${data.reward.chips} Chips\nStreak: ${data.reward.day} Days`);
      fetchMe(); // Refresh balance
    } else {
      if (data.nextClaimAt) {
        const next = new Date(data.nextClaimAt);
        const diff = next - new Date();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        alert(`⏳ Daily reward not ready yet.\n\nCome back in ${hours}h ${mins}m.`);
      } else {
        alert('❌ ' + (data.error || 'Failed to claim reward'));
      }
    }
  } catch (e) {
    console.error(e);
    alert('❌ Error claiming reward');
  }
}

// Sit at seat - now supports multi-seat
function sitAtSeat(seatIndex) {
  if (!socket) return;
  socket.emit('sit_at_seat', { seatIndex, chips: startingChips });
}

// Leave a specific seat
function leaveSeat(seatIndex) {
  if (!socket) return;
  socket.emit('leave_seat', { seatIndex });
}

// Place bet for a specific seat
function placeBet(seatIndex) {
  const amt = Number(document.getElementById('betAmount').value);
  if (!gameState) return; 
  if (mySeats.length === 0) { alert('Please sit at a seat first'); return; }
  if (isNaN(amt) || amt < gameState.minBet) { alert(`Min bet ${gameState.minBet}`); return; }
  
  // If seatIndex provided, bet for that seat; otherwise bet for first unready seat
  const targetSeat = seatIndex !== undefined ? seatIndex : getFirstUnreadySeat();
  if (targetSeat === -1) { alert('All your seats have bets placed'); return; }
  
  socket.emit('place_bet', { betAmount: amt, seatIndex: targetSeat });
}

// Place bet for all seats at once
function placeBetAll() {
  const amt = Number(document.getElementById('betAmount').value);
  if (!gameState) return;
  if (mySeats.length === 0) { alert('Please sit at a seat first'); return; }
  if (isNaN(amt) || amt < gameState.minBet) { alert(`Min bet ${gameState.minBet}`); return; }
  
  // Place bet for each unready seat
  mySeats.forEach(seatIndex => {
    const seat = gameState.seats[seatIndex];
    if (seat && !seat.empty && !seat.ready) {
      socket.emit('place_bet', { betAmount: amt, seatIndex });
    }
  });
}

// Get first seat that hasn't placed a bet yet
function getFirstUnreadySeat() {
  for (const seatIndex of mySeats) {
    const seat = gameState.seats[seatIndex];
    if (seat && !seat.empty && !seat.ready) {
      return seatIndex;
    }
  }
  return -1;
}

// Check if any of my seats need to bet
function hasUnreadySeats() {
  return mySeats.some(seatIndex => {
    const seat = gameState.seats[seatIndex];
    return seat && !seat.empty && !seat.ready;
  });
}

// Visual Table Rendering
function renderTable() {
  if (!gameState) return;
  
  const tableEl = document.getElementById('casinoTable');
  if (!tableEl) return;
  
  // Update status
  const statusEl = document.getElementById('tableStatus');
  if (statusEl) {
    statusEl.textContent = gameState.status || (gameState.bettingPhase ? 'Place your bets!' : '');
  }
  
  // Update pot display
  const potEl = document.getElementById('potDisplay');
  if (potEl) {
    potEl.textContent = `Pot: ${gameState.pot} | Min bet: ${gameState.minBet}`;
  }
  
  // Render house/dealer area
  renderHouse();
  
  // Render 5 seats
  for (let i = 0; i < 5; i++) {
    renderSeat(i);
  }
  
  // Update multi-seat info
  const multiSeatInfo = document.getElementById('multiSeatInfo');
  const seatCountEl = document.getElementById('seatCount');
  if (multiSeatInfo && seatCountEl) {
    if (mySeats.length > 1) {
      multiSeatInfo.style.display = 'block';
      seatCountEl.textContent = mySeats.length;
    } else {
      multiSeatInfo.style.display = 'none';
    }
  }
  
  // Update betting controls visibility
  const bettingControls = document.getElementById('bettingControls');
  const betAllBtn = document.getElementById('betAllBtn');
  if (bettingControls) {
    if (mySeats.length > 0 && gameState.bettingPhase && hasUnreadySeats()) {
      bettingControls.style.display = 'flex';
      // Show "Bet All" button if multiple seats
      if (betAllBtn) {
        betAllBtn.style.display = mySeats.length > 1 ? 'inline-block' : 'none';
      }
    } else {
      bettingControls.style.display = 'none';
    }
  }
  
  // Update observer count
  const observerEl = document.getElementById('observerCount');
  if (observerEl) {
    observerEl.textContent = `${gameState.observerCount} watching`;
  }
}

function renderHouse() {
  const houseEl = document.getElementById('houseArea');
  if (!houseEl) return;
  
  let cardsHtml = '';
  
  // Handle Blackjack dealer hand
  if (gameState.dealerHand && gameState.dealerHand.length > 0) {
    cardsHtml = gameState.dealerHand.map((card, i) => {
      // First card might be hidden if game state says so, but usually server sends what should be seen
      // If card has no rank/suit, it's hidden
      if (!card.rank) {
        return '<div class="card card-back" style="margin-left: -30px;"><span class="dealer-icon">D</span></div>';
      }
      const isRed = card.suit === '♥' || card.suit === '♦';
      const style = i > 0 ? 'margin-left: -30px;' : '';
      return `<div class="card dealt ${isRed ? 'red' : 'black'}" style="${style}">
        <span class="card-rank">${card.rank}</span>
        <span class="card-suit">${card.suit}</span>
      </div>`;
    }).join('');
  } 
  // Handle War house card
  else if (gameState.houseCard) {
    const houseCard = gameState.houseCard;
    const isRed = houseCard.suit === '♥' || houseCard.suit === '♦';
    cardsHtml = `<div class="card dealt ${isRed ? 'red' : 'black'}">
      <span class="card-rank">${houseCard.rank}</span>
      <span class="card-suit">${houseCard.suit}</span>
    </div>`;
  } else {
    cardsHtml = '<div class="card card-back"><span class="dealer-icon">D</span></div>';
  }
  
  houseEl.innerHTML = `
    <div class="chip-tray">
      <div class="tray-chip red"></div>
      <div class="tray-chip red"></div>
      <div class="tray-chip green"></div>
      <div class="tray-chip green"></div>
      <div class="tray-chip black"></div>
      <div class="tray-chip black"></div>
      <div class="tray-chip blue"></div>
      <div class="tray-chip gold"></div>
    </div>
    <div class="house-label">DEALER ${gameState.dealerValue ? `(${gameState.dealerValue})` : ''}</div>
    <div class="house-card" style="display:flex; justify-content:center;">${cardsHtml}</div>
  `;
}

// Generate chip stack HTML based on bet amount
function renderChipStack(amount) {
  if (!amount || amount <= 0) return '';
  
  // Chip values: Black=100, Green=25, Red=5
  const chips = [];
  let remaining = amount;
  
  // Calculate chip breakdown
  const black = Math.floor(remaining / 100);
  remaining %= 100;
  const green = Math.floor(remaining / 25);
  remaining %= 25;
  const red = Math.ceil(remaining / 5);
  
  // Create chip elements (limit to 8 chips for display)
  let chipCount = 0;
  const maxChips = 8;
  
  for (let i = 0; i < Math.min(black, maxChips - chipCount); i++) {
    chips.push({ color: 'chip-black', offset: chipCount * 4 });
    chipCount++;
  }
  for (let i = 0; i < Math.min(green, maxChips - chipCount); i++) {
    chips.push({ color: 'chip-green', offset: chipCount * 4 });
    chipCount++;
  }
  for (let i = 0; i < Math.min(red, maxChips - chipCount); i++) {
    chips.push({ color: 'chip-red', offset: chipCount * 4 });
    chipCount++;
  }
  
  if (chips.length === 0) return '';
  
  const chipHtml = chips.map((c, i) => 
    `<div class="chip ${c.color}" style="bottom:${c.offset}px;z-index:${i}"></div>`
  ).join('');
  
  return `<div class="chip-stack">${chipHtml}</div>`;
}

function renderSeat(seatIndex) {
  const seatEl = document.getElementById(`seat${seatIndex}`);
  if (!seatEl) return;
  
  const seat = gameState.seats[seatIndex];
  const isMySeat = mySeats.includes(seatIndex);
  
  seatEl.className = `seat ${isMySeat ? 'my-seat' : ''} ${!seat.empty ? 'occupied' : 'empty'}`;
  
  if (seat.empty) {
    // Empty seat - show "Sit Here" button
    seatEl.innerHTML = `
      <button class="sit-btn" onclick="sitAtSeat(${seatIndex})">
        <span class="sit-icon">+</span>
        <span>Sit</span>
      </button>
    `;
  } else {
    // Occupied seat - show player info with chip stack
    let cardsHtml = '';
    
    // Handle Blackjack hands
    if (seat.hands && seat.hands.length > 0) {
      cardsHtml = seat.hands.map((hand, hIndex) => {
        return `<div class="hand-container" style="display:flex; margin-right:10px;">
          ${hand.cards.map((card, cIndex) => {
            const isRed = card.suit === '♥' || card.suit === '♦';
            const style = cIndex > 0 ? 'margin-left: -25px;' : '';
            return `<div class="card dealt ${isRed ? 'red' : 'black'}" style="${style}">
              <span class="card-rank">${card.rank}</span>
              <span class="card-suit">${card.suit}</span>
            </div>`;
          }).join('')}
          ${hand.value ? `<div class="hand-value">${hand.value}</div>` : ''}
        </div>`;
      }).join('');
    }
    // Handle War card
    else if (seat.card) {
      const isRed = seat.card.suit === '♥' || seat.card.suit === '♦';
      cardsHtml = `<div class="card dealt ${isRed ? 'red' : 'black'}">
        <span class="card-rank">${seat.card.rank}</span>
        <span class="card-suit">${seat.card.suit}</span>
      </div>`;
    } else {
      cardsHtml = '<div class="card card-back"><span>?</span></div>';
    }
    
    const statusClass = seat.ready ? 'ready' : '';
    const disconnectedClass = !seat.connected ? 'disconnected' : '';
    const chipStackHtml = renderChipStack(seat.currentBet);
    
    seatEl.innerHTML = `
      ${seat.currentBet > 0 ? `<div class="betting-circle">${chipStackHtml}</div>` : ''}
      <div class="player-card ${statusClass} ${disconnectedClass}" style="display:flex; justify-content:center;">
        ${cardsHtml}
      </div>
      <div class="player-info">
        ${seat.photo ? `<img class="player-avatar" src="${seat.photo}" alt="">` : `<div class="player-avatar-placeholder">${seat.name.charAt(0).toUpperCase()}</div>`}
        <div class="player-name">${ClientCrypto.sanitize(seat.name)}</div>
        <div class="player-chips">$${seat.chips}</div>
        ${seat.currentBet > 0 ? `<div class="player-bet">Bet: $${seat.currentBet}</div>` : ''}
        ${!seat.connected ? '<div class="disconnected-label">Disconnected</div>' : ''}
      </div>
      ${isMySeat ? `<button class="leave-btn" onclick="leaveSeat(${seatIndex})">Leave</button>` : ''}
    `;
  }
}

function showRoundResult(res) {
  const div = document.getElementById('roundResult');
  if (!div) return;
  div.style.display = 'block';
  
  if (res.type === 'win') {
    const winner = res.winners[0];
    if (winner.isHouse) {
      div.innerHTML = `<span class="result-loss">House wins! Pot lost: $${res.pot}</span>`;
    } else {
      div.innerHTML = `<span class="result-win">${ClientCrypto.sanitize(winner.name)} wins $${res.pot}!</span>`;
    }
  } else {
    const names = res.winners.map(w => w.isHouse ? 'House' : ClientCrypto.sanitize(w.name)).join(', ');
    div.innerHTML = `<span class="result-tie">Tie between ${names}. Split pot $${res.pot}</span>`;
  }
  log(div.textContent);
}

function resetRoundUI() {
  const div = document.getElementById('roundResult');
  if (div) div.style.display = 'none';
}

function showGameOver(standings) {
  const div = document.getElementById('roundResult');
  if (!div) return;
  div.style.display = 'block';
  div.innerHTML = `<span class="game-over">Game Over! Final standings: ${standings.map(s => `${ClientCrypto.sanitize(s.name)}: $${s.chips}`).join(', ')}</span>`;
  log('Game Over');
}

function showLobby() {
  document.getElementById('lobbyScreen').style.display = 'block';
  document.getElementById('gameScreen').style.display = 'none';
  mySeats = [];
  gameState = null;
  roomId = null;
  initSocket(); 
  socket.emit('get_rooms');
  if (auth.authenticated) {
    loadFriends();
    loadFriendRequests();
    loadInvites();
  }
  renderFriends(); // Update invite buttons
}

function showGame() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  renderFriends(); // Update invite buttons
}

function log(msg) {
  const gl = document.getElementById('gameLog');
  if (!gl) return;
  const e = document.createElement('div');
  e.className = 'log-entry';
  e.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
  gl.prepend(e);
}

// Friends and Invites
let friends = [];
let friendRequests = [];
let tableInvites = [];

async function loadFriends() {
  try {
    const res = await fetch('/friends');
    const data = await res.json();
    friends = data.friends || [];
    renderFriends();
  } catch (e) {
    console.error('Error loading friends:', e);
  }
}

async function loadFriendRequests() {
  try {
    const res = await fetch('/friend-requests');
    const data = await res.json();
    friendRequests = data.requests || [];
    renderFriendRequests();
  } catch (e) {
    console.error('Error loading friend requests:', e);
  }
}

async function loadInvites() {
  try {
    const res = await fetch('/invites');
    const data = await res.json();
    tableInvites = data.invites || [];
    if (tableInvites.length > 0) {
      showInviteNotification();
    }
  } catch (e) {
    console.error('Error loading invites:', e);
  }
}

function renderFriends() {
  const list = document.getElementById('friendsList');
  if (!list) return;
  
  if (friends.length === 0) {
    list.innerHTML = '<div class="empty-state">No friends yet</div>';
    return;
  }
  
  list.innerHTML = friends.map(f => `
    <div class="friend-item">
      ${f.customAvatar ? `<img src="${f.customAvatar}" class="friend-avatar">` : '<div class="friend-avatar-placeholder">👤</div>'}
      <span class="friend-name">${ClientCrypto.sanitize(f.nickname || f.displayName)}</span>
      <div class="friend-actions">
        <button class="btn btn-small btn-transfer" onclick="openTransferModal('${f.id}', '${ClientCrypto.sanitize(f.nickname || f.displayName)}')">💰 Send</button>
        ${roomId ? `<button class="btn btn-small btn-invite" onclick="inviteFriend('${f.id}')">Invite</button>` : ''}
      </div>
    </div>
  `).join('');
}

function renderFriendRequests() {
  const container = document.getElementById('friendRequests');
  if (!container) return;
  
  if (friendRequests.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <div class="friend-requests-header">Friend Requests (${friendRequests.length})</div>
    ${friendRequests.map(req => `
      <div class="friend-request-item">
        ${req.user.customAvatar ? `<img src="${req.user.customAvatar}" class="friend-avatar">` : '<div class="friend-avatar-placeholder">👤</div>'}
        <span class="friend-name">${ClientCrypto.sanitize(req.user.nickname || req.user.displayName)}</span>
        <div class="friend-request-actions">
          <button class="btn btn-small btn-success" onclick="acceptFriendRequest('${req.id}')">✓</button>
          <button class="btn btn-small btn-danger" onclick="declineFriendRequest('${req.id}')">✗</button>
        </div>
      </div>
    `).join('')}
  `;
}

function openAddFriendModal() {
  document.getElementById('addFriendModal').style.display = 'flex';
  document.getElementById('friendEmail').value = '';
}

function closeAddFriendModal() {
  document.getElementById('addFriendModal').style.display = 'none';
}

async function sendFriendRequest() {
  const email = document.getElementById('friendEmail').value.trim();
  if (!email) return;
  
  try {
    const res = await fetch('/friend-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendEmail: email })
    });
    const data = await res.json();
    
    if (data.ok) {
      alert('Friend request sent!');
      closeAddFriendModal();
    } else {
      alert(data.error || 'Failed to send request');
    }
  } catch (e) {
    alert('Error sending friend request');
  }
}

async function acceptFriendRequest(requestId) {
  try {
    const res = await fetch(`/friend-request/${requestId}/accept`, { method: 'POST' });
    const data = await res.json();
    
    if (data.ok) {
      await loadFriends();
      await loadFriendRequests();
    }
  } catch (e) {
    console.error('Error accepting friend request:', e);
  }
}

async function declineFriendRequest(requestId) {
  try {
    const res = await fetch(`/friend-request/${requestId}/decline`, { method: 'POST' });
    const data = await res.json();
    
    if (data.ok) {
      await loadFriendRequests();
    }
  } catch (e) {
    console.error('Error declining friend request:', e);
  }
}

function inviteFriend(friendId) {
  if (!socket || !roomId) return;
  socket.emit('send_invite', { friendId });
  alert('Invite sent!');
}

function handleFriendRequest(data) {
  loadFriendRequests();
  showNotification(`Friend request from ${data.from.nickname || data.from.displayName}`);
}

function handleTableInvite(data) {
  tableInvites.push(data);
  showNotification(`${data.from.name} invited you to a table!`);
  openInvitesModal();
}

function handleInviteAccepted(data) {
  roomId = data.roomId;
  gameState = data.gameState;
  showGame();
  renderTable();
  closeInvitesModal();
}

function openInvitesModal() {
  const modal = document.getElementById('invitesModal');
  const list = document.getElementById('invitesList');
  
  if (tableInvites.length === 0) {
    list.innerHTML = '<div class="empty-state">No pending invites</div>';
  } else {
    list.innerHTML = tableInvites.map(inv => `
      <div class="invite-item">
        <div>
          ${inv.from.photo ? `<img src="${inv.from.photo}" class="invite-avatar">` : '<div class="invite-avatar-placeholder">👤</div>'}
          <span>${ClientCrypto.sanitize(inv.from.name)} invited you to Table ${inv.roomId}</span>
        </div>
        <div class="invite-actions">
          <button class="btn btn-success" onclick="acceptInvite('${inv.inviteId}')">Join</button>
          <button class="btn" onclick="declineInvite('${inv.inviteId}')">Decline</button>
        </div>
      </div>
    `).join('');
  }
  
  modal.style.display = 'flex';
}

function closeInvitesModal() {
  document.getElementById('invitesModal').style.display = 'none';
}

function acceptInvite(inviteId) {
  if (!socket) return;
  socket.emit('accept_invite', { inviteId });
}

function declineInvite(inviteId) {
  tableInvites = tableInvites.filter(inv => inv.inviteId !== inviteId);
  openInvitesModal();
}

function showNotification(message) {
  // Simple notification - could be enhanced with a proper notification system
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.textContent = message;
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

function showInviteNotification() {
  showNotification(`You have ${tableInvites.length} table invite(s)!`);
}

// Chip Transfer
let transferTargetId = null;
let transferTargetName = null;

function openTransferModal(friendId, friendName) {
  transferTargetId = friendId;
  transferTargetName = friendName;
  
  const modal = document.getElementById('transferModal');
  document.getElementById('transferRecipient').textContent = friendName;
  document.getElementById('transferAmount').value = '100';
  document.getElementById('transferBalance').textContent = auth.user?.chipBalance || 0;
  modal.style.display = 'flex';
}

function closeTransferModal() {
  document.getElementById('transferModal').style.display = 'none';
  transferTargetId = null;
  transferTargetName = null;
}

async function sendChips() {
  const amount = Number(document.getElementById('transferAmount').value);
  
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  if (amount < 10) {
    alert('Minimum transfer is 10 chips');
    return;
  }
  
  if (amount > auth.user?.chipBalance) {
    alert('Insufficient chips');
    return;
  }
  
  try {
    const res = await fetch('/transfer-chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId: transferTargetId, amount })
    });
    const data = await res.json();
    
    if (data.ok) {
      auth.user.chipBalance = data.newBalance;
      renderAuth();
      showNotification(`✅ Sent ${amount} chips to ${transferTargetName}!`);
      closeTransferModal();
      
      // Refresh chip display
      const chipDisplay = document.getElementById('chipDisplay');
      if (chipDisplay) {
        chipDisplay.textContent = `$${data.newBalance}`;
      }
    } else {
      alert(data.error || 'Failed to send chips');
    }
  } catch (e) {
    alert('Error sending chips');
  }
}

function handleChipsReceived(data) {
  auth.user.chipBalance = data.newBalance;
  renderAuth();
  showNotification(`💰 ${data.from.name} sent you ${data.amount} chips!`);
  
  // Update chip display
  const chipDisplay = document.getElementById('chipDisplay');
  if (chipDisplay) {
    chipDisplay.textContent = `$${data.newBalance}`;
  }
  
  // Refresh user data
  fetchMe();
}

// ========== BINGO FUNCTIONALITY ==========

let bingoCards = [];
let bingoGameState = null;
let bingoVoice = null;

// Initialize speech synthesis for Bingo caller
function initBingoVoice() {
  if (!window.speechSynthesis) {
    console.warn('Speech synthesis not supported');
    return;
  }
  
  // Wait for voices to load
  speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    // Try to find a female voice
    bingoVoice = voices.find(v => v.name.includes('Female') || v.name.includes('female') || v.lang.startsWith('en'));
    if (!bingoVoice) bingoVoice = voices[0];
  };
}

// Announce ball with smoky voice
function announceBall(ball, letter) {
  if (!bingoVoice || !window.speechSynthesis) return;
  
  const utterance = new SpeechSynthesisUtterance(`${letter} ${ball}`);
  utterance.voice = bingoVoice;
  utterance.pitch = 0.7; // Lower pitch for "smoky" sound
  utterance.rate = 0.8; // Slower, deliberate pace
  utterance.volume = 1.0;
  
  speechSynthesis.speak(utterance);
}

// Render Bingo card
function renderBingoCard(card, container) {
  const cardEl = document.createElement('div');
  cardEl.className = 'bingo-card';
  cardEl.dataset.cardId = card.id;
  cardEl.onclick = () => selectBingoCard(card.id);
  
  // Header with BINGO letters
  const header = document.createElement('div');
  header.className = 'bingo-header';
  ['B', 'I', 'N', 'G', 'O'].forEach(letter => {
    const letterEl = document.createElement('div');
    letterEl.className = 'bingo-letter';
    letterEl.textContent = letter;
    header.appendChild(letterEl);
  });
  cardEl.appendChild(header);
  
  // Grid
  const grid = document.createElement('div');
  grid.className = 'bingo-grid';
  
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cell = document.createElement('div');
      cell.className = 'bingo-cell';
      
      const num = card.grid[col][row];
      if (num === 0) {
        cell.classList.add('free-space');
        cell.textContent = 'FREE';
      } else {
        cell.textContent = num;
      }
      
      if (card.marked[col][row]) {
        cell.classList.add('marked');
      }
      
      grid.appendChild(cell);
    }
  }
  cardEl.appendChild(grid);
  
  container.appendChild(cardEl);
}

let selectedBingoCard = null;

// Select a Bingo card for claiming
function selectBingoCard(cardId) {
  selectedBingoCard = cardId;
  // Highlight selected card
  document.querySelectorAll('.bingo-card').forEach(card => {
    if (card.dataset.cardId === cardId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

// Handle Bingo ball called
function handleBingoBallCalled(data) {
  bingoGameState = data.gameState;
  announceBall(data.ball, data.letter);
  
  // Update big ball display
  const bigBall = document.getElementById('bingoBigBall');
  if (bigBall) {
    bigBall.textContent = `${data.letter}-${data.ball}`;
    bigBall.classList.add('animate-ball');
    setTimeout(() => bigBall.classList.remove('animate-ball'), 1000);
  }
  
  // Re-render cards to show marked numbers
  renderBingoCards();
}

// Render all player's Bingo cards
function renderBingoCards() {
  const container = document.getElementById('bingoCardsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  bingoCards.forEach(card => renderBingoCard(card, container));
}

// Claim BINGO
function claimBingo() {
  if (!socket || !roomId) return;
  if (!selectedBingoCard) {
    alert('Please select a card first by clicking on it!');
    return;
  }
  socket.emit('claim_bingo', { cardId: selectedBingoCard });
}

// Buy Bingo card
function buyBingoCard() {
  if (!socket || !roomId) return;
  if (bingoGameState && bingoGameState.phase !== 'BUYING') {
    alert('Can only buy cards during buying phase');
    return;
  }
  socket.emit('buy_bingo_card', {});
}

// Create Bingo room
function createBingoRoom() {
  if (!auth.authenticated) {
    alert('Please log in to play Bingo');
    return;
  }
  socket.emit('create_bingo_room', {});
}

// Show Bingo game screen
function showBingoGame() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('bingoScreen').style.display = 'block';
  renderBingoUI();
}

// Leave Bingo room
function leaveBingoRoom() {
  if (roomId) {
    socket.emit('leave_room', { roomId });
  }
  roomId = null;
  bingoCards = [];
  bingoGameState = null;
  showLobby();
}

// Render Bingo UI
function renderBingoUI() {
  if (!bingoGameState) return;
  
  // Update pot and phase
  document.getElementById('bingoPot').textContent = `Pot: ${bingoGameState.pot} chips`;
  
  // Show phase with helpful messages
  let phaseText = bingoGameState.phase;
  if (bingoGameState.phase === 'BUYING') {
    phaseText = '🛒 BUYING PHASE - Buy your cards now!';
  } else if (bingoGameState.phase === 'PLAYING') {
    if (bingoCards.length === 0) {
      phaseText = '👀 WATCHING - Next round you can play!';
    } else {
      phaseText = '🎱 GAME IN PROGRESS';
    }
  } else if (bingoGameState.phase === 'COMPLETE') {
    phaseText = '🎉 GAME OVER - New round starting soon!';
  }
  document.getElementById('bingoPhase').textContent = phaseText;
  
  // Update called numbers display with rolling animation
  const calledNumbersEl = document.getElementById('bingoCalledNumbers');
  if (calledNumbersEl && bingoGameState.drawnNumbers) {
    // Clear and rebuild
    calledNumbersEl.innerHTML = '';
    calledNumbersEl.className = 'bingo-rolling-area';
    
    // Show all numbers in reverse order (newest first)
    [...bingoGameState.drawnNumbers].reverse().forEach((n, index) => {
      const ball = document.createElement('div');
      ball.className = `bingo-ball-display ${index === 0 ? 'latest' : ''}`;
      ball.textContent = n;
      
      // Add letter above number
      const letter = getBingoLetterFromNum(n);
      ball.innerHTML = `<div style="font-size:0.6em;margin-bottom:-5px">${letter}</div><div>${n}</div>`;
      
      calledNumbersEl.appendChild(ball);
    });
  }
  
  // Enable/disable BINGO button
  const bingoBtn = document.getElementById('bingoButton');
  if (bingoBtn) {
    bingoBtn.disabled = bingoGameState.phase !== 'PLAYING' || bingoCards.length === 0;
    if (bingoCards.length === 0) {
      bingoBtn.textContent = 'Buy cards to play!';
    } else {
      bingoBtn.textContent = 'BINGO!';
    }
  }
  
  // Show/hide buy button based on phase
  const buyBtn = document.querySelector('.bingo-controls .btn-gold');
  if (buyBtn) {
    if (bingoGameState.phase === 'BUYING') {
      buyBtn.style.display = 'block';
      buyBtn.textContent = `Buy Card (1 chip) - ${bingoCards.length}/5`;
    } else if (bingoGameState.phase === 'PLAYING') {
      buyBtn.style.display = 'none';
    } else {
      buyBtn.style.display = 'block';
      buyBtn.textContent = 'Next round starting soon...';
      buyBtn.disabled = true;
    }
  }
  
  renderBingoCards();
}

// Helper to get Bingo letter from number
function getBingoLetterFromNum(num) {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  if (num >= 61 && num <= 75) return 'O';
  return '';
}

// ========== INFO MODAL FUNCTIONALITY ==========

let currentInfoTab = 'rules';

function openInfoModal() {
  document.getElementById('infoModal').style.display = 'flex';
  showInfoTab('rules');
}

function closeInfoModal() {
  document.getElementById('infoModal').style.display = 'none';
}

function showInfoTab(tabName) {
  currentInfoTab = tabName;
  
  // Update tab buttons
  const tabs = document.querySelectorAll('.info-tab-btn');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Show selected content
  const contents = document.querySelectorAll('.info-tab-content');
  contents.forEach(content => {
    if (content.dataset.tab === tabName) {
      content.style.display = 'block';
    } else {
      content.style.display = 'none';
    }
  });
}

async function submitTip() {
  const amount = Number(document.getElementById('tipAmount').value);
  const note = document.getElementById('tipNote').value;
  
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  if (amount < 1) {
    alert('Minimum tip is 1 chip');
    return;
  }
  
  try {
    const response = await fetch('/api/tip-moe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      auth.user.chipBalance = data.newBalance;
      renderAuth();
      alert(data.message);
      document.getElementById('tipAmount').value = '';
      document.getElementById('tipNote').value = '';
      closeInfoModal();
    } else {
      alert(data.error || 'Failed to send tip');
    }
  } catch (e) {
    console.error('Tip error:', e);
    alert('Error sending tip');
  }
}

window.addEventListener('load', () => {
  fetchMe();
  showLobby();
  initSocket();
  initBingoVoice();
  
  if (auth.authenticated) {
    loadFriends();
    loadFriendRequests();
    loadInvites();
  }
});