<template>
  <section class="page-card">
    <p class="eyebrow">Lobby</p>
    <h1>Enter a room, or host a new one.</h1>
    <p class="copy">
      The room REST flow is wired. You can refresh the lobby, create a room, or join an
      existing room from here.
    </p>

    <div class="actions-row">
      <button class="secondary-button" type="button" :disabled="isLoadingRooms" @click="loadRooms">
        {{ isLoadingRooms ? 'Refreshing...' : 'Refresh Rooms' }}
      </button>
      <button
        v-if="storedSession.roomId && storedSession.sessionToken"
        class="secondary-button"
        type="button"
        @click="handleResumeSession"
      >
        Resume Saved Session
      </button>
      <RouterLink class="nav-link" to="/game">Go To Game Shell</RouterLink>
    </div>

    <p v-if="roomsError" class="feedback feedback-error">{{ roomsError }}</p>
    <p v-else-if="joinError" class="feedback feedback-error">{{ joinError }}</p>
    <p v-else-if="hostError" class="feedback feedback-error">{{ hostError }}</p>

    <div class="grid">
      <form class="panel" @submit.prevent="handleHostRoom">
        <h2>Host Room</h2>
        <label class="field">
          <span>Host nickname</span>
          <input v-model.trim="hostNickname" type="text" maxlength="24" placeholder="Terry" />
        </label>
        <button class="primary-button" type="submit" :disabled="isHosting">
          {{ isHosting ? 'Creating...' : 'Create Room' }}
        </button>
      </form>

      <form class="panel" @submit.prevent="handleJoinRoom">
        <h2>Join Room</h2>
        <label class="field">
          <span>Room Number</span>
          <input
            :value="joinRoomId"
            type="text"
            maxlength="4"
            inputmode="numeric"
            placeholder="1234"
            @input="setJoinRoomCode(($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="field">
          <span>Nickname</span>
          <input v-model.trim="joinNickname" type="text" maxlength="24" placeholder="Player name" />
        </label>
        <button class="primary-button" type="submit" :disabled="isJoining">
          {{ isJoining ? 'Joining...' : 'Join Room' }}
        </button>
      </form>
    </div>

    <section class="panel">
      <div class="rooms-header">
        <h2>Active Rooms</h2>
        <span class="rooms-count">{{ rooms.length }} rooms</span>
      </div>

      <p v-if="isLoadingRooms && rooms.length === 0" class="feedback">Loading rooms...</p>
      <p v-else-if="rooms.length === 0" class="feedback">No rooms are open right now.</p>

      <ul v-else class="room-list">
        <li v-for="room in rooms" :key="room.id" class="room-item">
          <div>
            <p class="room-title">{{ getShortRoomCode(room.id) }}</p>
            <p class="room-meta">
              Host {{ room.hostNickname }} · {{ room.playerCount }} players · {{ room.status }}
            </p>
          </div>
          <button
            class="secondary-button"
            type="button"
            :disabled="isJoining"
            @click="prefillJoinRoom(room.id)"
          >
            Use Code
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { fetchRooms } from '@/api/rooms';
import { readStoredSocketSession } from '@/socket/storage';
import {
  hostRoomAndConnect,
  joinRoomAndConnect,
  resumeStoredRoomSession,
} from '@/services/roomSession';
import type { RoomSummary } from '@/types';
import { getShortRoomCode } from '@/utils/roomCode';

const router = useRouter();

const storedSession = readStoredSocketSession();
const rooms = ref<RoomSummary[]>([]);
const isLoadingRooms = ref(false);
const isHosting = ref(false);
const isJoining = ref(false);
const roomsError = ref('');
const hostError = ref('');
const joinError = ref('');

const hostNickname = ref('');
const joinRoomId = ref('');
const joinNickname = ref('');

const normalizeShortRoomCode = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

const setJoinRoomCode = (value: string): void => {
  joinRoomId.value = normalizeShortRoomCode(value);
};

const resolveRoomIdFromShortCode = (roomCode: string, roomList: RoomSummary[]): string | null => {
  const matches = roomList.filter((room) => getShortRoomCode(room.id) === roomCode);

  if (matches.length === 1) {
    return matches[0]!.id;
  }

  if (matches.length > 1) {
    throw new Error(`Room code ${roomCode} matches multiple rooms. Please refresh and try again.`);
  }

  return null;
};

