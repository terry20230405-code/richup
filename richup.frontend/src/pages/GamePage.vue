<template>
  <section class="game-page">
    <div v-if="gameStore.status === 'PAUSED'" class="paused-overlay">
      <div class="paused-card">
        <p class="eyebrow">Game Paused</p>
        <h2>Match flow is temporarily frozen.</h2>
        <p v-if="pausedPlayerName">{{ pausedPlayerName }} paused the game. Countdown: {{ gameStore.pauseCountdownSeconds }}s.</p>
      </div>
    </div>

    <div
      v-if="gameStore.dyingPlayerId"
      class="rescue-banner"
      :class="{ 'rescue-banner--self': gameStore.dyingPlayerId === selfStore.id }"
    >
      <span>{{ gameStore.dyingPlayerId === selfStore.id ? 'You are in the rescue window.' : `${dyingPlayerName} is in the rescue window.` }}</span>
    </div>

    <section class="game-scene" :class="{ 'drawer-open': drawerOpen }">
      <button class="drawer-toggle" type="button" :aria-expanded="drawerOpen" :aria-label="drawerOpen ? 'Close drawer' : 'Open drawer'" @click="drawerOpen = !drawerOpen">
        <span class="drawer-toggle-arrow">{{ drawerOpen ? '›' : '‹' }}</span>
      </button>

      <div class="board-wrapper">
        <section v-if="gameStore.board.length === 0" class="surface empty-board">
          <p class="eyebrow">{{ gameStore.status === 'LOBBY' ? 'Lobby Ready' : 'Waiting For Map' }}</p>
          <h2>{{ emptyBoardTitle }}</h2>
          <p>{{ emptyBoardDescription }}</p>
        </section>

        <BoardView
          v-else
          :tiles="gameStore.board"
          :players="boardPlayers"
          :current-turn-player-id="gameStore.currentTurnPlayerId"
        >
          <template #center>
            <CenterHub
              :heading="centerHeading"
              :status-line="centerStatusLine"
              :description="centerDescription"
              :current-player-color="currentPlayerColor"
              :active-tile-name="isCasinoBetting ? null : (activeTile?.name ?? null)"
              :active-tile-type="isCasinoBetting ? null : activeTileTypeLabel"
              :active-tile-price="isCasinoBetting ? null : (activeTile?.basePrice ?? null)"
            >
              <template #pills>
                <EventLogStream />
              </template>

              <template #actions>
                <div class="hub-stack">
                  <div v-if="isMyTurn && gameStore.currentPhase === 'WAITING_FOR_ACTION'" class="button-row">
                    <button class="pill pill--primary" type="button" @click="rollDice">🎲 Roll Dice</button>
                  </div>


                  <div v-if="isMyTurn && contextualActions.length > 0" class="button-row">
                    <button
                      v-for="action in contextualActions"
                      :key="action.id"
                      :class="['pill', `pill--${action.tone}`]"
                      type="button"
                      @click="action.handler()"
                    >
                      {{ action.id === 'BUY_PROPERTY' && activeTile?.basePrice
                        ? `${action.label} ($${activeTile.basePrice})`
                        : action.id === 'PAY_TAX' && gameStore.pendingTaxAmount
                          ? `${action.label} ($${gameStore.pendingTaxAmount})`
                          : action.label }}
                    </button>
                  </div>

                  <div
                    v-if="isMyTurn && !actionTaken && gameStore.currentPhase === 'EVENT_TRIGGER' && contextualActions.length === 0 && !gameStore.availableActions.includes('CASINO_BET')"
                    class="button-row"
                  >
                    <button
                      v-if="activeTile && (activeTile.type === 'PROPERTY' || activeTile.type === 'AIRPORT' || activeTile.type === 'TEMPLE') && !activeTile.ownerId"
                      class="pill pill--primary"
                      type="button"
                      @click="ACTION_CONFIG['BUY_PROPERTY'].handler()"
                    >
                      Buy {{ activeTile.type === 'AIRPORT' ? 'Airport' : activeTile.type === 'TEMPLE' ? 'Temple' : 'Property' }} (${{ activeTile.basePrice ?? 0 }})
                    </button>
                    <button
                      v-if="activeTile && (activeTile.type === 'PROPERTY' || activeTile.type === 'AIRPORT') && !activeTile.ownerId"
                      class="pill pill--primary"
                      type="button"
                      @click="ACTION_CONFIG['CHOOSE_AUCTION'].handler()"
                    >
                      Auction
                    </button>
                    <button
                      v-if="activeTile && !activeTile.ownerId"
                      class="pill pill--primary"
                      type="button"
                      @click="ACTION_CONFIG['SKIP_PURCHASE'].handler()"
                    >
                      Skip
                    </button>
                  </div>

                  <div
                    v-if="isMyTurn && (actionTaken || gameStore.currentPhase === 'END_TURN_PENDING' || gameStore.availableActions.includes('END_TURN'))"
                    class="button-row"
                  >
                    <button class="pill pill--primary" type="button" @click="endTurn">End Turn</button>
                  </div>

                  <div v-if="isMyTurn && gameStore.currentPhase === 'BUILD_PHASE'" class="button-row">
                    <button class="pill pill--primary" type="button" @click="endTurn">Finish Build Phase</button>
                  </div>

                  <p v-if="!isMyTurn && gameStore.status === 'IN_PROGRESS'" class="muted-note">
                    Waiting for {{ currentPlayerLabel }} to finish the {{ turnPhaseLabel.toLowerCase() }} phase.
                  </p>
                </div>
              </template>

              <template #details>
                <section v-if="isMyTurn && gameStore.currentPhase === 'BUILD_PHASE'" class="detail-card">
                  <p class="eyebrow eyebrow--small">Build Queue</p>
                  <div v-if="selfStore.constructibleTileIds.length > 0" class="detail-list">
                    <div v-for="tileId in selfStore.constructibleTileIds" :key="tileId" class="detail-row">
                      <div>
                        <strong>{{ gameStore.boardById[tileId]?.name ?? `Tile ${tileId}` }}</strong>
                        <small>Level {{ gameStore.boardById[tileId]?.buildingLevel ?? 0 }}</small>
                      </div>
                      <div class="button-row">
                        <button
                          v-if="(gameStore.boardById[tileId]?.buildingLevel ?? 0) < 4"
                          class="pill pill--dark"
                          type="button"
                          @click="buildHouse(tileId)"
                        >
                          Build House
                        </button>
                        <button
                          v-else
                          class="pill pill--dark"
                          type="button"
                          @click="buildHotel(tileId)"
                        >
                          Build Hotel
                        </button>
                        <button
                          v-if="(gameStore.boardById[tileId]?.buildingLevel ?? 0) > 0"
                          class="pill pill--soft"
                          type="button"
                          @click="sellBuilding(tileId)"
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  </div>
                  <p v-else class="muted-note">No properties are currently eligible for construction.</p>
                </section>

                <section v-if="isCasinoBetting" class="detail-card detail-card--casino">
                  <div class="casino-top-row">
                    <button class="pill pill--soft casino-skip-btn" type="button" @click="handleCasinoSkip">Skip</button>
                  </div>
                  <p class="casino-hint">Small bets → high multiplier &amp; high risk. Large bets → safer odds, smaller return. Must be a multiple of ${{ activeTile?.betMultiple ?? 50 }}.</p>
                  <div class="input-row">
                    <input
                      v-model.number="casinoBetAmount"
                      type="number"
                      :min="activeTile?.betMultiple ?? 50"
                      :step="activeTile?.betMultiple ?? 50"
                      class="pill-input"
                      placeholder="Custom bet..."
                    />
                    <button class="pill pill--primary" type="button" :disabled="casinoBetPlaced" @click="handlePlaceBet">Place Bet</button>
                  </div>
                </section>

                <section v-if="gameStore.activeAuction" class="detail-card detail-card--auction">
                  <p class="eyebrow eyebrow--small">Auction Floor</p>
                  <div class="auction-grid">
                    <div><span>Current bid</span><strong>${{ gameStore.activeAuction.currentBid }}</strong></div>
                    <div><span>Leader</span><strong>{{ auctionLeaderName }}</strong></div>
                    <div><span>Bidders</span><strong>{{ gameStore.activeAuction.activePlayerIds.length }}</strong></div>
                  </div>
                  <div v-if="isActiveAuctionParticipant" class="input-row">
                    <input
                      v-model.number="auctionBidAmount"
                      type="number"
                      :min="gameStore.activeAuction.currentBid + 1"
                      class="pill-input"
                      :placeholder="`Bid above $${gameStore.activeAuction.currentBid}`"
                    />
                    <button class="pill pill--dark" type="button" @click="handlePlaceAuctionBid">Bid</button>
                    <button class="pill pill--soft" type="button" @click="passAuction">Pass</button>
                  </div>
                  <p v-else class="muted-note">
                    {{
                      gameStore.activeAuction.passedPlayerIds.includes(selfStore.id)
                        ? 'You have already passed this auction.'
                        : 'Waiting for the current bidder rotation.'
                    }}
                  </p>
                </section>
              </template>
            </CenterHub>
          </template>
        </BoardView>
      </div>

      <aside class="side-drawer">
        <section class="surface">
          <div class="section-head">
            <div>
              <p class="eyebrow">Session</p>
              <h3>{{ roomNumberDisplay ? `Room ${roomNumberDisplay}` : 'No room selected' }}</h3>
            </div>
            <span class="chip" :class="{ 'chip--live': isConnected }">{{ isConnected ? 'Connected' : 'Offline' }}</span>
          </div>
          <dl class="stats-grid">
            <div><dt>Nickname</dt><dd>{{ session.nickname || 'Waiting' }}</dd></div>
            <div><dt>Status</dt><dd>{{ statusLabel }}</dd></div>
            <div><dt>Phase</dt><dd>{{ turnPhaseLabel }}</dd></div>
            <div><dt>Turn</dt><dd>{{ gameStore.turnNumber || 0 }}</dd></div>
          </dl>
        </section>

        <section v-if="showLobbyControls" class="surface">
          <div class="section-head">
            <div>
              <p class="eyebrow">Lobby Controls</p>
              <h3>Prepare the match</h3>
            </div>
          </div>
          <div class="drawer-actions">
            <button class="pill pill--dark" type="button" @click="handleStartGame">Start Game</button>
            <RouterLink class="drawer-link" to="/">Back To Lobby</RouterLink>
            <button class="pill pill--soft" type="button" @click="handleDisconnect">Disconnect</button>
            <button class="pill pill--soft" type="button" @click="handleClearSession">Clear Session</button>
          </div>
        </section>

        <section class="surface">
          <div class="section-head">
            <div>
              <p class="eyebrow">Players</p>
              <h3>Table roster</h3>
            </div>
            <span class="chip">{{ rosterPlayers.length }}</span>
          </div>
          <p v-if="rosterPlayers.length === 0" class="muted-note">Player snapshots will appear here after the socket handshake completes.</p>
          <div v-else class="roster-list">
            <PlayerPanel
              v-for="player in rosterPlayers"
              :key="player.id"
              :player="player"
              :owned-count="ownedTileCount(player.id)"
              :cash="player.id === selfStore.id ? selfStore.cash : null"
              :constructible-count="player.id === selfStore.id ? selfStore.constructibleTileIds.length : null"
              :is-current="gameStore.currentTurnPlayerId === player.id"
              :is-self="player.id === selfStore.id"
            />
          </div>
        </section>

        <TradePanel />
        <PropCardHand />

      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import BoardView from '@/components/board/BoardView.vue';
