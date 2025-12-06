# Custom Room Naming Feature

## Overview
Players who create a room can now give it a custom display name (up to 30 characters). This helps players identify rooms more easily in the lobby.

## Changes Made

### Server-Side Changes (server.js)

1. **GameRoom Class** - Added `displayName` and `creatorSocketId` properties:
   ```javascript
   constructor(roomId, displayName = null) {
     this.roomId = roomId;
     this.displayName = displayName; // Custom room name set by creator
     this.creatorSocketId = null; // Track who created the room
     // ... rest of properties
   }
   ```

2. **Room State** - displayName is now included in the game state:
   ```javascript
   getState() {
     return {
       roomId: this.roomId,
       displayName: this.displayName,
       // ... other state properties
     };
   }
   ```

3. **Socket Event Handlers** - Updated all room creation handlers:
   - `create_room` (War game)
   - `create_bingo_room` (Bingo)
   - `create_blackjack_room` (Blackjack)

4. **Room Summaries** - Added displayName to lobby room lists:
   - `getRoomsSummary()` - For War rooms
   - `getBingoRoomsSummary()` - For Bingo rooms

### Security Features
- Room names are sanitized using `sanitizeMessage()` to prevent XSS attacks
- Names are limited to 30 characters maximum
- If no name is provided, displayName is `null` and rooms show with just the roomId

## Client-Side Usage

### Creating a Named Room (War)
```javascript
// When creating a room, pass the roomName in the data object
socket.emit('create_room', {
  playerName: 'YourName',
  photo: 'avatar-url',
  startingChips: 1000,
  roomName: 'Friday Night War' // Optional custom name
});
```

### Creating a Named Bingo Room
```javascript
socket.emit('create_bingo_room', {
  roomName: 'Saturday Bingo Bash' // Optional custom name
});
```

### Creating a Named Blackjack Room
```javascript
socket.emit('create_blackjack_room', {
  playerSeed: 'your-seed',
  roomName: 'High Stakes Table' // Optional custom name
});
```

### Displaying Room Names in Lobby
```javascript
// When you receive the rooms list
socket.on('rooms_update', (rooms) => {
  rooms.forEach(room => {
    const displayText = room.displayName || room.roomId;
    console.log(`Room: ${displayText} (${room.seatedCount} players)`);
  });
});
```

## Example UI Implementation

### HTML Input for Room Creation
```html
<div class="create-room-modal">
  <h3>Create a Room</h3>
  <input 
    type="text" 
    id="roomNameInput" 
    placeholder="Room name (optional)" 
    maxlength="30"
  />
  <button onclick="createNamedRoom()">Create Room</button>
</div>
```

### JavaScript Handler
```javascript
function createNamedRoom() {
  const roomName = document.getElementById('roomNameInput').value.trim();
  
  socket.emit('create_room', {
    playerName: currentPlayer.name,
    photo: currentPlayer.avatar,
    startingChips: 1000,
    roomName: roomName || undefined // Only send if not empty
  });
}
```

### Lobby Display
```javascript
function displayRoomInLobby(room) {
  const roomElement = document.createElement('div');
  roomElement.className = 'room-card';
  
  // Use displayName if available, otherwise show roomId
  const title = room.displayName 
    ? `${room.displayName} <span class="room-id">(${room.roomId})</span>`
    : room.roomId;
  
  roomElement.innerHTML = `
    <h4>${title}</h4>
    <p>Players: ${room.seatedCount}/${room.maxPlayers || 5}</p>
    <button onclick="joinRoom('${room.roomId}')">Join</button>
  `;
  
  return roomElement;
}
```

## Database Considerations

The displayName is currently stored only in memory (not persisted to the database). If you want to persist room names for historical purposes, you could:

1. Add a `displayName` field to the `GameSession` model in Prisma
2. Save it when creating the game session
3. Load it when restoring game state

## Examples of Good Room Names
- "Friday Night War"
- "High Rollers Only"
- "Beginner Friendly"
- "Tournament Finals"
- "Late Night Grind"

## API Response Structure

### Room in Lobby List (War)
```json
{
  "roomId": "a3b4c5d6",
  "displayName": "Friday Night War",
  "seatedCount": 3,
  "observerCount": 2,
  "hasEmptySeat": true,
  "gameType": "WAR"
}
```

### Room in Lobby List (Bingo)
```json
{
  "roomId": "bingo_1234abcd",
  "displayName": "Saturday Bingo",
  "type": "BINGO",
  "playerCount": 15,
  "phase": "betting",
  "pot": 500
}
```

### Game State (Includes displayName)
```json
{
  "roomId": "a3b4c5d6",
  "displayName": "Friday Night War",
  "seats": [...],
  "observers": [...],
  "pot": 300,
  "roundActive": true,
  "status": "Place your bets!"
}
```

## Testing

1. **Create a room with a name**:
   ```javascript
   socket.emit('create_room', { roomName: 'Test Room' });
   ```

2. **Create a room without a name** (should default to null):
   ```javascript
   socket.emit('create_room', {});
   ```

3. **Test XSS protection** (should be sanitized):
   ```javascript
   socket.emit('create_room', { 
     roomName: '<script>alert("xss")</script>' 
   });
   ```

4. **Test length limit** (should be truncated to 30 chars):
   ```javascript
   socket.emit('create_room', { 
     roomName: 'This is a very long room name that exceeds thirty characters' 
   });
   ```

## Backwards Compatibility

This feature is fully backwards compatible:
- Old clients that don't send `roomName` will work fine (displayName will be null)
- Old code that expects only `roomId` will continue to work
- The displayName is optional everywhere it's used
