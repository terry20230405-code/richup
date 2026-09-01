import { pinia } from '@/stores/pinia';
import { useGameStore, type DirectorEffect } from '@/stores/useGameStore';
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
  DyingRescueDetailPayload,
  ForcedTradeExecutedPayload,
  GameOverPayload,
  GamePausedPayload,
  GameResumedPayload,
  ImmunityUsedPayload,
  JailAutoReleasedPayload,
  JailReleasedPayload,
  LobbyStateUpdatedPayload,
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
  PropCardsUpdatedPayload,
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
  TurnReadyPayload,
  TurnStartedPayload,
  WhaleFallPayload,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/types/socket';
import type { Socket } from 'socket.io-client';

import { useEventLogStore } from '@/stores/useEventLogStore';
import { useFloatingTextStore } from '@/stores/useFloatingTextStore';

import { clearStoredSocketSession } from './storage';

const PROP_CARD_LABELS: Record<string, string> = {
  [PropCardType.FORCED_TRADE]: 'Forced Trade',
  [PropCardType.REMOTE_DICE]: 'Remote Dice',
  [PropCardType.PLUNDER]: 'Plunder',
  [PropCardType.IMMUNITY]: 'Immunity',
  [PropCardType.AUDIT]: 'Audit',
  [PropCardType.PRICE_HIKE]: 'Price Hike',
};

let listenersBound = false;

const isInvalidReconnectRejection = (payload: ActionRejectedPayload): boolean =>
  payload.action === 'RECONNECT'
  && payload.code === 'RULE_VIOLATION'
  && (payload.reason === 'Room not found' || payload.reason === 'Player not found');

