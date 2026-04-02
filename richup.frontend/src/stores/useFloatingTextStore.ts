import { defineStore } from 'pinia';

interface FloatingTextEntry {
  id: string;
  tilePosition: number;
  text: string;
}

let seq = 0;

export const useFloatingTextStore = defineStore('floatingText', {
  state: () => ({
    texts: [] as FloatingTextEntry[],
  }),
  actions: {
    show(tilePosition: number, text: string) {
      const id = `ft-${Date.now()}-${++seq}`;
      this.texts.push({ id, tilePosition, text });
      setTimeout(() => this.remove(id), 1600);
    },
    remove(id: string) {
      this.texts = this.texts.filter((t) => t.id !== id);
    },
  },
});
