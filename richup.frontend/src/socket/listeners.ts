import type { Socket } from 'socket.io-client';

import { pinia } from '@/stores/pinia';
import { useGameStore } from '@/stores/useGameStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { useSelfStore } from '@/stores/useSelfStore';
import { PropCardType } from '@/types';
import type {
  ActionRejectedPayload,
  AuditResultPayload,
  AuctionBidPlacedPayload,
  AuctionBidRejectedPayload,
  AuctionHammerDownPayload,
  AuctionNoSalePayload,
  AuctionPlayerPassedPayload,
  AuctionStartedPayload,
  BuildingBuiltPayload,
  BuildingSoldPayload,
  CashUpdatedPayload,
  CasinoResultPayload,
  DiceOverridePayload,
  DiceRolledPayload,
  DyingRescueAfkWarningPayload,
  ForcedTradeExecutedPayload,
  GameOverPayload,
  GamePausedPayload,
  GameResumedPayload,
  ImmunityUsedPayload,
  JailAutoReleasedPayload,
  MapGeneratedPayload,
  OperationBlockedPayload,
  PlayerBankruptPayload,
  PlayerDisconnectedPayload,
  PlayerDyingPayload,
  PlayerMovedPayload,
  PlayerReconnectedPayload,
  PlayerRescuedPayload,
  PlunderExecutedPayload,
  PriceHikeExpiredPayload,
  PropCardDrawnPayload,
  PropCardUsedPayload,
  PropertyFreedPayload,
  PropertyMortgagedPayload,
  PropertyPurchasedPayload,
  PropertyUnmortgagedPayload,
  ReconnectSuccessPayload,
  RentChargedPayload,
  StartLandedPayload,
  StartPassedPayload,
  SurpriseRampagePayload,
  SurpriseResultPayload,
  TaxPaidPayload,
  TempleLitPayload,
  TileEventPayload,
  TradeAcceptedPayload,
  TradeCancelledPayload,
  TradeCompletedPayload,
  TradeDetailPayload,
  TradeProposedPayload,
  TradeRejectedPayload,
  TradeVoidedPayload,
  TurnEndedPayload,
  TurnStartedPayload,
  WhaleFallPayload,
} from '@/types/socket';

import { useEventLogStore } from '@/stores/useEventLogStore';

import { clearStoredSocketSession } from './storage';

const PROP_CARD_LABELS: Record<string, string> = {
  [PropCardType.FORCED_TRADE]: '强制交换',
  [PropCardType.REMOTE_DICE]: '遥控骰子',
  [PropCardType.PLUNDER]: '掠夺',
  [PropCardType.IMMUNITY]: '豁免',
  [PropCardType.AUDIT]: '验资',
  [PropCardType.PRICE_HIKE]: '涨价',
};

let listenersBound = false;

const isInvalidReconnectRejection = (payload: ActionRejectedPayload): boolean =>
  payload.action === 'RECONNECT'
  && payload.code === 'RULE_VIOLATION'
  && (payload.reason === 'Room not found' || payload.reason === 'Player not found');

