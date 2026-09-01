<template>
  <article class="player-card" :class="{ 'player-card-current': isCurrent, 'player-card-self': isSelf }">
    <div class="player-head">
      <div class="identity">
        <span class="avatar" :style="{ '--avatar-color': player.color }">
          {{ player.nickname.slice(0, 1).toUpperCase() }}
        </span>
        <div class="identity-copy">
          <p class="name-line">
            <span class="player-name">{{ player.nickname }}</span>
            <span class="inline-icons">
              <span
                class="connection-indicator"
                :class="player.isConnected ? 'connection-indicator-online' : 'connection-indicator-offline'"
                :title="player.isConnected ? 'Connected' : 'Disconnected'"
                :aria-label="player.isConnected ? 'Connected' : 'Disconnected'"
              >
                <span class="wifi-icon" aria-hidden="true">
                  <span class="wifi-arc wifi-arc-outer"></span>
                  <span class="wifi-arc wifi-arc-middle"></span>
                  <span class="wifi-arc wifi-arc-inner"></span>
                  <span class="wifi-dot"></span>
                  <span v-if="!player.isConnected" class="wifi-alert">!</span>
                </span>
              </span>
              <span
                v-if="player.inJail"
                class="state-icon state-icon-jail"
                title="In Jail"
                aria-label="In Jail"
              >
                <span aria-hidden="true">🔒</span>
              </span>
            </span>
            <span v-if="isSelf" class="tag">You</span>
            <span v-if="isHost" class="tag">Host</span>
            <span v-if="isCurrent" class="status-chip status-chip-turn">
              Turn
            </span>
          </p>
        </div>
      </div>
    </div>

    <dl class="stats-grid">
      <div>
        <dt>Position</dt>
        <dd>#{{ player.position }}</dd>
      </div>
      <div>
        <dt>Owned</dt>
        <dd>{{ ownedCount }}</dd>
      </div>
      <div v-if="cash !== null">
        <dt>Cash</dt>
        <dd>${{ cash }}</dd>
      </div>
      <div v-if="constructibleCount !== null">
        <dt>Buildable</dt>
        <dd>{{ constructibleCount }}</dd>
      </div>
    </dl>
  </article>
</template>

<script setup lang="ts">
interface PlayerSummary {
  id: string;
  nickname: string;
  color: string;
  position: number;
  inJail: boolean;
  jailTurnsWaited: number;
  status: string;
  isConnected: boolean;
}

withDefaults(
  defineProps<{
    player: PlayerSummary;
    ownedCount: number;
    cash?: number | null;
    constructibleCount?: number | null;
    isCurrent?: boolean;
    isSelf?: boolean;
    isHost?: boolean;
  }>(),
  {
    cash: null,
    constructibleCount: null,
    isCurrent: false,
    isSelf: false,
    isHost: false,
  },
);
</script>

<style scoped>
.player-card {
  padding: 18px;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(245, 238, 226, 0.96));
  border: 1px solid rgba(95, 67, 41, 0.12);
  box-shadow: 0 16px 36px rgba(77, 52, 28, 0.09);
}

.player-card-current {
  border-color: rgba(211, 84, 0, 0.28);
  box-shadow: 0 18px 36px rgba(211, 84, 0, 0.14);
}

.player-card-self {
  background:
    linear-gradient(180deg, rgba(255, 250, 240, 0.98), rgba(247, 237, 218, 0.98));
}

.player-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.identity-copy {
  min-width: 0;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--avatar-color, #8f5d23);
  color: #fffef9;
  font-weight: 700;
  box-shadow: 0 8px 14px rgba(35, 24, 13, 0.14);
}

.name-line {
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-weight: 700;
  color: #291d13;
}

.player-name {
  min-width: 0;
  word-break: break-word;
}

.inline-icons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eadbc2;
  color: #5d462e;
  font-size: 0.7rem;
  font-weight: 700;
}

.tag-hot {
  background: #f7c78d;
}

.connection-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.wifi-icon {
  position: relative;
  width: 20px;
  height: 15px;
  display: inline-block;
}

.wifi-arc {
  position: absolute;
  left: 50%;
  border-style: solid;
  border-color: currentColor transparent transparent transparent;
  border-radius: 999px 999px 0 0;
  transform: translateX(-50%);
  opacity: 0.98;
}

.wifi-arc-outer {
  top: 0;
  width: 20px;
  height: 10px;
  border-width: 2px 2px 0 2px;
}

.wifi-arc-middle {
  top: 4px;
  width: 14px;
  height: 7px;
  border-width: 2px 2px 0 2px;
}

.wifi-arc-inner {
  top: 8px;
  width: 8px;
  height: 4px;
  border-width: 2px 2px 0 2px;
}

.wifi-dot {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  transform: translateX(-50%);
}

.wifi-alert {
  position: absolute;
  right: -6px;
  top: 1px;
  font-size: 0.62rem;
  line-height: 1;
  font-weight: 900;
}

.connection-indicator-online {
  color: #2ca34a;
}

.connection-indicator-offline {
  color: #d94747;
}

.state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  font-size: 0.78rem;
}

.state-icon-jail {
  background: rgba(90, 64, 147, 0.14);
  color: #5a4093;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(234, 219, 194, 0.62);
  color: #5d462e;
  font-size: 0.72rem;
  font-weight: 700;
}

.status-chip-turn {
  background: #f7c78d;
  color: #7a4612;
}

.stats-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stats-grid div {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.68);
}

.stats-grid dt {
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8a7156;
}

.stats-grid dd {
  margin: 6px 0 0;
  font-weight: 700;
  color: #26180d;
}

@media (max-width: 640px) {
  .player-card {
    padding: 16px;
    border-radius: 18px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
