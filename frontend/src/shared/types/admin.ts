export type ModelAsset = {
  id: number;
  assetType: 'POSE_LANDMARKER';
  originalFileName: string;
  storagePath: string;
  runtimePath: string;
  contentType: string | null;
  size: number;
  versionLabel: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminMemberSummary = {
  id: number;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  authProvider: 'LOCAL' | 'GOOGLE' | 'KAKAO' | 'NAVER';
  createdAt: string;
  self: boolean;
  hasActivity: boolean;
  canDelete: boolean;
};

export type AdminMemberOverview = {
  totalCount: number;
  adminCount: number;
  userCount: number;
  recentMembers: AdminMemberSummary[];
};

export type AdminMemberListResponse = {
  items: AdminMemberSummary[];
  totalCount: number;
  page: number;
  size: number;
};

export type AdminMemberCreateInput = {
  email: string;
  displayName: string;
  password: string;
  role: 'USER' | 'ADMIN';
};

export type AdminMemberUpdateInput = {
  email: string;
  displayName: string;
  password?: string;
  role: 'USER' | 'ADMIN';
};

export type ModelAssetUpdateInput = {
  versionLabel?: string | null;
  active?: boolean | null;
};