export const registerSocketListeners = (socket: Socket): void => {
  if (listenersBound) {
    return;
  }

  listenersBound = true;

  const gameStore = useGameStore(pinia);
  const selfStore = useSelfStore(pinia);
  const playersStore = usePlayersStore(pinia);
  const eventLogStore = useEventLogStore(pinia);

  socket.on('MAP_GENERATED', (payload: MapGeneratedPayload) => {
    gameStore.setMap(payload.board, payload.playerOrder);
  });

  socket.on('TURN_STARTED', (payload: TurnStartedPayload) => {
    gameStore.setStatus('IN_PROGRESS');
    gameStore.startTurn(payload.playerId, payload.turnNumber, payload.phase);
  });

  socket.on('TURN_ENDED', (payload: TurnEndedPayload) => {
    gameStore.setAvailableActions([]);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} 结束回合`);
  });

  socket.on('DICE_ROLLED', (payload: DiceRolledPayload) => {
    gameStore.setCurrentPhase('MOVING');
    gameStore.setAvailableActions([]);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const doubleTag = payload.isDouble ? ' 双！' : '';
    eventLogStore.push('info', `${name} 掷出 ${payload.die1}+${payload.die2}=${payload.totalSteps}${doubleTag}`);
  });

  socket.on('DICE_OVERRIDE', (payload: DiceOverridePayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} 遥控骰子：指定 ${payload.steps} 步`);
  });

  socket.on('PLAYER_MOVED', (payload: PlayerMovedPayload) => {
    playersStore.updateMovement(payload.playerId, payload.toPosition, payload.fromPosition);

    if (payload.playerId === selfStore.id) {
      selfStore.setMovement(payload.toPosition, payload.fromPosition);
    }
  });

  socket.on('GAME_OVER', (payload: GameOverPayload) => {
    clearStoredSocketSession();
    gameStore.setStatus('FINISHED');
    gameStore.setCurrentPhase('WAITING_FOR_ACTION');
    const winners = payload.standings
      .filter((entry) => entry.rank === 1)
      .map((entry) => entry.playerId);

    const winnerIds = winners.length > 0 ? winners : payload.winnerIds;
    gameStore.setWinners(winnerIds);
    eventLogStore.push('info', `游戏结束，获胜者：${winnerIds.join(', ')}`);
  });

  socket.on('START_PASSED', (payload: StartPassedPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('positive', `${name} 经过起点，获得 $${payload.bonusAmount}`);
  });

  socket.on('START_LANDED', (payload: StartLandedPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const total = payload.passBonusAmount + payload.landBonusAmount;
    eventLogStore.push('positive', `${name} 停在起点，获得 $${total}`);
  });

  socket.on('TILE_EVENT', (payload: TileEventPayload) => {
    gameStore.setCurrentTurnPlayerId(payload.playerId);
    gameStore.setCurrentPhase(payload.phase);
    gameStore.setAvailableActions(payload.availableActions);
    gameStore.setPendingTaxAmount(payload.taxAmount ?? null);

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('info', `${name} 落在【${tileName}】`);
  });

  socket.on('PROPERTY_PURCHASED', (payload: PropertyPurchasedPayload) => {
    gameStore.setTileOwner(payload.tileId, payload.buyerId);
    gameStore.setAvailableActions([]);

    if (payload.buyerId === selfStore.id) {
      selfStore.addConstructibleTile(payload.tileId);
    }

    const buyer = playersStore.players[payload.buyerId];
    const buyerName = buyer?.nickname ?? payload.buyerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('info', `${buyerName} 购入【${tileName}】（$${payload.price}）`);
  });

  socket.on('PROPERTY_MORTGAGED', (payload: PropertyMortgagedPayload) => {
    gameStore.setTileMortgage(payload.tileId, true);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('info', `${name} 抵押了【${tileName}】（+$${payload.mortgageValue}）`);
  });

  socket.on('PROPERTY_UNMORTGAGED', (payload: PropertyUnmortgagedPayload) => {
    gameStore.setTileMortgage(payload.tileId, false);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('info', `${name} 赎回了【${tileName}】（-$${payload.redemptionCost}）`);
  });

  socket.on('PROPERTY_FREED', (payload: PropertyFreedPayload) => {
    gameStore.setTileOwner(payload.tileId, null);
    gameStore.setTileBuildingLevel(payload.tileId, 0);
    gameStore.setTileMortgage(payload.tileId, false);

    if (payload.previousOwnerId === selfStore.id) {
      selfStore.removeConstructibleTile(payload.tileId);
    }

    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('warn', `【${tileName}】已解除所有权`);
  });

  socket.on('BUILDING_BUILT', (payload: BuildingBuiltPayload) => {
    gameStore.setTileBuildingLevel(payload.tileId, payload.newBuildingLevel);
  });

  socket.on('BUILDING_SOLD', (payload: BuildingSoldPayload) => {
    gameStore.setTileBuildingLevel(payload.tileId, payload.newBuildingLevel);
  });

  socket.on('RENT_CHARGED', (payload: RentChargedPayload) => {
    const fromPlayer = playersStore.players[payload.from];
    const fromName = fromPlayer?.nickname ?? payload.from;
    const toPlayer = playersStore.players[payload.to];
    const toName = toPlayer?.nickname ?? payload.to;
    // Payer sees red, recipient sees gold
    if (payload.from === selfStore.id) {
      eventLogStore.push('warn', `${fromName} → ${toName} 租金 $${payload.amount}`);
    } else if (payload.to === selfStore.id) {
      eventLogStore.push('positive', `${fromName} → ${toName} 租金 $${payload.amount}`);
    } else {
      eventLogStore.push('info', `${fromName} → ${toName} 租金 $${payload.amount}`);
    }
  });

  socket.on('TAX_PAID', (payload: TaxPaidPayload) => {
    gameStore.setPendingTaxAmount(null);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('warn', `${name} 缴税 $${payload.amount}`);
  });

  socket.on('CASINO_RESULT', (payload: CasinoResultPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const delta = payload.cashDelta >= 0 ? `+${payload.cashDelta}` : `${payload.cashDelta}`;
    eventLogStore.push('info', `${name} 赌场 ${payload.outcome}，${delta}`);
  });

  socket.on('SURPRISE_RESULT', (payload: SurpriseResultPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    let msg = `${name} 命运：${payload.cardDescription}`;
    if (payload.cashDelta !== undefined) {
      msg += `（${payload.cashDelta >= 0 ? '+' : ''}${payload.cashDelta}）`;
    }
    eventLogStore.push('info', msg);
  });

  socket.on('SURPRISE_RAMPAGE', (payload: SurpriseRampagePayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} 触发狂奔！额外获得一次掷骰机会`);
  });

  socket.on('TEMPLE_LIT', (payload: TempleLitPayload) => {
    gameStore.setTileLit(payload.tileId, payload.isLit);
  });

  socket.on('AUCTION_STARTED', (payload: AuctionStartedPayload) => {
    gameStore.setActiveAuction(payload.auction);
    gameStore.setCurrentPhase('AUCTION_IN_PROGRESS');

    const tile = gameStore.boardById[payload.auction.tileId];
    const tileName = tile?.name ?? `格${payload.auction.tileId}`;
    eventLogStore.push('info', `【${tileName}】开始拍卖，起拍价 $${payload.auction.currentBid}`);
  });

  socket.on('AUCTION_BID_PLACED', (payload: AuctionBidPlacedPayload) => {
    gameStore.patchAuction({
      currentBid: payload.bidAmount,
      currentLeaderId: payload.currentLeaderId,
      roundDeadlineAt: payload.roundDeadlineAt,
    });

    const bidder = playersStore.players[payload.bidderId];
    const bidderName = bidder?.nickname ?? payload.bidderId;
    eventLogStore.push('info', `${bidderName} 出价 $${payload.bidAmount}`);
  });

  socket.on('AUCTION_PLAYER_PASSED', (payload: AuctionPlayerPassedPayload) => {
    const auction = gameStore.activeAuction;
    if (auction) {
      gameStore.patchAuction({
        passedPlayerIds: [...auction.passedPlayerIds, payload.passedPlayerId],
        activePlayerIds: auction.activePlayerIds.filter((id) => id !== payload.passedPlayerId),
      });
    }

    const player = playersStore.players[payload.passedPlayerId];
    const name = player?.nickname ?? payload.passedPlayerId;
    eventLogStore.push('info', `${name} 放弃竞拍（剩余 ${payload.remainingActiveCount} 人）`);
  });

  socket.on('AUCTION_HAMMER_DOWN', (payload: AuctionHammerDownPayload) => {
    gameStore.setActiveAuction(null);
    gameStore.setAvailableActions([]);
    gameStore.setTileOwner(payload.tileId, payload.winnerId);

    if (payload.winnerId === selfStore.id) {
      selfStore.addConstructibleTile(payload.tileId);
    }

    const winner = playersStore.players[payload.winnerId];
    const winnerName = winner?.nickname ?? payload.winnerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('info', `${winnerName} 以 $${payload.finalPrice} 拍得【${tileName}】`);
  });

  socket.on('AUCTION_NO_SALE', (payload: AuctionNoSalePayload) => {
    gameStore.setActiveAuction(null);
    gameStore.setAvailableActions([]);

    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('info', `【${tileName}】流拍`);
  });

  // ── Trade events ──────────────────────────────────────────────────────

  socket.on('TRADE_PROPOSED', (payload: TradeProposedPayload) => {
    gameStore.addTrade(payload);
    const proposer = playersStore.players[payload.proposerId];
    const responder = playersStore.players[payload.responderId];
    const proposerName = proposer?.nickname ?? payload.proposerId;
    const responderName = responder?.nickname ?? payload.responderId;
    const isSelfResponder = payload.responderId === selfStore.id;
    const msg = isSelfResponder
      ? `${proposerName} 向你发起交易请求`
      : `${proposerName} 向 ${responderName} 发起交易`;
    eventLogStore.push('info', msg);
  });

  socket.on('TRADE_ACCEPTED', (payload: TradeAcceptedPayload) => {
    gameStore.updateTradeStatus(payload.tradeId, 'ACCEPTED');
    eventLogStore.push('info', `交易已接受，等待执行…`);
  });

  socket.on('TRADE_REJECTED', (payload: TradeRejectedPayload) => {
    gameStore.removeTrade(payload.tradeId);
    eventLogStore.push('warn', `交易已被拒绝`);
  });

  socket.on('TRADE_CANCELLED', (payload: TradeCancelledPayload) => {
    gameStore.removeTrade(payload.tradeId);
    eventLogStore.push('info', `交易已取消`);
  });

  socket.on('TRADE_COMPLETED', (payload: TradeCompletedPayload) => {
    for (const transfer of payload.tileTransfers) {
      gameStore.setTileOwner(transfer.tileId, transfer.newOwnerId);

      if (transfer.newOwnerId === selfStore.id) {
        selfStore.addConstructibleTile(transfer.tileId);
      } else if (selfStore.constructibleSet.has(transfer.tileId)) {
        selfStore.removeConstructibleTile(transfer.tileId);
      }
    }

    gameStore.removeTrade(payload.tradeId);

    const count = payload.tileTransfers.length;
    const cashNote = payload.cashAmount > 0 ? `，含现金 $${payload.cashAmount}` : '';
    eventLogStore.push('info', `交易完成，${count} 块地产易主${cashNote}`);
  });

  socket.on('TRADE_VOIDED', (payload: TradeVoidedPayload) => {
    gameStore.removeTrade(payload.tradeId);
    const reasonLabels: Record<string, string> = {
      PLAYER_BANKRUPT: '玩家破产',
      GAME_ENDED: '游戏结束',
      TIMEOUT: '超时',
    };
    const reason = reasonLabels[payload.reason] ?? payload.reason;
    eventLogStore.push('warn', `交易已作废（${reason}）`);
  });

  // ── Prop card events ──────────────────────────────────────────────────

  socket.on('PROP_CARD_USED', (payload: PropCardUsedPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const cardLabel = PROP_CARD_LABELS[payload.cardType] ?? payload.cardType;
    let msg = `${name} 使用【${cardLabel}】`;
    if (payload.targetPlayerId) {
      const target = playersStore.players[payload.targetPlayerId];
      msg += ` → ${target?.nickname ?? payload.targetPlayerId}`;
    }
    if (payload.targetTileId != null) {
      const tile = gameStore.boardById[payload.targetTileId];
      msg += ` 格${tile?.name ?? payload.targetTileId}`;
    }
    eventLogStore.push('info', msg);
  });

  socket.on('PROP_CARD_DRAWN', (payload: PropCardDrawnPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} 获得一张道具卡`);
  });

  socket.on('IMMUNITY_USED', (payload: ImmunityUsedPayload) => {
    if (payload.playerId === selfStore.id) {
      selfStore.consumeImmunity();
    }
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('info', `${name} 豁免了【${tileName}】的租金`);
  });

  socket.on('PRICE_HIKE_EXPIRED', (payload: PriceHikeExpiredPayload) => {
    if (payload.playerId === selfStore.id) {
      selfStore.clearPriceHike();
    }
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} 的涨价效果已结束`);
  });

  socket.on('FORCED_TRADE_EXECUTED', (payload: ForcedTradeExecutedPayload) => {
    gameStore.setTileOwner(payload.tileId, payload.to);

    if (payload.to === selfStore.id) {
      selfStore.addConstructibleTile(payload.tileId);
    } else if (selfStore.constructibleSet.has(payload.tileId)) {
      selfStore.removeConstructibleTile(payload.tileId);
    }

    const initiator = playersStore.players[payload.from];
    const target = playersStore.players[payload.to];
    const tile = gameStore.boardById[payload.tileId];
    const iName = initiator?.nickname ?? payload.from;
    const tName = target?.nickname ?? payload.to;
    const tileName = tile?.name ?? `格${payload.tileId}`;
    eventLogStore.push('warn', `${iName} 强制购得 ${tName} 的【${tileName}】（$${payload.price}）`);
  });

  socket.on('PLUNDER_EXECUTED', (payload: PlunderExecutedPayload) => {
    const plunderer = playersStore.players[payload.from];
    const target = playersStore.players[payload.to];
    const pName = plunderer?.nickname ?? payload.from;
    const tName = target?.nickname ?? payload.to;
    const amountStr = payload.amount > 0 ? `$${payload.amount}` : '（目标现金不足，获得 $0）';
    eventLogStore.push('warn', `${pName} 掠夺了 ${tName} ${amountStr}`);
  });

  socket.on('JAIL_AUTO_RELEASED', (payload: JailAutoReleasedPayload) => {
    playersStore.updateJailState(payload.playerId, false, 0);

    if (payload.playerId === selfStore.id) {
      selfStore.setJailState(false, 0);
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} 自动出狱`);
  });

  socket.on('PLAYER_DYING', (payload: PlayerDyingPayload) => {
    playersStore.updateStatus(payload.playerId, 'DYING');
    gameStore.setDyingPlayer(payload.playerId, payload.rescueWindowMs);

    if (payload.playerId === selfStore.id) {
      selfStore.setStatus('DYING');
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const seconds = Math.ceil(payload.rescueWindowMs / 1000);
    eventLogStore.push('error', `${name} 陷入濒死！${seconds} 秒内自救或宣告破产`);
  });

  socket.on('PLAYER_RESCUED', (payload: PlayerRescuedPayload) => {
    playersStore.updateStatus(payload.playerId, 'ACTIVE');
    gameStore.clearDyingPlayer();

    if (payload.playerId === selfStore.id) {
      selfStore.setStatus('ACTIVE');
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} 成功自救！`);
  });

  socket.on('DYING_RESCUE_AFK_WARNING', (payload: DyingRescueAfkWarningPayload) => {
    if (payload.playerId === selfStore.id) {
      eventLogStore.push('error', `⚠️ 自救超时警告！还剩 ${payload.remainingSeconds} 秒`);
    } else {
      const player = playersStore.players[payload.playerId];
      const name = player?.nickname ?? payload.playerId;
      eventLogStore.push('warn', `${name} 自救超时警告（剩余 ${payload.remainingSeconds} 秒）`);
    }
  });

  socket.on('PLAYER_BANKRUPT', (payload: PlayerBankruptPayload) => {
    playersStore.updateStatus(payload.playerId, 'BANKRUPT');
    gameStore.clearDyingPlayer();

    if (payload.playerId === selfStore.id) {
      selfStore.setStatus('BANKRUPT');
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const creditor = payload.creditorId
      ? (playersStore.players[payload.creditorId]?.nickname ?? payload.creditorId)
      : null;
    const msg = creditor
      ? `${name} 破产，资产转移给 ${creditor}`
      : `${name} 宣告破产，资产归还银行`;
    eventLogStore.push('error', msg);
  });

  socket.on('WHALE_FALL', (payload: WhaleFallPayload) => {
    playersStore.updateStatus(payload.playerId, 'BANKRUPT');
    gameStore.clearDyingPlayer();

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const reasonLabels: Record<string, string> = {
      DISCONNECT_TIMEOUT: '断线超时',
      AFK_IN_RESCUE: '自救期间挂机',
    };
    const reason = reasonLabels[payload.reason] ?? payload.reason;
    eventLogStore.push('warn', `${name} 因${reason}强制破产`);
  });

  socket.on('PLAYER_DISCONNECTED', (payload: PlayerDisconnectedPayload) => {
    playersStore.updateStatus(payload.playerId, 'DISCONNECTED');
    playersStore.updateConnection(payload.playerId, false);
  });

  socket.on('PLAYER_RECONNECTED', (payload: PlayerReconnectedPayload) => {
    playersStore.updateStatus(payload.playerId, 'ACTIVE');
    playersStore.updateConnection(payload.playerId, true);
  });

  socket.on('GAME_PAUSED', (payload: GamePausedPayload) => {
    gameStore.setStatus('PAUSED');
    gameStore.setPausedInfo(payload.disconnectedPlayerId, payload.reconnectWindowSeconds);

    const player = playersStore.players[payload.disconnectedPlayerId];
    const name = player?.nickname ?? payload.disconnectedPlayerId;
    eventLogStore.push('warn', `游戏暂停：${name} 断线，等待重连（${payload.reconnectWindowSeconds} 秒）`);
  });

  socket.on('GAME_RESUMED', (payload: GameResumedPayload) => {
    gameStore.setStatus('IN_PROGRESS');
    gameStore.setCurrentTurnPlayerId(payload.currentTurnPlayerId);
    gameStore.setCurrentPhase(payload.currentTurnPhase);
    gameStore.clearPausedInfo();
    eventLogStore.push('info', '游戏继续');
  });

  socket.on('CASH_UPDATED', (payload: CashUpdatedPayload) => {
    selfStore.setCash(payload.newBalance);
  });

  socket.on('RECONNECT_SUCCESS', (payload: ReconnectSuccessPayload) => {
    selfStore.hydrate(payload.selfView);
    gameStore.hydrate(payload.gameSnapshot);
    playersStore.hydrate(payload.gameSnapshot.players);
  });

  socket.on('AUCTION_BID_REJECTED', (payload: AuctionBidRejectedPayload) => {
    const reasonLabels: Record<string, string> = {
      INSUFFICIENT_FUNDS: '余额不足',
      BID_NOT_HIGHER: '出价未超过当前最高价',
      AUCTION_CLOSED: '拍卖已结束',
    };
    const reason = reasonLabels[payload.reason] ?? payload.reason;
    const suffix = payload.currentBid != null ? `（当前最高 $${payload.currentBid}）` : '';
    eventLogStore.push('error', `出价被拒绝：${reason}${suffix}`);
  });

  socket.on('ACTION_REJECTED', (payload: ActionRejectedPayload) => {
    if (isInvalidReconnectRejection(payload)) {
      clearStoredSocketSession();
      gameStore.reset();
      playersStore.reset();
      selfStore.reset();
      eventLogStore.clear();
      eventLogStore.push('error', 'Saved room session expired. Please create or join a room again.');

      if (socket.connected) {
        socket.disconnect();
      }

      return;
    }
    eventLogStore.push('error', `操作被拒绝 [${payload.code}]: ${payload.reason}`);
  });

  socket.on('OPERATION_BLOCKED', (payload: OperationBlockedPayload) => {
    eventLogStore.push('error', `操作被锁定：竞拍锁定中（锁定金额 $${payload.lockedAmount}）`);
  });

  socket.on('TRADE_DETAIL', (payload: TradeDetailPayload) => {
    gameStore.setActiveTradeDetail(payload);
  });

  socket.on('AUDIT_RESULT', (payload: AuditResultPayload) => {
    const entries = Object.entries(payload.playerCashMap)
      .map(([playerId, cash]) => {
        const player = playersStore.players[playerId];
        const name = player?.nickname ?? playerId;
        return `${name}: $${cash}`;
      })
      .join('，');
    eventLogStore.push('info', `验资结果 — ${entries}`);
  });
};
