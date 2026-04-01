export const STORAGE_KEYS = {
  roomId: 'roomId',
  sessionToken: 'sessionToken',
  nickname: 'playerNickname',
} as const;

export interface StoredSocketSession {
  roomId?: string;
  sessionToken?: string;
  nickname?: string;
}

export const readStoredSocketSession = (): StoredSocketSession => ({
  roomId: localStorage.getItem(STORAGE_KEYS.roomId) ?? undefined,
  sessionToken: localStorage.getItem(STORAGE_KEYS.sessionToken) ?? undefined,
  nickname: localStorage.getItem(STORAGE_KEYS.nickname) ?? undefined,
});

export const persistStoredSocketSession = (session: StoredSocketSession): void => {
  if (session.roomId) {
    localStorage.setItem(STORAGE_KEYS.roomId, session.roomId);
  }

  if (session.sessionToken) {
    localStorage.setItem(STORAGE_KEYS.sessionToken, session.sessionToken);
  }

  if (session.nickname) {
    localStorage.setItem(STORAGE_KEYS.nickname, session.nickname);
  }
};

export const clearStoredSocketSession = (): void => {
  localStorage.removeItem(STORAGE_KEYS.roomId);
  localStorage.removeItem(STORAGE_KEYS.sessionToken);
  localStorage.removeItem(STORAGE_KEYS.nickname);
};
