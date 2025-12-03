# Friends & Table Invites Feature

## Overview
Added comprehensive friend management and table invite system with first-time avatar setup.

## Features Implemented

### 1. First-Time Avatar Setup
- New users are prompted to select an avatar on first login
- Modal automatically opens if `needsAvatarSetup` is true
- Users can choose from 8 DiceBear avatar styles or provide custom URL
- Avatar preference saved to database

### 2. Friend System

#### Database Schema
- **Friendship Model**: Tracks friend relationships
  - `userId` - User who initiated the request
  - `friendId` - User who received the request
  - `status` - PENDING, ACCEPTED, BLOCKED
  - Bidirectional relations for efficient querying

#### API Endpoints
- `GET /friends` - Get list of accepted friends
- `GET /friend-requests` - Get pending friend requests
- `POST /friend-request` - Send friend request by email
- `POST /friend-request/:id/accept` - Accept friend request
- `POST /friend-request/:id/decline` - Decline friend request

#### UI Components
- Friends list in lobby sidebar
- "Add Friend" button and modal
- Friend request notifications with accept/decline actions
- Real-time updates via Socket.IO

### 3. Table Invites

#### Database Schema
- **TableInvite Model**: Tracks table invitations
  - `roomId` - The game room being invited to
  - `fromUserId` - User sending invite
  - `toUserId` - User receiving invite
  - `status` - PENDING, ACCEPTED, DECLINED, EXPIRED
  - `expiresAt` - Invite expires after 5 minutes

#### Socket Events
- `send_invite` - Send table invite to friend
- `table_invite` - Receive invite notification
- `accept_invite` - Accept invite and join room
- `invite_accepted` - Confirmation and game state

#### UI Features
- "Invite" button next to friends when in a game room
- Table invites modal showing pending invites
- Real-time notifications for new invites
- Automatic join on invite acceptance

### 4. User Experience

#### First Login Flow
1. User logs in with Google
2. Avatar setup modal automatically opens
3. User selects from generated avatars or custom URL
4. Profile saved, `needsAvatarSetup` set to false
5. User proceeds to lobby

#### Adding Friends
1. Click "+ Add" button in Friends section
2. Enter friend's email address
3. Friend receives real-time notification
4. Friend can accept/decline from lobby

#### Inviting Friends to Table
1. Create or join a game room
2. "Invite" buttons appear next to online friends
3. Click to send instant invite
4. Friend receives notification and modal
5. Friend clicks "Join" to enter the game

## Technical Details

### Database Migrations
- Added `needsAvatarSetup` field to User model
- Created Friendship model with bidirectional relations
- Created TableInvite model with expiration
- Added FriendshipStatus and InviteStatus enums

### Client-Side State
- `friends[]` - List of accepted friends
- `friendRequests[]` - Pending incoming requests
- `tableInvites[]` - Active table invitations

### Socket.IO Integration
- Real-time friend request notifications
- Instant table invite delivery
- Live friends list updates
- Automatic room joining on invite acceptance

### Security Considerations
- Email-based friend lookup prevents friend ID enumeration
- Invite expiration prevents stale invites (5 minutes)
- Socket session validation for all invite actions
- Database cascade deletes for data integrity

### 4. Chip Transfers

#### Database Changes
- Added `TRANSFER_SENT` and `TRANSFER_RECEIVED` transaction types
- Added `relatedUserId` field to Transaction model to track transfer partner
- Metadata stores sender/recipient name for transaction history

#### API Endpoint
- `POST /transfer-chips` - Transfer chips to a friend
  - Validates friendship status
  - Checks sender balance
  - Atomic transaction (both users updated or neither)
  - Creates transaction records for both users
  - Real-time notification to recipient

#### Security & Validation
- **Minimum transfer**: 10 chips
- **Friendship required**: Can only send to accepted friends
- **Balance validation**: Cannot send more than you have
- **Atomic transactions**: Uses Prisma transactions to ensure consistency
- **Cannot self-transfer**: Prevents sending to yourself
- **Transaction audit trail**: Full history of all transfers

#### UI Features
- "💰 Send" button next to each friend
- Transfer modal with:
  - Recipient name display
  - Amount input with validation
  - Quick amount buttons (50, 100, 500, 1000)
  - Current balance display
- Real-time balance updates
- Success notifications for both sender and receiver

#### Socket Events
- `chips_received` - Real-time notification when chips are received
- Automatically updates balance in UI
- Shows notification with sender's name and amount

### 5. User Experience

#### First Login Flow
1. User logs in with Google
2. Avatar setup modal automatically opens
3. User selects from generated avatars or custom URL
4. Profile saved, `needsAvatarSetup` set to false
5. User proceeds to lobby

#### Adding Friends
1. Click "+ Add" button in Friends section
2. Enter friend's email address
3. Friend receives real-time notification
4. Friend can accept/decline from lobby

#### Sending Chips
1. View friends list in lobby
2. Click "💰 Send" button next to friend
3. Enter amount or use quick amount buttons
4. Click "Send Chips"
5. Friend receives instant notification
6. Both balances update in real-time

#### Inviting Friends to Table
1. Create or join a game room
2. "Invite" buttons appear next to online friends
3. Click to send instant invite
4. Friend receives notification and modal
5. Friend clicks "Join" to enter the game

## Technical Details

### Database Migrations
- Added `needsAvatarSetup` field to User model
- Created Friendship model with bidirectional relations
- Created TableInvite model with expiration
- Added FriendshipStatus and InviteStatus enums
- Added `TRANSFER_SENT` and `TRANSFER_RECEIVED` to TransactionType enum
- Added `relatedUserId` field to Transaction model

### Client-Side State
- `friends[]` - List of accepted friends
- `friendRequests[]` - Pending incoming requests
- `tableInvites[]` - Active table invitations
- `transferTargetId` - Current transfer recipient
- `transferTargetName` - Recipient display name

### Socket.IO Integration
- Real-time friend request notifications
- Instant table invite delivery
- Live friends list updates
- Automatic room joining on invite acceptance
- Real-time chip transfer notifications

### Security Considerations
- Email-based friend lookup prevents friend ID enumeration
- Invite expiration prevents stale invites (5 minutes)
- Socket session validation for all invite actions
- Database cascade deletes for data integrity
- Friendship verification for chip transfers
- Atomic database transactions for chip transfers
- Balance validation before transfer
- Minimum transfer amount (10 chips)
- Transaction audit trail for all transfers

## Future Enhancements
- Friend search by username (not just email)
- Block/unfriend functionality
- Online status indicators
- Friend chat system
- Invite history
- Multiple invite support (invite multiple friends at once)
- Transfer limits (daily/per-transfer maximums)
- Transfer fees for large amounts
- Gift messages with transfers
- Transfer history view
- Push notifications for mobile

## Testing Checklist
- [x] Avatar setup on first login
- [x] Friend request by email
- [x] Accept/decline friend requests
- [x] View friends list
- [x] Send table invite
- [x] Receive and accept invite
- [x] Invite expiration handling
- [x] Socket reconnection handling
- [x] Multi-user scenarios
- [x] Chip transfer between friends
- [x] Transfer validation (minimum, balance, friendship)
- [x] Real-time balance updates
- [x] Transaction history recording
- [x] Transfer notifications
