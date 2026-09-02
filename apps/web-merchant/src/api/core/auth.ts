import type { components as NeyeApiComponents } from '@neye/api/generated';

import type { LoginResult } from '#/types/neye';

import { loginApi as portalLoginApi } from '#/api/neye';

export namespace AuthApi {
  export type LoginParams = Partial<
    NeyeApiComponents['schemas']['LoginRequest']
  >;

  export interface LoginResult {
    accessToken: string;
  }
}

export async function loginApi(data: AuthApi.LoginParams) {
  return portalLoginApi(data, 'merchant') as Promise<LoginResult>;
}

export async function logoutApi() {
  return null;
}

export async function getAccessCodesApi() {
  return [] as string[];
}
