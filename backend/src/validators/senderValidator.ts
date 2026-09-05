import { z } from 'zod';

export const createSenderSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive(),
  smtpUsername: z.string().min(1),
  smtpPassword: z.string().min(1)
});

export type CreateSenderInput = z.infer<typeof createSenderSchema>;
