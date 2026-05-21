export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  enrollmentId: string;
  amount: number;
  commission: number;
  teacherPayout: number;
  status: PaymentStatus;
  yookassaId?: string;
  paidAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
