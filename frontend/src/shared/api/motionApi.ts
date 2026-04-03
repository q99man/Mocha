import { fetchJson } from './client';
import type { MotionSessionState } from '../types/motion';

export async function getMotionSessionState(challengeId: number): Promise<MotionSessionState> {
  return fetchJson<MotionSessionState>(`/api/challenges/${challengeId}/motion-session`);
}