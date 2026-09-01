import type { Server } from 'socket.io';
import type { GameSession } from '../src/types/GameSession.types';
import { BankruptcyType, GameStatus, SurpriseCardType, TurnPhase } from '../src/types/GameSession.types';
import type { Player } from '../src/types/Player.types';
import { PlayerStatus } from '../src/types/Player.types';
import type { PropertyTile } from '../src/types/Tile.types';
import { TileType } from '../src/types/Tile.types';
import { PropCardType } from '../src/types/PropCard.types';
import { TradeVoidReason } from '../src/types/Trade.types';
import { DEFAULT_GAME_CONFIG } from '../src/config/GameConfig';
import { generateBoard } from '../src/modules/MapGenerator';
import { performRoll } from '../src/modules/DiceEngine';
import { sendToJail } from '../src/modules/JailManager';
import { buildHotel } from '../src/modules/BuildingManager';
import { startAuction, placeBid, passAuction } from '../src/modules/AuctionManager';
import { declareBankruptcy, enterDyingRescue, triggerWhaleFall } from '../src/modules/BankruptcyResolver';
import { acceptTrade, proposeTrade, voidTradesInvolvingPlayer } from '../src/modules/TradeManager';
import { handleTempleLanding } from '../src/modules/TempleManager';
import { applySurpriseCard } from '../src/modules/SurpriseHandler';
import { computeRent } from '../src/modules/RentCalculator';
import { buildReconnectSnapshot } from '../src/serialization/GameStateSerializer';
import { startGame, syncPropCards } from '../src/state/GameSession';
import { StateMachine } from '../src/state/StateMachine';
import {
  createRoom,
  deleteRoom,
  getSession,
  hasConnectedSocket,
  joinRoom,
  registerSocket,
  removeLobbyPlayer,
  unregisterSocket,
} from '../src/state/RoomManager';
import {
  handleLastSocketDisconnect,
  scheduleLobbyReservation,
} from '../src/modules/ConnectionLifecycle';
import { cancelAllTimers } from '../src/utils/timerUtils';

const io = {
  to: () => ({ emit: jest.fn() }),
} as unknown as Server;

function makePlayer(id: string, cash = 15_000): Player {
  return {
    id,
    nickname: id,
    avatarIndex: 0,
    color: '#000000',
    position: 0,
    previousPosition: 0,
    inJail: false,
    jailTurnsWaited: 0,
    status: PlayerStatus.ACTIVE,
    isConnected: true,
    lastSeenAt: Date.now(),
    cash,
    propCards: [],
    hasImmunity: false,
    priceHikeActive: false,
    priceHikeExpiresOnTurn: null,
    constructibleTileIds: [],
  };
}

function makeSession(): GameSession {
  const p1 = makePlayer('p1');
  const p2 = makePlayer('p2');
  return {
    id: 'room-test',
    status: GameStatus.IN_PROGRESS,
    config: { ...DEFAULT_GAME_CONFIG },
    board: generateBoard(),
    players: new Map([[p1.id, p1], [p2.id, p2]]),
    playerOrder: ['p1', 'p2'],
    currentPlayerIndex: 0,
    currentPhase: TurnPhase.WAITING_FOR_ACTION,
    phaseEnteredAt: Date.now(),
    turnNumber: 1,
    roundNumber: 1,
    lastDiceRoll: null,
    pendingExtraRoll: false,
    remoteDiceOverride: null,
    pendingTileEvent: null,
    activeAuction: null,
    activeTrades: new Map(),
    surpriseDeck: [],
    surpriseDiscardPile: [],
    dyingRescue: null,
    pendingBankruptcy: null,
    hostId: 'p1',
    createdAt: Date.now(),
    startedAt: Date.now(),
    finishedAt: null,
    winnerIds: [],
    pausedAt: null,
    disconnectedCurrentPlayerId: null,
  };
}

