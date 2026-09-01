import {
  createRoomSession,
  deleteRoom,
  joinRoomSession,
  type RoomSessionResponse,
} from '@/api/rooms';
import { connectGameSocket, disconnectGameSocket } from '@/socket/client';
import { pinia } from '@/stores/pinia';
import { useEventLogStore } from '@/stores/useEventLogStore';
import { useGameStore } from '@/stores/useGameStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { useSelfStore } from '@/stores/useSelfStore';
import {
  clearStoredSocketSession,
  readStoredSocketSession,
  type StoredSocketSession,
} from '@/socket/storage';

const connectWithStoredSession = (session: StoredSocketSession): void => {
  if (!session.roomId) {
    return;
  }

  connectGameSocket({
    roomId: session.roomId,
    sessionToken: session.sessionToken,
    nickname: session.nickname,
  });
};

const resetClientRoomState = (): void => {
  useGameStore(pinia).reset();
  usePlayersStore(pinia).reset();
  useSelfStore(pinia).reset();
  useEventLogStore(pinia).clear();
};

export const hostRoomAndConnect = async (
  hostNickname: string,
): Promise<RoomSessionResponse> => {
  // A lobby page may have auto-resumed an older session. Stop that socket
  // before switching the browser to the newly-created room.
  disconnectGameSocket();
  resetClientRoomState();
  const response = await createRoomSession(hostNickname);

  connectGameSocket({
    roomId: response.roomId,
    sessionToken: response.sessionToken,
    nickname: hostNickname,
  });

  return response;
};

export const joinRoomAndConnect = async (
  roomId: string,
  nickname: string,
): Promise<RoomSessionResponse> => {
  // Joining is also a session switch; do not leave a previous socket active
  // while the new room credentials are being persisted.
  disconnectGameSocket();
  resetClientRoomState();
  const response = await joinRoomSession(roomId, nickname);

  connectGameSocket({
    roomId: response.roomId,
    sessionToken: response.sessionToken,
    nickname,
  });

  return response;
};

export const resumeStoredRoomSession = (): boolean => {
  const storedSession = readStoredSocketSession();

  if (!storedSession.roomId || !storedSession.sessionToken) {
    return false;
  }

  connectWithStoredSession(storedSession);
  return true;
};

export const disconnectRoomSession = (): void => {
  disconnectGameSocket();
};

export const clearRoomSession = (): void => {
  disconnectGameSocket();
  resetClientRoomState();
  clearStoredSocketSession();
};

export const dissolveRoomAndClearSession = async (): Promise<void> => {
  const storedSession = readStoredSocketSession();

  if (!storedSession.roomId || !storedSession.sessionToken) {
    clearRoomSession();
    return;
  }

  await deleteRoom(storedSession.roomId, storedSession.sessionToken);
  clearRoomSession();
};
