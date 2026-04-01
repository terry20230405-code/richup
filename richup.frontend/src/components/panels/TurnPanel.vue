<template>
  <section class="turn-card">
    <p class="eyebrow">Live Session</p>
    <h1>Realtime game room</h1>
    <p class="copy">
      Connection, turn phase, board state, and player movement are all being read directly from
      Pinia stores hydrated by Socket.io events.
    </p>

    <dl class="turn-grid">
      <div>
        <dt>Socket</dt>
        <dd>{{ isConnected ? 'Connected' : 'Disconnected' }}</dd>
      </div>
      <div>
        <dt>Room</dt>
        <dd>{{ roomId || 'Waiting' }}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{{ status }}</dd>
      </div>
      <div>
        <dt>Phase</dt>
        <dd>{{ phase }}</dd>
      </div>
      <div>
        <dt>Turn</dt>
        <dd>{{ turnNumber }}</dd>
      </div>
      <div>
        <dt>Current</dt>
        <dd>{{ currentPlayerLabel }}</dd>
      </div>
      <div>
        <dt>Nickname</dt>
        <dd>{{ nickname || 'Waiting' }}</dd>
      </div>
      <div>
        <dt>Board</dt>
        <dd>{{ boardCount }} tiles</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  isConnected: boolean;
  roomId: string | null | undefined;
  nickname: string | null | undefined;
  status: string;
  phase: string;
  turnNumber: number;
  currentPlayerLabel: string;
  boardCount: number;
}>();
</script>

<style scoped>
.turn-card {
  display: none;
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8f5d23;
}

h1 {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(1.8rem, 2vw, 2.5rem);
  line-height: 1.08;
  color: #24170d;
}

.copy {
  margin: 14px 0 20px;
  color: #64503e;
  line-height: 1.7;
}

.turn-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.turn-grid div {
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.68);
}

.turn-grid dt {
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8a7156;
}

.turn-grid dd {
  margin: 6px 0 0;
  font-weight: 700;
  color: #23170d;
}
</style>
