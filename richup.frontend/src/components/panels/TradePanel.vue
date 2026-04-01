<template>
  <section class="trade-panel">
    <div class="trade-header">
      <div>
        <p class="trade-eyebrow">Trade Desk</p>
        <h3 class="trade-title">Manage pending offers</h3>
      </div>
      <div class="trade-header-right">
        <span v-if="pendingCount > 0" class="trade-badge">{{ pendingCount }}</span>
        <button class="propose-btn" type="button" @click="showPropose = !showPropose">
          {{ showPropose ? 'Close' : 'New Trade' }}
        </button>
      </div>
    </div>

    <div v-if="showPropose" class="propose-form">
      <p class="form-section-label">Choose a player</p>
      <div class="player-select">
        <button
          v-for="player in otherActivePlayers"
          :key="player.id"
          class="player-btn"
          :class="{ 'player-btn--active': proposalResponderId === player.id }"
          :style="{ '--p-color': player.color }"
          type="button"
          @click="selectResponder(player.id)"
        >
          {{ player.nickname }}
        </button>
        <p v-if="otherActivePlayers.length === 0" class="empty-hint">No eligible players are available right now.</p>
      </div>

      <template v-if="proposalResponderId">
        <p class="form-section-label">Your offer</p>
        <div class="tile-select">
          <button
            v-for="tile in selfOwnedTiles"
            :key="tile.id"
            class="tile-btn"
            :class="{ 'tile-btn--active': proposerTileIds.includes(tile.id) }"
            type="button"
            @click="toggleTile(proposerTileIds, tile.id)"
          >
            {{ tile.name }}
          </button>
          <p v-if="selfOwnedTiles.length === 0" class="empty-hint">You do not own any tradable properties.</p>
        </div>
        <div class="cash-row">
          <label class="cash-label">Cash</label>
          <input v-model.number="proposerCash" type="number" min="0" class="cash-input" placeholder="0" />
        </div>

        <p class="form-section-label">Requested in return</p>
        <div class="tile-select">
          <button
            v-for="tile in responderOwnedTiles"
            :key="tile.id"
            class="tile-btn"
            :class="{ 'tile-btn--active': responderTileIds.includes(tile.id) }"
            type="button"
            @click="toggleTile(responderTileIds, tile.id)"
          >
            {{ tile.name }}
          </button>
          <p v-if="responderOwnedTiles.length === 0" class="empty-hint">That player does not own any tradable properties.</p>
        </div>
        <div class="cash-row">
          <label class="cash-label">Cash</label>
          <input v-model.number="responderCash" type="number" min="0" class="cash-input" placeholder="0" />
        </div>

        <button class="submit-btn" type="button" :disabled="!canPropose" @click="submitPropose">
          Send Trade Offer
        </button>
      </template>
    </div>

    <div v-if="gameStore.pendingTrades.length > 0" class="trade-list">
      <div
        v-for="trade in gameStore.pendingTrades"
        :key="trade.tradeId"
        class="trade-row"
        :class="`trade-row--${trade.status.toLowerCase()}`"
      >
        <div class="trade-row-header">
          <span class="trade-status-badge" :class="`status--${trade.status.toLowerCase()}`">
            {{ STATUS_LABELS[trade.status] ?? trade.status }}
          </span>
          <span class="trade-parties">{{ playerName(trade.proposerId) }} -> {{ playerName(trade.responderId) }}</span>
        </div>

        <div class="trade-tiles">
          <span class="trade-side">
            {{ playerName(trade.proposerId) }} offers
            <span v-if="trade.proposerTileIds.length > 0">{{ trade.proposerTileIds.map(tileName).join(', ') }}</span>
            <span v-else class="no-tiles">no property</span>
          </span>
          <span class="trade-arrow">for</span>
          <span class="trade-side">
            {{ playerName(trade.responderId) }} offers
            <span v-if="trade.responderTileIds.length > 0">{{ trade.responderTileIds.map(tileName).join(', ') }}</span>
            <span v-else class="no-tiles">no property</span>
          </span>
        </div>

        <div v-if="detailFor(trade.tradeId)" class="trade-detail">
          <span class="detail-item">Your side cash: ${{ detailFor(trade.tradeId)!.proposerOffer.cash ?? 0 }}</span>
          <span class="detail-item">Their side cash: ${{ detailFor(trade.tradeId)!.responderOffer.cash ?? 0 }}</span>
        </div>

        <div class="trade-actions">
          <template v-if="trade.responderId === selfStore.id && trade.status === 'PENDING'">
            <button class="action-btn action-btn--accept" type="button" @click="acceptTrade(trade.tradeId)">Accept</button>
            <button class="action-btn action-btn--reject" type="button" @click="rejectTrade(trade.tradeId)">Reject</button>
          </template>
          <template v-else-if="trade.proposerId === selfStore.id && trade.status === 'PENDING'">
            <button class="action-btn action-btn--cancel" type="button" @click="cancelTrade(trade.tradeId)">Cancel</button>
          </template>
        </div>
      </div>
    </div>

    <p v-else-if="!showPropose" class="no-trades">No trade offers are active.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  acceptTrade,
  cancelTrade,
  proposeTrade,
  rejectTrade,
} from '@/socket/actions';
import { useGameStore } from '@/stores/useGameStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { useSelfStore } from '@/stores/useSelfStore';
import type { TileId } from '@/types';

const selfStore = useSelfStore();
const playersStore = usePlayersStore();
const gameStore = useGameStore();

const showPropose = ref(false);
const proposalResponderId = ref<string | null>(null);
const proposerTileIds = ref<TileId[]>([]);
const responderTileIds = ref<TileId[]>([]);
const proposerCash = ref(0);
const responderCash = ref(0);

