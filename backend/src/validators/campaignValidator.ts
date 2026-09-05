import { z } from 'zod';

export const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Body cannot be empty'),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date string',
  }).transform((val) => new Date(val)).refine((date) => date >= new Date(Date.now() - 5000), {
    message: 'Start time cannot be in the past',
  }),
  delayBetweenEmails: z.number().int().nonnegative().optional(),
  hourlyLimit: z.number().int().positive().optional(),
  recipients: z.array(z.string().email()).min(1, 'Must provide at least one recipient'),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string()
  })).optional()
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
