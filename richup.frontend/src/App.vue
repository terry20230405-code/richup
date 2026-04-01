<template>
  <main class="app-shell" :class="{ 'app-shell--game': isGameRoute }">
    <RouterView />
  </main>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const isGameRoute = computed(() => route.name === 'game');

watchEffect(() => {
  const overflow = isGameRoute.value ? 'hidden' : '';
  document.documentElement.style.overflow = overflow;
  document.body.style.overflow = overflow;
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(255, 214, 153, 0.75), transparent 40%),
    linear-gradient(145deg, #f6efe1 0%, #e7dcc5 48%, #d9ccb3 100%);
  color: #1f1a14;
  font-family: 'Itim', cursive;
  box-sizing: border-box;
}

.app-shell:not(.app-shell--game) {
  display: grid;
  align-items: start;
  justify-items: center;
  padding: 24px;
}

.app-shell--game {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  padding: 0;
}

.app-shell :deep(*) {
  box-sizing: border-box;
}

:global(html),
:global(body),
:global(#app) {
  min-height: 100%;
  margin: 0;
}
</style>
