import { SenderRepository } from '../repositories/SenderRepository';
import { CreateSenderInput } from '../validators/senderValidator';
import { Sender } from '@prisma/client';

export class SenderService {
  private senderRepo: SenderRepository;

  constructor() {
    this.senderRepo = new SenderRepository();
  }

  // Helper to remove password from returned objects
  private sanitizeSender(sender: Sender) {
    const { smtpPassword, ...safeSender } = sender;
    return safeSender;
  }

  async createSender(userId: string, data: CreateSenderInput) {
    const sender = await this.senderRepo.create(userId, data);
    return this.sanitizeSender(sender);
  }

  async getSenders(userId: string) {
    const senders = await this.senderRepo.findAllByUserId(userId);
    return senders.map(this.sanitizeSender);
  }

  async activateSender(userId: string, senderId: string) {
    const sender = await this.senderRepo.safeUpdate(senderId, userId, { active: true });
    if (!sender) throw new Error('Sender not found or not owned by user');
    return this.sanitizeSender(sender);
  }

  async deactivateSender(userId: string, senderId: string) {
    const sender = await this.senderRepo.safeUpdate(senderId, userId, { active: false });
    if (!sender) throw new Error('Sender not found or not owned by user');
    return this.sanitizeSender(sender);
  }
}
