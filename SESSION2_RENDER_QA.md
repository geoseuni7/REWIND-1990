# Session 2 / Render QA

## Scope
- General mode is preserved; Session 2 code is isolated under the Session 2 style/script section.
- Render deployment target uses `server.js`, `package.json`, `render.yaml`, `session2_assets.json`, and `index.html`.

## Results
| Item | Result | Evidence |
|---|---|---|
| Online battle button -> Session 2 | PASS | `chooseMode('user')` calls `s2Enter()`; general-mode branch remains unchanged |
| General-mode code outside Session 2 section | PASS | prefix before `session2Style` identical to previous Session 2 snapshot |
| Real-time names | PASS | server `publicView()` returns player names every poll |
| Real-time leaderboard amount | PASS | server recomputes net worth on each request; client polls every 700ms |
| Private cash/positions/loan | PASS | only `me` contains private state |
| Common market price | PASS | room-level `marketPrices` |
| Independent holdings | PASS | player-level positions/avg/cash |
| Same-round multi-player trading | PASS | server no longer serializes regular trades by player turn |
| Random whole-player day trade | PASS | 40% server-side trigger per round; all room players receive the same event/price |
| Day-trade timer | PASS | server clock is authoritative; 30-second event; expired positions auto-settle |
| Day-trade anti-client-trust | PASS | buy/sell, price, cash and settlement are server-side |
| Lobby ready N/N | PASS | server counts ready players; start requires all participants ready |
| Round transition ready N/N | PASS | every player must press ready; only then server advances month |
| Month progression | PASS | 1990.01 -> 1990.02 verified |
| Duplicate ready protection | PASS | already-ready player cannot advance twice |
| Negative cash prevention | PASS | server validates regular/day-trade purchases and loans |
| Oversell prevention | PASS | server validates owned quantity |
| Session 2 save namespace | PASS | `tm-session2-save` separate from normal save |
| Render-style PORT binding | PASS | `process.env.PORT || 3000` |
| Node syntax | PASS | `node --check server.js` and extracted HTML JS |
| Local Render-equivalent server flow | PASS | server started with `node server.js`, API flow passed |
| Actual deployment to user's Render account | UNVERIFIED | no access to user's Render project/account |
| Actual mobile touch in deployed browser | UNVERIFIED | no deployed-device browser session available |

## Automated integration checks
1. Room create: PASS
2. Room join: PASS
3. Two-player lobby: PASS
4. Lobby ready 1/2 -> 2/2: PASS
5. Game start: PASS
6. 1990.01 maintained after start: PASS
7. Player A ready -> waits at 1/2: PASS
8. Player B ready -> advances to 1990.02: PASS
9. Both players trade the same asset in the same round: PASS
10. Player state remains independent: PASS
11. Leaderboard contains both names and server-calculated net worth: PASS
12. Random day-trade event discovered and executed in test run: PASS
13. Day-trade event is shared between players: PASS

## Remaining limitation
Rooms/session state are in server memory. A Render restart or multiple web instances will not preserve/synchronize rooms. For durable/multi-instance online play, a shared store such as Redis is required.
