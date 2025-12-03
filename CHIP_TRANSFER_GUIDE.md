# 💰 Chip Transfer Feature Guide

## Quick Overview
Send chips to your friends instantly! A safe and secure way to share your winnings.

## How to Send Chips

### Step 1: View Your Friends
- Go to the lobby
- Look at the Friends section on the right sidebar
- You'll see all your accepted friends listed

### Step 2: Initiate Transfer
- Click the "💰 Send" button next to your friend's name
- A transfer modal will open

### Step 3: Enter Amount
- Type in the amount you want to send (minimum 10 chips)
- Or use the quick amount buttons: 50, 100, 500, 1000
- Your current balance is shown at the bottom

### Step 4: Confirm & Send
- Click "Send Chips"
- The chips are instantly transferred!
- Both you and your friend get real-time notifications

## Features

### ✅ Secure Transfers
- **Friendship Required**: Can only send to accepted friends
- **Balance Validation**: Cannot send more than you have
- **Atomic Transactions**: Both accounts update together or not at all
- **No Self-Transfers**: Cannot send to yourself

### ✅ User-Friendly
- **Quick Amounts**: One-click preset amounts
- **Balance Display**: See your balance before sending
- **Real-Time Updates**: Balance updates instantly
- **Notifications**: Both parties get notified

### ✅ Complete Audit Trail
- Every transfer is recorded
- Transaction history shows:
  - Amount sent/received
  - Who you sent to/received from
  - Balance before and after
  - Timestamp

## Transfer Limits

| Limit Type | Amount |
|------------|--------|
| Minimum Transfer | 10 chips |
| Maximum Transfer | Your balance |
| Self-Transfer | Not allowed ❌ |
| Non-Friend Transfer | Not allowed ❌ |

## Receiving Chips

When someone sends you chips:
1. 💰 You get an instant notification showing:
   - Who sent the chips
   - How many chips
2. Your balance automatically updates
3. Transaction is recorded in your history

## Common Use Cases

### 🎁 Gift Chips to New Players
Help your friends get started with some starting chips!

### 🤝 Split Winnings
Won big? Share the wealth with friends who played with you!

### 💪 Support Friends
Friend running low? Send them some chips to keep playing!

### 🎉 Celebrate Together
Won a big hand? Spread the joy by sending chips!

## Technical Details

### Transaction Safety
- Uses PostgreSQL transactions for ACID compliance
- Both sender and receiver records created atomically
- Rollback on any error (no partial transfers)

### Real-Time Sync
- Socket.IO for instant notifications
- Balance updates across all open sessions
- No page refresh needed

### Database Records
Each transfer creates 2 transaction records:
1. **Sender**: `TRANSFER_SENT` with negative amount
2. **Receiver**: `TRANSFER_RECEIVED` with positive amount

Both records link to each other via `relatedUserId` field.

## FAQ

**Q: Is there a fee for transfers?**  
A: No! Transfers are completely free.

**Q: Can I cancel a transfer?**  
A: No, transfers are instant and final.

**Q: What's the minimum I can send?**  
A: 10 chips minimum to prevent spam.

**Q: Can I send to anyone?**  
A: Only to accepted friends for security.

**Q: Are transfers reversible?**  
A: No, but they're tracked in transaction history.

**Q: What if my friend is offline?**  
A: The transfer still works! They'll see it when they log in.

**Q: Is there a daily limit?**  
A: Not currently, but may be added for balance purposes.

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Insufficient chips" | You don't have enough | Play some games to earn more |
| "Minimum transfer is 10 chips" | Amount too small | Enter at least 10 chips |
| "Can only transfer chips to friends" | Not friends yet | Send a friend request first |
| "Cannot transfer to yourself" | Self-transfer attempt | Choose a different friend |
| "Friend not found" | Invalid friend ID | Refresh and try again |

## Security Features

✅ **Friendship Verification**: Only accepted friends  
✅ **Balance Checks**: Can't send what you don't have  
✅ **Atomic Operations**: All or nothing  
✅ **Transaction Logs**: Complete audit trail  
✅ **Real-Time Validation**: Checks happen server-side  
✅ **Session Validation**: Authenticated users only  

---

**Pro Tip**: Use the quick amount buttons for common transfer amounts!
