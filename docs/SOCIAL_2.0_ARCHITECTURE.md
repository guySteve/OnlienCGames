# VegasCore Social 2.0 Architecture

## Executive Summary

This document details the complete architectural upgrade from VegasCore 4.0 (individual play) to VegasCore 5.0 "Social 2.0" (tribal ecosystem). Every technical decision serves two primary objectives: **Retention** and **Social Contagion**.

---

## Architectural Overview

### System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VEGASCORE SOCIAL 2.0                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   CLIENT    │    │   SOCKET    │    │   SERVICES  │    │  DATABASE   │  │
│  │   LAYER     │◄──►│   LAYER     │◄──►│   LAYER     │◄──►│   LAYER     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │          │
│        ▼                  ▼                  ▼                  ▼          │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         NEW SYNDICATE LAYER                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │  Syndicate  │  │  Treasury   │  │  Referral   │  │  Dividend   │  │ │
│  │  │  Service    │  │  Manager    │  │  Engine     │  │  Scheduler  │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      ENHANCED ENGAGEMENT LAYER                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │  Variable   │  │  Generosity │  │  Happy Hour │  │  Streak     │  │ │
│  │  │  Rewards    │  │  Leaderboard│  │  Engine     │  │  v2.0       │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         GAME ENGINE LAYER                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │  War        │  │  Blackjack  │  │  Bingo      │  │  Provably   │  │ │
│  │  │  Engine     │  │  Engine     │  │  Engine     │  │  Fair 2.0   │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Treasury Tax

```
Player Wins Big (≥1000 chips)
        │
        ▼
┌───────────────────┐
│ GameEngine.award  │
│ Chips()           │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌───────────────────┐
│ Check if player   │────►│ Calculate 1% Tax  │
│ is in Syndicate   │     │ (min 10 chips)    │
└───────────────────┘     └────────┬──────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
         ▼                                                   ▼
┌───────────────────┐                           ┌───────────────────┐
│ Credit 99% to     │                           │ Credit 1% to      │
│ Player Balance    │                           │ Syndicate Treasury│
└───────────────────┘                           └───────────────────┘
         │                                                   │
         └─────────────────────────┬─────────────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────┐
                    │ Emit Real-time Update to  │
                    │ All Syndicate Members     │
                    └───────────────────────────┘
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Extended with Syndicate models |
| `src/services/SyndicateService.js` | Core syndicate business logic |
| `src/services/EngagementServiceV2.js` | Enhanced engagement with variable rewards |
| `src/services/ReferralService.js` | Double-sided referral engine |
| `src/services/GenerosityService.js` | Tip leaderboard and patron badges |
| `src/jobs/DividendDistributor.js` | Weekly dividend cron job |
| `src/jobs/HappyHourScheduler.js` | Randomized happy hour triggers |
| `frontend/src/components/SyndicateHUD.jsx` | Guild UI overlay |
| `frontend/src/components/ProvablyFairVerifier.jsx` | Transparency UI |
| `frontend/src/components/HappyHourBanner.jsx` | Countdown timer |
| `frontend/src/hooks/useSpatialAudio.js` | Howler.js integration |
| `frontend/src/hooks/useCardPhysics.js` | Physics-based animations |

---

## Phase Rollout

### Phase 1: Foundation (Week 1-2)
- Database schema migration
- SyndicateService core implementation
- Basic SyndicateHUD component

### Phase 2: Economics (Week 3-4)
- Treasury Tax integration with game engines
- Dividend distribution job
- Referral system with tracking

### Phase 3: Engagement (Week 5-6)
- Variable reward schedule
- Generosity leaderboard
- Happy Hour visual system

### Phase 4: Juice (Week 7-8)
- Physics-based card animations
- Spatial audio implementation
- Mobile optimizations
- Provably Fair 2.0 UI

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| DAU/MAU Ratio | 15% | 35% | Daily active / Monthly active |
| D7 Retention | 22% | 45% | Users returning after 7 days |
| Viral Coefficient | 0.3 | 1.2 | New users per existing user |
| Session Length | 8 min | 18 min | Average time in app |
| Syndicate Participation | 0% | 60% | Users in a syndicate |
