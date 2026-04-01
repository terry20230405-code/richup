import { createRouter, createWebHistory } from 'vue-router';

import GamePage from '@/pages/GamePage.vue';
import LobbyPage from '@/pages/LobbyPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'lobby',
      component: LobbyPage,
    },
    {
      path: '/game',
      name: 'game',
      component: GamePage,
    },
  ],
});
