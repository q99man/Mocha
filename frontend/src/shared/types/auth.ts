export type AuthRole = 'USER' | 'ADMIN';

export type AuthSession = {
  id: number;
  email: string;
  displayName: string;
  role: AuthRole;
  authenticated: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
};
