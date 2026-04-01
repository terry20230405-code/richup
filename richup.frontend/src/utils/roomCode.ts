export const getShortRoomCode = (roomId: string | null | undefined): string => {
  const normalizedRoomId = (roomId ?? '').trim();

  if (!normalizedRoomId) {
    return '----';
  }

  const digits = normalizedRoomId.replace(/\D/g, '');

  if (digits.length >= 4) {
    return digits.slice(-4);
  }

  if (digits.length > 0) {
    return digits.padStart(4, '0');
  }

  const fallback = normalizedRoomId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return fallback.slice(-4).padStart(4, '0');
};
