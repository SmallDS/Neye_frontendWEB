import type { LoginResult } from '#/types/neye';

import { neyeApiRequest } from '#/api/neye';

export namespace AuthApi {
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

export async function loginApi(data: AuthApi.LoginParams) {
  return neyeApiRequest<LoginResult>('/auth/login', {
    body: JSON.stringify(data),
    method: 'POST',
    skipAuth: true,
  });
}

export async function refreshTokenApi() {
  return { data: '', status: 204 } satisfies AuthApi.RefreshTokenResult;
}

export async function logoutApi() {
  return null;
}

export async function getAccessCodesApi() {
  return [] as string[];
}