export const registerSocketListeners = (
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
): void => {
  if (listenersBound) {
    return;
  }

  listenersBound = true;

  const gameStore = useGameStore(pinia);
  const selfStore = useSelfStore(pinia);
  const playersStore = usePlayersStore(pinia);
  const eventLogStore = useEventLogStore(pinia);
  const floatingTextStore = useFloatingTextStore(pinia);

  const queueOrApplyDirectorEffects = (effects: DirectorEffect[]): void => {
    if (!gameStore.isDirectorBlocking) {
      for (const effect of effects) {
        if (effect.type === 'DICE_REVEAL') {
          gameStore.setCurrentPhase(effect.payload.phase);
          gameStore.setAvailableActions(effect.payload.availableActions);
          eventLogStore.push(effect.payload.logType, effect.payload.logMessage);
          continue;
        }
        if (effect.type === 'PLAYER_MOVED') {
          playersStore.updateMovement(effect.payload.playerId, effect.payload.toPosition, effect.payload.fromPosition);
          if (effect.payload.playerId === selfStore.id) {
            selfStore.setMovement(effect.payload.toPosition, effect.payload.fromPosition);
          }
          continue;
        }
        if (effect.type === 'TURN_READY') {
          gameStore.setCurrentTurnPlayerId(effect.payload.playerId);
          gameStore.setCurrentPhase(effect.payload.phase);
          gameStore.setAvailableActions(effect.payload.availableActions);
          continue;
        }
        if (effect.type === 'RENT_CHARGED') {
          eventLogStore.push(effect.payload.logType, effect.payload.logMessage);
          if (effect.payload.phase) {
            gameStore.setCurrentPhase(effect.payload.phase);
            gameStore.setAvailableActions(effect.payload.availableActions);
          }
          continue;
        }
        gameStore.setCurrentTurnPlayerId(effect.payload.playerId);
        gameStore.setCurrentPhase(effect.payload.phase);
        gameStore.setAvailableActions(effect.payload.availableActions);
        gameStore.setPendingTaxAmount(effect.payload.taxAmount);
        eventLogStore.push(effect.payload.logType, effect.payload.logMessage);
      }
      return;
    }

    for (const effect of effects) {
      gameStore.queueDirectorEffect(effect);
    }
  };

  const flushDirectorEffects = (): void => {
    const effects = [...gameStore.director.pendingEffects];
    gameStore.flushDirectorEffects();
    queueOrApplyDirectorEffects(effects);
  };

  socket.on('MAP_GENERATED', (payload: MapGeneratedPayload) => {
    gameStore.setMap(payload.board, payload.playerOrder);
  });

  socket.on('TURN_STARTED', (payload: TurnStartedPayload) => {
    gameStore.resetDirector();
    gameStore.setStatus('IN_PROGRESS');
    gameStore.startTurn(payload.playerId, payload.turnNumber, payload.phase);
  });

  socket.on('TURN_ENDED', (payload: TurnEndedPayload) => {
    gameStore.setAvailableActions([]);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} ended their turn`);
  });

  socket.on('DICE_ROLLED', (payload: DiceRolledPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const doubleTag = payload.isDouble ? ' Double!' : '';

    gameStore.beginDirectedDiceSequence([payload.die1, payload.die2]);
    gameStore.queueDirectorEffect({
      type: 'DICE_REVEAL',
      payload: {
        phase: 'MOVING',
        availableActions: [],
        logType: 'info',
        logMessage: `${name} rolled ${payload.die1}+${payload.die2}=${payload.totalSteps}${doubleTag}`,
      },
    });

    const revealDelay = Math.max((gameStore.director.windowEndsAt ?? Date.now()) - Date.now(), 0);
    window.setTimeout(() => {
      flushDirectorEffects();
    }, revealDelay);
  });

  socket.on('DICE_OVERRIDE', (payload: DiceOverridePayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} used Remote Dice and selected ${payload.steps} steps`);
  });

  socket.on('PLAYER_MOVED', (payload: PlayerMovedPayload) => {
    queueOrApplyDirectorEffects([
      {
        type: 'PLAYER_MOVED',
        payload: {
          playerId: payload.playerId,
          toPosition: payload.toPosition,
          fromPosition: payload.fromPosition,
        },
      },
    ]);
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
    eventLogStore.push('info', `Game over. Winner: ${winnerIds.join(', ')}`);
  });

  socket.on('START_PASSED', (payload: StartPassedPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('positive', `${name} passed START and received $${payload.bonusAmount}`);
  });

  socket.on('START_LANDED', (payload: StartLandedPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const total = payload.passBonusAmount + payload.landBonusAmount;
    eventLogStore.push('positive', `${name} landed on START and received $${total}`);
  });

  socket.on('TILE_EVENT', (payload: TileEventPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;

    queueOrApplyDirectorEffects([
      {
        type: 'TILE_EVENT',
        payload: {
          playerId: payload.playerId,
          tileId: payload.tileId,
          phase: payload.phase,
          availableActions: payload.availableActions,
          taxAmount: payload.taxAmount ?? null,
          logType: 'info',
          logMessage: `${name} landed on [${tileName}]`,
        },
      },
    ]);
  });

  socket.on('TURN_READY', (payload: TurnReadyPayload) => {
    queueOrApplyDirectorEffects([
      {
        type: 'TURN_READY',
        payload: {
          playerId: payload.playerId,
          phase: payload.phase,
          availableActions: payload.availableActions,
        },
      },
    ]);
  });

  socket.on('PROPERTY_PURCHASED', (payload: PropertyPurchasedPayload) => {
    gameStore.setTileOwner(payload.tileId, payload.buyerId);
    gameStore.setAvailableActions([]);

    if (payload.buyerId === selfStore.id && gameStore.boardById[payload.tileId]?.type === 'PROPERTY') {
      selfStore.addConstructibleTile(payload.tileId);
    }

    const buyer = playersStore.players[payload.buyerId];
    const buyerName = buyer?.nickname ?? payload.buyerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('info', `${buyerName} purchased [${tileName}] for $${payload.price}`);
  });

  socket.on('PROPERTY_MORTGAGED', (payload: PropertyMortgagedPayload) => {
    gameStore.setTileMortgage(payload.tileId, true);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('info', `${name} mortgaged [${tileName}] (+$${payload.mortgageValue})`);
  });

  socket.on('PROPERTY_UNMORTGAGED', (payload: PropertyUnmortgagedPayload) => {
    gameStore.setTileMortgage(payload.tileId, false);
    if (payload.playerId === selfStore.id && gameStore.boardById[payload.tileId]?.type === 'PROPERTY') {
      selfStore.addConstructibleTile(payload.tileId);
    }
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('info', `${name} unmortgaged [${tileName}] (-$${payload.redemptionCost})`);
  });

  socket.on('PROPERTY_FREED', (payload: PropertyFreedPayload) => {
    gameStore.setTileOwner(payload.tileId, null);
    gameStore.setTileBuildingLevel(payload.tileId, 0);
    gameStore.setTileMortgage(payload.tileId, false);

    if (payload.previousOwnerId === selfStore.id) {
      selfStore.removeConstructibleTile(payload.tileId);
    }

    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('warn', `[${tileName}] has been released`);
  });

  socket.on('BUILDING_BUILT', (payload: BuildingBuiltPayload) => {
    gameStore.setTileBuildingLevel(payload.tileId, payload.newBuildingLevel);
    const tile = gameStore.boardById[payload.tileId];
    const name = playersStore.players[payload.ownerId]?.nickname ?? payload.ownerId;
    eventLogStore.push('info', `${name} upgraded 【${tile?.name ?? `Tile ${payload.tileId}`}】 to level ${payload.newBuildingLevel}`);
  });

  socket.on('BUILDING_SOLD', (payload: BuildingSoldPayload) => {
    gameStore.setTileBuildingLevel(payload.tileId, payload.newBuildingLevel);
    const tile = gameStore.boardById[payload.tileId];
    const name = playersStore.players[payload.ownerId]?.nickname ?? payload.ownerId;
    eventLogStore.push('info', `${name} downgraded 【${tile?.name ?? `Tile ${payload.tileId}`}】 to level ${payload.newBuildingLevel}`);
  });

  socket.on('RENT_CHARGED', (payload: RentChargedPayload) => {
    const fromPlayer = playersStore.players[payload.from];
    const fromName = fromPlayer?.nickname ?? payload.from;
    const toPlayer = playersStore.players[payload.to];
    const toName = toPlayer?.nickname ?? payload.to;
    const logMessage = `${fromName} paid ${toName} $${payload.amount} in rent`;
    // Payer sees red, recipient sees gold, bystanders neutral.
    const isPayer = payload.from === selfStore.id;
    const logType: 'warn' | 'positive' | 'info' = isPayer
      ? 'warn'
      : payload.to === selfStore.id
        ? 'positive'
        : 'info';
    const shouldEndTurn = isPayer && payload.phase === 'END_TURN_PENDING';

    queueOrApplyDirectorEffects([
      {
        type: 'RENT_CHARGED',
        payload: {
          phase: shouldEndTurn ? 'END_TURN_PENDING' : null,
          availableActions: payload.availableActions ?? ['END_TURN'],
          logType,
          logMessage,
        },
      },
    ]);
  });

  socket.on('TAX_PAID', (payload: TaxPaidPayload) => {
    gameStore.setPendingTaxAmount(null);
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('warn', `${name} paid $${payload.amount} in tax`);
  });

  socket.on('CASINO_RESULT', (payload: CasinoResultPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const outcomeLabels: Record<CasinoResultPayload['outcome'], string> = {
      WIN: 'won',
      LOSE: 'lost',
      BREAK_EVEN: 'broke even',
    };
    const logType = payload.outcome === 'WIN' ? 'positive' : payload.outcome === 'LOSE' ? 'warn' : 'info';
    const delta = payload.cashDelta === 0
      ? 'cash unchanged'
      : `${payload.cashDelta > 0 ? '+' : '-'}$${Math.abs(payload.cashDelta)}`;
    eventLogStore.push(logType, `${name} ${outcomeLabels[payload.outcome]} at the casino, ${delta}`);
    if (payload.playerId === selfStore.id && payload.phase === 'END_TURN_PENDING') {
      gameStore.setCurrentPhase(payload.phase);
      gameStore.setAvailableActions(payload.availableActions);
    }
  });

  socket.on('SURPRISE_RESULT', (payload: SurpriseResultPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    let msg = `${name}'s surprise: ${payload.cardDescription}`;
    if (payload.cashDelta !== undefined) {
      msg += ` (${payload.cashDelta >= 0 ? '+' : ''}${payload.cashDelta})`;
    }
    eventLogStore.push('info', msg);
  });

  socket.on('SURPRISE_RAMPAGE', (payload: SurpriseRampagePayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} triggered Rampage and may roll again`);
  });

  socket.on('TEMPLE_LIT', (payload: TempleLitPayload) => {
    gameStore.setTileLit(payload.tileId, payload.isLit);
  });

  socket.on('AUCTION_STARTED', (payload: AuctionStartedPayload) => {
    gameStore.setActiveAuction(payload.auction);
    gameStore.setAvailableActions([]);
    gameStore.setCurrentPhase('AUCTION_IN_PROGRESS');

    const tile = gameStore.boardById[payload.auction.tileId];
    const tileName = tile?.name ?? `Tile ${payload.auction.tileId}`;
    eventLogStore.push('info', `[${tileName}] is up for auction at $${payload.auction.currentBid}`);
  });

  socket.on('AUCTION_BID_PLACED', (payload: AuctionBidPlacedPayload) => {
    gameStore.patchAuction({
      currentBid: payload.bidAmount,
      currentLeaderId: payload.currentLeaderId,
      roundDeadlineAt: payload.roundDeadlineAt,
    });

    const bidder = playersStore.players[payload.bidderId];
    const bidderName = bidder?.nickname ?? payload.bidderId;
    eventLogStore.push('info', `${bidderName} bid $${payload.bidAmount}`);
  });

  socket.on('AUCTION_PLAYER_PASSED', (payload: AuctionPlayerPassedPayload) => {
    if (gameStore.activeAuction?.id === payload.auctionId) {
      gameStore.patchAuction({
        activePlayerIds: payload.activePlayerIds,
        passedPlayerIds: payload.passedPlayerIds,
        currentLeaderId: payload.currentLeaderId,
        currentBid: payload.currentBid,
      });
    }

    const player = playersStore.players[payload.passedPlayerId];
    const name = player?.nickname ?? payload.passedPlayerId;
    eventLogStore.push('info', `${name} passed (${payload.remainingActiveCount} bidders remaining)`);
  });

  socket.on('AUCTION_HAMMER_DOWN', (payload: AuctionHammerDownPayload) => {
    gameStore.setActiveAuction(null);
    gameStore.setAvailableActions([]);
    gameStore.setTileOwner(payload.tileId, payload.winnerId);

    if (payload.winnerId === selfStore.id && gameStore.boardById[payload.tileId]?.type === 'PROPERTY') {
      selfStore.addConstructibleTile(payload.tileId);
    }

    const winner = playersStore.players[payload.winnerId];
    const winnerName = winner?.nickname ?? payload.winnerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('info', `${winnerName} won [${tileName}] for $${payload.finalPrice}`);
  });

  socket.on('AUCTION_NO_SALE', (payload: AuctionNoSalePayload) => {
    gameStore.setActiveAuction(null);
    gameStore.setAvailableActions([]);

    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('info', `[${tileName}] received no bids`);
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
      ? `${proposerName} sent you a trade offer`
      : `${proposerName} sent ${responderName} a trade offer`;
    eventLogStore.push('info', msg);
  });

  socket.on('TRADE_ACCEPTED', (payload: TradeAcceptedPayload) => {
    gameStore.updateTradeStatus(payload.tradeId, 'ACCEPTED');
    eventLogStore.push('info', 'Trade accepted and awaiting execution...');
  });

  socket.on('TRADE_REJECTED', (payload: TradeRejectedPayload) => {
    gameStore.removeTrade(payload.tradeId);
    eventLogStore.push('warn', 'Trade rejected');
  });

  socket.on('TRADE_CANCELLED', (payload: TradeCancelledPayload) => {
    gameStore.removeTrade(payload.tradeId);
    eventLogStore.push('info', 'Trade cancelled');
  });

  socket.on('TRADE_COMPLETED', (payload: TradeCompletedPayload) => {
    for (const transfer of payload.tileTransfers) {
      gameStore.setTileOwner(transfer.tileId, transfer.newOwnerId);

      if (transfer.newOwnerId === selfStore.id && gameStore.boardById[transfer.tileId]?.type === 'PROPERTY') {
        selfStore.addConstructibleTile(transfer.tileId);
      } else if (selfStore.constructibleSet.has(transfer.tileId)) {
        selfStore.removeConstructibleTile(transfer.tileId);
      }
    }

    gameStore.removeTrade(payload.tradeId);

    const count = payload.tileTransfers.length;
    const cashNote = payload.cashAmount > 0 ? `, including $${payload.cashAmount} cash` : '';
    eventLogStore.push('info', `Trade completed: ${count} properties transferred${cashNote}`);
  });

  socket.on('TRADE_VOIDED', (payload: TradeVoidedPayload) => {
    gameStore.removeTrade(payload.tradeId);
    const reasonLabels: Record<string, string> = {
      PLAYER_ROLLED: 'player rolled the dice',
      PLAYER_JAILED: 'player went to jail',
      PLAYER_DYING: 'player entered rescue',
      PLAYER_BANKRUPT: 'player went bankrupt',
      PLAYER_DISCONNECTED: 'player disconnected',
      GAME_ENDED: 'game ended',
    };
    const reason = reasonLabels[payload.reason] ?? payload.reason;
    eventLogStore.push('warn', `Trade voided (${reason})`);
  });

  // ── Prop card events ──────────────────────────────────────────────────

  socket.on('PROP_CARDS_UPDATED', (payload: PropCardsUpdatedPayload) => {
    selfStore.setPropCards(payload.propCards);
  });

  socket.on('PROP_CARD_USED', (payload: PropCardUsedPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const cardLabel = PROP_CARD_LABELS[payload.cardType] ?? payload.cardType;
    let msg = `${name} used [${cardLabel}]`;
    if (payload.targetPlayerId) {
      const target = playersStore.players[payload.targetPlayerId];
      msg += ` → ${target?.nickname ?? payload.targetPlayerId}`;
    }
    if (payload.targetTileId != null) {
      const tile = gameStore.boardById[payload.targetTileId];
      msg += ` on ${tile?.name ?? `Tile ${payload.targetTileId}`}`;
    }
    eventLogStore.push('info', msg);
  });

  socket.on('PROP_CARD_DRAWN', (payload: PropCardDrawnPayload) => {
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} drew a prop card`);
  });

  socket.on('IMMUNITY_USED', (payload: ImmunityUsedPayload) => {
    if (payload.playerId === selfStore.id) {
      selfStore.consumeImmunity();
    }
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const tile = gameStore.boardById[payload.tileId];
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('info', `${name} used immunity against rent on [${tileName}]`);
  });

  socket.on('PRICE_HIKE_EXPIRED', (payload: PriceHikeExpiredPayload) => {
    if (payload.playerId === selfStore.id) {
      selfStore.clearPriceHike();
    }
    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name}'s Price Hike effect expired`);
  });

  socket.on('FORCED_TRADE_EXECUTED', (payload: ForcedTradeExecutedPayload) => {
    gameStore.setTileOwner(payload.tileId, payload.fromPlayerId);

    if (payload.fromPlayerId === selfStore.id && gameStore.boardById[payload.tileId]?.type === 'PROPERTY') {
      selfStore.addConstructibleTile(payload.tileId);
    } else if (selfStore.constructibleSet.has(payload.tileId)) {
      selfStore.removeConstructibleTile(payload.tileId);
    }

    const initiator = playersStore.players[payload.fromPlayerId];
    const target = playersStore.players[payload.toPlayerId];
    const tile = gameStore.boardById[payload.tileId];
    const iName = initiator?.nickname ?? payload.fromPlayerId;
    const tName = target?.nickname ?? payload.toPlayerId;
    const tileName = tile?.name ?? `Tile ${payload.tileId}`;
    eventLogStore.push('warn', `${iName} forcibly purchased ${tName}'s [${tileName}] for $${payload.price}`);
  });

  socket.on('PLUNDER_EXECUTED', (payload: PlunderExecutedPayload) => {
    const plunderer = playersStore.players[payload.fromPlayerId];
    const target = playersStore.players[payload.toPlayerId];
    const pName = plunderer?.nickname ?? payload.fromPlayerId;
    const tName = target?.nickname ?? payload.toPlayerId;
    const amountStr = payload.amount > 0 ? `$${payload.amount}` : '$0 (target had insufficient cash)';
    eventLogStore.push('warn', `${pName} plundered ${amountStr} from ${tName}`);
  });

  socket.on('JAIL_AUTO_RELEASED', (payload: JailAutoReleasedPayload) => {
    playersStore.updateJailState(payload.playerId, false, 0);

    if (payload.playerId === selfStore.id) {
      selfStore.setJailState(false, 0);
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} was automatically released from jail`);
  });

  socket.on('JAIL_RELEASED', (payload: JailReleasedPayload) => {
    playersStore.updateJailState(payload.playerId, false, 0);

    if (payload.playerId === selfStore.id) {
      selfStore.setJailState(false, 0);
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} jail released after bail`);
  });

  socket.on('PLAYER_DYING', (payload: PlayerDyingPayload) => {
    playersStore.updateStatus(payload.playerId, 'DYING');
    gameStore.setCurrentPhase(payload.phase);
    gameStore.setAvailableActions([]);
    gameStore.setDyingPlayer(payload.playerId, payload.rescueDeadlineAt);

    if (payload.playerId === selfStore.id) {
      selfStore.setStatus('DYING');
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const seconds = Math.ceil(payload.rescueWindowMs / 1000);
    eventLogStore.push('error', `${name} needs rescue! Recover or declare bankruptcy within ${seconds} seconds`);
  });

  socket.on('DYING_RESCUE_DETAIL', (payload: DyingRescueDetailPayload) => {
    gameStore.setSelfRescueDetail(payload);
  });

  socket.on('PLAYER_RESCUED', (payload: PlayerRescuedPayload) => {
    playersStore.updateStatus(payload.playerId, 'ACTIVE');
    gameStore.clearDyingPlayer();

    if (payload.playerId === selfStore.id) {
      selfStore.setStatus('ACTIVE');
    }

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    eventLogStore.push('info', `${name} recovered successfully!`);
  });

  socket.on('DYING_RESCUE_AFK_WARNING', (payload: DyingRescueAfkWarningPayload) => {
    if (payload.playerId === selfStore.id) {
      eventLogStore.push('error', `⚠️ Rescue timeout warning! ${payload.remainingSeconds} seconds remaining`);
    } else {
      const player = playersStore.players[payload.playerId];
      const name = player?.nickname ?? payload.playerId;
      eventLogStore.push('warn', `${name} has ${payload.remainingSeconds} seconds remaining to recover`);
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
      ? `${name} went bankrupt; assets transferred to ${creditor}`
      : `${name} declared bankruptcy; assets returned to the bank`;
    eventLogStore.push('error', msg);
  });

  socket.on('WHALE_FALL', (payload: WhaleFallPayload) => {
    playersStore.updateStatus(payload.playerId, 'BANKRUPT');
    gameStore.clearDyingPlayer();

    const player = playersStore.players[payload.playerId];
    const name = player?.nickname ?? payload.playerId;
    const reasonLabels: Record<string, string> = {
      DISCONNECT_TIMEOUT: 'disconnect timeout',
      AFK_IN_RESCUE: 'inactivity during rescue',
    };
    const reason = reasonLabels[payload.reason] ?? payload.reason;
    eventLogStore.push('warn', `${name} was forced into bankruptcy due to ${reason}`);
  });

  socket.on('PLAYER_DISCONNECTED', (payload: PlayerDisconnectedPayload) => {
    playersStore.updateStatus(payload.playerId, payload.status);
    playersStore.updateConnection(payload.playerId, false);
  });

  socket.on('PLAYER_RECONNECTED', (payload: PlayerReconnectedPayload) => {
    playersStore.updateStatus(payload.playerId, payload.status);
    playersStore.updateConnection(payload.playerId, true);
  });

  socket.on('LOBBY_STATE_UPDATED', (payload: LobbyStateUpdatedPayload) => {
    gameStore.setHostId(payload.hostId);
    playersStore.hydrate(payload.players);
  });

  socket.on('GAME_PAUSED', (payload: GamePausedPayload) => {
    gameStore.setStatus('PAUSED');
    gameStore.setPausedInfo(payload.disconnectedPlayerId, payload.reconnectDeadlineAt);

    const player = playersStore.players[payload.disconnectedPlayerId];
    const name = player?.nickname ?? payload.disconnectedPlayerId;
    eventLogStore.push('warn', `Game paused: ${name} disconnected. Waiting ${payload.reconnectWindowSeconds} seconds for reconnection`);
  });

  socket.on('GAME_RESUMED', (payload: GameResumedPayload) => {
    gameStore.setStatus('IN_PROGRESS');
    gameStore.setCurrentTurnPlayerId(payload.currentTurnPlayerId);
    gameStore.setCurrentPhase(payload.currentTurnPhase);
    gameStore.clearPausedInfo();
    eventLogStore.push('info', 'Game resumed');
  });

  socket.on('CASH_UPDATED', (payload: CashUpdatedPayload) => {
    selfStore.setCash(payload.newBalance);
    if (payload.delta !== 0) {
      floatingTextStore.showGlobal(`${payload.delta > 0 ? '+' : '-'}$${Math.abs(payload.delta)}`);
    }
  });

  socket.on('RECONNECT_SUCCESS', (payload: ReconnectSuccessPayload) => {
    selfStore.hydrate(payload.selfView);
    gameStore.hydrate(payload.gameSnapshot);
    gameStore.setTradeDetails(payload.tradeDetails);
    gameStore.setSelfRescueDetail(payload.rescueDetail);
    playersStore.hydrate(payload.gameSnapshot.players);
  });

  socket.on('AUCTION_BID_REJECTED', (payload: AuctionBidRejectedPayload) => {
    const reasonLabels: Record<string, string> = {
      INSUFFICIENT_FUNDS: 'insufficient funds',
      BID_NOT_HIGHER: 'bid does not exceed the current bid',
      AUCTION_CLOSED: 'auction has ended',
    };
    const reason = reasonLabels[payload.reason] ?? payload.reason;
    const suffix = payload.currentBid != null ? ` (current bid: $${payload.currentBid})` : '';
    eventLogStore.push('error', `Bid rejected: ${reason}${suffix}`);
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
    eventLogStore.push('error', `Action rejected [${payload.code}]: ${payload.reason}`);
  });

  socket.on('OPERATION_BLOCKED', (payload: OperationBlockedPayload) => {
    eventLogStore.push('error', `Action blocked: $${payload.lockedAmount} is locked in the auction`);
  });

  socket.on('TRADE_DETAIL', (payload: TradeDetailPayload) => {
    gameStore.setTradeDetail(payload);
  });

  socket.on('AUDIT_RESULT', (payload: AuditResultPayload) => {
    const entries = Object.entries(payload.playerCashMap)
      .map(([playerId, cash]) => {
        const player = playersStore.players[playerId];
        const name = player?.nickname ?? playerId;
        return `${name}: $${cash}`;
      })
      .join(', ');
    eventLogStore.push('info', `Audit result — ${entries}`);
  });
};
