export class CreateReviewDto {
  enrollmentId: string;
  rating: number; // 1-5
  comment?: string; // max 2000 chars
}
