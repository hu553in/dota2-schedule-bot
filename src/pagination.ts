import { z } from "zod";

export const PAGE_SIZE = 6;
export const MAX_PAGE = 10_000;
export const callbackPageSchema = z.coerce.number().int().min(1).max(MAX_PAGE);

export interface Page<T> {
  data: T[];
  hasNext: boolean;
  page: number;
  total?: number;
  totalPages?: number;
}
