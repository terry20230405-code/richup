import { defineStore } from 'pinia';

import type { PlayerSelfView, PlayerStatus, PropCard, TileId } from '@/types';

interface SelfState {
  id: string;
  nickname: string;
  avatarIndex: number;
  color: string;
  position: TileId;
  previousPosition: TileId;
  cash: number;
  propCards: PropCard[];
  hasImmunity: boolean;
  priceHikeActive: boolean;
  constructibleTileIds: TileId[];
  inJail: boolean;
  jailTurnsWaited: number;
  status: PlayerStatus;
  isConnected: boolean;
}

const createInitialSelfState = (): SelfState => ({
  id: '',
  nickname: '',
  avatarIndex: 0,
  color: '#8f5d23',
  position: 0,
  previousPosition: 0,
  cash: 0,
  propCards: [],
  hasImmunity: false,
  priceHikeActive: false,
  constructibleTileIds: [],
  inJail: false,
  jailTurnsWaited: 0,
  status: 'ACTIVE',
  isConnected: false,
});

export const useSelfStore = defineStore('self', {
  state: (): SelfState => createInitialSelfState(),
  getters: {
    constructibleSet: (state) => new Set(state.constructibleTileIds),
    isHydrated: (state) => state.id.length > 0,
  },
  actions: {
    reset() {
      Object.assign(this, createInitialSelfState());
    },
    hydrate(selfView: PlayerSelfView) {
      this.id = selfView.id;
      this.nickname = selfView.nickname;
      this.avatarIndex = selfView.avatarIndex;
      this.color = selfView.color;
      this.position = selfView.position;
      this.previousPosition = selfView.previousPosition;
      this.cash = selfView.cash;
      this.propCards = [...selfView.propCards];
      this.hasImmunity = selfView.hasImmunity;
      this.priceHikeActive = selfView.priceHikeActive;
      this.constructibleTileIds = [...selfView.constructibleTileIds];
      this.inJail = selfView.inJail;
      this.jailTurnsWaited = selfView.jailTurnsWaited;
      this.status = selfView.status;
      this.isConnected = selfView.isConnected;
    },
    setMovement(position: TileId, previousPosition: TileId) {
      this.position = position;
      this.previousPosition = previousPosition;
    },
    setCash(cash: number) {
      this.cash = cash;
    },
    setPropCards(propCards: PropCard[]) {
      this.propCards = [...propCards];
    },
    setConstructibleTileIds(tileIds: TileId[]) {
      this.constructibleTileIds = [...tileIds];
    },
    addConstructibleTile(tileId: TileId) {
      if (this.constructibleTileIds.includes(tileId)) {
        return;
      }

      this.constructibleTileIds = [...this.constructibleTileIds, tileId];
    },
    removeConstructibleTile(tileId: TileId) {
      this.constructibleTileIds = this.constructibleTileIds.filter(
        (constructibleTileId) => constructibleTileId !== tileId,
      );
    },
    setJailState(inJail: boolean, jailTurnsWaited?: number) {
      this.inJail = inJail;
      this.jailTurnsWaited = jailTurnsWaited ?? this.jailTurnsWaited;
    },
    setStatus(status: PlayerStatus) {
      this.status = status;
    },
    consumeImmunity() {
      this.hasImmunity = false;
    },
    clearPriceHike() {
      this.priceHikeActive = false;
    },
    setConnected(isConnected: boolean) {
      this.isConnected = isConnected;
    },
  },
});
