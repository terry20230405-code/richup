import { defineStore } from 'pinia';

import type { PlayerId, PlayerPublicView, PlayerStatus, TileId } from '@/types';

interface PlayersState {
  players: Record<PlayerId, PlayerPublicView>;
}

const clonePlayer = (player: PlayerPublicView): PlayerPublicView => ({
  ...player,
});

export const usePlayersStore = defineStore('players', {
  state: (): PlayersState => ({
    players: {},
  }),
  getters: {
    playerList: (state) => Object.values(state.players),
    hasPlayers: (state) => Object.keys(state.players).length > 0,
  },
  actions: {
    reset() {
      this.players = {};
    },
    hydrate(playerViews: PlayerPublicView[]) {
      const nextPlayers: Record<PlayerId, PlayerPublicView> = {};

      for (const player of playerViews) {
        nextPlayers[player.id] = clonePlayer(player);
      }

      this.players = nextPlayers;
    },
    upsert(player: PlayerPublicView) {
      this.players[player.id] = clonePlayer(player);
    },
    updateMovement(playerId: PlayerId, position: TileId, previousPosition: TileId) {
      const player = this.players[playerId];
      if (!player) {
        return;
      }

      player.position = position;
      player.previousPosition = previousPosition;
    },
    updateStatus(playerId: PlayerId, status: PlayerStatus) {
      const player = this.players[playerId];
      if (!player) {
        return;
      }

      player.status = status;
    },
    updateJailState(playerId: PlayerId, inJail: boolean, jailTurnsWaited = 0) {
      const player = this.players[playerId];
      if (!player) {
        return;
      }

      player.inJail = inJail;
      player.jailTurnsWaited = jailTurnsWaited;
    },
    updateConnection(playerId: PlayerId, isConnected: boolean) {
      const player = this.players[playerId];
      if (!player) {
        return;
      }

      player.isConnected = isConnected;
    },
    patchPlayer(playerId: PlayerId, patch: Partial<Omit<PlayerPublicView, 'id'>>) {
      const player = this.players[playerId];
      if (!player) {
        return;
      }

      this.players[playerId] = {
        ...player,
        ...patch,
      };
    },
  },
});
