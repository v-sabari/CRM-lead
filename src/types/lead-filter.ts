import { z } from 'zod';

export const leadFilterSchema = z.object({
  fieldId: z.string().min(1, 'fieldId is required'),
  fieldType: z.enum(['string', 'number', 'date', 'boolean'], {
    errorMap: () => ({ message: 'fieldType must be one of: string, number, date, boolean' }),
  }),
  condition: z.enum([
    'is', 'is not', 'contain', 'does not contain',
    'starts with', 'ends with', 'before', 'after',
    'greater than', 'less than', 'is empty', 'is not empty',
  ], {
    errorMap: () => ({
      message: 'condition must be one of: is, is not, contain, does not contain, starts with, ends with, before, after, greater than, less than, is empty, is not empty',
    }),
  }),
  value: z.string().optional(),
  inputType: z.string().optional(),
});

export const queryLeadsBodySchema = z.object({
  q: z.string().optional(),
  logic: z.enum(['AND', 'OR']).optional().default('AND'),
  filters: z.array(leadFilterSchema).optional().default([]),
});

export const queryLeadsParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'followUpDate']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});

export type LeadFilter = z.infer<typeof leadFilterSchema>;
export type QueryLeadsBody = z.infer<typeof queryLeadsBodySchema>;
export type QueryLeadsParams = z.infer<typeof queryLeadsParamsSchema>;