import CenterHub from '@/components/board/CenterHub.vue';
import EventLogStream from '@/components/board/EventLogStream.vue';
import PlayerPanel from '@/components/panels/PlayerPanel.vue';
import PropCardHand from '@/components/panels/PropCardHand.vue';
import TradePanel from '@/components/panels/TradePanel.vue';
import { clearRoomSession, disconnectRoomSession } from '@/services/roomSession';
import {
  buildHouse,
  buildHotel,
  buyProperty,
  chooseAuction,
  declareBankruptcy,
  endTurn,
  passAuction,
  payBail,
  payTax,
  placeCasinoBet,
  placeAuctionBid,
  rollDice,
  rollForDouble,
  sellBuilding,
  skipPurchase,
  startGame,
  templePray,
} from '@/socket/actions';
import { useFloatingTextStore } from '@/stores/useFloatingTextStore';
import { gameSocket } from '@/socket/client';
import { readStoredSocketSession } from '@/socket/storage';
import { useEventLogStore } from '@/stores/useEventLogStore';
import { useGameStore } from '@/stores/useGameStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { useSelfStore } from '@/stores/useSelfStore';
import type { PlayerId, PlayerPublicView } from '@/types';
import { getShortRoomCode } from '@/utils/roomCode';

const router = useRouter();
const gameStore = useGameStore();
const selfStore = useSelfStore();
const playersStore = usePlayersStore();
const eventLogStore = useEventLogStore();

