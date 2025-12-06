# Daily Chip Allowance Changed to 100

## ✅ Changes Applied

All daily chip rewards have been reduced by 10x (divided by 10).

---

## Files Modified

### 1. **src/db.js**
- ✅ Line 32: Daily chip reset changed from `1000` → `100`

**Before:**
```javascript
const DAILY_CHIPS = 1000n;
```

**After:**
```javascript
const DAILY_CHIPS = 100n;
```

---

### 2. **src/services/EngagementServiceV2.js**
- ✅ All streak rewards reduced by 10x

**Streak Reward Changes:**

| Day | Before | After | Change |
|-----|--------|-------|--------|
| 1 | 1,000 | 100 | -90% |
| 2 | 1,200 | 120 | -90% |
| 3 | 1,500 | 150 | -90% |
| 4 | 2,000 | 200 | -90% |
| 5 | 2,500 | 250 | -90% |
| 6 | 3,500 | 350 | -90% |
| 7 (milestone) | 7,500 | 750 | -90% |
| 8 | 4,000 | 400 | -90% |
| 9 | 4,200 | 420 | -90% |
| 10 | 4,500 | 450 | -90% |
| 11 | 4,800 | 480 | -90% |
| 12 | 5,200 | 520 | -90% |
| 13 | 5,700 | 570 | -90% |
| 14 (milestone) | 15,000 | 1,500 | -90% |
| 21 (milestone) | 20,000 | 2,000 | -90% |
| 30 (milestone) | 50,000 | 5,000 | -90% |

---

### 3. **prisma/schema.prisma**
- ✅ Line 101: Default chip balance for new users changed from `1000` → `100`

**Before:**
```prisma
chipBalance           BigInt            @default(1000)
```

**After:**
```prisma
chipBalance           BigInt            @default(100)
```

---

### 4. **src/db.js**
- ✅ Line 106: New user creation chip balance changed from `1000` → `100`

**Before:**
```javascript
chipBalance: 1000n,
```

**After:**
```javascript
chipBalance: 100n,
```

---

## Impact

### For New Users:
- ✅ Start with **100 chips** instead of 1,000
- ✅ Daily rewards give **100 chips** on day 1
- ✅ All streak bonuses are 10x lower

### For Existing Users:
- ✅ **Existing chip balances are NOT affected** (only new daily rewards)
- ✅ Daily reset will give **100 chips** instead of 1,000
- ✅ Streak rewards will be 10x lower going forward

---

## Economy Impact

### Old Economy (Before):
- Day 1 reward: 1,000 chips
- Week milestone (Day 7): 7,500 chips
- Month milestone (Day 30): 50,000 chips

### New Economy (After):
- Day 1 reward: **100 chips**
- Week milestone (Day 7): **750 chips**
- Month milestone (Day 30): **5,000 chips**

**Result:**
- Chips are now 10x more valuable
- Daily grind is more challenging
- Encourages strategic play and chip conservation

---

## Testing

### Test Daily Reset:
1. Start the server
2. Sign in with your account
3. Click "Claim Daily Chips"
4. **Should receive 100 chips** (not 1,000)

### Test New User:
1. Create a new Google account
2. Sign in to the casino
3. Check chip balance
4. **Should start with 100 chips**

### Test Streak Rewards:
1. Claim daily reward on consecutive days
2. Day 1: **100 chips**
3. Day 2: **120 chips**
4. Day 3: **150 chips**
5. Day 7: **750 chips**

---

## Database Migration

✅ **Migration Complete:**
```
Your database is now in sync with your Prisma schema. Done in 1.81s
✔ Generated Prisma Client (v5.22.0)
```

**Schema changes applied:**
- Default chip balance: 1000 → 100
- Database is in sync
- Prisma client regenerated

---

## Rollback (If Needed)

If you want to revert back to 1,000 chips:

1. **src/db.js line 32:**
   ```javascript
   const DAILY_CHIPS = 1000n;
   ```

2. **src/services/EngagementServiceV2.js:**
   Multiply all chip values by 10

3. **prisma/schema.prisma line 101:**
   ```prisma
   chipBalance           BigInt            @default(1000)
   ```

4. **src/db.js line 106:**
   ```javascript
   chipBalance: 1000n,
   ```

5. Run:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

---

## ✅ Summary

- **Daily chip allowance:** 1,000 → **100** ✅
- **All streak rewards:** Reduced by 90% ✅
- **New user starting balance:** 1,000 → **100** ✅
- **Database schema:** Updated ✅
- **Prisma client:** Regenerated ✅

**The economy is now 10x tighter!** Players need to be more strategic with their chips. 💰
