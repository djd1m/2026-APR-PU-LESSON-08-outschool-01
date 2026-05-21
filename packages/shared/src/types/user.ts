export enum UserRole {
  PARENT = 'PARENT',
  TEACHER = 'TEACHER',
  CHILD = 'CHILD',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Child {
  id: string;
  name: string;
  age: number;
  birthDate: Date;
  parentId: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherProfile {
  id: string;
  userId: string;
  bio: string;
  education: string;
  experience: string;
  subjects: string[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  verificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}
