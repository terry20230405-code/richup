<template>
  <span class="floating-text">{{ text }}</span>
</template>

<script setup lang="ts">
defineProps<{ text: string }>();
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

@keyframes float-up {
  0%   { opacity: 1; transform: translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(-50%, calc(-50% - 36px)); }
}
</style>
