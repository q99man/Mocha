const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

type RequestOptions = RequestInit & {
  path: string;
};

async function requestJson<T>({ path, ...options }: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('요청한 데이터를 찾을 수 없습니다.');
    }

    if (response.status === 400) {
      throw new Error('요청 내용을 다시 확인해 주세요.');
    }

    throw new Error('데이터를 불러오는 중 문제가 발생했습니다.');
  }

  return response.json() as Promise<T>;
}

export async function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>({ path });
}

export async function postJson<TResponse, TRequest>(path: string, body: TRequest): Promise<TResponse> {
  return requestJson<TResponse>({
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function postFormData<TResponse>(path: string, formData: FormData): Promise<TResponse> {
  return requestJson<TResponse>({
    path,
    method: 'POST',
    body: formData,
  });
}
