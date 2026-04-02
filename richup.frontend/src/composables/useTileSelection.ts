import { ref } from 'vue';

// Module-level singleton: all BoardTile instances share one selection state.
// Toggling the same tile again deselects it.
const selectedTileId = ref<number | null>(null);

export function useTileSelection() {
  return {
    selectedTileId,
    toggle(id: number) {
      selectedTileId.value = selectedTileId.value === id ? null : id;
    },
    clear() {
      selectedTileId.value = null;
    },
  };
}
