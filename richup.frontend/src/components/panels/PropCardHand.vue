<template>
  <section v-if="selfStore.propCards.length > 0" class="prop-hand">
    <p class="hand-eyebrow">Prop Cards</p>
    <div class="hand-list">
      <div v-for="card in selfStore.propCards" :key="card.id" class="prop-card">
        <div class="prop-card-body">
          <span class="prop-card-icon">{{ CARD_ICONS[card.type] }}</span>
          <div class="prop-card-info">
            <p class="prop-card-label">{{ CARD_LABELS[card.type] }}</p>
            <p class="prop-card-desc">{{ CARD_DESCS[card.type] }}</p>
          </div>
        </div>

        <div v-if="activeCard?.id === card.id" class="prop-card-target">
          <template v-if="card.type === PropCardType.REMOTE_DICE">
            <p class="target-hint">Pick the step count.</p>
            <div class="steps-row">
              <button
                v-for="steps in ([5, 6, 7] as const)"
                :key="steps"
                class="step-btn"
                :class="{ 'step-btn--active': selectedSteps === steps }"
                type="button"
                @click="selectedSteps = steps"
              >
                {{ steps }}
              </button>
            </div>
            <div class="target-actions">
              <button class="confirm-btn" type="button" :disabled="selectedSteps === null" @click="confirmUse(card)">Use Card</button>
              <button class="cancel-btn" type="button" @click="cancelTarget">Cancel</button>
            </div>
          </template>

          <template v-else-if="card.type === PropCardType.PLUNDER || card.type === PropCardType.AUDIT">
            <p class="target-hint">Choose a target player.</p>
            <div class="player-select">
              <button
                v-for="player in otherActivePlayers"
                :key="player.id"
                class="player-btn"
                :class="{ 'player-btn--active': selectedTargetPlayerId === player.id }"
                :style="{ '--p-color': player.color }"
                type="button"
                @click="selectedTargetPlayerId = player.id"
              >
                {{ player.nickname }}
              </button>
            </div>
            <div class="target-actions">
              <button class="confirm-btn" type="button" :disabled="!selectedTargetPlayerId" @click="confirmUse(card)">Use Card</button>
              <button class="cancel-btn" type="button" @click="cancelTarget">Cancel</button>
            </div>
          </template>

          <template v-else-if="card.type === PropCardType.FORCED_TRADE">
            <template v-if="!selectedTargetPlayerId">
              <p class="target-hint">Choose a target player.</p>
              <div class="player-select">
                <button
                  v-for="player in otherActivePlayers"
                  :key="player.id"
                  class="player-btn"
                  :class="{ 'player-btn--active': selectedTargetPlayerId === player.id }"
                  :style="{ '--p-color': player.color }"
                  type="button"
                  @click="selectedTargetPlayerId = player.id"
                >
                  {{ player.nickname }}
                </button>
              </div>
              <button class="cancel-btn" type="button" @click="cancelTarget">Cancel</button>
            </template>
            <template v-else>
              <p class="target-hint">Choose one unbuilt property from {{ playersStore.players[selectedTargetPlayerId]?.nickname }}.</p>
              <div class="tile-select">
                <button
                  v-for="tile in targetUnbuiltTiles"
                  :key="tile.id"
                  class="tile-btn"
                  :class="{ 'tile-btn--active': selectedTargetTileId === tile.id }"
                  type="button"
                  @click="selectedTargetTileId = tile.id"
                >
                  {{ tile.name }}
                </button>
                <p v-if="targetUnbuiltTiles.length === 0" class="no-tiles">That player has no eligible properties.</p>
              </div>
              <div class="target-actions">
                <button class="confirm-btn" type="button" :disabled="!selectedTargetTileId" @click="confirmUse(card)">Use Card</button>
                <button class="cancel-btn" type="button" @click="selectedTargetPlayerId = null; selectedTargetTileId = null">Back</button>
              </div>
            </template>
          </template>
        </div>

        <button v-else class="use-btn" type="button" :disabled="!canUseCard" @click="startUse(card)">
          Use Card
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { usePropCard } from '@/socket/actions';
import { useGameStore } from '@/stores/useGameStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { useSelfStore } from '@/stores/useSelfStore';
import { PropCardType } from '@/types';
import type { PropCard } from '@/types';

const selfStore = useSelfStore();
const playersStore = usePlayersStore();
const gameStore = useGameStore();

const activeCard = ref<PropCard | null>(null);
const selectedTargetPlayerId = ref<string | null>(null);
const selectedTargetTileId = ref<number | null>(null);
const selectedSteps = ref<5 | 6 | 7 | null>(null);

const canUseCard = computed(() => {
  const phase = gameStore.currentPhase;
  return gameStore.currentTurnPlayerId === selfStore.id && (phase === 'WAITING_FOR_ACTION' || phase === 'END_TURN_PENDING');
});

const otherActivePlayers = computed(() =>
  playersStore.playerList.filter((p) => p.id !== selfStore.id && p.status === 'ACTIVE'),
);

