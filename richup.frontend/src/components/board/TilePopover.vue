<template>
  <Teleport to="body">
    <!-- Full-screen transparent backdrop: click anywhere outside closes the popover -->
    <div class="tp-backdrop" @click="close" />

    <article class="tp-card" :style="floatingStyle" @click.stop>

      <!-- ── Header ──────────────────────────────────────────── -->
      <header class="tp-header">
        <div v-if="colorHex" class="tp-color-pip" :style="{ background: colorHex }" />
        <div class="tp-header-body">
          <h3 class="tp-name">{{ displayName }}</h3>
        </div>
        <button class="tp-close-btn" type="button" aria-label="Close popover" @click="close">✕</button>
      </header>

      <!-- ── Mortgaged badge ───────────────────────────────────── -->
      <span v-if="tile.isMortgaged" class="tp-badge tp-badge--warn">Mortgaged</span>

      <!-- ── PROPERTY ────────────────────────────────────────── -->
      <template v-if="tile.type === 'PROPERTY'">
        <div class="tp-stat-row">
          <span>Base Price</span>
          <strong>${{ tile.basePrice ?? '—' }}</strong>
        </div>
        <div v-if="tile.mortgageValue" class="tp-stat-row">
          <span>Mortgage Value</span>
          <strong>${{ tile.mortgageValue }}</strong>
        </div>

        <div v-if="rentRows.length" class="tp-section">
          <p class="tp-section-title">Rent Schedule</p>
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
      </template>

      <!-- ── AIRPORT ─────────────────────────────────────────── -->
      <template v-else-if="tile.type === 'AIRPORT'">
        <div class="tp-stat-row">
          <span>Base Price</span>
          <strong>${{ tile.basePrice ?? '—' }}</strong>
        </div>
        <div v-if="tile.mortgageValue" class="tp-stat-row">
          <span>Mortgage Value</span>
          <strong>${{ tile.mortgageValue }}</strong>
        </div>
        <div v-if="tile.passThruToll" class="tp-stat-row">
          <span>Pass-thru Toll</span>
          <strong>${{ tile.passThruToll }}</strong>
        </div>
        <div v-if="tile.rentTable?.length" class="tp-section">
          <p class="tp-section-title">Toll by Network Size</p>
          <div v-for="(toll, i) in tile.rentTable" :key="i" class="tp-rent-row">
            <span>{{ i + 1 }} Airport{{ i > 0 ? 's' : '' }}</span>
            <strong>${{ toll }}</strong>
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

      <!-- ── Build actions (monopoly owner during their turn) ─── -->
      <div v-if="showBuildActions" class="tp-build-section">
        <p class="tp-section-title">Build Actions</p>
        <div class="tp-build-row">
          <button
            v-if="(tile.buildingLevel ?? 0) < 6"
            class="tp-btn tp-btn--upgrade"
            type="button"
            @click="handleUpgrade"
          >
            Upgrade
          </button>
          <button
            v-if="(tile.buildingLevel ?? 0) > 0"
            class="tp-btn tp-btn--downgrade"
            type="button"
            @click="handleDowngrade"
          >
            Sell / Downgrade
          </button>
        </div>
      </div>

      <!-- ── Mortgage actions (owner during their turn) ─────── -->
      <div v-if="showMortgageActions" class="tp-build-section">
        <p class="tp-section-title">Mortgage</p>
        <div class="tp-build-row">
          <button
            v-if="!tile.isMortgaged && (tile.buildingLevel ?? 0) === 0"
            class="tp-btn tp-btn--mortgage"
            type="button"
            @click="handleMortgage"
          >
            Mortgage (${{ tile.mortgageValue }})
          </button>
          <button
            v-if="tile.isMortgaged"
            class="tp-btn tp-btn--unmortgage"
            type="button"
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
import { computed, onMounted, onUnmounted } from 'vue';

import type { TilePublicView } from '@/types';
import type { TileSide } from './BoardView.vue';
import { buildHouse, buildHotel, sellBuilding, mortgageProperty, unmortgageProperty } from '@/socket/actions';
import { useGameStore } from '@/stores/useGameStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
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
const playersStore = usePlayersStore();
const selfStore    = useSelfStore();
const { clear }    = useTileSelection();

const close = () => clear();

// Close on Escape
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
onMounted(()  => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));

// ── Floating position ────────────────────────────────────────────────
// Strategy: position: fixed + getBoundingClientRect.
// Direction is derived from the `side` prop (already known from the grid layout).
// Corners open toward the viewport center.
const GAP = 10; // px gap between tile edge and popover

