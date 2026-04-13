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
        <span class="corner-icon" aria-hidden="true">{{ cornerIcon }}</span>
        <span class="corner-label">{{ displayName }}</span>
        <div v-if="players.length > 0" class="corner-tokens">
          <span
            v-for="player in players"
            :key="player.id"
            class="player-token"
            :class="{ 'player-token-current': player.isCurrent }"
            :style="{ '--token-color': player.color }"
            :title="player.nickname"
          >{{ player.nickname.slice(0, 1).toUpperCase() }}</span>
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

          <!-- PROPERTY level 1–4: house count -->
          <span
            v-else-if="tile.type === 'PROPERTY' && (tile.buildingLevel ?? 0) >= 1 && (tile.buildingLevel ?? 0) <= 4"
            class="building-indicator"
          >🏠×{{ tile.buildingLevel }}</span>

          <!-- PROPERTY level 5: hotel -->
          <span
            v-else-if="tile.type === 'PROPERTY' && (tile.buildingLevel ?? 0) === 5"
            class="building-indicator"
          >🏨</span>

          <!-- PROPERTY level 6: landmark -->
          <span
            v-else-if="tile.type === 'PROPERTY' && (tile.buildingLevel ?? 0) === 6"
            class="building-indicator"
          >🏰</span>
        </div>
      </div>

      <!-- 2. Middle: Name + buildings -->
      <div class="tile-body">
        <div class="body-content">
          <span class="tile-name">{{ displayName }}</span>

        </div>
      </div>

      <!-- 3. Inner edge: Flag / Icon + player tokens (no color strip) -->
      <div class="tile-inner-zone">
        <div class="icon-token-area">
          <img
            v-if="tile.type === 'PROPERTY' && flagCode"
            :src="`https://flagcdn.com/w20/${flagCode}.png`"
            class="tile-flag"
            aria-hidden="true"
          />
          <span v-else class="tile-icon" aria-hidden="true">{{ tileIcon }}</span>

          <div v-if="players.length > 0" class="player-stack">
            <span
              v-for="player in players"
              :key="player.id"
              class="player-token"
              :class="{ 'player-token-current': player.isCurrent }"
              :style="{ '--token-color': player.color }"
              :title="player.nickname"
            >{{ player.nickname.slice(0, 1).toUpperCase() }}</span>
          </div>
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

const COUNTRY_FLAG_CODES: Record<string, string> = {
  BROWN:      'kr',
  LIGHT_BLUE: 'ca',
  PINK:       'gb',
  ORANGE:     'de',
  RED:        'jp',
  YELLOW:     'cn',
  GREEN:      'us',
  DARK_BLUE:  'au',
  PURPLE:     'it',
  TEAL:       'fr',
  GRAY:       'ae',
};

const TILE_ICONS: Record<string, string> = {
  AIRPORT:    '✈',
  TEMPLE:     '⛩',
  CASINO:     '🤑',
  TAX:        '💸',
  SURPRISE:   '❓',
  GO:         '▶',
  JAIL:       '⛓',
  GO_TO_JAIL: '🚔',
  FREE:       '🌴',
  PROPERTY:   '🏠',
};

const CORNER_ICONS: Record<string, string> = {
  GO:         '▶',
  JAIL:       '⛓',
  GO_TO_JAIL: '🚔',
  FREE:       '🌴',
  TEMPLE:     '🛕', 
};

// Chinese → English tile name translations
const TILE_NAME_EN: Record<string, string> = {
  // Special tiles
  '起点':           'GO',
  '监狱':           'Jail',
  '监狱/探视':      'Jail / Visit',
  '去监狱':         'Go to Jail',
  '免费停留':       'Free Parking',
  '惊喜格':         'Surprise',
  '交税格':         'Tax',
  '奢侈税':         'Luxury Tax',
  '所得税':         'Income Tax',
  // Temples & Casinos
  '东方古寺':       'East Temple',
  '西方古寺':       'West Temple',
  '东方古寺（寺庙A）': 'East Temple (A)',
  '西方古寺（寺庙B）': 'West Temple (B)',
  '赌场':           'Casino',
  // Utilities
  '水务公司':       'Water Co.',
  '电力公司':       'Electric Co.',
  // Americas
  '纽约':           'New York',
  '洛杉矶':         'Los Angeles',
  '旧金山':         'San Francisco',
  '萨尔瓦多':       'Salvador',
  '里约':           'Rio',
  // Europe
  '伦敦':           'London',
  '曼彻斯特':       'Manchester',
  '利物浦':         'Liverpool',
  '爱丁堡':         'Edinburgh',
  '巴黎':           'Paris',
  '里昂':           'Lyon',
  '图卢兹':         'Toulouse',
  '柏林':           'Berlin',
  '法兰克福':       'Frankfurt',
  '慕尼黑':         'Munich',
  '罗马':           'Rome',
  '米兰':           'Milan',
  '威尼斯':         'Venice',
  // Asia
  '北京':           'Beijing',
  '上海':           'Shanghai',
  '深圳':           'Shenzhen',
  '首尔':           'Seoul',
  '釜山':           'Busan',
  '大阪':           'Osaka',
  '东京':           'Tokyo',
  // Middle East & Oceania
  '迪拜':           'Dubai',
  '阿布扎比':       'Abu Dhabi',
  '特拉维夫':       'Tel Aviv',
  '海法':           'Haifa',
  '耶路撒冷':       'Jerusalem',
  '悉尼':           'Sydney',
  '墨尔本':         'Melbourne',
  // Airports
  'JFK机场':        'JFK Airport',
  'CDG机场':        'CDG Airport',
  'MUC机场':        'MUC Airport',
  'TLV机场':        'TLV Airport',
};