const isConnected = ref(gameSocket.connected);
const drawerOpen = ref(true);
const session = ref(readStoredSocketSession());
const casinoBetAmount = ref(0);
const auctionBidAmount = ref(0);
const actionTaken = ref(false);
const casinoBetPlaced = ref(false);
const floatingTextStore = useFloatingTextStore();

const triggerFloatingTax = (): void => {
  const pos = selfStore.position;
  const amt = gameStore.pendingTaxAmount;
  if (pos !== null && amt) floatingTextStore.show(pos, `-$${amt}`);
};

const refreshSession = (): void => {
  session.value = readStoredSocketSession();
};

const fallbackPlayer = (playerId: PlayerId): PlayerPublicView => ({
  id: playerId,
  nickname: `Player ${playerId.slice(0, 6)}`,
  avatarIndex: 0,
  color: '#8f5d23',
  position: 0,
  previousPosition: 0,
  inJail: false,
  jailTurnsWaited: 0,
  status: 'ACTIVE',
  isConnected: false,
});

const orderedPlayers = computed(() => (
  gameStore.playerOrder.length > 0
    ? gameStore.playerOrder.map((playerId) => playersStore.players[playerId] ?? fallbackPlayer(playerId))
    : playersStore.playerList
));

const rosterPlayers = computed(() => {
  const selfId = selfStore.id;
  return [...orderedPlayers.value].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    return 0;
  });
});