const floatingStyle = computed(() => {
  const r = props.anchorRect;
  const s = props.side;

  if (s === 'top') {
    // Tile is on the top row → popover opens downward, horizontally centered
    return {
      top:       `${r.bottom + GAP}px`,
      left:      `${r.left + r.width / 2}px`,
      transform: 'translateX(-50%)',
    };
  }
  if (s === 'bottom') {
    // Tile is on the bottom row → popover opens upward, horizontally centered
    return {
      top:       `${r.top - GAP}px`,
      left:      `${r.left + r.width / 2}px`,
      transform: 'translateX(-50%) translateY(-100%)',
    };
  }
  if (s === 'left') {
    // Tile is on the left column → popover opens to the right, vertically centered
    return {
      top:       `${r.top + r.height / 2}px`,
      left:      `${r.right + GAP}px`,
      transform: 'translateY(-50%)',
    };
  }
  if (s === 'right') {
    // Tile is on the right column → popover opens to the left, vertically centered
    return {
      top:       `${r.top + r.height / 2}px`,
      left:      `${r.left - GAP}px`,
      transform: 'translateX(-100%) translateY(-50%)',
    };
  }

  // corner: open diagonally toward the viewport center
  const goRight = r.left < window.innerWidth  / 2;
  const goDown  = r.top  < window.innerHeight / 2;
  const tx = goRight ? ''                : 'translateX(-100%)';
  const ty = goDown  ? ''                : 'translateY(-100%)';
  return {
    top:       goDown  ? `${r.bottom + GAP}px` : `${r.top  - GAP}px`,
    left:      goRight ? `${r.right  + GAP}px` : `${r.left - GAP}px`,
    transform: [tx, ty].filter(Boolean).join(' ') || 'none',
  };
});

// ── Display helpers ──────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  BROWN:      '#8B4513',
  LIGHT_BLUE: '#87CEEB',
  PINK:       '#FF69B4',
  ORANGE:     '#FFA500',
  RED:        '#FF0000',
  YELLOW:     '#FFD700',
  GREEN:      '#008000',
  DARK_BLUE:  '#00008B',
  PURPLE:     '#800080',
  TEAL:       '#008080',
  GRAY:       '#808080',
};

const colorHex = computed(() =>
  props.tile.colorGroup ? (GROUP_COLORS[props.tile.colorGroup] ?? null) : null,
);

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
  TAX:        'Pay a fixed tax to the bank when you land here.',
  SURPRISE:   'Draw a random event card — fortune or misfortune awaits.',
  GO:         'Pass to collect your pass-go bonus each lap.',
  JAIL:       'Visiting only — no penalty unless you are jailed.',
  GO_TO_JAIL: 'Land here and go directly to jail. Do not pass Go.',
  FREE:       'A safe haven — no rent, no fines, just rest.',
};

const specialDescription = computed(() => SPECIAL_DESC[props.tile.type] ?? 'Special tile.');

// ── Build actions ────────────────────────────────────────────────────
// Shown only when: current player owns ALL tiles in the color group (monopoly)
// AND the game is currently in BUILD_PHASE for that player.
const hasMonopoly = computed(() => {
  if (props.tile.type !== 'PROPERTY' || !props.tile.colorGroup) return false;
  if (props.tile.ownerId !== selfStore.id) return false;
  const group = gameStore.board.filter((t) => t.colorGroup === props.tile.colorGroup);
  return group.length > 0 && group.every((t) => t.ownerId === selfStore.id);
});

const isOwnTurn = computed(() =>
  (gameStore.currentPhase === 'WAITING_FOR_ACTION' || gameStore.currentPhase === 'END_TURN_PENDING') &&
  gameStore.currentTurnPlayerId === selfStore.id,
);

const showBuildActions = computed(() =>
  hasMonopoly.value && isOwnTurn.value,
);

const showMortgageActions = computed(() =>
  (props.tile.type === 'PROPERTY' || props.tile.type === 'AIRPORT') &&
  props.tile.ownerId === selfStore.id &&
  isOwnTurn.value &&
  ((props.tile.buildingLevel ?? 0) === 0 || !!props.tile.isMortgaged),
);

const unmortgageCost = computed(() =>
  Math.ceil((props.tile.mortgageValue ?? 0) * 1.1),
);

const handleUpgrade = () => {
  const level = props.tile.buildingLevel ?? 0;
  if (level < 4) buildHouse(props.tile.id);
  else           buildHotel(props.tile.id);
  close();
};

const handleDowngrade = () => {
  sellBuilding(props.tile.id);
  close();
};

const handleMortgage = () => {
  mortgageProperty(props.tile.id);
  close();
};

const handleUnmortgage = () => {
  unmortgageProperty(props.tile.id);
  close();
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
  width: 260px;
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
}

/* ── Header ────────────────────────────────────────────────────── */
.tp-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tp-color-pip {
  width: 10px;
  height: 38px;
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.tp-header-body {
  flex: 1;
  min-width: 0;
}

.tp-name {
  margin: 2px 0 0;
  font-family: 'Itim', cursive;
  font-size: 1.05rem;
  font-weight: 400;
  line-height: 1.2;
  color: #1f1208;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tp-close-btn {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: rgba(92, 66, 41, 0.1);
  color: #8f5d23;
  font-size: 0.68rem;
  cursor: pointer;
  transition: background 150ms;
}
.tp-close-btn:hover { background: rgba(92, 66, 41, 0.22); }

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

.tp-btn--upgrade            { background: #b8793a; color: #fff; }
.tp-btn--upgrade:hover      { background: #c98540; }
.tp-btn--downgrade          { background: #eadbc2; color: #4e3b27; }
.tp-btn--downgrade:hover    { background: #ddc8a0; }
.tp-btn--mortgage           { background: #c0392b; color: #fff; }
.tp-btn--mortgage:hover     { background: #e74c3c; }
.tp-btn--unmortgage         { background: #27ae60; color: #fff; }
.tp-btn--unmortgage:hover   { background: #2ecc71; }
</style>