const targetUnbuiltTiles = computed(() => {
  if (!selectedTargetPlayerId.value) return [];
  return gameStore.board.filter((t) => t.ownerId === selectedTargetPlayerId.value && (t.buildingLevel ?? 0) === 0);
});

const CARD_ICONS: Record<string, string> = {
  [PropCardType.FORCED_TRADE]: 'FT',
  [PropCardType.REMOTE_DICE]: 'RD',
  [PropCardType.PLUNDER]: 'PL',
  [PropCardType.IMMUNITY]: 'IM',
  [PropCardType.AUDIT]: 'AU',
  [PropCardType.PRICE_HIKE]: 'PH',
};

const CARD_LABELS: Record<string, string> = {
  [PropCardType.FORCED_TRADE]: 'Forced Trade',
  [PropCardType.REMOTE_DICE]: 'Remote Dice',
  [PropCardType.PLUNDER]: 'Plunder',
  [PropCardType.IMMUNITY]: 'Immunity',
  [PropCardType.AUDIT]: 'Audit',
  [PropCardType.PRICE_HIKE]: 'Price Hike',
};

const CARD_DESCS: Record<string, string> = {
  [PropCardType.FORCED_TRADE]: 'Claim one unbuilt property from another player.',
  [PropCardType.REMOTE_DICE]: 'Choose a direct movement value of 5, 6, or 7.',
  [PropCardType.PLUNDER]: 'Take cash from another player.',
  [PropCardType.IMMUNITY]: 'Negate one hostile effect that targets you.',
  [PropCardType.AUDIT]: 'Inspect and pressure another player financially.',
  [PropCardType.PRICE_HIKE]: 'Increase your pass-through rent multiplier for one turn.',
};

const startUse = (card: PropCard): void => {
  const needsTarget = [
    PropCardType.FORCED_TRADE,
    PropCardType.REMOTE_DICE,
    PropCardType.PLUNDER,
    PropCardType.AUDIT,
  ].includes(card.type);

  if (!needsTarget) {
    usePropCard({ cardId: card.id, cardType: card.type });
    return;
  }

  activeCard.value = card;
  selectedTargetPlayerId.value = null;
  selectedTargetTileId.value = null;
  selectedSteps.value = null;
};

const confirmUse = (card: PropCard): void => {
  const payload: Parameters<typeof usePropCard>[0] = {
    cardId: card.id,
    cardType: card.type,
  };

  if (card.type === PropCardType.REMOTE_DICE && selectedSteps.value) {
    payload.steps = selectedSteps.value;
  } else if ((card.type === PropCardType.PLUNDER || card.type === PropCardType.AUDIT) && selectedTargetPlayerId.value) {
    payload.targetPlayerId = selectedTargetPlayerId.value;
  } else if (card.type === PropCardType.FORCED_TRADE && selectedTargetPlayerId.value && selectedTargetTileId.value != null) {
    payload.targetPlayerId = selectedTargetPlayerId.value;
    payload.targetTileId = selectedTargetTileId.value;
  }

  usePropCard(payload);
  cancelTarget();
};

const cancelTarget = (): void => {
  activeCard.value = null;
  selectedTargetPlayerId.value = null;
  selectedTargetTileId.value = null;
  selectedSteps.value = null;
};
</script>

<style scoped>
.prop-hand {
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(248, 250, 255, 0.97), rgba(228, 235, 255, 0.96));
  border: 1px solid rgba(80, 100, 180, 0.18);
  box-shadow: 0 14px 30px rgba(60, 80, 160, 0.07);
  display: grid;
  gap: 12px;
}

.hand-eyebrow {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #4050a0;
}

.hand-list,
.prop-card,
.prop-card-target {
  display: grid;
  gap: 10px;
}

.prop-card {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(80, 100, 180, 0.14);
}

.prop-card-body,
.target-actions {
  display: flex;
  gap: 10px;
}

.prop-card-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2d3b8f;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.prop-card-label {
  margin: 0 0 2px;
  font-size: 0.88rem;
  font-weight: 700;
  color: #26180d;
}

.prop-card-desc,
.target-hint,
.no-tiles {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5a5070;
}

.use-btn,
.confirm-btn {
  width: 100%;
  padding: 8px;
  border-radius: 999px;
  border: 0;
  background: #2d3b8f;
  color: #fff;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.use-btn:disabled,
.confirm-btn:disabled {
  background: #b0b8d8;
  cursor: not-allowed;
}

.steps-row,
.player-select,
.tile-select {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.step-btn,
.player-btn,
.tile-btn,
.cancel-btn {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid rgba(80, 100, 180, 0.3);
  background: rgba(255, 255, 255, 0.8);
  color: #26180d;
  font: inherit;
  cursor: pointer;
}

.step-btn--active,
.player-btn--active,
.tile-btn--active {
  background: #2d3b8f;
  border-color: #2d3b8f;
  color: #fff;
}

.player-btn {
  border-color: var(--p-color, rgba(80, 100, 180, 0.3));
}

.cancel-btn {
  color: #4050a0;
}
</style>
