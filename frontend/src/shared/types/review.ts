export type Review = {
  id: number;
  challengeId: number;
  challengeTitle: string;
  memberId: number;
  memberDisplayName: string;
  rating: number;
  content: string;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReviewInput = {
  rating: number;
  content: string;
};
