# FRONTEND_INTEGRATION.md
# 《现代大亨》前端接入指南

> 技术栈假设：**Vue 3 + Pinia + socket.io-client（TypeScript）**
>
> 信息差原则：服务器永远不在广播中携带 `cash`、`propCards`、`hasImmunity`、`priceHikeActive`。
> 所有余额更新只通过定向私密事件 `CASH_UPDATED` 送达本人。

---

## 目录

1. [HTTP REST 大厅接口](#1-http-rest-大厅接口)
2. [Socket.io 连接与握手](#2-socketio-连接与握手)
3. [State Mapping — Pinia Store 字段设计](#3-state-mapping--pinia-store-字段设计)
4. [Action List — 前端 emit 事件](#4-action-list--前端-emit-事件)
5. [Event Listeners — 前端需监听的广播事件](#5-event-listeners--前端需监听的广播事件)
6. [定向私密事件（仅发给当事人）](#6-定向私密事件仅发给当事人)
7. [UI 驱动逻辑：constructibleTileIds 高亮](#7-ui-驱动逻辑constructibletileids-高亮)
8. [错误处理与操作拒绝](#8-错误处理与操作拒绝)
9. [完整连接生命周期](#9-完整连接生命周期)

---

## 1. HTTP REST 大厅接口

Base URL: `http://<host>:<port>/api/v1`

| 方法 | 路径 | 说明 | 请求体 | 成功响应 |
|------|------|------|--------|---------|
| GET  | `/health` | 健康检查 | — | `{ status: string, uptime: number }` |
| GET  | `/rooms` | 获取大厅列表 | — | `{ rooms: RoomSummary[] }` |
| POST | `/rooms` | 创建房间 | `{ hostNickname: string }` | `{ roomId: string, sessionToken: string }` |
| POST | `/rooms/:id/join` | 加入房间 | `{ nickname: string }` | `{ roomId: string, sessionToken: string }` |
| DELETE | `/rooms/:id` | 解散房间（仅房主） | — | `204 No Content` |

`DELETE` 请求需附带 `Authorization: Bearer <sessionToken>` 请求头。

**`sessionToken`** 是 JWT，内含 `{ playerId, roomId, iat }`，保存到 `localStorage` 供断线重连使用。

```typescript
// RoomSummary 结构
interface RoomSummary {
  id: string;
  hostNickname: string;
  playerCount: number;
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';
  createdAt: number;
}
```

---

## 2. Socket.io 连接与握手

```typescript
import { io } from 'socket.io-client';

const socket = io('http://<host>:<port>', {
  auth: {
    sessionToken: localStorage.getItem('sessionToken') ?? undefined,
    roomId: currentRoomId,
    nickname: playerNickname,
  },
  reconnection: false, // 手动管理重连
});
```

握手认证逻辑：
- 首次连接：`auth.sessionToken` 为空，服务器注册新玩家
- 断线重连：携带有效 `sessionToken`，服务器触发重连流程并返回 `RECONNECT_SUCCESS`

---

## 3. State Mapping — Pinia Store 字段设计

### 推荐 Store 结构

```
stores/
  useGameStore.ts      // 游戏核心状态（房间、阶段、回合）
  useSelfStore.ts      // 本玩家私有视图（现金、道具卡）
  usePlayersStore.ts   // 所有玩家公开视图
  useAuctionStore.ts   // 拍卖状态
  useTradeStore.ts     // 交易状态
```

---

### `PlayerSelfView` → `useSelfStore`

`PlayerSelfView` 通过 `RECONNECT_SUCCESS.selfView` 或初始连接时服务器内部发送，后续通过各事件增量更新。

| `PlayerSelfView` 字段 | Pinia Store 字段 | 更新事件 |
|----------------------|-----------------|---------|
| `id` | `self.id` | 连接时固定 |
| `nickname` | `self.nickname` | 连接时固定 |
| `position` | `self.position` | `PLAYER_MOVED` |
| `cash` | `self.cash` | `CASH_UPDATED` (定向) |
| `propCards` | `self.propCards: PropCard[]` | `RECONNECT_SUCCESS` |
| `hasImmunity` | `self.hasImmunity` | `RECONNECT_SUCCESS` / `IMMUNITY_USED` |
| `priceHikeActive` | `self.priceHikeActive` | `RECONNECT_SUCCESS` / `PRICE_HIKE_EXPIRED` |
| `priceHikeExpiresOnTurn` | `self.priceHikeExpiresOnTurn` | `RECONNECT_SUCCESS` |
| `constructibleTileIds` | `self.constructibleTileIds: TileId[]` | `RECONNECT_SUCCESS` / `PROPERTY_PURCHASED` / `TRADE_COMPLETED` / `BUILDING_BUILT` |
| `inJail` | `self.inJail` | `DICE_ROLLED`(triple-double) / `JAIL_AUTO_RELEASED` |
| `jailTurnsWaited` | `self.jailTurnsWaited` | `TURN_STARTED` (推断) |
| `status` | `self.status` | `PLAYER_DYING` / `PLAYER_BANKRUPT` |
| `ownedTileIds` | `self.ownedTileIds: TileId[]` | `PROPERTY_PURCHASED` / `TRADE_COMPLETED` / `PROPERTY_FREED` |

> **注意**：`constructibleTileIds` 是服务器实时计算并定向推送的，前端不得本地计算。
> 每次影响地产归属或建筑等级的事件后，服务器会推送更新的 `selfView` 或直接通过 `RECONNECT_SUCCESS` 恢复完整状态。

---

### `PlayerPublicView` → `usePlayersStore`

广播事件中所有玩家数据均为 `PlayerPublicView`，永远不含 `cash`、`propCards`。

| `PlayerPublicView` 字段 | Pinia Store 字段 | 更新事件 |
|------------------------|-----------------|---------|
| `id` | `players[id].id` | `MAP_GENERATED` |
| `nickname` | `players[id].nickname` | `MAP_GENERATED` |
| `avatar` | `players[id].avatar` | `MAP_GENERATED` |
| `color` | `players[id].color` | `MAP_GENERATED` |
| `position` | `players[id].position` | `PLAYER_MOVED` |
| `inJail` | `players[id].inJail` | `DICE_ROLLED` / `JAIL_AUTO_RELEASED` |
| `jailTurnsWaited` | `players[id].jailTurnsWaited` | `TURN_STARTED`（可从回合数推断） |
| `status` | `players[id].status` | `PLAYER_DYING` / `PLAYER_BANKRUPT` / `PLAYER_DISCONNECTED` |
| `ownedTileIds` | `players[id].ownedTileIds` | `PROPERTY_PURCHASED` / `TRADE_COMPLETED` / `PROPERTY_FREED` |

---

### `useGameStore` — 游戏核心状态

```typescript
interface GameState {
  roomId: string;
  status: GameStatus;           // LOBBY | IN_PROGRESS | PAUSED | FINISHED
  currentPhase: TurnPhase;
  currentTurnPlayerId: string;
  turnNumber: number;
  playerOrder: string[];
  board: TilePublicView[];      // 56格静态+动态信息
  activeAuction: AuctionPublicView | null;
  pendingTrades: TradePublicView[];
  winners: string[];
}

// 更新来源：MAP_GENERATED, TURN_STARTED, TURN_ENDED, GAME_PAUSED,
//           GAME_RESUMED, GAME_OVER, PLAYER_MOVED 等
```

---

### `useAuctionStore`

```typescript
interface AuctionState {
  auctionId: string | null;
  tileId: number | null;
  currentBid: number;
  currentLeaderId: string | null;
  activePlayerIds: string[];
  passedPlayerIds: string[];
  roundDeadlineAt: number | null;   // 用于倒计时 UI
  status: AuctionStatus | null;
}
```

---

## 4. Action List — 前端 emit 事件

> 格式：`socket.emit(eventName, payload)`。标注 `{}` 表示空对象（不传 payload 也可）。

### 游戏流程

| 事件名 | Payload 类型 | 允许阶段 | 额外条件 |
|--------|-------------|---------|---------|
| `action:START_GAME` | `{}` | `LOBBY` | 仅房主 |
| `action:ROLL_DICE` | `{}` | `WAITING_FOR_ACTION` 或 `JAIL_DECISION` | 当前玩家 |
| `action:ROLL_FOR_DOUBLE` | `{}` | `JAIL_DECISION` | 当前玩家（在狱中） |
| `action:END_TURN` | `{}` | `END_TURN_PENDING` | 当前玩家 |
| `action:DECLARE_BANKRUPTCY` | `{}` | `DYING_RESCUE` | 濒死玩家本人 |

### 落地决策

| 事件名 | Payload 类型 | 允许阶段 | 说明 |
|--------|-------------|---------|------|
| `action:BUY_PROPERTY` | `{}` | `EVENT_TRIGGER` | 购买当前地块 |
| `action:CHOOSE_AUCTION` | `{}` | `EVENT_TRIGGER` | 发起拍卖当前地块 |
| `action:SKIP_PURCHASE` | `{}` | `EVENT_TRIGGER` | 放弃购买/拍卖 |
| `action:TEMPLE_PRAY` | `{}` | `EVENT_TRIGGER` | 寺庙祈福（地主踩到未点亮寺庙） |
| `action:CASINO_BET` | `{ amount: number }` | `EVENT_TRIGGER` | 赌场下注，`amount` 必须是 `casinoBetMultiple` 的整数倍 |
| `action:PAY_BAIL` | `{}` | `JAIL_DECISION` | 付保释金出狱 |

### 拍卖

| 事件名 | Payload 类型 | 允许阶段 |
|--------|-------------|---------|
| `action:AUCTION_BID` | `{ amount: number }` | `AUCTION_IN_PROGRESS` |
| `action:AUCTION_PASS` | `{}` | `AUCTION_IN_PROGRESS` |

### 建筑与抵押

| 事件名 | Payload 类型 | 允许阶段 |
|--------|-------------|---------|
| `action:BUILD_HOUSE` | `{ tileId: number }` | `WAITING_FOR_ACTION` \| `END_TURN_PENDING` |
| `action:BUILD_HOTEL` | `{ tileId: number }` | `WAITING_FOR_ACTION` \| `END_TURN_PENDING` |
| `action:SELL_BUILDING` | `{ tileId: number }` | `WAITING_FOR_ACTION` \| `DYING_RESCUE` \| `END_TURN_PENDING` |
| `action:MORTGAGE` | `{ tileId: number }` | `WAITING_FOR_ACTION` \| `DYING_RESCUE` \| `END_TURN_PENDING` |
| `action:UNMORTGAGE` | `{ tileId: number }` | `WAITING_FOR_ACTION` \| `END_TURN_PENDING` |

### 交易

| 事件名 | Payload 类型 | 允许阶段 | 说明 |
|--------|-------------|---------|------|
| `action:PROPOSE_TRADE` | `ProposeTrade` | 任意（含 `DYING_RESCUE`） | 见下方类型 |
| `action:ACCEPT_TRADE` | `{ tradeId: string }` | 任意（含 `DYING_RESCUE`） | 响应方 |
| `action:REJECT_TRADE` | `{ tradeId: string }` | 任意 | 响应方 |
| `action:CANCEL_TRADE` | `{ tradeId: string }` | 任意 | 发起方 |

```typescript
interface TradeOffer {
  cash?: number;          // 默认 0
  tileIds: number[];      // TileId[]
  propCardIds?: string[]; // 道具卡 UUID[]
}

interface ProposeTrade {
  responderId: string;
  proposerOffer: TradeOffer;
  responderOffer: TradeOffer;
}
```

### 道具卡

| 事件名 | Payload 类型 | 允许阶段 |
|--------|-------------|---------|
| `action:USE_PROP_CARD` | `UsePropCard` | `WAITING_FOR_ACTION` \| `END_TURN_PENDING` |

```typescript
interface UsePropCard {
  cardId: string;           // UUID（来自 propCards[].id）
  cardType: PropCardType;   // 见下方枚举
  targetPlayerId?: string;  // PLUNDER / AUDIT / FORCED_TRADE 需要
  targetTileId?: number;    // FORCED_TRADE 需要
  steps?: 5 | 6 | 7;       // REMOTE_DICE 需要
}

// PropCardType 枚举
enum PropCardType {
  FORCED_TRADE = 'FORCED_TRADE',  // 强制买卖（需 targetTileId，不能有建筑）
  REMOTE_DICE  = 'REMOTE_DICE',   // 遥控骰子（需 steps: 5|6|7）
  PLUNDER      = 'PLUNDER',       // 掠夺（需 targetPlayerId）
  IMMUNITY     = 'IMMUNITY',      // 免付（不需额外参数，下次落到他人地免租）
  AUDIT        = 'AUDIT',         // 验资（不需额外参数，结果私密定向）
  PRICE_HIKE   = 'PRICE_HIKE',    // 涨价（不需额外参数，本玩家地租 ×1.5）
}
```

### 断线重连

```typescript
// 断线重连时 emit（服务器也会在 connection 握手时自动处理，
// 此事件可用于主动请求重同步）
socket.emit('action:RECONNECT', {
  sessionToken: localStorage.getItem('sessionToken'),
  roomId: currentRoomId,
});
```

---

## 5. Event Listeners — 前端需监听的广播事件

> 所有广播发给房间内所有玩家，除非另有注明。

### 5.1 游戏流程

```typescript
socket.on('MAP_GENERATED', (payload) => {
  // payload: { board: TilePublicView[], playerOrder: string[] }
  store.board = payload.board;
  store.playerOrder = payload.playerOrder;
});

socket.on('TURN_STARTED', (payload) => {
  // payload: { playerId, turnNumber, phase, timeoutMs }
  store.currentTurnPlayerId = payload.playerId;
  store.currentPhase = payload.phase;
  store.turnNumber = payload.turnNumber;
  // 启动客户端回合倒计时（可选，纯展示）
});

socket.on('TURN_ENDED', (payload) => {
  // payload: { playerId }
});

socket.on('DICE_ROLLED', (payload) => {
  // payload: { playerId, die1, die2, isDouble, totalSteps }
  // 触发骰子动画
});

socket.on('DICE_OVERRIDE', (payload) => {
  // payload: { playerId, steps, source: 'REMOTE_DICE' }
  // 遥控骰子覆盖，更新骰子显示
});

socket.on('PLAYER_MOVED', (payload) => {
  // payload: { playerId, fromPosition, toPosition, passedGo }
  players[payload.playerId].position = payload.toPosition;
  // 触发棋子移动动画
  if (payload.passedGo) showPassedGoEffect(payload.playerId);
});

socket.on('GAME_OVER', (payload) => {
  // payload: { winnerId, standings: Array<{ playerId, rank }> }
  showEndScreen(payload);
});
```

### 5.2 起点事件

```typescript
socket.on('START_PASSED', (payload) => {
  // payload: { playerId, bonusAmount: number }
  // 注意：仅含变动量，不含余额
  showPassedGoBanner(payload.playerId, payload.bonusAmount);
});

socket.on('START_LANDED', (payload) => {
  // payload: { playerId, passBonusAmount: number, landBonusAmount: number }
  showLandedOnGoBanner(payload.playerId, payload.passBonusAmount + payload.landBonusAmount);
});
```

### 5.3 地块事件

```typescript
socket.on('TILE_EVENT', (payload) => {
  // payload: { playerId, tileId, tileType, phase }
  // phase = EVENT_TRIGGER 时，显示当前玩家的地块决策 UI
  // (买/拍/跳过 / 赌场下注 / 寺庙祈福等)
  store.currentPhase = payload.phase;
});

socket.on('PROPERTY_PURCHASED', (payload) => {
  // payload: { tileId, buyerId, price: number }
  board[payload.tileId].ownerId = payload.buyerId;
  players[payload.buyerId].ownedTileIds.push(payload.tileId);
  // 注意：现金变动通过 CASH_UPDATED 定向通知买方本人
});

socket.on('PROPERTY_MORTGAGED', (payload) => {
  // payload: { playerId, tileId, mortgageValue: number }
  board[payload.tileId].isMortgaged = true;
  // 显示抵押标识；现金变动通过 CASH_UPDATED 定向通知
});

socket.on('PROPERTY_UNMORTGAGED', (payload) => {
  // payload: { playerId, tileId, redemptionCost: number }
  board[payload.tileId].isMortgaged = false;
});

socket.on('PROPERTY_FREED', (payload) => {
  // payload: { tileId, previousOwnerId, newOwnerId: null }
  board[payload.tileId].ownerId = null;
  board[payload.tileId].buildingLevel = 0;
  board[payload.tileId].isMortgaged = false;
  players[payload.previousOwnerId].ownedTileIds =
    players[payload.previousOwnerId].ownedTileIds.filter(id => id !== payload.tileId);
});

socket.on('BUILDING_BUILT', (payload) => {
  // payload: { tileId, buildingType: 'HOUSE'|'HOTEL', ownerId, cost: number, newLevel: number }
  board[payload.tileId].buildingLevel = payload.newLevel;
});

socket.on('BUILDING_SOLD', (payload) => {
  // payload: { tileId, buildingType, ownerId, refund: number, newLevel: number }
  board[payload.tileId].buildingLevel = payload.newLevel;
});

socket.on('RENT_CHARGED', (payload) => {
  // payload: { from: string, to: string | 'BANK', tileId, amount: number }
  // ⚠️ 仅展示租金事件，不含任何玩家余额
  showRentChargedAnimation(payload);
});

socket.on('TAX_PAID', (payload) => {
  // payload: { playerId, amount: number }
  showTaxEffect(payload.playerId, payload.amount);
});

socket.on('CASINO_RESULT', (payload) => {
  // payload: { playerId, betAmount, outcome: 'WIN'|'LOSE'|'BREAK_EVEN', cashDelta: number }
  showCasinoResultAnimation(payload);
});

socket.on('SURPRISE_RESULT', (payload) => {
  // payload: { playerId, cashDelta?: number, cardDescription: string }
  showSurpriseCard(payload.playerId, payload.cardDescription, payload.cashDelta);
});

socket.on('SURPRISE_RAMPAGE', (payload) => {
  // payload: { playerId }
  // 玩家额外获得一次掷骰机会（狂奔）
  showRampageEffect(payload.playerId);
});

socket.on('TEMPLE_LIT', (payload) => {
  // payload: { tileId, isLit: true }
  board[payload.tileId].isLit = true;
  // 播放寺庙点亮动画
});
```

### 5.4 拍卖事件

```typescript
socket.on('AUCTION_STARTED', (payload) => {
  // payload: { auction: AuctionPublicView }
  // AuctionPublicView 含: id, tileId, status, currentBid(=0),
  //   currentLeaderId, activePlayerIds, passedPlayerIds,
  //   winnerId, finalPrice, roundDeadlineAt
  auctionStore.setAuction(payload.auction);
  // 显示拍卖 UI，启动 roundDeadlineAt 倒计时
});

socket.on('AUCTION_BID_PLACED', (payload) => {
  // payload: { auctionId, bidderId, bidAmount, currentLeaderId, roundDeadlineAt }
  auctionStore.currentBid = payload.bidAmount;
  auctionStore.currentLeaderId = payload.currentLeaderId;
  auctionStore.roundDeadlineAt = payload.roundDeadlineAt;
  // 重置倒计时
});

socket.on('AUCTION_PLAYER_PASSED', (payload) => {
  // payload: { auctionId, passedPlayerId, remainingActiveCount }
  auctionStore.markPassed(payload.passedPlayerId);
});

socket.on('AUCTION_HAMMER_DOWN', (payload) => {
  // payload: { auctionId, winnerId, finalPrice, tileId }
  board[payload.tileId].ownerId = payload.winnerId;
  players[payload.winnerId].ownedTileIds.push(payload.tileId);
  auctionStore.clearAuction();
  showHammerDownEffect(payload);
});

socket.on('AUCTION_NO_SALE', (payload) => {
  // payload: { auctionId, tileId }
  auctionStore.clearAuction();
  showNoSaleEffect();
});
```

### 5.5 交易事件

```typescript
socket.on('TRADE_PROPOSED', (payload) => {
  // payload: { tradeId, proposerId, responderId,
  //            proposerTileIds, responderTileIds, status, proposedAt }
  // ⚠️ 不含现金金额（完整金额通过 TRADE_DETAIL 私密发给双方）
  tradeStore.addPendingTrade(payload);
  // 若当前玩家是 responderId，显示交易通知
});

socket.on('TRADE_ACCEPTED', (payload) => {
  // payload: { tradeId }
  tradeStore.removeTrade(payload.tradeId);
});

socket.on('TRADE_REJECTED', (payload) => {
  // payload: { tradeId }
  tradeStore.removeTrade(payload.tradeId);
});

socket.on('TRADE_CANCELLED', (payload) => {
  // payload: { tradeId }
  tradeStore.removeTrade(payload.tradeId);
});

socket.on('TRADE_COMPLETED', (payload) => {
  // payload: { tradeId, tileTransfers, cashAmount: number }
  // tileTransfers: Array<{ tileId, newOwnerId }>
  for (const transfer of payload.tileTransfers) {
    board[transfer.tileId].ownerId = transfer.newOwnerId;
  }
  // cashAmount 在成交后公开展示（无余额信息）
  tradeStore.removeTrade(payload.tradeId);
  showTradeCompletedEffect(payload);
});

socket.on('TRADE_VOIDED', (payload) => {
  // payload: { tradeId, reason: TradeVoidReason }
  tradeStore.removeTrade(payload.tradeId);
});
```

### 5.6 道具卡事件

```typescript
socket.on('PROP_CARD_USED', (payload) => {
  // payload: { playerId, cardType, targetPlayerId?, targetTileId? }
  // ⚠️ 只公开使用了哪种类型的卡，不公开牌堆信息
  showPropCardUsedEffect(payload);
});

socket.on('PROP_CARD_DRAWN', (payload) => {
  // payload: { playerId }
  // 只公开"谁抽了卡"，不公开牌型
  showDrawCardEffect(payload.playerId);
});

socket.on('IMMUNITY_USED', (payload) => {
  // payload: { playerId, tileId }
  showImmunityEffect(payload.playerId, payload.tileId);
});

socket.on('PRICE_HIKE_EXPIRED', (payload) => {
  // payload: { playerId }
  if (payload.playerId === self.id) {
    selfStore.priceHikeActive = false;
  }
  showPriceHikeExpiredEffect(payload.playerId);
});

socket.on('FORCED_TRADE_EXECUTED', (payload) => {
  // payload: { from: string, to: string, tileId, price: number }
  board[payload.tileId].ownerId = payload.to;
  showForcedTradeEffect(payload);
});

socket.on('PLUNDER_EXECUTED', (payload) => {
  // payload: { from: string, to: string, amount: number }
  // amount 可为 0（目标现金为负时）
  showPlunderEffect(payload);
});

socket.on('JAIL_AUTO_RELEASED', (payload) => {
  // payload: { playerId }
  players[payload.playerId].inJail = false;
});
```

### 5.7 濒死/破产事件

```typescript
socket.on('PLAYER_DYING', (payload) => {
  // payload: { playerId, rescueWindowMs }
  players[payload.playerId].status = 'DYING';
  // 显示濒死 UI（若是本人：显示自救倒计时、可用操作：卖楼/抵押/交易/宣告破产）
  if (payload.playerId === self.id) {
    startDyingRescueTimer(payload.rescueWindowMs);
  }
});

socket.on('PLAYER_RESCUED', (payload) => {
  // payload: { playerId }
  players[payload.playerId].status = 'ACTIVE';
  if (payload.playerId === self.id) clearDyingRescueTimer();
});

socket.on('DYING_RESCUE_AFK_WARNING', (payload) => {
  // payload: { playerId, remainingSeconds }
  if (payload.playerId === self.id) showAfkWarning(payload.remainingSeconds);
});

socket.on('PLAYER_BANKRUPT', (payload) => {
  // payload: { playerId, bankruptType: 'A'|'B', creditorId?: string }
  players[payload.playerId].status = 'BANKRUPT';
  // TYPE_B：债主 creditorId 收到部分资产（余额通过 CASH_UPDATED 私密告知债主）
  // 地块已通过 PROPERTY_FREED 归还
  showBankruptEffect(payload);
});

socket.on('WHALE_FALL', (payload) => {
  // payload: { playerId, reason: 'DISCONNECT_TIMEOUT'|'AFK_IN_RESCUE' }
  players[payload.playerId].status = 'BANKRUPT';
  showWhaleFallEffect(payload);
});
```

### 5.8 断线/重连/暂停

```typescript
socket.on('PLAYER_DISCONNECTED', (payload) => {
  // payload: { playerId, afkWarningMs }
  players[payload.playerId].status = 'DISCONNECTED';
});

socket.on('PLAYER_RECONNECTED', (payload) => {
  // payload: { playerId }
  players[payload.playerId].status = 'ACTIVE';
});

socket.on('GAME_PAUSED', (payload) => {
  // payload: { disconnectedPlayerId, reconnectWindowSeconds: number }
  store.status = 'PAUSED';
  showPausedOverlay(payload.disconnectedPlayerId, payload.reconnectWindowSeconds);
});

socket.on('GAME_RESUMED', (payload) => {
  // payload: { currentTurnPlayerId, currentTurnPhase }
  store.status = 'IN_PROGRESS';
  store.currentTurnPlayerId = payload.currentTurnPlayerId;
  store.currentPhase = payload.currentTurnPhase;
});
```

---

## 6. 定向私密事件（仅发给当事人）

这些事件**只发给特定玩家**，不广播给房间。

```typescript
// ── 现金变动（任意现金操作后）──────────────────────────────────────
socket.on('CASH_UPDATED', (payload) => {
  // payload: { newBalance: number, delta: number, reason: string }
  // reason 例：'PROPERTY_PURCHASE' | 'RENT_PAID' | 'TRADE_CASH' | 'AUCTION_WIN' | ...
  selfStore.cash = payload.newBalance;
  // 显示 +/- delta 浮动数字动画
  showCashDeltaEffect(payload.delta, payload.reason);
});

// ── 断线重连成功 ──────────────────────────────────────────────────
socket.on('RECONNECT_SUCCESS', (payload) => {
  // payload: { selfView: PlayerSelfView, gameSnapshot: DesensitizedGameState }
  selfStore.hydrate(payload.selfView);
  gameStore.hydrate(payload.gameSnapshot);
  // 恢复完整界面状态
});

// ── 拍卖出价被拒 ──────────────────────────────────────────────────
socket.on('AUCTION_BID_REJECTED', (payload) => {
  // payload: { reason: 'INSUFFICIENT_FUNDS'|'BID_NOT_HIGHER'|'AUCTION_CLOSED', currentBid?: number }
  showBidRejectedToast(payload.reason, payload.currentBid);
});

// ── 操作被拒绝（守卫未通过）─────────────────────────────────────────
socket.on('ACTION_REJECTED', (payload) => {
  // payload: { action: string, reason: string,
  //   code: 'WRONG_PHASE'|'NOT_YOUR_TURN'|'INVALID_INPUT'|'INSUFFICIENT_FUNDS'|'BID_LOCKED'|'RULE_VIOLATION' }
  showActionRejectedToast(payload);
});

// ── 竞拍锁定阻止操作 ─────────────────────────────────────────────
socket.on('OPERATION_BLOCKED', (payload) => {
  // payload: { reason: 'BID_LOCKED', lockedAmount: number }
  showBidLockedToast(payload.lockedAmount);
});

// ── 交易完整详情（含现金，仅发给交易双方）────────────────────────────
socket.on('TRADE_DETAIL', (payload) => {
  // payload: { tradeId, proposerOffer: TradeOffer, responderOffer: TradeOffer }
  // TradeOffer: { cash, tileIds, propCardIds }
  tradeStore.setTradeDetail(payload.tradeId, payload);
  // 在交易确认 UI 中展示完整报价
});

// ── 验资结果（仅发给使用 AUDIT 卡的玩家）──────────────────────────
socket.on('AUDIT_RESULT', (payload) => {
  // payload: { playerCashMap: Record<PlayerId, number> }
  // ⚠️ 永远不广播，仅定向
  showAuditResult(payload.playerCashMap);
});
```

---

## 7. UI 驱动逻辑：`constructibleTileIds` 高亮

`constructibleTileIds` 是服务器计算后**定向发送**给本玩家的地块 ID 数组。满足以下所有条件的地块才在其中：
1. 玩家拥有该地块（`ownerId === self.id`）
2. 玩家垄断了该色组（颜色组内所有地块均为本人所有）
3. 地块未被抵押（`isMortgaged === false`）
4. 建造后不会破坏"均匀建造"规则（同色组内任意两块 `buildingLevel` 差 ≤ 1）
5. 建筑等级未达上限（`buildingLevel < 5`；5 = 酒店）

### 数据来源

`constructibleTileIds` 通过以下方式到达前端：
- 初始连接/重连：`RECONNECT_SUCCESS.selfView.constructibleTileIds`
- 每次影响地产的操作后：服务器会定向推送更新的 `CASH_UPDATED` + 新的 `selfView`（可通过重连快照或专用 push 刷新）

> **当前实现**：服务器在每次 `PROPERTY_PURCHASED`、`TRADE_COMPLETED`、`PROPERTY_FREED`、`BUILDING_BUILT`、`BUILDING_SOLD`、`PROPERTY_MORTGAGED`、`PROPERTY_UNMORTGAGED` 后会隐式触发重算，前端应在这些事件的处理函数中**请求或等待**服务器推送最新 `selfView`，而非本地推算。

### Pinia Getter 示例

```typescript
// useSelfStore.ts
const selfStore = defineStore('self', {
  state: () => ({
    constructibleTileIds: [] as number[],
    // ...
  }),
  getters: {
    constructibleSet: (state) => new Set(state.constructibleTileIds),
  },
});
```

### 地图组件高亮逻辑

```typescript
// BoardTile.vue
const props = defineProps<{ tileId: number }>();
const selfStore = useSelfStore();
const gameStore = useGameStore();

// 显示建造按钮/高亮：
//   1. 当前阶段允许建造（WAITING_FOR_ACTION 或 END_TURN_PENDING）
//   2. 轮到当前玩家
//   3. 该地块在 constructibleTileIds 中
const canBuild = computed(() =>
  selfStore.constructibleSet.has(props.tileId) &&
  [TurnPhase.WAITING_FOR_ACTION, TurnPhase.END_TURN_PENDING].includes(gameStore.currentPhase) &&
  gameStore.currentTurnPlayerId === selfStore.id
);

// 高亮样式
const tileClass = computed(() => ({
  'tile--constructible': canBuild.value,
  'tile--owned-self': selfStore.ownedTileIds.includes(props.tileId),
  'tile--mortgaged': gameStore.board[props.tileId]?.isMortgaged,
}));
```

### 建造操作流程

```typescript
function onBuildHouseClick(tileId: number) {
  if (!canBuild.value) return;
  socket.emit('action:BUILD_HOUSE', { tileId });
  // 服务器响应：
  //   成功 → BUILDING_BUILT（广播）+ CASH_UPDATED（定向）
  //   失败 → ACTION_REJECTED（定向）
}
```

### 建造等级视觉映射

| `buildingLevel` | 显示内容 |
|:-----------:|---------|
| 0 | 空地 |
| 1 | 🏠 1 栋房子 |
| 2 | 🏠🏠 2 栋房子 |
| 3 | 🏠🏠🏠 3 栋房子 |
| 4 | 🏠🏠🏠🏠 4 栋房子 |
| 5 | 🏨 酒店 |

---

## 8. 错误处理与操作拒绝

所有失败操作都会触发定向事件 `ACTION_REJECTED`：

```typescript
socket.on('ACTION_REJECTED', ({ action, reason, code }) => {
  switch (code) {
    case 'WRONG_PHASE':
      toast.warning(`操作 ${action} 不在允许的游戏阶段`);
      break;
    case 'NOT_YOUR_TURN':
      toast.warning('还没轮到你');
      break;
    case 'INSUFFICIENT_FUNDS':
      toast.error(`资金不足：${reason}`);
      break;
    case 'BID_LOCKED':
      toast.error(`竞拍锁定中，无法执行 ${action}`);
      break;
    case 'INVALID_INPUT':
      toast.error(`无效输入：${reason}`);
      break;
    case 'RULE_VIOLATION':
    default:
      toast.error(reason);
  }
});
```

---

## 9. 完整连接生命周期

```
1. GET /api/v1/rooms               → 展示大厅列表
2. POST /api/v1/rooms              → 创建房间，获得 sessionToken
   OR
   POST /api/v1/rooms/:id/join     → 加入房间，获得 sessionToken

3. localStorage.setItem('sessionToken', token)
   localStorage.setItem('roomId', roomId)

4. socket.connect()（携带 auth.sessionToken + auth.roomId）
   → 服务器将 socket 加入 room(roomId) 和 player:<playerId> 私有频道

5. 房主 emit('action:START_GAME') → MAP_GENERATED → TURN_STARTED

6. 主循环：
   TURN_STARTED
   → emit('action:ROLL_DICE')
   → DICE_ROLLED → PLAYER_MOVED → TILE_EVENT
   → 落地决策（购买/拍卖/跳过/特殊格）
   → END_TURN_PENDING
   → emit('action:END_TURN')
   → TURN_ENDED → (下一玩家) TURN_STARTED

7. 断线：
   socket.on('disconnect', () => {
     // 等待 5 秒后尝试重连
     setTimeout(() => {
       socket.auth = {
         sessionToken: localStorage.getItem('sessionToken'),
         roomId: localStorage.getItem('roomId'),
       };
       socket.connect();
     }, 5000);
   });
   socket.on('RECONNECT_SUCCESS', (payload) => {
     // 用 selfView + gameSnapshot 完整恢复状态
     hydrateAllStores(payload);
   });

8. 游戏结束：GAME_OVER → 展示排名，清除 localStorage
```

---

*此文档由服务器源码（`SocketEventRouter.ts`、`*.types.ts`）自动归纳生成，如后端接口变更请同步更新。*
