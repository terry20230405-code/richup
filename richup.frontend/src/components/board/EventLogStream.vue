<template>
  <div
    ref="containerEl"
    class="event-stream"
    :class="{ 'is-hovering': isHovering }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <TransitionGroup name="stream" tag="div" class="stream-list">
      <p
        v-for="entry in entries"
        :key="entry.id"
        class="stream-item"
        :class="`stream-item--${entry.type}`"
      >
        <span
          v-if="entry.playerColor"
          class="stream-dot"
          :style="{ background: entry.playerColor }"
        />{{ entry.message }}</p>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useEventLogStore } from '@/stores/useEventLogStore';

const eventLogStore = useEventLogStore();
const isHovering = ref(false);
const containerEl = ref<HTMLElement | null>(null);

const entries = computed(() => eventLogStore.entries);

const scrollToBottom = (): void => {
  nextTick(() => {
    nextTick(() => {
      if (containerEl.value) containerEl.value.scrollTop = containerEl.value.scrollHeight;
    });
  });
};

onMounted(scrollToBottom);

watch(
  () => eventLogStore.entries.length,
  () => { if (!isHovering.value) scrollToBottom(); },
);

const onMouseEnter = (): void => {
  isHovering.value = true;
  scrollToBottom();
};

const onMouseLeave = (): void => {
  isHovering.value = false;
  scrollToBottom();
};
</script>

<style scoped>
.event-stream {
  flex-shrink: 0;
  width: 220px;
  height: 120px;
  overflow: hidden;
  cursor: default;
  margin-top: 24px;
  align-self: flex-end;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 38%, black 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 38%, black 100%);
}

.event-stream.is-hovering {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(143, 93, 35, 0.25) transparent;
  -webkit-mask-image: none;
  mask-image: none;
}

/* ── List ─────────────────────────────────────────────── */
.stream-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  position: relative;
}

/* ── Stream items ─────────────────────────────────────── */
.stream-item {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.45;
  color: #5d4935;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.10);
}

.stream-item--warn     { color: #c0392b; }
.stream-item--error    { color: #8b1c1c; }
.stream-item--positive { color: #b8860b; }

.event-stream.is-hovering .stream-item {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}

/* ── Player color dot ─────────────────────────────────── */
.stream-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
  flex-shrink: 0;
  opacity: 0.85;
}

/* ── Enter/leave transitions ──────────────────────────── */
.stream-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.stream-enter-active {
  transition: opacity 240ms ease, transform 240ms ease;
}

.stream-leave-active {
  position: absolute;
  width: 100%;
  transition: opacity 160ms ease, transform 160ms ease;
}
.stream-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.stream-move {
  transition: transform 240ms ease;
}

@media (max-width: 780px) {
  .event-stream {
    width: 100%;
    max-width: 100%;
  }
}
</style>
