import type { RoomSummary } from '@/types';

import { persistStoredSocketSession } from '@/socket/storage';

import { requestJson, requestNoContent } from './http';

interface HealthResponse {
  status: string;
  uptime: number;
}

interface RoomsResponse {
  rooms: RoomSummary[];
}

export interface RoomSessionResponse {
  roomId: string;
  sessionToken: string;
}

interface CreateRoomRequest {
  hostNickname: string;
}

interface JoinRoomRequest {
  nickname: string;
}

export const fetchHealth = async (): Promise<HealthResponse> =>
  requestJson<HealthResponse>('/health');

export const fetchRooms = async (): Promise<RoomSummary[]> => {
  const response = await requestJson<RoomsResponse>('/rooms');
  return response.rooms;
};

export const createRoom = async (hostNickname: string): Promise<RoomSessionResponse> =>
  requestJson<RoomSessionResponse>('/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hostNickname,
    } satisfies CreateRoomRequest),
  });

export const joinRoom = async (
  roomId: string,
  nickname: string,
): Promise<RoomSessionResponse> =>
  requestJson<RoomSessionResponse>(`/rooms/${roomId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nickname,
    } satisfies JoinRoomRequest),
  });

export const createRoomSession = async (
  hostNickname: string,
): Promise<RoomSessionResponse> => {
  const response = await createRoom(hostNickname);

  persistStoredSocketSession({
    roomId: response.roomId,
    sessionToken: response.sessionToken,
    nickname: hostNickname,
  });

  return response;
};

export const joinRoomSession = async (
  roomId: string,
  nickname: string,
): Promise<RoomSessionResponse> => {
  const response = await joinRoom(roomId, nickname);

  persistStoredSocketSession({
    roomId: response.roomId,
    sessionToken: response.sessionToken,
    nickname,
  });

  return response;
};

export const deleteRoom = async (
  roomId: string,
  sessionToken: string,
): Promise<void> =>
  requestNoContent(`/rooms/${roomId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });
