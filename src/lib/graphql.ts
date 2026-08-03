const API_URL = 'http://127.0.0.1:8002/graphql/';

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

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `JWT ${token}`;
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new GraphQLError(json.errors.map((e: { message: string }) => e.message));
  }

  return json.data as T;
}
