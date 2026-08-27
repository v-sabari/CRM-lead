import { z } from 'zod';

export const createLeadBodySchema = z.object({
  name: z.string().min(1, 'name is required'),
  phone: z.string().min(1, 'phone is required'),
  countryCode: z.string().optional().default('+91'),
  email: z.string().email('email must be valid').optional().nullable(),
  assignedTo: z.string().min(1, 'assignedTo must be a valid user id').optional().nullable(),
  followUpDate: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)), {
    message: 'followUpDate must be YYYY-MM-DD',
  }).optional().nullable(),
});

export const updateLeadBodySchema = z.object({
  name: z.string().min(1, 'name must not be empty').optional(),
  phone: z.string().min(1, 'phone must not be empty').optional(),
  countryCode: z.string().optional(),
  email: z.string().email('email must be valid').optional().nullable(),
  assignedTo: z.string().min(1, 'assignedTo must be a valid user id').optional().nullable(),
  followUpDate: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)), {
    message: 'followUpDate must be YYYY-MM-DD',
  }).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export type CreateLeadBody = z.infer<typeof createLeadBodySchema>;
export type UpdateLeadBody = z.infer<typeof updateLeadBodySchema>;
