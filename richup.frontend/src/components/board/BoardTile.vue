<template>
  <article
    class="tile-card"
    :class="[typeClass, `side--${side}`, { 'tile-current': hasCurrentPlayer }]"
    :style="cardStyle"
    style="cursor: pointer"
    @click="handleClick"
  >
    <!-- ── Corner tiles ──────────────────────────────────────────── -->
    <template v-if="side === 'corner'">
      <div class="corner-inner">
        <span class="corner-icon" aria-hidden="true">{{ tileArt }}</span>
        <span class="corner-label">{{ displayName }}</span>
        <div v-if="players.length > 0" class="corner-tokens">
          <span
            v-for="player in players"
            :key="player.id"
            class="player-token"
            :style="{ '--token-color': player.color }"
            :title="player.nickname"
            :aria-label="player.nickname"
            role="img"
          />
        </div>
      </div>
    </template>

    <!-- ── Edge tiles ────────────────────────────────────────────── -->
    <template v-else>
      <!-- 1. Outer edge: Price zone -->
      <div class="tile-price-zone">
        <div class="price-content">
          <!-- AIRPORT: show current toll when owned, base price when unowned -->
          <span v-if="tile.type === 'AIRPORT' && currentAirportToll != null" class="tile-price tile-price--toll">${{ currentAirportToll }}</span>
          <span v-else-if="tile.type === 'AIRPORT' && tile.basePrice != null" class="tile-price">${{ tile.basePrice }}</span>

          <!-- PROPERTY level 0: show price -->
          <span
            v-else-if="tile.type === 'PROPERTY' && tile.basePrice != null && (tile.buildingLevel ?? 0) === 0"
            class="tile-price"
          >${{ tile.basePrice }}</span>

          <!-- Property buildings use a compact level marker to keep the map readable. -->
          <span
            v-else-if="tile.type === 'PROPERTY' && (tile.buildingLevel ?? 0) > 0"
            class="building-indicator"
          >L{{ tile.buildingLevel }}</span>
        </div>
      </div>

      <!-- 2. Middle: Name + buildings -->
      <div class="tile-body">
        <div class="body-content">
          <CountryFlag
            v-if="countryFlagCode"
            :code="countryFlagCode"
            class="tile-art tile-art--flag"
            aria-hidden="true"
          />
          <span v-else-if="tileArt" class="tile-art" aria-hidden="true">{{ tileArt }}</span>
          <span class="tile-name">{{ displayName }}</span>
        </div>
      </div>

      <!-- 3. Inner edge: player tokens only (decorative flags/icons are intentionally omitted). -->
      <div v-if="players.length > 0" class="tile-inner-zone">
        <div class="player-stack">
          <span
            v-for="player in players"
            :key="player.id"
            class="player-token"
            :style="{ '--token-color': player.color }"
            :title="player.nickname"
            :aria-label="player.nickname"
            role="img"
          />
        </div>
      </div>
    </template>

    <!-- Mortgaged overlay -->
    <div v-if="tile.isMortgaged" class="tile-mortgaged-overlay" aria-hidden="true" />

    <!-- Floating text (e.g. tax deduction) -->
    <FloatingText v-if="activeFloatingText" :text="activeFloatingText.text" />

    <!-- Click popover (Teleports to body) -->
    <TilePopover
      v-if="isSelected && anchorRect"
      :tile="tile"
      :display-name="displayName"
      :anchor-rect="anchorRect"
      :side="side"
      :owner-color="ownerColor"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import type { TilePublicView } from '@/types';
import type { TileSide } from './BoardView.vue';
import FloatingText from './FloatingText.vue';
import TilePopover from './TilePopover.vue';
import CountryFlag from './CountryFlag.vue';
import { useFloatingTextStore } from '@/stores/useFloatingTextStore';
import { useTileSelection } from '@/composables/useTileSelection';
import { useGameStore } from '@/stores/useGameStore';

interface TilePlayerToken {
  id: string;
  nickname: string;
  color: string;
  isCurrent: boolean;
}

const props = defineProps<{
  tile: TilePublicView;
  players: TilePlayerToken[];
  ownerColor?: string;
  side: TileSide;
}>();

const floatingTextStore = useFloatingTextStore();
const gameStore = useGameStore();
const activeFloatingText = computed(() =>
  floatingTextStore.texts.find((t) => t.tilePosition === props.tile.id) ?? null,
);

// ── Click-to-open popover ────────────────────────────────────────────
const tileSelection = useTileSelection();
const anchorRect    = ref<DOMRect | null>(null);
const isSelected    = computed(() => tileSelection.selectedTileId.value === props.tile.id);