const roomNumberDisplay = computed(() => getShortRoomCode(session.value.roomId));

const boardPlayers = computed(() =>
  orderedPlayers.value.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    color: player.color,
    position: player.position,
  })),
);

const phaseLabelMap: Record<string, string> = {
  WAITING_FOR_ACTION: 'Waiting for action',
  ROLLING_DICE: 'Rolling dice',
  MOVING: 'Moving',
  EVENT_TRIGGER: 'Resolving event',
  AUCTION_IN_PROGRESS: 'Auction',
  BUILD_PHASE: 'Build phase',
  JAIL_DECISION: 'Jail decision',
  DYING_RESCUE: 'Rescue window',
  END_TURN_PENDING: 'Ready to end turn',
  TURN_TRANSITIONING: 'Turn transition',
};

const statusLabelMap: Record<string, string> = {
  LOBBY: 'Lobby',
  STARTING: 'Starting',
  IN_PROGRESS: 'In progress',
  PAUSED: 'Paused',
  FINISHED: 'Finished',
};

const tileTypeLabelMap: Record<string, string> = {
  PROPERTY: 'Property',
  AIRPORT: 'Airport',
  TEMPLE: 'Temple',
  CASINO: 'Casino',
  TAX: 'Tax',
  SURPRISE: 'Chance',
  GO: 'Go',
  JAIL: 'Jail',
  GO_TO_JAIL: 'Go To Jail',
  FREE: 'Free',
};

const currentTurnPlayer = computed(() => (
  gameStore.currentTurnPlayerId
    ? playersStore.players[gameStore.currentTurnPlayerId] ?? fallbackPlayer(gameStore.currentTurnPlayerId)
    : null
));

const currentPlayerLabel = computed(() => currentTurnPlayer.value?.nickname ?? 'Waiting');
const currentPlayerColor = computed(() => currentTurnPlayer.value?.color ?? null);
const turnPhaseLabel = computed(() => phaseLabelMap[gameStore.currentPhase] ?? gameStore.currentPhase.replace(/_/g, ' '));
const statusLabel = computed(() => statusLabelMap[gameStore.status] ?? gameStore.status);
const isMyTurn = computed(() => gameStore.currentTurnPlayerId === selfStore.id);

const winnerNames = computed(() =>
  gameStore.winners.map((playerId) => playersStore.players[playerId]?.nickname ?? `Player ${playerId.slice(0, 6)}`),
);

const centerHeading = computed(() => {
  if (gameStore.status === 'FINISHED') return winnerNames.value.length > 0 ? winnerNames.value.join(', ') : 'Match finished';
  if (gameStore.currentTurnPlayerId) return currentPlayerLabel.value;
  return gameStore.status === 'LOBBY' ? 'Waiting for kickoff' : 'Synchronizing board';
});

const centerStatusLine = computed(() => (
  gameStore.status === 'IN_PROGRESS'
    ? `Round ${Math.max(gameStore.turnNumber, 1)}`
    : (gameStore.status === 'FINISHED' ? 'Winner' : statusLabel.value)
));

