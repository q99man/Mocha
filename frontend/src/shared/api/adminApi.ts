import { deleteJson, fetchJson, patchJson, postFormData, postJson } from './client';
import type {
  AdminMemberCreateInput,
  AdminMemberListResponse,
  AdminMemberOverview,
  AdminMemberSummary,
  AdminMemberUpdateInput,
  ModelAsset,
  ModelAssetUpdateInput,
} from '../types/admin';

export async function getPoseLandmarkerAssets(): Promise<ModelAsset[]> {
  return fetchJson<ModelAsset[]>('/api/admin/model-assets/pose-landmarker');
}

export async function getActivePoseLandmarkerAsset(): Promise<ModelAsset> {
  return fetchJson<ModelAsset>('/api/admin/model-assets/pose-landmarker/active');
}

export async function uploadPoseLandmarkerModel(modelFile: File, versionLabel?: string): Promise<ModelAsset> {
  const formData = new FormData();
  formData.append('modelFile', modelFile);
  if (versionLabel && versionLabel.trim()) {
    formData.append('versionLabel', versionLabel.trim());
  }

  return postFormData<ModelAsset>('/api/admin/model-assets/pose-landmarker', formData);
}

export async function deletePoseLandmarkerModel(id: number): Promise<void> {
  return deleteJson(`/api/admin/model-assets/pose-landmarker/${id}`);
}

export async function updatePoseLandmarkerModel(id: number, input: ModelAssetUpdateInput): Promise<ModelAsset> {
  return patchJson<ModelAsset, ModelAssetUpdateInput>(`/api/admin/model-assets/pose-landmarker/${id}`, input);
}

export async function getAdminMemberOverview(): Promise<AdminMemberOverview> {
  return fetchJson<AdminMemberOverview>('/api/admin/members/overview');
}

export async function getAdminMembers(params: {
  page?: number;
  size?: number;
  role?: 'ALL' | 'USER' | 'ADMIN';
  authProvider?: 'ALL' | 'LOCAL' | 'GOOGLE' | 'KAKAO' | 'NAVER';
  sort?: 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'EMAIL_ASC' | 'PROVIDER_ASC';
  keyword?: string;
} = {}): Promise<AdminMemberListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set('page', String(params.page));
  if (params.size != null) searchParams.set('size', String(params.size));
  if (params.role && params.role !== 'ALL') searchParams.set('role', params.role);
  if (params.authProvider && params.authProvider !== 'ALL') searchParams.set('authProvider', params.authProvider);
  if (params.sort && params.sort !== 'NEWEST') searchParams.set('sort', params.sort);
  if (params.keyword?.trim()) searchParams.set('keyword', params.keyword.trim());
  const query = searchParams.toString();
  return fetchJson<AdminMemberListResponse>(`/api/admin/members${query ? `?${query}` : ''}`);
}

export async function createAdminMember(input: AdminMemberCreateInput): Promise<AdminMemberSummary> {
  return postJson<AdminMemberSummary, AdminMemberCreateInput>('/api/admin/members', input);
}

export async function updateAdminMember(id: number, input: AdminMemberUpdateInput): Promise<AdminMemberSummary> {
  return patchJson<AdminMemberSummary, AdminMemberUpdateInput>(`/api/admin/members/${id}`, input);
}

export async function deleteAdminMember(id: number): Promise<void> {
  return deleteJson(`/api/admin/members/${id}`);
}
