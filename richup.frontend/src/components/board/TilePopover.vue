<template>
  <Teleport to="body">
    <!-- Full-screen transparent backdrop: click anywhere outside closes the popover -->
    <div class="tp-backdrop" @click="close" />

    <article ref="floatingEl" class="tp-card" :style="floatingStyles" @click.stop>

      <!-- ── Header ──────────────────────────────────────────── -->
      <header class="tp-header">
        <h3 class="tp-name">{{ displayName }}</h3>
      </header>

      <!-- ── PROPERTY ────────────────────────────────────────── -->
      <template v-if="tile.type === 'PROPERTY'">
        <div class="tp-stat-row">
          <span>Base Price</span>
          <strong>${{ tile.basePrice ?? '—' }}</strong>
        </div>
        <div v-if="tile.mortgageValue != null" class="tp-stat-row">
          <span>Mortgage Price</span>
          <strong>${{ tile.mortgageValue }}</strong>
        </div>
        <div v-if="tile.buildCost != null" class="tp-stat-row">
          <span>Upgrade Price</span>
          <strong>${{ tile.buildCost }}</strong>
        </div>

        <div v-if="rentRows.length" class="tp-section">
          <p class="tp-section-title">Rent Schedule</p>
          <div class="tp-rent-list">
            <div
              v-for="row in rentRows"
              :key="row.label"
              class="tp-rent-row"
              :class="{ 'tp-rent-row--current': row.current }"
            >
              <span>{{ row.label }}</span>
              <strong>${{ row.amount }}</strong>
            </div>
          </div>
        </div>
      </template>

      <!-- ── AIRPORT ─────────────────────────────────────────── -->
      <template v-else-if="tile.type === 'AIRPORT'">
        <div class="tp-stat-row">
          <span>Base Price</span>
          <strong>${{ tile.basePrice ?? '—' }}</strong>
        </div>
        <div v-if="tile.passThruToll" class="tp-stat-row">
          <span>Pass-thru Toll</span>
          <strong>${{ tile.passThruToll }}</strong>
        </div>
        <div v-if="tile.rentTable?.length" class="tp-section">
          <p class="tp-section-title">Toll by Network Size</p>
          <div class="tp-rent-list">
            <div
              v-for="(toll, i) in tile.rentTable"
              :key="i"
              class="tp-rent-row"
              :class="{ 'tp-rent-row--current': tile.ownerId != null && i === ownerAirportCount - 1 }"
            >
              <span>{{ i + 1 }} Airport{{ i > 0 ? 's' : '' }}</span>
              <strong>${{ toll }}</strong>
            </div>
          </div>
        </div>
      </template>

      <!-- ── TEMPLE ──────────────────────────────────────────── -->
      <template v-else-if="tile.type === 'TEMPLE'">
        <div class="tp-stat-row">
          <span>Purchase Price</span>
          <strong>${{ tile.basePrice ?? '—' }}</strong>
        </div>
        <div v-if="tile.prayFee" class="tp-stat-row">
          <span>Pray Fee</span>
          <strong>${{ tile.prayFee }}</strong>
        </div>
        <div class="tp-badge" :class="tile.isLit ? 'tp-badge--lit' : 'tp-badge--quiet'">
          {{ tile.isLit ? '🔆 Temple is Lit — Blessing Active' : '🕯 Temple is Quiet' }}
        </div>
      </template>

      <!-- ── CASINO ──────────────────────────────────────────── -->
      <template v-else-if="tile.type === 'CASINO'">
        <div v-if="tile.maxBet" class="tp-stat-row">
          <span>Max Bet</span>
          <strong>${{ tile.maxBet }}</strong>
        </div>
        <div v-if="tile.betMultiple" class="tp-stat-row">
          <span>Payout Multiplier</span>
          <strong>×{{ tile.betMultiple }}</strong>
        </div>
      </template>

      <!-- ── Special tiles ───────────────────────────────────── -->
      <template v-else>
        <p class="tp-description">{{ specialDescription }}</p>
      </template>

      <!-- Property management lives on the tile card so the board remains the single source of action. -->
      <div v-if="showManagementActions" class="tp-build-section">
        <p class="tp-section-title">Property Actions</p>

        <div v-if="tile.type === 'PROPERTY'" class="tp-build-row tp-build-row--management">
          <button
            class="tp-btn tp-icon-btn tp-btn--upgrade"
            type="button"
            aria-label="Upgrade property"
            :disabled="!canUpgrade"
            :title="upgradeDisabledReason"
            @click="handleUpgrade"
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            class="tp-btn tp-icon-btn tp-btn--downgrade"
            type="button"
            aria-label="Downgrade property"
            :disabled="!canLiquidate || (tile.buildingLevel ?? 0) === 0"
            :title="canLiquidate ? 'Sell one building for rescue cash.' : 'Selling is available during your turn or rescue.'"
            @click="handleDowngrade"
          >
            <span aria-hidden="true">↓</span>
          </button>
        </div>

        <p
          v-if="tile.type === 'PROPERTY' && !hasMonopoly"
          class="tp-action-hint"
          :class="{ 'tp-action-hint--highlight': hintHighlighted }"
          aria-live="polite"
        >
          Own every city in this country first.
        </p>

        <div v-if="tile.type === 'PROPERTY'" class="tp-build-row">
          <button
            v-if="!tile.isMortgaged && (tile.buildingLevel ?? 0) === 0"
            class="tp-btn tp-btn--mortgage"
            type="button"
            :disabled="!canLiquidate"
            :title="canLiquidate ? 'Mortgage this property for cash.' : 'Mortgage is available during your turn or rescue.'"
            @click="handleMortgage"
          >
            Mortgage (${{ tile.mortgageValue ?? '?' }})
          </button>
          <button
            v-if="tile.isMortgaged"
            class="tp-btn tp-btn--unmortgage"
            type="button"
            :disabled="!isOwnTurn || selfStore.cash < unmortgageCost"
            :title="!isOwnTurn ? 'Unmortgaging is available during your turn.' : `Requires $${unmortgageCost}.`"
            @click="handleUnmortgage"
          >
            Unmortgage (${{ unmortgageCost }})
          </button>
        </div>
      </div>

    </article>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useFloating, offset, shift } from '@floating-ui/vue';