const pausedPlayerName = computed(() => (
  gameStore.pausedByPlayerId
    ? playersStore.players[gameStore.pausedByPlayerId]?.nickname ?? gameStore.pausedByPlayerId
    : null
));

const dyingPlayerName = computed(() => (
  gameStore.dyingPlayerId
    ? playersStore.players[gameStore.dyingPlayerId]?.nickname ?? gameStore.dyingPlayerId
    : null
));

const centerDescription = computed(() => {
  if (gameStore.status === 'LOBBY') return 'Start the match from the drawer when everyone has joined.';
  if (gameStore.status === 'PAUSED') return pausedPlayerName.value ? `${pausedPlayerName.value} paused the game.` : 'The board is paused.';
  if (gameStore.status === 'FINISHED') return winnerNames.value.length > 0 ? `Winner: ${winnerNames.value.join(', ')}.` : 'Final standings locked.';
  if (!gameStore.currentTurnPlayerId) return 'The board is waiting for the first active turn assignment.';
  if (isMyTurn.value && gameStore.currentPhase === 'WAITING_FOR_ACTION') return 'Your turn is live. Roll the dice from the command area below.';
  if (isMyTurn.value && gameStore.currentPhase === 'BUILD_PHASE') return 'Upgrade any eligible property before ending the phase.';
  if (isMyTurn.value && gameStore.currentPhase === 'END_TURN_PENDING') return 'Your move is resolved. End the turn when you are ready.';
  if (isMyTurn.value && gameStore.currentPhase === 'EVENT_TRIGGER' && activeTile.value?.type === 'TAX' && gameStore.pendingTaxAmount)
    return `Tax Event! You must pay $${gameStore.pendingTaxAmount} to continue.`;
  if (isMyTurn.value && gameStore.currentPhase === 'EVENT_TRIGGER' && activeTile.value?.type === 'CASINO')
    return '';
  return isMyTurn.value
    ? `Your turn is active. The board is currently in the ${turnPhaseLabel.value.toLowerCase()} phase.`
    : `${currentPlayerLabel.value} is currently handling the ${turnPhaseLabel.value.toLowerCase()} phase.`;
});


const activeTile = computed(() => {
  if (!gameStore.hasBoard || !gameStore.currentTurnPlayerId) return null;
  const position = gameStore.currentTurnPlayerId === selfStore.id
    ? selfStore.position
    : (playersStore.players[gameStore.currentTurnPlayerId]?.position ?? null);
  return position === null ? null : gameStore.boardById[position] ?? null;
});

const activeTileTypeLabel = computed(() => (
  activeTile.value ? tileTypeLabelMap[activeTile.value.type] ?? activeTile.value.type : null
));

const isActiveAuctionParticipant = computed(() => gameStore.activeAuction?.activePlayerIds.includes(selfStore.id) ?? false);
const auctionLeaderName = computed(() => {
  const leaderId = gameStore.activeAuction?.currentLeaderId;
  if (!leaderId) return 'No leader';
  return playersStore.players[leaderId]?.nickname ?? `Player ${leaderId.slice(0, 6)}`;
});

const ACTION_CONFIG: Record<string, { label: string; tone: 'primary' | 'dark' | 'soft' | 'danger'; handler: () => void }> = {
  BUY_PROPERTY: { label: 'Buy Property', tone: 'primary', handler: () => { actionTaken.value = true; buyProperty(); } },
  CHOOSE_AUCTION: { label: 'Auction It', tone: 'primary', handler: () => { actionTaken.value = true; chooseAuction(); } },
  SKIP_PURCHASE: { label: 'Skip Purchase', tone: 'primary', handler: () => { actionTaken.value = true; skipPurchase(); } },
  PAY_BAIL: { label: 'Pay Bail', tone: 'primary', handler: () => payBail() },
  PAY_TAX: { label: 'Pay Tax', tone: 'danger', handler: () => { triggerFloatingTax(); actionTaken.value = true; payTax(); } },
  ROLL_FOR_DOUBLE: { label: 'Roll For Double', tone: 'primary', handler: () => rollForDouble() },
  PRAY: { label: 'Pray', tone: 'dark', handler: () => templePray() },
  DECLARE_BANKRUPTCY: { label: 'Declare Bankruptcy', tone: 'danger', handler: () => declareBankruptcy() },
};

const contextualActions = computed(() => {
  if (actionTaken.value) return [];
  return gameStore.availableActions
    .filter((action) => action !== 'PLACE_BET' && action !== 'END_TURN' && ACTION_CONFIG[action])
    .map((action) => ({ id: action, ...ACTION_CONFIG[action]! }));
});