const pendingCount = computed(
  () => gameStore.pendingTrades.filter((t) => t.status === 'PENDING').length,
);

const otherActivePlayers = computed(() =>
  playersStore.playerList.filter((p) => p.id !== selfStore.id && p.status === 'ACTIVE'),
);

const selfOwnedTiles = computed(() => gameStore.board.filter((t) => t.ownerId === selfStore.id));

const responderOwnedTiles = computed(() => {
  if (!proposalResponderId.value) return [];
  return gameStore.board.filter((t) => t.ownerId === proposalResponderId.value);
});

const canPropose = computed(
  () =>
    proposalResponderId.value !== null &&
    (proposerTileIds.value.length > 0 || responderTileIds.value.length > 0 || proposerCash.value > 0 || responderCash.value > 0),
);

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  VOIDED: 'Voided',
};

const playerName = (id: string): string =>
  playersStore.players[id]?.nickname ?? id.slice(0, 8);

const tileName = (id: TileId): string =>
  gameStore.boardById[id]?.name ?? `Tile ${id}`;

const detailFor = (tradeId: string) => (
  gameStore.activeTradeDetail?.tradeId === tradeId ? gameStore.activeTradeDetail : null
);

const selectResponder = (playerId: string): void => {
  proposalResponderId.value = playerId;
  proposerTileIds.value = [];
  responderTileIds.value = [];
};

const toggleTile = (list: TileId[], tileId: TileId): void => {
  const idx = list.indexOf(tileId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(tileId);
  }
};

const submitPropose = (): void => {
  if (!proposalResponderId.value) return;

  proposeTrade({
    responderId: proposalResponderId.value,
    proposerOffer: {
      cash: proposerCash.value || undefined,
      tileIds: [...proposerTileIds.value],
    },
    responderOffer: {
      cash: responderCash.value || undefined,
      tileIds: [...responderTileIds.value],
    },
  });

  showPropose.value = false;
  proposalResponderId.value = null;
  proposerTileIds.value = [];
  responderTileIds.value = [];
  proposerCash.value = 0;
  responderCash.value = 0;
};
</script>

<style scoped>
.trade-panel {
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(252, 250, 242, 0.97), rgba(240, 234, 215, 0.96));
  border: 1px solid rgba(120, 90, 40, 0.18);
  box-shadow: 0 14px 30px rgba(90, 65, 25, 0.07);
  display: grid;
  gap: 14px;
}

.trade-header,
.trade-header-right,
.trade-row-header,
.trade-actions,
.cash-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trade-header,
.trade-row-header {
  justify-content: space-between;
}

.trade-eyebrow {
  margin: 0 0 2px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8f5d23;
}

.trade-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #26180d;
}

.trade-badge,
.trade-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.trade-badge {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #c0392b;
  color: #fff;
  font-size: 0.78rem;
}

.propose-btn,
.submit-btn,
.action-btn {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.propose-btn,
.submit-btn {
  padding: 8px 14px;
  border-radius: 999px;
  background: #1f1a14;
  color: #fff7ed;
  font-size: 0.85rem;
  font-weight: 700;
}

.propose-form,
.trade-row,
.trade-detail {
  display: grid;
  gap: 10px;
}

.propose-form {
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 252, 244, 0.8);
  border: 1px solid rgba(120, 90, 40, 0.12);
}

.form-section-label,
.trade-status-badge {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.form-section-label {
  margin: 0;
  color: #8f5d23;
}

.player-select,
.tile-select,
.trade-list,
.trade-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.trade-list {
  display: grid;
  gap: 10px;
}

.player-btn,
.tile-btn,
.cash-input {
  font: inherit;
  color: #26180d;
}

.player-btn,
.tile-btn {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1.5px solid rgba(120, 90, 40, 0.25);
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.player-btn--active,
.tile-btn--active {
  background: #1f1a14;
  border-color: #1f1a14;
  color: #fff7ed;
}

.player-btn {
  border-color: var(--p-color, rgba(120, 90, 40, 0.25));
}

.cash-label {
  font-size: 0.8rem;
  color: #4e3b27;
  white-space: nowrap;
}

.cash-input {
  width: 90px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(120, 90, 40, 0.25);
  background: #fff7ed;
  outline: none;
}

.cash-input:focus {
  border-color: #8f5d23;
}

.submit-btn:disabled {
  background: #b0a590;
  cursor: not-allowed;
}

.trade-row {
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(120, 90, 40, 0.12);
}

.status--pending { background: rgba(200, 160, 30, 0.2); color: #7a5f00; }
.status--accepted { background: rgba(30, 160, 80, 0.15); color: #135a30; }
.status--rejected,
.status--cancelled,
.status--voided { background: rgba(160, 40, 40, 0.12); color: #7a1a1a; }
.status--completed { background: rgba(30, 80, 200, 0.1); color: #13306a; }

.trade-parties,
.trade-tiles,
.trade-detail {
  font-size: 0.8rem;
  color: #4e3b27;
}

.trade-arrow {
  font-weight: 700;
  color: #8f5d23;
}

.no-tiles,
.no-trades,
.empty-hint {
  color: #9b8a78;
  font-style: italic;
}

.trade-detail {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 248, 220, 0.7);
}

.action-btn {
  flex: 1;
  padding: 8px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
}

.action-btn--accept { background: #1a6b3c; color: #fff; }
.action-btn--reject { background: #8b1c1c; color: #fff; }
.action-btn--cancel { background: #eadbc2; color: #4e3b27; }

.no-trades,
.empty-hint {
  margin: 0;
  font-size: 0.82rem;
}
</style>
