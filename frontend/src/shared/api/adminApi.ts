import { fetchJson, postFormData } from './client';
import type { ModelAsset } from '../types/admin';

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
