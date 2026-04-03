import { fetchJson } from './client';
import type { Challenge } from '../types/challenge';

export async function getChallenges(): Promise<Challenge[]> {
  return fetchJson<Challenge[]>('/api/challenges');
}

export async function getChallengeById(id: string | number): Promise<Challenge> {
  return fetchJson<Challenge>(`/api/challenges/${id}`);
}
