import {
  createRoomSession,
  deleteRoom,
  joinRoomSession,
  type RoomSessionResponse,
} from '@/api/rooms';
import { connectGameSocket, disconnectGameSocket } from '@/socket/client';
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

export const hostRoomAndConnect = async (
  hostNickname: string,
): Promise<RoomSessionResponse> => {
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
