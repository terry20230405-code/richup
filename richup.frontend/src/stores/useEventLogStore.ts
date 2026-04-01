import { defineStore } from 'pinia';

export type EventLogType = 'info' | 'warn' | 'error';

export interface EventLogEntry {
  id: string;
  type: EventLogType;
  message: string;
  at: number;
}

const MAX_ENTRIES = 20;

let seq = 0;

export const useEventLogStore = defineStore('eventLog', {
  state: () => ({
    entries: [] as EventLogEntry[],
  }),
  actions: {
    push(type: EventLogType, message: string) {
      this.entries.push({ id: `${Date.now()}-${++seq}`, type, message, at: Date.now() });
      if (this.entries.length > MAX_ENTRIES) {
        this.entries.splice(0, this.entries.length - MAX_ENTRIES);
      }
    },
    clear() {
      this.entries = [];
    },
  },
});