const handleClick = (e: MouseEvent) => {
  e.stopPropagation();
  anchorRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
  tileSelection.toggle(props.tile.id);
};

/** Each property color group represents one country in the board definition. */
const COUNTRY_FLAGS: Record<string, string> = {
  BROWN:      'kr',
  PURPLE:     'it',
  LIGHT_BLUE: 'ca',
  TEAL:       'fr',
  PINK:       'gb',
  ORANGE:     'de',
  RED:        'jp',
  YELLOW:     'cn',
  GREEN:      'us',
  GRAY:       'ae',
  DARK_BLUE:  'au',
};

const SPECIAL_TILE_ART: Record<string, string> = {
  AIRPORT:    '✈️',
  TEMPLE:     '🛕',
  CASINO:     '🎰',
  TAX:        '💰',
  SURPRISE:   '❓',
  GO:         '🏁',
  JAIL:       '⛓️',
  GO_TO_JAIL: '🚔',
  FREE:       '🌴',
};

const typeClass = computed(() => `tile-${props.tile.type.toLowerCase()}`);

const hasCurrentPlayer = computed(() => props.players.some((p) => p.isCurrent));

const displayName = computed(() => props.tile.name);

const countryFlagCode = computed(() => (
  props.tile.type === 'PROPERTY' && props.tile.colorGroup
    ? (COUNTRY_FLAGS[props.tile.colorGroup] ?? null)
    : null
));

const tileArt = computed(() => {
  if (props.tile.type === 'PROPERTY') {
    return countryFlagCode.value ? '' : '🏙️';
  }

  return SPECIAL_TILE_ART[props.tile.type] ?? '◆';
});

/**
 * Uniform cell background: keep the warm beige base (#f8f4ec) for most tiles;
 * apply a very light tint of the color-group hue for property cells so the
 * entire cell reads as one color with no internal segmentation.
 */
const cardStyle = computed(() => {
  if (props.side === 'corner') return {};
  if (props.ownerColor) {
    const hex = props.ownerColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { background: `rgba(${r}, ${g}, ${b}, 0.25)` };
  }
  return {};
});

const currentAirportToll = computed(() => {
  if (props.tile.type !== 'AIRPORT' || props.tile.ownerId == null || !props.tile.rentTable) return null;
  const airportCount = gameStore.board.filter(
    (t) => t.type === 'AIRPORT' && t.ownerId === props.tile.ownerId && !t.isMortgaged,
  ).length;
  return props.tile.rentTable[airportCount - 1] ?? null;
});

</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────── */
.tile-card {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  border-radius: 4px;
  background: rgba(248, 244, 236, 0.90);
  border: 1px solid rgba(0, 0, 0, 0.15);
  transition: background 200ms ease, border-color 150ms ease;
  box-sizing: border-box;
  font-family: 'Itim', cursive;
}

.tile-current {
  border-color: rgba(180, 100, 20, 0.9) !important;
  box-shadow: inset 0 0 0 2px rgba(180, 100, 20, 0.3);
}

/* ── Direction variants ─────────────────────────────────────────── */
.side--top    { flex-direction: column; }
.side--bottom { flex-direction: column-reverse; }
.side--left   { flex-direction: row; }
.side--right  { flex-direction: row-reverse; }

