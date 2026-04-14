export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type RequestOptions = RequestInit & {
  path: string;
};

async function requestJson<T>({ path, ...options }: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('요청한 정보를 찾을 수 없습니다.');
    }

    if (response.status === 400) {
      throw new Error('요청이 거부되었습니다. 입력값을 확인한 뒤 다시 시도해 주세요.');
    }

    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }

    if (response.status === 403) {
      throw new Error('접근 권한이 없습니다.');
    }

    if (response.status >= 500) {
      throw new Error('서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }

    throw new Error('요청 처리에 실패했습니다. 다시 시도해 주세요.');
  }

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

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('요청한 정보를 찾을 수 없습니다.');
    }

    if (response.status === 400) {
      throw new Error('요청이 거부되었습니다. 입력값을 확인한 뒤 다시 시도해 주세요.');
    }

    if (response.status === 401) {
      throw new Error('로그인이 필요합니다.');
    }

    if (response.status === 403) {
      throw new Error('접근 권한이 없습니다.');
    }

    if (response.status >= 500) {
      throw new Error('서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }

    throw new Error('요청 처리에 실패했습니다. 다시 시도해 주세요.');
  }
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}