const showLobbyControls = computed(() => gameStore.status === 'LOBBY');

const emptyBoardTitle = computed(() => {
  if (gameStore.status === 'LOBBY') return 'Start the match to generate the board.';
  if (!isConnected.value) return 'Reconnect to the room to resume the board scene.';
  return 'The board will appear as soon as the map arrives from the server.';
});

const emptyBoardDescription = computed(() => {
  if (gameStore.status === 'LOBBY') return 'You can already confirm the roster in the drawer while the room waits in the lobby.';
  if (!isConnected.value) return 'Return to the lobby if this browser lost its socket session.';
  return 'Player state is already hydrating from the live stores while the map syncs.';
});

const isCasinoBetting = computed(() =>
  isMyTurn.value && gameStore.currentPhase === 'EVENT_TRIGGER' && gameStore.availableActions.includes('CASINO_BET'),
);

const casinoPresets = computed((): number[] => {
  if (!activeTile.value || activeTile.value.type !== 'CASINO') return [];
  const step = activeTile.value.betMultiple ?? 50;
  const max = activeTile.value.maxBet ?? Infinity;
  return [step, step * 2, step * 4, step * 10, step * 20, step * 100].filter((p) => p <= max);
});

const isBetValid = computed(() => {
  if (!activeTile.value || activeTile.value.type !== 'CASINO') return false;
  const step = activeTile.value.betMultiple ?? 50;
  return casinoBetAmount.value > 0 && casinoBetAmount.value % step === 0;
});

const handlePlaceBet = (): void => {
  if (casinoBetPlaced.value) return;
  const step = activeTile.value?.betMultiple ?? 50;
  if (casinoBetAmount.value <= 0 || casinoBetAmount.value % step !== 0) {
    eventLogStore.push('error', `Bet rejected: amount must be a positive multiple of $${step}.`);
    return;
  }
  casinoBetPlaced.value = true;
  placeCasinoBet(casinoBetAmount.value);
  casinoBetAmount.value = 0;
};

const handleCasinoSkip = (): void => {
  skipPurchase();
};

const handlePlaceAuctionBid = (): void => {
  if (auctionBidAmount.value > 0) placeAuctionBid(auctionBidAmount.value);
};

const ownedTileCount = (playerId: PlayerId): number =>
  gameStore.board.filter((tile) => tile.ownerId === playerId).length;

const syncConnectionState = (): void => {
  isConnected.value = gameSocket.connected;
  refreshSession();
};

const ensureActiveRoomSession = (): boolean => {
  if (!session.value.roomId || !session.value.sessionToken) {
    eventLogStore.push('error', 'No active room session found. Please create or join a room again.');
    return false;
  }

  if (!isConnected.value || !selfStore.isHydrated || !gameStore.roomId) {
    eventLogStore.push('error', 'Room session is not connected to the server. Please return to the lobby and join again.');
    return false;
  }

  return true;
};

const handleStartGame = (): void => {
  if (ensureActiveRoomSession()) startGame();
};

const handleDisconnect = (): void => {
  disconnectRoomSession();
  syncConnectionState();
};

const handleClearSession = async (): Promise<void> => {
  clearRoomSession();
  syncConnectionState();
  await router.push('/');
};

watch(
  [() => gameStore.currentTurnPlayerId, () => gameStore.turnNumber, () => gameStore.currentPhase],
  () => { actionTaken.value = false; casinoBetPlaced.value = false; },
);

const onActionRejected = (): void => { actionTaken.value = false; };

onMounted(() => {
  refreshSession();
  gameSocket.on('connect', syncConnectionState);
  gameSocket.on('disconnect', syncConnectionState);
  gameSocket.on('connect_error', syncConnectionState);
  gameSocket.on('ACTION_REJECTED', onActionRejected);
});

onBeforeUnmount(() => {
  gameSocket.off('connect', syncConnectionState);
  gameSocket.off('disconnect', syncConnectionState);
  gameSocket.off('connect_error', syncConnectionState);
  gameSocket.off('ACTION_REJECTED', onActionRejected);
});
</script>

