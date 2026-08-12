const API_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8002') + '/graphql/';

export const TOKEN_KEY = 'bus_jwt';
export const REFRESH_KEY = 'bus_refresh';
export const USER_KEY = 'bus_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAuth(token: string, refreshToken: string, user: object) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSavedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  company?: { id: string; name: string } | null;
  permissions?: string[];
}

export class GraphQLError extends Error {
  constructor(public messages: string[]) {
    super(messages[0] || 'GraphQL error');
  }
}

const REFRESH_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) { token refreshToken }
  }
`;

let _refreshing: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  _refreshing = (async () => {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: REFRESH_MUTATION, variables: { refreshToken } }),
      });
      const json = await res.json();
      const data = json.data?.refreshToken;
      if (data?.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
        return data.token as string;
      }
    } catch { /* ignore */ }
    return null;
  })();
  const result = await _refreshing;
  _refreshing = null;
  return result;
}

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  auth = true,
): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth && token) headers['Authorization'] = `JWT ${token}`;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    return res.json();
  };

  let json = await doFetch(auth ? getToken() : null);

  // If token expired, try refresh once
  const expired = json.errors?.some((e: { message: string }) =>
    /expired|signature/i.test(e.message),
  );
  if (auth && expired) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      json = await doFetch(newToken);
    }
  }

  if (json.errors?.length) {
    throw new GraphQLError(json.errors.map((e: { message: string }) => e.message));
  }

  return json.data as T;
}