/* ── 1. Outer edge: Price zone ──────────────────────────────────── */
.tile-price-zone {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.side--top    .tile-price-zone,
.side--bottom .tile-price-zone { width: 100%; height: 22%; }

.side--left   .tile-price-zone,
.side--right  .tile-price-zone { width: 22%; height: 100%; }

.side--top .tile-price-zone {
  align-items: flex-start;
  padding-top: 2px;
}

.side--bottom .tile-price-zone {
  align-items: flex-end;
  padding-bottom: 2px;
}

.side--left .tile-price-zone {
  justify-content: flex-start;
  padding-left: 2px;
}

.side--right .tile-price-zone {
  justify-content: flex-end;
  padding-right: 2px;
}

.price-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tile-price {
  font-family: 'Itim', cursive;
  font-size: 0.65rem;
  font-weight: 400;
  color: #4a3520;
  line-height: 1;
}

.tile-price--toll {
  font-weight: 700;
  color: #FF0000;
}

.building-indicator {
  font-size: 0.65rem;
  line-height: 1;
  white-space: nowrap;
  display: inline-block;
}

/* Rotate building indicators so they face the center hub */
.side--bottom .building-indicator {
  transform: rotate(180deg);
}

/* Left/right sides: override vertical writing-mode, then rotate toward center */
.side--left .building-indicator {
  writing-mode: horizontal-tb;
  transform: rotate(90deg);
}

/* side--right parent already has rotate(180deg); child rotate(90deg) = -90deg on screen */
.side--right .building-indicator {
  writing-mode: horizontal-tb;
  transform: rotate(90deg);
}

/* ── 2. Middle: Body ────────────────────────────────────────────── */
.tile-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.body-content {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.tile-name {
  position: absolute;
  top: 54%;
  left: 50%;
  display: inline-block;
  font-family: 'Itim', cursive;
  font-size: 0.62rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.09em;
  color: #2a1f14;
  text-align: center;
  white-space: nowrap;
  word-break: normal;
  overflow-wrap: normal;
  hyphens: none;
  max-width: 100%;
  transform: translate(-50%, -50%);
}

.tile-art {
  position: absolute;
  top: 30%;
  left: 50%;
  font-size: 0.92rem;
  line-height: 1;
  transform: translate(-50%, -50%);
}

.tile-art--flag {
  width: 1.08rem;
  height: 0.72rem;
}

.side--bottom .tile-art {
  top: 70%;
}

.side--bottom .tile-name {
  top: 46%;
}

.side--left .tile-art {
  top: 50%;
  left: 32%;
  transform: translate(-50%, -50%) rotate(90deg);
}

.side--right .tile-art {
  top: 50%;
  left: 68%;
  transform: translate(-50%, -50%) rotate(-90deg);
}

/* ── Text rotation: left / right columns ────────────────────────────
 *
 *  LEFT column  → writing-mode vertical-rl + rotate(180deg)
 *                 Text reads bottom-to-top on screen.
 *                 A player standing on the left tilts head left and reads
 *                 left-to-right naturally.
 *
 *  RIGHT column → writing-mode vertical-rl (no additional rotation)
 *                 Text reads top-to-bottom on screen.
 *                 A player standing on the right tilts head right and reads
 *                 left-to-right naturally.
 * ─────────────────────────────────────────────────────────────────── */
.side--left .price-content {
  writing-mode: vertical-rl;
}

.side--right .price-content {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

.side--left .tile-name,
.side--right .tile-name {
  top: 50%;
  writing-mode: vertical-rl;
}

.side--left .tile-name {
  left: 54%;
}

.side--right .tile-name {
  left: 46%;
  transform: translate(-50%, -50%) rotate(180deg);
}

/* ── 3. Inner edge: Player tokens ───────────────────────────────── */
.tile-inner-zone {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.side--top    .tile-inner-zone,
.side--bottom .tile-inner-zone { width: 100%; height: 36%; }

.side--left   .tile-inner-zone,
.side--right  .tile-inner-zone { width: 36%; height: 100%; }

.player-stack {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
}

.player-token {
  position: relative;
  width: 13px;
  height: 13px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--token-color, #8f5d23);
  border: none;
  flex-shrink: 0;
  writing-mode: horizontal-tb !important;
  transform: none !important;
  box-shadow: none;
}

.player-stack .player-token + .player-token {
  margin-left: -9px;
}

/* ── Corner tiles ───────────────────────────────────────────────── */
.side--corner {
  border-radius: 8px;
  background: #E8E2D2;
  border: 1px solid rgba(0, 0, 0, 0.20);
}

.corner-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
}

.corner-icon {
  font-size: 1.7rem;
  line-height: 1;
}

.corner-label {
  font-family: 'Itim', cursive;
  font-size: 0.7rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2a1f14;
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
}

.corner-tokens {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}

.corner-tokens .player-token + .player-token {
  margin-left: -9px;
}

/* Subtle hover highlight so tiles feel interactive */
.tile-card:hover {
  filter: brightness(1.04);
}

/* ── Mortgaged overlay ──────────────────────────────────────────── */
.tile-mortgaged-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  border-radius: inherit;
  background: rgba(20, 20, 20, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.3s ease;
}

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .tile-name    { font-size: 0.52rem; }
  .tile-art     { font-size: 0.78rem; }
  .tile-art--flag { width: 0.96rem; height: 0.64rem; }
  .corner-icon  { font-size: 1.45rem; }
  .corner-label { font-size: 0.6rem; }
  .player-token { width: 12px; height: 12px; }
  .player-stack .player-token + .player-token,
  .corner-tokens .player-token + .player-token { margin-left: -8px; }
  .tile-price   { font-size: 0.55rem; }
}
</style>