describe('core game rules', () => {
  it('creates independent fixed tiles for every board', () => {
    const first = generateBoard();
    const second = generateBoard();
    const firstTemple = first.find((tile) => tile.type === TileType.TEMPLE);
    const secondTemple = second.find((tile) => tile.type === TileType.TEMPLE);

    expect(firstTemple).toBeDefined();
    expect(secondTemple).toBeDefined();
    expect(firstTemple).not.toBe(secondTemple);
    if (firstTemple?.type === TileType.TEMPLE && secondTemple?.type === TileType.TEMPLE) {
      firstTemple.litCount = 2;
      expect(secondTemple.litCount).toBe(0);
    }
  });

  it('uses the approved reconnect and rescue windows', () => {
    expect(DEFAULT_GAME_CONFIG.lobbyReconnectWindowMs).toBe(90_000);
    expect(DEFAULT_GAME_CONFIG.reconnectWindowMs).toBe(180_000);
    expect(DEFAULT_GAME_CONFIG.dyingRescueTotalMs).toBe(480_000);
    expect(DEFAULT_GAME_CONFIG.dyingRescueAfkWarningMs).toBe(360_000);
  });

  it('keeps a player connected until their last socket unregisters', () => {
    const roomId = 'socket-room';
    const playerId = 'socket-player';

    registerSocket('socket-1', playerId, roomId);
    registerSocket('socket-2', playerId, roomId);

    unregisterSocket('socket-1');
    expect(hasConnectedSocket(roomId, playerId)).toBe(true);

    unregisterSocket('socket-2');
    expect(hasConnectedSocket(roomId, playerId)).toBe(false);
  });

  it('removes a socket from its previous player when it reauthenticates', () => {
    registerSocket('switching-socket', 'old-player', 'old-room');
    registerSocket('switching-socket', 'new-player', 'new-room');

    expect(hasConnectedSocket('old-room', 'old-player')).toBe(false);
    expect(hasConnectedSocket('new-room', 'new-player')).toBe(true);

    unregisterSocket('switching-socket');
  });

  it('refuses to start while a reserved lobby player is offline', () => {
    const session = makeSession();
    session.status = GameStatus.LOBBY;
    session.players.get('p2')!.isConnected = false;
    session.players.get('p2')!.status = PlayerStatus.DISCONNECTED;

    expect(() => startGame(session)).toThrow('All lobby players must be connected');
    expect(session.status).toBe(GameStatus.LOBBY);
  });

  it('transfers lobby host ownership to the earliest connected player', () => {
    const created = createRoom('host');
    const second = joinRoom(created.roomId, 'second');
    const third = joinRoom(created.roomId, 'third');
    const session = getSession(created.roomId)!;
    session.players.get(second.playerId)!.isConnected = true;
    session.players.get(second.playerId)!.status = PlayerStatus.ACTIVE;
    session.players.get(third.playerId)!.isConnected = true;
    session.players.get(third.playerId)!.status = PlayerStatus.ACTIVE;

    const result = removeLobbyPlayer(created.roomId, created.playerId);

    expect(result).toEqual({
      removed: true,
      roomDeleted: false,
      newHostId: second.playerId,
    });
    expect(session.hostId).toBe(second.playerId);

    deleteRoom(created.roomId, second.playerId);
  });

  it('deletes a lobby after its last reserved player expires', () => {
    const created = createRoom('solo-host');

    const result = removeLobbyPlayer(created.roomId, created.playerId);

    expect(result.roomDeleted).toBe(true);
    expect(getSession(created.roomId)).toBeUndefined();
  });

  it('removes an unclaimed lobby seat when its reservation expires', () => {
    jest.useFakeTimers();
    const created = createRoom('timed-host');
    const session = getSession(created.roomId)!;
    session.config.lobbyReconnectWindowMs = 90_000;

    scheduleLobbyReservation(session, created.playerId, io);
    jest.advanceTimersByTime(90_000);

    expect(getSession(created.roomId)).toBeUndefined();
    jest.useRealTimers();
  });

  it('keeps the original pause when a second player disconnects and times out', () => {
    jest.useFakeTimers();
    const session = makeSession();
    const p3 = makePlayer('p3');
    session.players.set(p3.id, p3);
    session.playerOrder.push(p3.id);
    session.status = GameStatus.PAUSED;
    session.disconnectedCurrentPlayerId = 'p1';
    session.pausedAt = Date.now();
    session.players.get('p1')!.isConnected = false;
    session.players.get('p1')!.status = PlayerStatus.DISCONNECTED;
    session.config.reconnectWindowMs = 300_000;

    handleLastSocketDisconnect(session, 'p2', io);
    jest.advanceTimersByTime(300_000);

    expect(session.players.get('p2')!.status).toBe(PlayerStatus.BANKRUPT);
    expect(session.status).toBe(GameStatus.PAUSED);
    expect(session.disconnectedCurrentPlayerId).toBe('p1');
    expect(session.playerOrder).toEqual(['p1', 'p3']);

    cancelAllTimers(session.id);
    jest.useRealTimers();
  });

  it('uses one absolute deadline for pause events and reconnect snapshots', () => {
    const session = makeSession();
    const emissions: Array<{ room: string; event: string; payload: unknown }> = [];
    const recordingIo = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => emissions.push({ room, event, payload }),
      }),
    } as unknown as Server;

    handleLastSocketDisconnect(session, 'p1', recordingIo);

    const expectedDeadline = session.pausedAt! + session.config.reconnectWindowMs;
    expect(emissions).toContainEqual({
      room: session.id,
      event: 'GAME_PAUSED',
      payload: {
        disconnectedPlayerId: 'p1',
        reconnectWindowSeconds: 180,
        reconnectDeadlineAt: expectedDeadline,
      },
    });
    expect(buildReconnectSnapshot(session, 'p2').gameSnapshot.pause).toEqual({
      disconnectedPlayerId: 'p1',
      reconnectDeadlineAt: expectedDeadline,
    });
    cancelAllTimers(session.id);
  });

  it('consumes a remote dice override on exactly one ordinary roll', () => {
    const session = makeSession();
    session.remoteDiceOverride = { playerId: 'p1', steps: 7 };

    const result = performRoll(session, 'p1', io);

    expect(result).toMatchObject({ die1: 3, die2: 4, total: 7, isDouble: false });
    expect(session.remoteDiceOverride).toBeNull();
  });

  it('allows an auction to resolve with an extra roll after a double', () => {
    const session = makeSession();
    session.currentPhase = TurnPhase.EVENT_TRIGGER;
    session.pendingExtraRoll = true;
    const property = session.board.find((tile) => tile.type === TileType.PROPERTY);
    expect(property).toBeDefined();

    startAuction(session, property!.id, io);
    placeBid(session, 'p1', 100, io);
    passAuction(session, 'p1', io);

    expect(session.activeAuction).toBeNull();
    expect(session.currentPhase).toBe(TurnPhase.WAITING_FOR_ACTION);
    expect(property).toHaveProperty('ownerId', 'p2');
  });

  it('lets the last remaining bidder win when the leader passes', () => {
    const session = makeSession();
    session.currentPhase = TurnPhase.EVENT_TRIGGER;
    const property = session.board.find((tile) => tile.type === TileType.PROPERTY);

    startAuction(session, property!.id, io);
    placeBid(session, 'p1', 100, io);
    passAuction(session, 'p1', io);

    expect(property).toHaveProperty('ownerId', 'p2');
    expect(session.activeAuction).toBeNull();
  });

  it('broadcasts the authoritative auction state when the leader passes', () => {
    const session = makeSession();
    const p3 = makePlayer('p3');
    session.players.set(p3.id, p3);
    session.playerOrder.push(p3.id);
    session.currentPhase = TurnPhase.EVENT_TRIGGER;
    const property = session.board.find(tile => tile.type === TileType.PROPERTY)!;
    const emissions: Array<{ room: string; event: string; payload: unknown }> = [];
    const recordingIo = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => emissions.push({ room, event, payload }),
      }),
    } as unknown as Server;

    startAuction(session, property.id, recordingIo);
    placeBid(session, 'p1', 100, recordingIo);
    emissions.length = 0;
    passAuction(session, 'p1', recordingIo);

    expect(session.activeAuction).not.toBeNull();
    expect(emissions).toContainEqual({
      room: session.id,
      event: 'AUCTION_PLAYER_PASSED',
      payload: {
        auctionId: session.activeAuction!.id,
        passedPlayerId: 'p1',
        remainingActiveCount: 2,
        activePlayerIds: ['p2', 'p3'],
        passedPlayerIds: ['p1'],
        currentLeaderId: null,
        currentBid: session.config.startingBid,
      },
    });
    cancelAllTimers(session.id);
  });

  it('uses the matching rent-table entry for a built property', () => {
    const session = makeSession();
    const property = session.board.find((tile): tile is PropertyTile => tile.type === TileType.PROPERTY)!;
    const groupTiles = session.board.filter(
      (tile): tile is PropertyTile => tile.type === TileType.PROPERTY && tile.colorGroup === property.colorGroup,
    );
    for (const tile of groupTiles) {
      tile.ownerId = 'p2';
      tile.isMortgaged = false;
    }
    property.buildingLevel = 1;

    const result = computeRent(session, property.id, 'p1');

    expect(result.amount).toBe(property.rentByLevel[1]);
    expect(result.amount).not.toBe(property.rentByLevel[0]);
  });

  it('caps property upgrades at level six', () => {
    const session = makeSession();
    const property = session.board.find((tile): tile is PropertyTile => tile.type === TileType.PROPERTY)!;
    const groupTiles = session.board.filter(
      (tile): tile is PropertyTile => tile.type === TileType.PROPERTY && tile.colorGroup === property.colorGroup,
    );
    for (const tile of groupTiles) {
      tile.ownerId = 'p1';
      tile.isMortgaged = false;
      tile.buildingLevel = 6;
    }

    expect(() => buildHotel(session, 'p1', property.id, io)).toThrow('maximum building level');
    expect(property.buildingLevel).toBe(6);
  });

  it('rejects duplicate tile entries in a trade offer', () => {
    const session = makeSession();
    const property = session.board.find((tile) => tile.type === TileType.PROPERTY);

    expect(() => proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 0, tileIds: [property!.id, property!.id], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    )).toThrow('same tile more than once');
  });

  it('allows one-sided gifts but rejects a trade where both offers are empty', () => {
    const session = makeSession();

    expect(() => proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 0, tileIds: [], propCardIds: [] },
      { cash: 100, tileIds: [], propCardIds: [] },
      io,
    )).not.toThrow();

    expect(() => proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 0, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    )).toThrow('at least one asset');
  });

  it('does not execute trades while paused or with a disconnected participant', () => {
    const session = makeSession();
    const tradeId = proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 10, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );

    session.status = GameStatus.PAUSED;
    expect(() => acceptTrade(session, tradeId, 'p2', io)).toThrow('game is not running');

    session.status = GameStatus.IN_PROGRESS;
    session.players.get('p1')!.isConnected = false;
    session.players.get('p1')!.status = PlayerStatus.DISCONNECTED;
    expect(() => acceptTrade(session, tradeId, 'p2', io)).toThrow('is disconnected');
    expect(session.activeTrades.has(tradeId)).toBe(true);
  });

  it('voids only the rolling player\'s pending trades', () => {
    const session = makeSession();
    const p3 = makePlayer('p3');
    session.players.set(p3.id, p3);
    session.playerOrder.push(p3.id);
    const involvingRollerId = proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 1, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );
    const unrelatedId = proposeTrade(
      session,
      'p2',
      'p3',
      { cash: 1, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );
    const emissions: Array<{ room: string; event: string; payload: unknown }> = [];
    const recordingIo = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => emissions.push({ room, event, payload }),
      }),
    } as unknown as Server;

    performRoll(session, 'p1', recordingIo);

    expect(session.activeTrades.has(involvingRollerId)).toBe(false);
    expect(session.activeTrades.has(unrelatedId)).toBe(true);
    expect(emissions).toContainEqual({
      room: session.id,
      event: 'TRADE_VOIDED',
      payload: { tradeId: involvingRollerId, reason: TradeVoidReason.PLAYER_ROLLED },
    });
  });

  it('voids pending trades when a participant is jailed or disconnects', () => {
    const jailSession = makeSession();
    const jailedTradeId = proposeTrade(
      jailSession,
      'p1',
      'p2',
      { cash: 1, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );
    sendToJail(jailSession, 'p1', io);
    expect(jailSession.activeTrades.has(jailedTradeId)).toBe(false);

    const disconnectSession = makeSession();
    const disconnectedTradeId = proposeTrade(
      disconnectSession,
      'p1',
      'p2',
      { cash: 1, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );
    handleLastSocketDisconnect(disconnectSession, 'p2', io);
    expect(disconnectSession.activeTrades.has(disconnectedTradeId)).toBe(false);
    cancelAllTimers(disconnectSession.id);
  });

  it('sends a prop-card hand snapshot only to its owner', () => {
    const session = makeSession();
    session.players.get('p1')!.propCards = [
      { id: 'card-a', type: PropCardType.AUDIT, acquiredAt: 1 },
    ];
    const emissions: Array<{ room: string; event: string; payload: unknown }> = [];
    const recordingIo = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => emissions.push({ room, event, payload }),
      }),
    } as unknown as Server;

    syncPropCards(session, 'p1', recordingIo);

    expect(emissions).toEqual([{
      room: 'player:p1',
      event: 'PROP_CARDS_UPDATED',
      payload: { propCards: [{ id: 'card-a', type: PropCardType.AUDIT, acquiredAt: 1 }] },
    }]);
  });

  it('privately syncs both final hands after a prop-card trade', () => {
    const session = makeSession();
    session.players.get('p1')!.propCards = [
      { id: 'card-a', type: PropCardType.AUDIT, acquiredAt: 1 },
    ];
    session.players.get('p2')!.propCards = [
      { id: 'card-b', type: PropCardType.IMMUNITY, acquiredAt: 2 },
    ];
    const emissions: Array<{ room: string; event: string; payload: unknown }> = [];
    const recordingIo = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => emissions.push({ room, event, payload }),
      }),
    } as unknown as Server;
    const tradeId = proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 0, tileIds: [], propCardIds: ['card-a'] },
      { cash: 0, tileIds: [], propCardIds: ['card-b'] },
      recordingIo,
    );
    emissions.length = 0;

    acceptTrade(session, tradeId, 'p2', recordingIo);

    expect(emissions.filter(item => item.event === 'PROP_CARDS_UPDATED')).toEqual([
      {
        room: 'player:p1',
        event: 'PROP_CARDS_UPDATED',
        payload: { propCards: [{ id: 'card-b', type: PropCardType.IMMUNITY, acquiredAt: 2 }] },
      },
      {
        room: 'player:p2',
        event: 'PROP_CARDS_UPDATED',
        payload: { propCards: [{ id: 'card-a', type: PropCardType.AUDIT, acquiredAt: 1 }] },
      },
    ]);
  });

  it('restores only the reconnecting player\'s private trade details', () => {
    const session = makeSession();
    const p3 = makePlayer('p3');
    session.players.set(p3.id, p3);
    session.playerOrder.push(p3.id);
    const visibleTradeId = proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 11, tileIds: [], propCardIds: [] },
      { cash: 22, tileIds: [], propCardIds: [] },
      io,
    );
    const hiddenTradeId = proposeTrade(
      session,
      'p2',
      'p3',
      { cash: 33, tileIds: [], propCardIds: [] },
      { cash: 44, tileIds: [], propCardIds: [] },
      io,
    );

    const snapshot = buildReconnectSnapshot(session, 'p1');

    expect(snapshot.gameSnapshot.pendingTrades.map(trade => trade.tradeId)).toEqual([
      visibleTradeId,
      hiddenTradeId,
    ]);
    expect(snapshot.tradeDetails).toEqual([{
      tradeId: visibleTradeId,
      proposerOffer: { cash: 11, tileIds: [], propCardIds: [] },
      responderOffer: { cash: 22, tileIds: [], propCardIds: [] },
    }]);
  });

  it('does not expose temple litCount in a reconnect snapshot', () => {
    const session = makeSession();
    const snapshot = buildReconnectSnapshot(session, 'p1');
    const temple = snapshot.gameSnapshot.board.find((tile) => (tile as { type?: string }).type === TileType.TEMPLE) as Record<string, unknown>;

    expect(temple).toBeDefined();
    expect(temple).not.toHaveProperty('litCount');
    expect(temple).toHaveProperty('isLit');
  });

  it('routes insufficient temple tolls into rescue instead of negative cash', () => {
    const session = makeSession();
    const temple = session.board.find((tile) => tile.type === TileType.TEMPLE);
    temple!.ownerId = 'p2';
    session.players.get('p1')!.cash = 0;

    const result = handleTempleLanding(session, 'p1', temple!.id, io);

    expect(result.requiresRescue).toBe(true);
    expect(result.amountOwed).toBe(session.config.templePassThruToll);
    expect(session.players.get('p1')!.cash).toBe(0);
  });

  it('routes insufficient surprise losses into rescue instead of negative cash', () => {
    const session = makeSession();
    session.players.get('p1')!.cash = 0;
    session.surpriseDeck = [{
      id: 'loss',
      type: SurpriseCardType.CASH_LOSS,
      amount: 500,
      description: 'loss',
    }];

    const result = applySurpriseCard(session, 'p1', io);

    expect(result.requiresRescue).toBe(true);
    expect(result.amountOwed).toBe(500);
    expect(session.players.get('p1')!.cash).toBe(0);
  });

  it('keeps rescue debt private while reconnecting clients share the deadline', () => {
    const session = makeSession();
    session.players.get('p1')!.status = PlayerStatus.DYING;
    session.currentPhase = TurnPhase.DYING_RESCUE;
    session.dyingRescue = {
      playerId: 'p1',
      startedAt: 1_000,
      lastActionAt: 1_000,
      afkWarningSentAt: null,
    };
    session.pendingBankruptcy = {
      playerId: 'p1',
      type: BankruptcyType.TYPE_B,
      creditorId: 'p2',
      amountOwed: 750,
    };

    const dyingSnapshot = buildReconnectSnapshot(session, 'p1');
    const otherSnapshot = buildReconnectSnapshot(session, 'p2');

    expect(dyingSnapshot.rescueDetail).toMatchObject({
      amountOwed: 750,
      creditorId: 'p2',
      bankruptcyType: BankruptcyType.TYPE_B,
      rescueDeadlineAt: 481_000,
    });
    expect(dyingSnapshot.rescueDetail?.availableActions).toContain('DECLARE_BANKRUPTCY');
    expect(otherSnapshot.rescueDetail).toBeNull();
    expect(otherSnapshot.gameSnapshot.dyingRescue).toEqual({
      playerId: 'p1',
      rescueDeadlineAt: 481_000,
    });
  });

  it('emits an absolute eight-minute rescue deadline and a two-minute warning', () => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    const session = makeSession();
    const emit = jest.fn();
    const localIo = { to: () => ({ emit }) } as unknown as Server;

    enterDyingRescue(session, 'p1', BankruptcyType.TYPE_A, null, 500, localIo);

    expect(emit).toHaveBeenCalledWith('PLAYER_DYING', {
      playerId: 'p1',
      rescueWindowMs: 480_000,
      rescueDeadlineAt: 490_000,
      phase: TurnPhase.DYING_RESCUE,
    });
    expect(emit).toHaveBeenCalledWith('DYING_RESCUE_DETAIL', expect.objectContaining({
      amountOwed: 500,
      rescueDeadlineAt: 490_000,
    }));

    jest.advanceTimersByTime(360_000);
    expect(emit).toHaveBeenCalledWith('DYING_RESCUE_AFK_WARNING', {
      playerId: 'p1',
      remainingSeconds: 120,
    });

    cancelAllTimers(session.id);
    jest.useRealTimers();
  });

  it('requires every rescue trade to involve the dying player', () => {
    const session = makeSession();
    const p3 = makePlayer('p3');
    session.players.set(p3.id, p3);
    session.playerOrder.push(p3.id);
    session.currentPhase = TurnPhase.DYING_RESCUE;
    session.players.get('p1')!.status = PlayerStatus.DYING;
    session.dyingRescue = {
      playerId: 'p1',
      startedAt: Date.now(),
      lastActionAt: Date.now(),
      afkWarningSentAt: null,
    };
    session.pendingBankruptcy = {
      playerId: 'p1',
      type: BankruptcyType.TYPE_A,
      creditorId: null,
      amountOwed: 500,
    };

    expect(() => proposeTrade(
      session,
      'p2',
      'p3',
      { cash: 100, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    )).toThrow('must involve the dying player');
  });

  it('voids every stale trade involving a player who enters rescue', () => {
    const session = makeSession();
    const p3 = makePlayer('p3');
    session.players.set(p3.id, p3);
    session.playerOrder.push(p3.id);

    const outgoingId = proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 1, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );
    const incomingId = proposeTrade(
      session,
      'p2',
      'p1',
      { cash: 1, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );
    const unrelatedId = proposeTrade(
      session,
      'p2',
      'p3',
      { cash: 1, tileIds: [], propCardIds: [] },
      { cash: 0, tileIds: [], propCardIds: [] },
      io,
    );

    voidTradesInvolvingPlayer(session, 'p1', TradeVoidReason.PLAYER_DYING, io);

    expect(session.activeTrades.has(outgoingId)).toBe(false);
    expect(session.activeTrades.has(incomingId)).toBe(false);
    expect(session.activeTrades.has(unrelatedId)).toBe(true);
  });

  it('automatically settles rescue debt after a funding trade', () => {
    const session = makeSession();
    const dyingPlayer = session.players.get('p1')!;
    dyingPlayer.status = PlayerStatus.DYING;
    dyingPlayer.cash = 100;
    session.currentPhase = TurnPhase.DYING_RESCUE;
    session.dyingRescue = {
      playerId: 'p1',
      startedAt: Date.now(),
      lastActionAt: Date.now(),
      afkWarningSentAt: null,
    };
    session.pendingBankruptcy = {
      playerId: 'p1',
      type: BankruptcyType.TYPE_A,
      creditorId: null,
      amountOwed: 1_000,
    };

    const tradeId = proposeTrade(
      session,
      'p1',
      'p2',
      { cash: 0, tileIds: [], propCardIds: [] },
      { cash: 900, tileIds: [], propCardIds: [] },
      io,
    );
    acceptTrade(session, tradeId, 'p2', io);

    expect(dyingPlayer.status).toBe(PlayerStatus.ACTIVE);
    expect(dyingPlayer.cash).toBe(0);
    expect(session.players.get('p2')!.cash).toBe(14_100);
    expect(session.pendingBankruptcy).toBeNull();
    expect(session.dyingRescue).toBeNull();
    expect(session.playerOrder[session.currentPlayerIndex]).toBe('p2');
    expect(session.currentPhase).toBe(TurnPhase.WAITING_FOR_ACTION);
  });

  it('pays a rent creditor only from realized bankruptcy assets', () => {
    const session = makeSession();
    const property = session.board.find((tile) => tile.type === TileType.PROPERTY);
    property!.ownerId = 'p1';
    if (property!.type === TileType.PROPERTY) property!.buildingLevel = 1;
    session.players.get('p1')!.cash = 0;
    session.pendingBankruptcy = {
      playerId: 'p1',
      type: BankruptcyType.TYPE_B,
      creditorId: 'p2',
      amountOwed: 100,
    };
    session.dyingRescue = { playerId: 'p1', startedAt: Date.now(), lastActionAt: Date.now(), afkWarningSentAt: null };
    session.currentPhase = TurnPhase.DYING_RESCUE;

    declareBankruptcy(session, 'p1', io);

    expect(session.players.get('p2')!.cash).toBeGreaterThan(0);
    expect(property).toHaveProperty('ownerId', null);
    expect(session.players.get('p1')!.cash).toBe(0);
  });

  it('whale-falls the requested player without clearing another player rescue', () => {
    const session = makeSession();
    const p3 = makePlayer('p3');
    session.players.set(p3.id, p3);
    session.playerOrder.push(p3.id);
    session.players.get('p1')!.status = PlayerStatus.DYING;
    session.pendingBankruptcy = {
      playerId: 'p1',
      type: BankruptcyType.TYPE_A,
      creditorId: null,
      amountOwed: 500,
    };
    session.dyingRescue = {
      playerId: 'p1',
      startedAt: Date.now(),
      lastActionAt: Date.now(),
      afkWarningSentAt: null,
    };
    session.currentPhase = TurnPhase.DYING_RESCUE;

    const emit = jest.fn();
    const localIo = { to: () => ({ emit }) } as unknown as Server;

    triggerWhaleFall(session, 'p2', 'DISCONNECT_TIMEOUT', localIo);

    expect(session.players.get('p1')!.status).toBe(PlayerStatus.DYING);
    expect(session.players.get('p2')!.status).toBe(PlayerStatus.BANKRUPT);
    expect(session.pendingBankruptcy?.playerId).toBe('p1');
    expect(session.dyingRescue?.playerId).toBe('p1');
    expect(session.currentPhase).toBe(TurnPhase.DYING_RESCUE);
    expect(session.playerOrder).toEqual(['p1', 'p3']);
    expect(emit).toHaveBeenCalledWith('WHALE_FALL', {
      playerId: 'p2',
      reason: 'DISCONNECT_TIMEOUT',
    });
    expect(emit).toHaveBeenCalledWith('PLAYER_BANKRUPT', {
      playerId: 'p2',
      bankruptType: BankruptcyType.TYPE_A,
      creditorId: null,
    });
  });

  it('keeps the state machine as the only phase mutation path for auction extra rolls', () => {
    const session = makeSession();
    session.currentPhase = TurnPhase.AUCTION_IN_PROGRESS;

    expect(() => StateMachine.transition(session, TurnPhase.WAITING_FOR_ACTION)).not.toThrow();
  });
});