import type { Placement } from '@floating-ui/vue';

import type { TilePublicView } from '@/types';
import type { TileSide } from './BoardView.vue';
import { buildHouse, buildHotel, sellBuilding, mortgageProperty, unmortgageProperty } from '@/socket/actions';
import { useGameStore } from '@/stores/useGameStore';
import { useSelfStore } from '@/stores/useSelfStore';
import { useTileSelection } from '@/composables/useTileSelection';

// ── Props ────────────────────────────────────────────────────────────
const props = defineProps<{
  tile: TilePublicView;
  /** Pre-translated display name (computed in BoardTile to avoid duplicating the map). */
  displayName: string;
  /** Bounding rect of the tile element, captured at click time. */
  anchorRect: DOMRect;
  /** Which edge the tile sits on — drives popover placement direction. */
  side: TileSide;
  /** Hex color of the tile's owner, if any (passed from BoardView). */
  ownerColor?: string;
}>();

// ── Stores & selection ───────────────────────────────────────────────
const gameStore    = useGameStore();
const selfStore    = useSelfStore();
const { clear }    = useTileSelection();
const hintHighlighted = ref(false);
let hintTimer: ReturnType<typeof setTimeout> | null = null;

const close = () => clear();

// Close on Escape
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
onMounted(()  => document.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  if (hintTimer) clearTimeout(hintTimer);
});

// ── Floating UI positioning ──────────────────────────────────────────

const floatingEl = ref<HTMLElement | null>(null);

/** Virtual reference element wrapping the anchor DOMRect captured at click time. */
const virtualRef = computed(() => ({
  getBoundingClientRect: () => props.anchorRect,
}));

