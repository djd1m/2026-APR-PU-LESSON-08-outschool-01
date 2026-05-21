export interface Review {
  id: string;
  enrollmentId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  flagged: boolean;
  flagReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
