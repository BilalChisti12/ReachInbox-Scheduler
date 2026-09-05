import { redisConnection } from '../config/queue';

const RATE_LIMIT_SCRIPT = `
  local senderKey = KEYS[1]
  local campaignKey = KEYS[2]
  local senderLimit = tonumber(ARGV[1])
  local campaignLimit = tonumber(ARGV[2])

  local currentSenderCount = tonumber(redis.call('GET', senderKey) or '0')
  if currentSenderCount >= senderLimit then
      return -1 -- Sender limit reached
  end

  local currentCampaignCount = tonumber(redis.call('GET', campaignKey) or '0')
  if currentCampaignCount >= campaignLimit then
      return -2 -- Campaign limit reached
  end

  redis.call('INCR', senderKey)
  redis.call('INCR', campaignKey)

  if currentSenderCount == 0 then
      redis.call('EXPIRE', senderKey, 7200)
  end
  if currentCampaignCount == 0 then
      redis.call('EXPIRE', campaignKey, 7200)
  end

  return 1 -- Allowed
`;

export class RateLimitService {
  /**
   * Attempts to consume a rate limit slot for both the sender and the campaign.
   * Returns:
   *  1 = Allowed
   * -1 = Sender limit reached
   * -2 = Campaign limit reached
   */
  async checkAndConsume(
    senderId: string, 
    campaignId: string, 
    senderLimit: number, 
    campaignLimit: number
  ): Promise<number> {
    // Generate hourly window string (e.g. 2023-10-01-14)
    const now = new Date();
    const hourKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;

    const senderKey = `rate:sender:${senderId}:${hourKey}`;
    const campaignKey = `rate:campaign:${campaignId}:${hourKey}`;

    const result = await redisConnection.eval(
      RATE_LIMIT_SCRIPT,
      2, // number of keys
      senderKey,
      campaignKey,
      senderLimit.toString(),
      campaignLimit.toString()
    );

    return result as number;
  }

  /**
   * Refunds a rate limit slot if an email failed to send and will be retried.
   */
  async refund(senderId: string, campaignId: string): Promise<void> {
    const now = new Date();
    const hourKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;

    const senderKey = `rate:sender:${senderId}:${hourKey}`;
    const campaignKey = `rate:campaign:${campaignId}:${hourKey}`;

    await redisConnection.decr(senderKey);
    await redisConnection.decr(campaignKey);
  }
}