/** Map tile side → Floating UI placement so the popover opens toward the board center. */
const floatingPlacement = computed((): Placement => {
  const s = props.side;
  if (s === 'top')    return 'bottom';
  if (s === 'bottom') return 'top';
  if (s === 'left')   return 'right';
  if (s === 'right')  return 'left';
  // corner: open diagonally toward the viewport center
  const r = props.anchorRect;
  const goRight = r.left < window.innerWidth  / 2;
  const goDown  = r.top  < window.innerHeight / 2;
  if (goRight && goDown)  return 'bottom-start';
  if (goRight && !goDown) return 'top-start';
  if (!goRight && goDown) return 'bottom-end';
  return 'top-end';
});

const { floatingStyles } = useFloating(virtualRef, floatingEl, {
  placement: floatingPlacement,
  middleware: [
    offset(10),
    shift({ padding: 12, crossAxis: true }),
  ],
  strategy: 'fixed',
});

// ── Airport: owner's current airport count (for toll highlight) ───────
const ownerAirportCount = computed(() => {
  if (props.tile.type !== 'AIRPORT' || props.tile.ownerId == null) return 0;
  return gameStore.board.filter(
    (t) => t.type === 'AIRPORT' && t.ownerId === props.tile.ownerId && !t.isMortgaged,
  ).length;
});

// ── Rent table (PROPERTY only) ───────────────────────────────────────
interface RentRow { label: string; amount: number; current: boolean }

const rentRows = computed((): RentRow[] => {
  if (props.tile.type !== 'PROPERTY') return [];
  const level = props.tile.buildingLevel ?? 0;
  const rows: RentRow[] = [];

  if (props.tile.baseRent != null) {
    rows.push({ label: 'Vacant', amount: props.tile.baseRent, current: level === 0 });
  }
  if (props.tile.baseRentWithMonopoly != null) {
    rows.push({ label: 'Monopoly (no buildings)', amount: props.tile.baseRentWithMonopoly, current: false });
  }
  // rentByLevel[0] is the vacant rent (identical to baseRent), already shown above — skip it.
  const byLevel = (props.tile.rentByLevel ?? []).slice(1);
  const labels  = ['1 House', '2 Houses', '3 Houses', '4 Houses', 'Hotel', 'Landmark'];
  byLevel.forEach((rent, i) => {
    rows.push({ label: labels[i] ?? `Level ${i + 2}`, amount: rent, current: level === i + 1 });
  });

  return rows;
});

// ── Special tile descriptions ────────────────────────────────────────
const SPECIAL_DESC: Record<string, string> = {
  TAX:        'Pay a random tax rate of 5% to 15% when you land here.',
  SURPRISE:   'Draw a random event card — fortune or misfortune awaits.',
  GO:         'Pass to collect your pass-go bonus each lap.\nExtra bonus if you land exactly here.',
  JAIL:       'Visiting only — no penalty unless you are jailed.',
  GO_TO_JAIL: 'Land here and go directly to jail. Do not pass Go.',
  FREE:       'A safe haven — no rent, no fines, just rest.',
};

const specialDescription = computed(() => SPECIAL_DESC[props.tile.type] ?? 'Special tile.');

// ── Build actions ────────────────────────────────────────────────────
const hasMonopoly = computed(() => {
  if (props.tile.type !== 'PROPERTY' || !props.tile.colorGroup) return false;
  if (props.tile.ownerId !== selfStore.id) return false;
  const group = gameStore.board.filter((t) => t.colorGroup === props.tile.colorGroup);
  return group.length > 0 && group.every((t) => t.ownerId === selfStore.id);
});

const lowestGroupLevel = computed(() => {
  if (props.tile.type !== 'PROPERTY' || !props.tile.colorGroup) return 0;
  const levels = gameStore.board
    .filter((tile) => tile.type === 'PROPERTY' && tile.colorGroup === props.tile.colorGroup && tile.ownerId === selfStore.id)
    .map((tile) => tile.buildingLevel ?? 0);
  return levels.length > 0 ? Math.min(...levels) : 0;
});

