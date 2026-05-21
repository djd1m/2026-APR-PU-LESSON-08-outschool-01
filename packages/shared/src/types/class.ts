export enum ClassStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum SectionStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Class {
  id: string;
  title: string;
  description: string;
  subject: string;
  price: number;
  ageMin: number;
  ageMax: number;
  maxStudents: number;
  teacherId: string;
  status: ClassStatus;
  slug: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Section {
  id: string;
  classId: string;
  startTime: Date;
  endTime: Date;
  status: SectionStatus;
  maxStudents: number;
  enrolledCount: number;
  createdAt: Date;
  updatedAt: Date;
}
