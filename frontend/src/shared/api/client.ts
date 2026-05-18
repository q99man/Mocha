export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type RequestOptions = RequestInit & {
  path: string;
};

const ERROR_FALLBACK_MESSAGES: Record<number, string> = {
  400: '요청이 거부되었습니다. 입력값을 확인한 뒤 다시 시도해 주세요.',
  401: '로그인이 필요합니다.',
  403: '접근 권한이 없습니다.',
  404: '요청한 정보를 찾을 수 없습니다.',
  409: '충돌이 발생했습니다. 상태를 확인해 주세요.',
};

async function resolveErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    if (payload.message && payload.message.trim()) {
      return payload.message;
    }
    if (payload.error && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Ignore body parsing failures and fall back to the generic message.
  }

  return fallback;
}

async function throwResponseError(response: Response): Promise<never> {
  const fallback =
    ERROR_FALLBACK_MESSAGES[response.status] ??
    (response.status >= 500
      ? '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      : '요청 처리에 실패했습니다. 다시 시도해 주세요.');

  throw new Error(await resolveErrorMessage(response, fallback));
}

async function assertOk(response: Response) {
  if (!response.ok) {
    await throwResponseError(response);
  }
}

async function requestJson<T>({ path, ...options }: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  await assertOk(response);

  return response.json() as Promise<T>;
}

export async function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>({ path, credentials: 'include' });
}

export async function postJson<TResponse, TRequest>(path: string, body: TRequest): Promise<TResponse> {
  return requestJson<TResponse>({
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
}

export async function patchJson<TResponse, TRequest>(path: string, body: TRequest): Promise<TResponse> {
  return requestJson<TResponse>({
    path,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
}

export async function postFormData<TResponse>(path: string, formData: FormData): Promise<TResponse> {
  return requestJson<TResponse>({
    path,
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
}

export async function putFormData<TResponse>(path: string, formData: FormData): Promise<TResponse> {
  return requestJson<TResponse>({
    path,
    method: 'PUT',
    credentials: 'include',
    body: formData,
  });
}

export async function deleteJson(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  await assertOk(response);
}

export async function deleteJsonResponse<TResponse>(path: string): Promise<TResponse> {
  return requestJson<TResponse>({
    path,
    method: 'DELETE',
    credentials: 'include',
  });
}

export function resolveApiUrl(path: string): string {
  if (/^[a-z][a-z\d+\-.]*:/i.test(path) || path.startsWith('//')) {
    return path;
  }
  return path.startsWith('/') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/${path}`;
}