<style scoped>
.game-page { width: 100%; height: 100vh; overflow: hidden; }
.game-scene { position: relative; width: 100%; height: 100vh; overflow: hidden; --drawer-width: 360px; --board-size: min(92vh, calc(100vw - 32px)); }
.board-wrapper { position: absolute; top: 50%; left: 50%; width: var(--board-size); height: var(--board-size); transform: translate(-50%, -50%); transition: transform 320ms cubic-bezier(0.4, 0, 0.2, 1); }
.game-scene.drawer-open .board-wrapper { transform: translate(calc(-50% - calc(var(--drawer-width) / 2)), -50%); }
.side-drawer { position: absolute; top: 0; right: 0; width: var(--drawer-width); height: 100vh; padding: 24px 18px 24px 20px; overflow-y: auto; display: grid; align-content: start; gap: 16px; background: linear-gradient(180deg, rgba(255, 250, 241, 0.97), rgba(244, 234, 216, 0.98)); border-left: 1px solid rgba(92, 66, 41, 0.12); box-shadow: -24px 0 50px rgba(55, 36, 17, 0.12); transform: translateX(100%); transition: transform 320ms cubic-bezier(0.4, 0, 0.2, 1); }
.game-scene.drawer-open .side-drawer { transform: translateX(0); }
.drawer-toggle { position: absolute; top: 50%; right: 0; z-index: 20; display: flex; align-items: center; justify-content: center; width: 24px; height: 52px; padding: 0; border: 1px solid rgba(92, 66, 41, 0.14); border-right: none; border-radius: 12px 0 0 12px; background: linear-gradient(180deg, rgba(255, 252, 246, 0.97), rgba(243, 233, 214, 0.97)); color: #8f5d23; box-shadow: -4px 0 14px rgba(55, 36, 17, 0.1); cursor: pointer; transform: translateY(-50%); transition: right 320ms cubic-bezier(0.4, 0, 0.2, 1); }
.game-scene.drawer-open .drawer-toggle { right: var(--drawer-width); }
.drawer-toggle-arrow { font-size: 1.1rem; font-weight: 700; line-height: 1; }
.surface { padding: 22px; border-radius: 24px; background: linear-gradient(180deg, rgba(255, 252, 246, 0.96), rgba(243, 233, 214, 0.97)); border: 1px solid rgba(92, 66, 41, 0.12); box-shadow: 0 16px 34px rgba(72, 49, 26, 0.08); }
.empty-board { height: 100%; display: grid; align-content: center; justify-items: center; text-align: center; gap: 12px; }
.eyebrow { margin: 0; font-size: 0.76rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #8f5d23; }
.eyebrow--small { font-size: 0.72rem; }
.empty-board h2, .paused-card h2 { margin: 0; font-family: 'Itim', cursive; font-weight: 400; font-size: clamp(1.7rem, 2.4vw, 2.5rem); line-height: 1.06; color: #26180d; }
.empty-board p, .muted-note, .paused-card p { margin: 0; color: #604b38; line-height: 1.6; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.section-head h3 { margin: 4px 0 0; font-size: 1.15rem; color: #26180d; }
.chip { display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px; font-size: 0.76rem; font-weight: 700; background: rgba(143, 93, 35, 0.12); color: #8f5d23; }
.chip--live { background: rgba(42, 163, 74, 0.12); color: #1b7a39; }
.stats-grid { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.stats-grid div { padding: 12px 14px; border-radius: 16px; background: rgba(255, 255, 255, 0.72); }
.stats-grid dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #8b7358; }
.stats-grid dd { margin: 6px 0 0; font-weight: 700; color: #26180d; }
.drawer-actions, .hub-stack, .detail-list, .roster-list { display: grid; gap: 12px; }
.button-row, .input-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.pill, .drawer-link { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 24px; border-radius: 999px; border: 0; font-family: 'Itim', cursive; font-size: 1rem; font-weight: 400; text-decoration: none; cursor: pointer; }
.pill--primary { background: #b8793a; color: #fff; box-shadow: 0 4px 14px rgba(143, 80, 20, 0.35); font-size: 1.05rem; }
.hub-stack .button-row { flex-wrap: nowrap; gap: 8px; }
.hub-stack .button-row .pill { flex: 1; min-width: 0; min-height: 40px; padding: 8px 12px; font-size: 0.875rem; }
.hub-stack .button-row .pill--primary { font-size: 0.875rem; }
.pill--primary:hover { background: #c98540; box-shadow: 0 6px 18px rgba(143, 80, 20, 0.45); }
.pill--dark, .drawer-link { background: #1f1a14; color: #fff7ed; }
.pill--soft { background: #eadbc2; color: #4e3b27; }
.pill--danger { background: #8b1c1c; color: #fff; }
.pill-input { min-width: 140px; flex: 1; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(92, 66, 41, 0.2); background: rgba(255, 255, 255, 0.86); font: inherit; color: #26180d; outline: none; }
.pill-input:focus { border-color: #8f5d23; }
.detail-card { display: grid; gap: 12px; padding: 16px; border-radius: 20px; background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(92, 66, 41, 0.1); }
.detail-card--auction { background: linear-gradient(180deg, rgba(255, 247, 225, 0.84), rgba(255, 236, 188, 0.76)); }
.detail-row { display: grid; gap: 10px; padding: 12px 14px; border-radius: 16px; background: rgba(255, 255, 255, 0.78); border: 1px solid rgba(92, 66, 41, 0.1); }
.detail-row strong, .auction-grid strong { display: block; color: #26180d; }
.detail-row small { color: #7b6145; }
.auction-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.auction-grid div { display: grid; gap: 4px; }
.auction-grid span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #8f5d23; }
.paused-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(10, 6, 2, 0.6); display: grid; place-items: center; backdrop-filter: blur(4px); }
.paused-card { padding: 36px 48px; border-radius: 28px; background: linear-gradient(180deg, rgba(255, 252, 242, 0.98), rgba(244, 234, 210, 0.98)); border: 1px solid rgba(120, 90, 40, 0.2); box-shadow: 0 30px 60px rgba(30, 18, 6, 0.25); text-align: center; max-width: 420px; }
.rescue-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 40; padding: 12px 20px; background: linear-gradient(90deg, rgba(255, 220, 100, 0.96), rgba(255, 200, 60, 0.96)); color: #5a3a00; }
.rescue-banner--self { background: linear-gradient(90deg, rgba(255, 100, 100, 0.95), rgba(220, 60, 60, 0.95)); color: #fff; }
.event-info {
  padding: 12px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 247, 225, 0.84), rgba(255, 236, 188, 0.76));
  border: 1px solid rgba(92, 66, 41, 0.1);
  margin-bottom: 12px;
  text-align: center;
  font-weight: 500;
  color: #26180d;
}
.detail-card--casino { background: linear-gradient(180deg, rgba(255, 242, 200, 0.88), rgba(255, 220, 130, 0.78)); border: 1px solid rgba(184, 121, 58, 0.25); }
.casino-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.casino-stats div { display: grid; gap: 4px; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.55); }
.casino-stats span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #8f5d23; }
.casino-stats strong { font-size: 1.05rem; color: #26180d; font-weight: 700; }
.casino-top-row { display: flex; justify-content: flex-end; }
.casino-skip-btn { min-height: 32px; padding: 5px 16px; font-size: 0.82rem; }
.casino-hint { margin: 0; font-size: 0.76rem; color: #7b5a23; font-style: italic; line-height: 1.5; }
.casino-presets { display: flex; flex-wrap: wrap; gap: 8px; }
.casino-chip { padding: 7px 15px; border-radius: 999px; border: 2px solid rgba(184, 121, 58, 0.35); background: rgba(255, 255, 255, 0.72); font-family: 'Itim', cursive; font-size: 0.9rem; font-weight: 400; color: #8f5d23; cursor: pointer; transition: background 120ms, border-color 120ms, color 120ms; }
.casino-chip:hover { background: rgba(184, 121, 58, 0.18); border-color: rgba(184, 121, 58, 0.65); }
.casino-chip--active { background: #b8793a; border-color: #b8793a; color: #fff; }
@media (max-width: 1080px) { .game-scene { --drawer-width: 320px; } .auction-grid { grid-template-columns: 1fr; } }
@media (max-width: 900px) { .game-scene { --board-size: min(calc(100vw - 24px), calc(100vh - 24px)); } .game-scene.drawer-open .board-wrapper { transform: translate(-50%, -50%); } .side-drawer { width: min(100vw, 420px); } .game-scene.drawer-open .drawer-toggle { right: min(100vw, 420px); } }
@media (max-width: 720px) { .game-scene { --board-size: calc(100vw - 16px); } .drawer-toggle { top: auto; bottom: 80px; right: 0; transform: none; border-radius: 12px 0 0 12px; } .game-scene.drawer-open .drawer-toggle { right: 100vw; } .side-drawer { width: 100vw; padding: 18px 16px 24px; } .stats-grid { grid-template-columns: 1fr; } .button-row, .input-row { flex-direction: column; align-items: stretch; } }
</style>
