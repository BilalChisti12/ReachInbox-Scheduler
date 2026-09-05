export interface Sender {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface EmailJob {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed';
  scheduledAt: string;
  sentAt?: string | null;
  error?: string | null;
  delayReason?: string | null;
}

export interface SearchResult {
  data: EmailJob[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SlackConnection {
  connected: boolean;
  teamName?: string;
}
