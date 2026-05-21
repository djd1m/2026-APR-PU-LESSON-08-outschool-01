export interface Achievement {
  id: string;
  childId: string;
  type: string;
  xp: number;
  badge?: string;
  createdAt: Date;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  requiredXp: number;
}
