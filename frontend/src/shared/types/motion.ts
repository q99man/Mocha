export type MotionSessionState = {
  challengeId: number;
  sessionState: 'READY';
  nextAction: 'REQUEST_CAMERA_PERMISSION';
  cameraPermissionRequired: boolean;
  recordingEnabled: boolean;
  scoringEnabled: boolean;
  message: string;
};