<template>
  <section class="board-shell">
    <div class="board-grid">
      <div
        v-for="entry in positionedTiles"
        :key="entry.tile.id"
        class="board-cell"
        :style="{ gridRow: String(entry.row), gridColumn: String(entry.column) }"
      >
        <BoardTile
          :tile="entry.tile"
          :players="entry.players"
          :owner-color="entry.ownerColor"
          :side="entry.side"
        />
      </div>

      <div class="board-center">
        <slot name="center">
          <div class="center-copy">
            <p class="center-eyebrow">RichUp</p>
            <h2>Realtime board synced from Socket.io events.</h2>
            <p>
              The 56-tile layout is rendered from the server-generated map, with player markers
              updating from live movement events.
            </p>
          </div>
        </slot>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { PlayerId, TilePublicView } from '@/types';

import BoardTile from './BoardTile.vue';

export type TileSide = 'top' | 'right' | 'bottom' | 'left' | 'corner';

interface BoardPlayer {
  id: PlayerId;
  nickname: string;
  color: string;
  position: number;
}

interface PositionedTile {
  tile: TilePublicView;
  row: number;
  column: number;
  players: Array<BoardPlayer & { isCurrent: boolean }>;
  ownerColor: string | undefined;
  side: TileSide;
}

const props = defineProps<{
  tiles: TilePublicView[];
  players: BoardPlayer[];
  currentTurnPlayerId: PlayerId | null;
}>();

const BOARD_SIZE = 15;
const CORNER_INDICES = new Set([0, BOARD_SIZE - 1, BOARD_SIZE + (BOARD_SIZE - 1) - 1, BOARD_SIZE + (BOARD_SIZE - 1) * 2 - 1]);

const getSide = (index: number): TileSide => {
  if (CORNER_INDICES.has(index)) return 'corner';
  if (index < BOARD_SIZE) return 'top';
  if (index < BOARD_SIZE + (BOARD_SIZE - 1)) return 'right';
  if (index < BOARD_SIZE + (BOARD_SIZE - 1) * 2) return 'bottom';
  return 'left';
};

const resolveBoundaryPosition = (index: number): { row: number; column: number } => {
  if (index < BOARD_SIZE) {
    return { row: 1, column: index + 1 };
  }

  if (index < BOARD_SIZE + (BOARD_SIZE - 1)) {
    return { row: index - BOARD_SIZE + 2, column: BOARD_SIZE };
  }

  if (index < BOARD_SIZE + (BOARD_SIZE - 1) * 2) {
    const offset = index - (BOARD_SIZE + (BOARD_SIZE - 1));
    return { row: BOARD_SIZE, column: BOARD_SIZE - 1 - offset };
  }

  const offset = index - (BOARD_SIZE + (BOARD_SIZE - 1) * 2);
  return { row: BOARD_SIZE - 1 - offset, column: 1 };
};

const playersByPosition = computed(() => {
  const grouped = new Map<number, Array<BoardPlayer & { isCurrent: boolean }>>();

  for (const player of props.players) {
    const existing = grouped.get(player.position) ?? [];
    existing.push({
      ...player,
      isCurrent: player.id === props.currentTurnPlayerId,
    });
    grouped.set(player.position, existing);
  }

  return grouped;
});

const playerColorById = computed(() => {
  const map = new Map<string, string>();
  for (const player of props.players) {
    map.set(player.id, player.color);
  }
  return map;
});

const positionedTiles = computed<PositionedTile[]>(() =>
  [...props.tiles]
    .sort((left, right) => left.id - right.id)
    .map((tile, index) => {
      const position = resolveBoundaryPosition(index);
      const ownerColor = tile.ownerId ? playerColorById.value.get(tile.ownerId) : undefined;

      return {
        tile,
        row: position.row,
        column: position.column,
        players: playersByPosition.value.get(tile.id) ?? [],
        ownerColor,
        side: getSide(index),
      };
    }),
);
</script>

<style scoped>
.board-shell {
  width: 100%;
  height: 100%;
}

.board-grid {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  /* Corner cells are 2.5x the size of edge cells */
  grid-template-columns: 2.5fr repeat(13, 1fr) 2.5fr;
  grid-template-rows: 2.5fr repeat(13, 1fr) 2.5fr;
  gap: 2px;
  padding: 8px;
  border-radius: 20px;
  background: #c5b99a;
  border: 2px solid rgba(92, 66, 41, 0.25);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 24px 48px rgba(0, 0, 0, 0.22);
}

.board-cell {
  min-width: 0;
  min-height: 0;
}

.board-center {
  grid-column: 2 / 15;
  grid-row: 2 / 15;
  min-height: 0;
  border-radius: 12px;
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 214, 153, 0.55), transparent 50%),
    linear-gradient(155deg, #f6efe1 0%, #e7dcc5 100%);
  border: 1px solid rgba(92, 66, 41, 0.1);
  display: grid;
  place-items: center;
  padding: clamp(12px, 2vw, 24px);
  overflow: hidden;
}

.center-copy {
  max-width: 32rem;
  text-align: center;
}

.center-eyebrow {
  margin: 0 0 10px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8f5d23;
}

.center-copy h2 {
  margin: 0 0 12px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(1.4rem, 1.8vw, 2.2rem);
  line-height: 1.1;
  color: #25190f;
}

.center-copy p {
  margin: 0;
  color: #5d4935;
  line-height: 1.65;
  font-size: 0.9rem;
}

@media (max-width: 1100px) {
  .board-grid {
    gap: 1px;
    padding: 6px;
  }
}

@media (max-width: 780px) {
  .board-grid {
    gap: 1px;
    padding: 4px;
    border-radius: 14px;
  }

  .center-copy h2 {
    font-size: 1.1rem;
  }

  .center-copy p {
    display: none;
  }
}
</style>
