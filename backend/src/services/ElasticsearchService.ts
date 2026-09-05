import { EmailJob } from '@prisma/client';
import esClient from '../config/elasticsearch';

export interface EmailSearchOptions {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export class ElasticsearchService {
  private readonly INDEX_NAME = 'email_jobs';

  /**
   * Initializes the index with explicit mappings.
   * Safe to call on startup (idempotent).
   */
  async initIndex() {
    try {
      const response = await esClient.indices.exists({ index: this.INDEX_NAME });
      const indexExists = response.body;
      
      if (!indexExists) {
        await esClient.indices.create({
          index: this.INDEX_NAME,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                userId: { type: 'keyword' },
                campaignId: { type: 'keyword' },
                senderId: { type: 'keyword' },
                sender: { type: 'keyword' },
                recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' }
              }
            }
          }
        });
        console.log(`Elasticsearch index '${this.INDEX_NAME}' created.`);
      } else {
        console.log(`Elasticsearch index '${this.INDEX_NAME}' already exists.`);
      }
    } catch (error: any) {
      console.error(`Failed to initialize Elasticsearch index. Error:`, JSON.stringify(error, null, 2));
      if (error.message) {
        console.error(`Message: ${error.message}`);
      }
    }
  }

  /**
   * Indexes or updates a single EmailJob document.
   * This is decoupled from SMTP execution.
   */
  async indexEmail(emailJob: EmailJob & { sender: any }) {
    try {
      await esClient.index({
        index: this.INDEX_NAME,
        id: emailJob.id,
        body: {
          id: emailJob.id,
          userId: emailJob.userId,
          campaignId: emailJob.campaignId,
          senderId: emailJob.senderId,
          sender: emailJob.sender.email,
          recipient: emailJob.recipient,
          subject: emailJob.subject,
          body: emailJob.body,
          status: emailJob.status,
          scheduledAt: emailJob.scheduledAt,
          sentAt: emailJob.sentAt,
          createdAt: emailJob.createdAt,
          updatedAt: emailJob.updatedAt
        }
      });
      // Optionally refresh the index for immediate search visibility (mostly useful in tests)
      // await esClient.indices.refresh({ index: this.INDEX_NAME });
    } catch (error: any) {
      console.error(`Elasticsearch indexing failed for job ${emailJob.id}: ${error.message}`);
      // DO NOT THROW. A failure to index should not cause BullMQ to retry the job (which would resend the email).
    }
  }

  /**
   * Deletes a single EmailJob document from the index.
   */
  async deleteEmail(id: string) {
    try {
      await esClient.delete({
        index: this.INDEX_NAME,
        id: id,
        refresh: true
      });
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        console.error(`Failed to delete email ${id} from ES: ${error.message}`);
      }
    }
  }

  /**
   * Searches for emails strictly scoped to the provided userId.
   */
  async searchEmails(userId: string, options: EmailSearchOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const from = (page - 1) * limit;

    const must: any[] = [
      { term: { userId: userId } } // STRICT TENANT ISOLATION
    ];

    if (options.status) {
      must.push({ term: { status: options.status } });
    }

    if (options.startDate || options.endDate) {
      const range: any = {};
      if (options.startDate) range.gte = options.startDate;
      if (options.endDate) range.lte = options.endDate;
      must.push({ range: { scheduledAt: range } });
    }

    if (options.q) {
      must.push({
        multi_match: {
          query: options.q,
          type: 'phrase_prefix',
          fields: ['subject', 'body', 'recipient']
        }
      });
    }

    try {
      const result = await esClient.search({
        index: this.INDEX_NAME,
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must
            }
          },
          sort: [
            { createdAt: { order: 'desc' } }
          ]
        }
      });

      const hits = result.body.hits.hits.map((hit: any) => hit._source);
      
      const total = typeof result.body.hits.total === 'number' 
        ? result.body.hits.total 
        : (result.body.hits.total as any)?.value || 0;

      return {
        data: hits,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error: any) {
      console.error(`Elasticsearch search failed: ${error.message}`);
      throw new Error('Search operation failed');
    }
  }
}
