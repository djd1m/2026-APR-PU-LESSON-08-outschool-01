export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ErrorDetail;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CursorPagination {
  cursor?: string;
  limit: number;
  hasMore: boolean;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
