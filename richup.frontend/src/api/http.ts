const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

export const requestJson = async <TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> => {
  const response = await fetch(buildUrl(path), init);

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return (await response.json()) as TResponse;
};

export const requestNoContent = async (
  path: string,
  init?: RequestInit,
): Promise<void> => {
  const response = await fetch(buildUrl(path), init);

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
};