const isOwnTurn = computed(() =>
  (gameStore.currentPhase === 'WAITING_FOR_ACTION' || gameStore.currentPhase === 'END_TURN_PENDING') &&
  gameStore.currentTurnPlayerId === selfStore.id,
);

const isRescueTurn = computed(() =>
  gameStore.currentPhase === 'DYING_RESCUE' &&
  gameStore.dyingPlayerId === selfStore.id &&
  gameStore.currentTurnPlayerId === selfStore.id,
);

const canLiquidate = computed(() => isOwnTurn.value || isRescueTurn.value);

const showManagementActions = computed(() =>
  props.tile.type === 'PROPERTY' &&
  props.tile.ownerId === selfStore.id,
);

const canUpgrade = computed(() => {
  if (props.tile.type !== 'PROPERTY' || props.tile.isMortgaged) return false;
  const level = props.tile.buildingLevel ?? 0;
  return isOwnTurn.value && hasMonopoly.value && level < 6 && level === lowestGroupLevel.value &&
    selfStore.cash >= (props.tile.buildCost ?? Number.POSITIVE_INFINITY);
});

const highlightGroupHint = () => {
  hintHighlighted.value = true;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    hintHighlighted.value = false;
    hintTimer = null;
  }, 1800);
};

const upgradeDisabledReason = computed(() => {
  if (!isOwnTurn.value) return 'Building is available during your turn.';
  if (props.tile.isMortgaged) return 'Unmortgage this property before building.';
  if (!hasMonopoly.value) return 'Own every city in this country first.';
  if ((props.tile.buildingLevel ?? 0) !== lowestGroupLevel.value) return 'Build evenly across this colour group.';
  if (selfStore.cash < (props.tile.buildCost ?? Number.POSITIVE_INFINITY)) return 'Not enough cash.';
  return 'Maximum building level reached.';
});

const unmortgageCost = computed(() =>
  Math.ceil((props.tile.mortgageValue ?? 0) * 1.1),
);

const handleUpgrade = () => {
  if (!hasMonopoly.value) {
    highlightGroupHint();
    return;
  }
  if (!canUpgrade.value) return;
  const level = props.tile.buildingLevel ?? 0;
  if (level < 4) buildHouse(props.tile.id);
  else           buildHotel(props.tile.id);
};

const handleDowngrade = () => {
  if (!canLiquidate.value || (props.tile.buildingLevel ?? 0) === 0) return;
  sellBuilding(props.tile.id);
};

const handleMortgage = () => {
  if (!canLiquidate.value) return;
  mortgageProperty(props.tile.id);
};

const handleUnmortgage = () => {
  if (!isOwnTurn.value || selfStore.cash < unmortgageCost.value) return;
  unmortgageProperty(props.tile.id);
};
</script>

<style scoped>
/* ── Backdrop ──────────────────────────────────────────────────── */
.tp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  /* transparent — only captures pointer events */
}

/* ── Card shell ────────────────────────────────────────────────── */
.tp-card {
  position: fixed;
  z-index: 1001;
  width: min(294px, calc(100vw - 24px));
  box-sizing: border-box;
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(170deg, rgba(255, 252, 245, 0.98), rgba(243, 233, 214, 0.98));
  border: 1px solid rgba(92, 66, 41, 0.16);
  box-shadow:
    0 8px 32px rgba(55, 36, 17, 0.18),
    0 2px 8px  rgba(0, 0, 0, 0.08);
  font-family: 'Itim', cursive;
  color: #26180d;
  max-height: min(88vh, 720px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 93, 35, 0.28) transparent;
}

/* ── Header ────────────────────────────────────────────────────── */
.tp-header {
  display: flex;
  align-items: center;
}

