<template>
  <section class="center-hub">
    <header class="hub-header">
      <div class="hub-topline">
        <p class="hub-eyebrow">Center Command</p>
        <slot name="pills" />
      </div>

      <div class="hub-title-row">
        <span
          class="hub-player-mark"
          :style="currentPlayerColor ? { '--player-color': currentPlayerColor } : undefined"
        />
        <div class="hub-title-copy">
          <p class="hub-status">{{ statusLine }}</p>
          <h2>{{ heading }}</h2>
        </div>
      </div>

      <p class="hub-description">{{ description }}</p>
    </header>

    <div
      v-if="activeTileName || activeTilePrice !== null"
      class="hub-tile"
    >
      <span v-if="activeTileName" class="hub-tile-name">{{ activeTileName }}</span>
      <span v-if="activeTilePrice !== null" class="hub-tile-price">${{ activeTilePrice }}</span>
    </div>

    <div class="hub-actions">
      <slot name="actions" />
    </div>

    <div v-if="$slots.details" class="hub-details">
      <slot name="details" />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    heading: string;
    statusLine: string;
    description: string;
    currentPlayerColor?: string | null;
    activeTileName?: string | null;
    activeTileType?: string | null;
    activeTilePrice?: number | null;
  }>(),
  {
    currentPlayerColor: null,
    activeTileName: null,
    activeTileType: null,
    activeTilePrice: null,
  },
);
</script>

<style scoped>
.center-hub {
  width: 100%;
  max-width: 40rem;
  display: grid;
  gap: 18px;
  text-align: left;
  color: #1f160f;
}

.hub-header {
  display: grid;
  gap: 14px;
}

.hub-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.hub-eyebrow {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8f5d23;
}


.hub-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hub-player-mark {
  width: 18px;
  height: 48px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--player-color, #d8c1a4), rgba(255, 255, 255, 0.2));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.hub-title-copy {
  min-width: 0;
}

.hub-status {
  margin: 0 0 4px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8f5d23;
}

.hub-title-copy h2 {
  margin: 0;
  font-family: 'Itim', cursive;
  font-size: clamp(1.7rem, 2.4vw, 2.7rem);
  line-height: 1.05;
  color: #25190f;
  font-weight: 400;
}

.hub-description {
  margin: 0;
  max-width: 34rem;
  line-height: 1.65;
  color: #5d4935;
}

.hub-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(92, 66, 41, 0.12);
}

.hub-tile-type {
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8f5d23;
  font-family: 'Itim', cursive;
  flex-shrink: 0;
}

.hub-tile-name {
  font-family: 'Itim', cursive;
  font-weight: 400;
  font-size: 1.05rem;
  color: #23170d;
}

.hub-tile-price {
  font-family: 'Itim', cursive;
  font-size: 0.92rem;
  color: #4f3a27;
}

.hub-actions,
.hub-details {
  display: grid;
  gap: 14px;
}

@media (max-width: 780px) {
  .center-hub {
    gap: 14px;
    text-align: center;
  }

  .hub-topline,
  .hub-title-row,
  .hub-tile {
    justify-content: center;
  }

  .hub-title-row {
    flex-direction: column;
  }

  .hub-player-mark {
    width: 48px;
    height: 14px;
  }
}
</style>