const loadRooms = async (): Promise<void> => {
  isLoadingRooms.value = true;
  roomsError.value = '';

  try {
    rooms.value = await fetchRooms();
  } catch (error) {
    roomsError.value = error instanceof Error ? error.message : 'Failed to load room list.';
  } finally {
    isLoadingRooms.value = false;
  }
};

const handleHostRoom = async (): Promise<void> => {
  hostError.value = '';

  if (!hostNickname.value) {
    hostError.value = 'Please enter a host nickname.';
    return;
  }

  isHosting.value = true;

  try {
    await hostRoomAndConnect(hostNickname.value);
    await router.push('/game');
  } catch (error) {
    hostError.value = error instanceof Error ? error.message : 'Failed to create room.';
  } finally {
    isHosting.value = false;
  }
};

const handleJoinRoom = async (): Promise<void> => {
  joinError.value = '';

  if (!joinRoomId.value || !joinNickname.value) {
    joinError.value = 'Please enter the 4-digit room number and nickname.';
    return;
  }

  if (joinRoomId.value.length !== 4) {
    joinError.value = 'Room number must be 4 digits.';
    return;
  }

  isJoining.value = true;

  try {
    let resolvedRoomId = resolveRoomIdFromShortCode(joinRoomId.value, rooms.value);

    if (!resolvedRoomId) {
      const latestRooms = await fetchRooms();
      rooms.value = latestRooms;
      resolvedRoomId = resolveRoomIdFromShortCode(joinRoomId.value, latestRooms);
    }

    if (!resolvedRoomId) {
      throw new Error(`Room ${joinRoomId.value} was not found.`);
    }

    await joinRoomAndConnect(resolvedRoomId, joinNickname.value);
    await router.push('/game');
  } catch (error) {
    joinError.value = error instanceof Error ? error.message : 'Failed to join room.';
  } finally {
    isJoining.value = false;
  }
};

const prefillJoinRoom = (roomId: string): void => {
  setJoinRoomCode(getShortRoomCode(roomId));
};

const handleResumeSession = async (): Promise<void> => {
  const resumed = resumeStoredRoomSession();

  if (resumed) {
    await router.push('/game');
  }
};

onMounted(() => {
  void loadRooms();
});
</script>

<style scoped>
.page-card {
  width: min(720px, 100%);
  padding: 32px;
  border-radius: 24px;
  background: rgba(255, 251, 244, 0.9);
  border: 1px solid rgba(100, 72, 38, 0.12);
  box-shadow: 0 24px 60px rgba(71, 49, 19, 0.14);
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8f5d23;
}

h1 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.08;
}

.copy {
  margin: 16px 0 24px;
  max-width: 50ch;
  font-size: 1rem;
  line-height: 1.7;
  color: #5d4b37;
}

.actions-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.panel {
  padding: 20px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(100, 72, 38, 0.12);
}

.panel h2 {
  margin: 0 0 16px;
  font-size: 1.1rem;
}

.field {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
}

.field span {
  font-size: 0.9rem;
  font-weight: 600;
  color: #5d4b37;
}

.field input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(100, 72, 38, 0.2);
  background: #fffdfa;
  color: #1f1a14;
  font: inherit;
}

.field input:focus {
  outline: 2px solid rgba(143, 93, 35, 0.24);
  border-color: rgba(143, 93, 35, 0.5);
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  border-radius: 999px;
  background: #1f1a14;
  color: #fff7ed;
  text-decoration: none;
  font-weight: 600;
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  border-radius: 999px;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.primary-button {
  background: #1f1a14;
  color: #fff7ed;
}

.secondary-button {
  background: #eadbc2;
  color: #4e3b27;
}

.primary-button:disabled,
.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.feedback {
  margin: 0 0 16px;
  color: #5d4b37;
}

.feedback-error {
  color: #9c2f2f;
}

.rooms-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.rooms-count {
  color: #7a654b;
  font-size: 0.9rem;
}

.room-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(100, 72, 38, 0.1);
}

.room-title {
  margin: 0 0 6px;
  font-weight: 700;
  color: #2a2017;
}

.room-meta {
  margin: 0;
  color: #6f5c47;
  line-height: 1.5;
}
</style>