.tp-name {
  margin: 0;
  font-family: 'Itim', cursive;
  font-size: 1.05rem;
  font-weight: 400;
  line-height: 1.2;
  color: #1f1208;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Stat rows ─────────────────────────────────────────────────── */
.tp-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.52);
  font-size: 0.82rem;
}
.tp-stat-row span   { color: #6b5540; }
.tp-stat-row strong { color: #1f1208; }

/* ── Sections (rent table, etc.) ───────────────────────────────── */
.tp-section {
  display: grid;
  gap: 3px;
}

.tp-section-title {
  margin: 0 0 4px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8f5d23;
}

/* ── Rent list: scrollable with CSS fallback ───────────────────── */
.tp-rent-list {
  display: grid;
  gap: 3px;
  max-height: 50vh;
  overflow-y: auto;
  /* Custom scrollbar — thin & translucent */
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 93, 35, 0.28) transparent;
}
.tp-rent-list::-webkit-scrollbar {
  width: 4px;
}
.tp-rent-list::-webkit-scrollbar-track {
  background: transparent;
}
.tp-rent-list::-webkit-scrollbar-thumb {
  background: rgba(139, 93, 35, 0.28);
  border-radius: 999px;
}
.tp-rent-list::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 93, 35, 0.50);
}

/* ── Rent rows ─────────────────────────────────────────────────── */
.tp-rent-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  border-radius: 7px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.4);
  color: #5c4432;
}
.tp-rent-row strong { color: inherit; }

.tp-rent-row--current {
  background: rgba(184, 121, 58, 0.16);
  color: #1f1208;
  font-weight: 700;
}

/* ── Badges ────────────────────────────────────────────────────── */
.tp-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}
.tp-badge--warn  { background: rgba(200, 100, 30, 0.12); color: #a05020; }
.tp-badge--lit   { background: rgba(255, 200, 50,  0.2);  color: #7a5500; }
.tp-badge--quiet { background: rgba(100, 100, 100, 0.1);  color: #555;    }

/* ── Description (special tiles) ──────────────────────────────── */
.tp-description {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.55;
  color: #5c4432;
  white-space: pre-line;
}

/* ── Build actions ─────────────────────────────────────────────── */
.tp-build-section {
  border-top: 1px solid rgba(92, 66, 41, 0.12);
  padding-top: 10px;
  display: grid;
  gap: 8px;
}

.tp-build-row {
  display: flex;
  gap: 8px;
}

.tp-build-row--management {
  align-items: center;
  justify-content: space-between;
  gap: 0;
  width: 100%;
}

.tp-btn {
  flex: 1;
  min-height: 36px;
  border: none;
  border-radius: 999px;
  font-family: 'Itim', cursive;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 150ms, transform 100ms;
}
.tp-btn:active { transform: scale(0.97); }
.tp-icon-btn {
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  min-height: 46px;
  padding: 0;
  display: inline-grid;
  place-items: center;
  font-family: Arial, sans-serif;
  font-size: 1.65rem;
  font-weight: 700;
  line-height: 1;
  border: 1px solid rgba(92, 66, 41, 0.16);
  border-radius: 50%;
  box-shadow: 0 4px 10px rgba(55, 36, 17, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: background 150ms, transform 120ms, box-shadow 150ms;
}
.tp-icon-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(55, 36, 17, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
.tp-icon-btn:active {
  transform: translateY(0) scale(0.94);
}
.tp-action-hint {
  margin: -2px 0 0;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 0.72rem;
  line-height: 1.35;
  color: #8b7358;
  text-align: center;
  transition: color 150ms, background 150ms, border-color 150ms, box-shadow 150ms;
}
.tp-action-hint--highlight {
  color: #7a1f12;
  background: rgba(225, 83, 62, 0.16);
  border-color: rgba(192, 57, 43, 0.42);
  box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.08);
}

.tp-btn--upgrade            { background: #b8793a; color: #fff; }
.tp-btn--upgrade:hover      { background: #c98540; }
.tp-btn--downgrade          { background: #eadbc2; color: #4e3b27; }
.tp-btn--downgrade:hover    { background: #ddc8a0; }
.tp-btn--mortgage           { background: #c0392b; color: #fff; }
.tp-btn--mortgage:hover     { background: #e74c3c; }
.tp-btn--unmortgage         { background: #27ae60; color: #fff; }
.tp-btn--unmortgage:hover   { background: #2ecc71; }
</style>