const typeClass = computed(() => `tile-${props.tile.type.toLowerCase()}`);

const hasCurrentPlayer = computed(() => props.players.some((p) => p.isCurrent));

/** Translate tile name: Chinese → English, fallback to original */
const displayName = computed(() => TILE_NAME_EN[props.tile.name] ?? props.tile.name);

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

const flagCode = computed(() =>
  props.tile.type === 'PROPERTY' && props.tile.colorGroup
    ? (COUNTRY_FLAG_CODES[props.tile.colorGroup] ?? null)
    : null,
);

const tileIcon = computed(() => TILE_ICONS[props.tile.type] ?? '');

const cornerIcon = computed(() => CORNER_ICONS[props.tile.type] ?? '★');

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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.side--top    .tile-price-zone,
.side--bottom .tile-price-zone { width: 100%; height: 22%; }

.side--left   .tile-price-zone,
.side--right  .tile-price-zone { width: 22%; height: 100%; }

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
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 2px 4px;
}

.body-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 100%;
  height: 100%;
}

.tile-name {
  font-family: 'Itim', cursive;
  font-size: 0.72rem;
  font-weight: 400;
  line-height: 1.2;
  color: #2a1f14;
  text-align: center;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
}
/* 只把顶部格子的地名往下平移 4px */
.side--top .tile-name {
  transform: translateY(1px);
}

/* 只把左侧格子的地名往右平移 4px */
.side--left .tile-name {
  transform: translateX(1px);
}

.side--right .tile-name {
  transform: translateX(-1px);
}

.side--bottom .tile-name {
  transform: translateY(-1px);
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
.side--left .price-content,
.side--left .body-content {
  writing-mode: vertical-rl;
  
}

.side--right .price-content,
.side--right .body-content {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

/* ── 3. Inner edge: Icon & Tokens ───────────────────────────────── */
.tile-inner-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.side--top    .tile-inner-zone,
.side--bottom .tile-inner-zone { width: 100%; height: 36%; }

.side--left   .tile-inner-zone,
.side--right  .tile-inner-zone { width: 36%; height: 100%; }

.icon-token-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 2px;
}

.tile-icon {
  font-size: 1.1em;
  line-height: 1;
  flex-shrink: 0;
}
.side--bottom .tile-icon {
  transform: translateY(-5px) rotate(0deg); /* 底部边上的表情翻转 180° (倒立) */
}

.side--left .tile-icon {
  transform: translateX(5px) rotate(90deg); /* 左侧边上的表情旋转 90° (与垂直文字对齐) */
}

.side--right .tile-icon {
  transform: translateX(-5px) rotate(-90deg); /* 右侧边上的表情旋转 -90° (与垂直文字对齐) */
}
/* 顶部（.side--top）默认为 0deg */
 .side--top .tile-icon {
  transform: translateY(5px) rotate(0deg); /* 顶部边上的表情旋转 0° (与水平文字对齐) */
}
/* 1. 先定义所有国旗共用的基础样式 */
.tile-flag {
  width: 20px;
  height: auto;
  flex-shrink: 0;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
} /* <--- 注意这里！要先把基础样式的大括号关上 */

/* 2. 然后在外面单独定义四个方向的移动和旋转 */

/* 顶部的格子 */
.side--top .tile-flag {
  transform: translateY(5px) rotate(0deg); 
}

/* 底部的格子 */
.side--bottom .tile-flag {
  transform: translateY(-5px) rotate(0deg);
}

/* 左侧的格子 */
.side--left .tile-flag {
  transform: translateX(5px) rotate(90deg);
}

/* 右侧的格子 */
.side--right .tile-flag {
  transform: translateX(-5px) rotate(-90deg);
}

.player-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
  justify-content: center;
}

.player-token {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--token-color, #8f5d23);
  color: #fff;
  font-size: 0.55rem;
  font-weight: 700;
  flex-shrink: 0;
  /* Always render tokens horizontal, unaffected by parent writing-mode */
  writing-mode: horizontal-tb !important;
  transform: none !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.player-token-current {
  outline: 2px solid #fff;
  box-shadow: 0 0 0 3px rgba(255, 140, 40, 0.8);
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

.corner-icon { font-size: 2.2em; line-height: 1; }

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
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
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
  .tile-name    { font-size: 0.58rem; }
  .tile-icon    { font-size: 0.9em; }
  .corner-icon  { font-size: 1.8em; }
  .corner-label { font-size: 0.6rem; }
  .player-token { width: 14px; height: 14px; font-size: 0.5rem; }
  .tile-price   { font-size: 0.55rem; }
}
</style>
