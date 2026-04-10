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
