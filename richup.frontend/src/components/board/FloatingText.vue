<template>
  <span class="floating-text" :class="{ 'floating-text--global': isGlobal }">{{ text }}</span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ text: string; isGlobal?: boolean }>(), {
  isGlobal: false,
});
</script>

<style scoped>
.floating-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #c0392b;
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  z-index: 20;
  writing-mode: horizontal-tb !important;
  animation: float-up 1.5s ease-out forwards;
}

.floating-text--global {
  position: fixed;
  top: 42%;
  left: 50%;
  z-index: 1200;
  font-size: clamp(1.25rem, 2.2vw, 2rem);
  text-shadow: 0 2px 10px rgba(255, 250, 240, 0.9);
}

@keyframes float-up {
  0%   { opacity: 1; transform: translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(-50%, calc(-50% - 36px)); }
}
</style>
