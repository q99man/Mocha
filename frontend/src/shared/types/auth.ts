export type AuthRole = 'USER' | 'ADMIN';
export type AuthProvider = 'LOCAL' | 'GOOGLE' | 'KAKAO' | 'NAVER';
export type SocialAuthProvider = Exclude<AuthProvider, 'LOCAL'>;

export type AuthSession = {
  id: number;
  email: string;
  displayName: string;
  authProvider: AuthProvider;
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
