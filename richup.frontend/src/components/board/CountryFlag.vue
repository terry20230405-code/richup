<template>
  <svg viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <template v-if="code === 'kr'">
      <rect width="24" height="16" fill="#fff" />
      <path d="M8 8a4 4 0 0 1 8 0 2 2 0 0 1-4 0 2 2 0 0 0-4 0Z" fill="#cd2e3a" />
      <path d="M8 8a4 4 0 0 0 8 0 2 2 0 0 1-4 0 2 2 0 0 0-4 0Z" fill="#0047a0" />
      <g stroke="#111" stroke-width="0.7">
        <path d="M3 3l3 1M3.3 2l3 1M2.7 4l3 1M18 12l3 1M17.7 13l3 1M18.3 11l3 1" />
        <path d="M18 4l3-1M17.7 3l3-1M18.3 5l3-1M3 13l3-1M3.3 14l3-1M2.7 12l3-1" />
      </g>
    </template>

    <template v-else-if="code === 'it'">
      <rect width="8" height="16" fill="#009246" />
      <rect x="8" width="8" height="16" fill="#fff" />
      <rect x="16" width="8" height="16" fill="#ce2b37" />
    </template>

    <template v-else-if="code === 'ca'">
      <rect width="24" height="16" fill="#fff" />
      <rect width="6" height="16" fill="#d52b1e" />
      <rect x="18" width="6" height="16" fill="#d52b1e" />
      <polygon
        points="12,2.6 12.8,5.1 14.7,4.4 14,6.4 16,7.2 13.8,8.1 14.4,10.6 12.6,9.7 12,13.4 11.4,9.7 9.6,10.6 10.2,8.1 8,7.2 10,6.4 9.3,4.4 11.2,5.1"
        fill="#d52b1e"
      />
    </template>

    <template v-else-if="code === 'fr'">
      <rect width="8" height="16" fill="#0055a4" />
      <rect x="8" width="8" height="16" fill="#fff" />
      <rect x="16" width="8" height="16" fill="#ef4135" />
    </template>

    <template v-else-if="code === 'gb'">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" stroke-width="4" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" stroke-width="1.6" />
      <path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" stroke-width="2.8" />
    </template>

    <template v-else-if="code === 'de'">
      <rect width="24" height="5.34" fill="#111" />
      <rect y="5.33" width="24" height="5.34" fill="#dd0000" />
      <rect y="10.66" width="24" height="5.34" fill="#ffce00" />
    </template>

    <template v-else-if="code === 'jp'">
      <rect width="24" height="16" fill="#fff" />
      <circle cx="12" cy="8" r="4.2" fill="#bc002d" />
    </template>

    <template v-else-if="code === 'cn'">
      <rect width="24" height="16" fill="#de2910" />
      <polygon points="4,2 4.7,3.7 6.5,3.8 5.1,4.9 5.6,6.7 4,5.7 2.4,6.7 2.9,4.9 1.5,3.8 3.3,3.7" fill="#ffde00" />
      <circle cx="8" cy="2.7" r="0.65" fill="#ffde00" />
      <circle cx="9.6" cy="4.4" r="0.65" fill="#ffde00" />
      <circle cx="9.6" cy="6.7" r="0.65" fill="#ffde00" />
      <circle cx="8" cy="8.5" r="0.65" fill="#ffde00" />
    </template>

    <template v-else-if="code === 'us'">
      <rect width="24" height="16" fill="#fff" />
      <g fill="#b22234">
        <rect width="24" height="1.24" />
        <rect y="2.46" width="24" height="1.24" />
        <rect y="4.92" width="24" height="1.24" />
        <rect y="7.38" width="24" height="1.24" />
        <rect y="9.84" width="24" height="1.24" />
        <rect y="12.3" width="24" height="1.24" />
        <rect y="14.76" width="24" height="1.24" />
      </g>
      <rect width="10.4" height="8.62" fill="#3c3b6e" />
      <g fill="#fff">
        <circle v-for="x in [1.4, 3.3, 5.2, 7.1, 9]" :key="`top-${x}`" :cx="x" cy="2" r="0.38" />
        <circle v-for="x in [2.3, 4.2, 6.1, 8]" :key="`middle-${x}`" :cx="x" cy="4.3" r="0.38" />
        <circle v-for="x in [1.4, 3.3, 5.2, 7.1, 9]" :key="`bottom-${x}`" :cx="x" cy="6.6" r="0.38" />
      </g>
    </template>

    <template v-else-if="code === 'ae'">
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5.34" fill="#00732f" />
      <rect y="10.66" width="24" height="5.34" fill="#000" />
      <rect width="6" height="16" fill="#ff0000" />
    </template>

    <template v-else-if="code === 'au'">
      <rect width="24" height="16" fill="#00008b" />
      <rect width="10" height="8" fill="#012169" />
      <path d="M0 0l10 8M10 0L0 8" stroke="#fff" stroke-width="2" />
      <path d="M0 0l10 8M10 0L0 8" stroke="#c8102e" stroke-width="0.8" />
      <path d="M5 0v8M0 4h10" stroke="#fff" stroke-width="2.4" />
      <path d="M5 0v8M0 4h10" stroke="#c8102e" stroke-width="1.2" />
      <g fill="#fff">
        <polygon points="5,9.4 5.6,11 7.3,11 5.9,12 6.4,13.7 5,12.7 3.6,13.7 4.1,12 2.7,11 4.4,11" />
        <circle cx="17" cy="4" r="0.85" />
        <circle cx="20.5" cy="7" r="0.75" />
        <circle cx="17.5" cy="12" r="0.85" />
        <circle cx="13.5" cy="8" r="0.7" />
      </g>
    </template>

    <rect v-else width="24" height="16" fill="#d8d2c4" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  code: string;
}>();
</script>

<style scoped>
svg {
  display: block;
  border: 1px solid rgba(42, 31, 20, 0.2);
  border-radius: 1px;
  box-shadow: 0 1px 2px rgba(42, 31, 20, 0.16);
}
</style>
