import { createSenderSchema } from '../validators/senderValidator';
import { createCampaignSchema } from '../validators/campaignValidator';
import { EmailService } from '../services/EmailService';
import dotenv from 'dotenv';
dotenv.config();

async function verifyPhase5() {
  console.log('--- Verifying Phase 5 Email System ---');
  let hasErrors = false;

  // 1. Test Sender Validation
  try {
    console.log('\nTesting Sender Validation...');
    // Should fail (missing smtpHost)
    createSenderSchema.parse({
      email: 'bad',
      smtpPort: -5,
      smtpUsername: '',
      smtpPassword: ''
    });
    console.error('❌ Sender validation failed to reject bad input.');
    hasErrors = true;
  } catch (error: any) {
    if (error.name === 'ZodError' || error.errors) {
      console.log('✅ Sender validation successfully rejected bad input.');
    } else {
      console.error('❌ Sender validation threw unexpected error:', error);
      hasErrors = true;
    }
  }

  // 2. Test Campaign Validation
  try {
    console.log('\nTesting Campaign Validation...');
    const validData = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      subject: 'Valid Subject',
      body: 'Valid Body',
      startTime: new Date().toISOString(),
      recipients: ['test@example.com']
    };
    createCampaignSchema.parse(validData);
    console.log('✅ Campaign validation successfully accepted valid input.');

    const invalidData = {
      ...validData,
      recipients: [], // Empty array should fail
      startTime: '2020-01-01T00:00:00.000Z' // Past date should fail
    };
    
    try {
      createCampaignSchema.parse(invalidData);
      console.error('❌ Campaign validation failed to reject bad input.');
      hasErrors = true;
    } catch (e: any) {
      console.log('✅ Campaign validation successfully rejected bad input (empty recipients & past date).');
    }
  } catch (error: any) {
    console.error('❌ Campaign validation failed unexpectedly:', error);
    hasErrors = true;
  }

  // 3. Test EmailService (Real Ethereal Integration)
  try {
    console.log('\nTesting Real Ethereal SMTP Integration...');
    if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASSWORD) {
      console.log('⚠️ ETHEREAL_USER or ETHEREAL_PASSWORD not found in .env. Skipping live SMTP test.');
      console.log('   Please provide valid ethereal credentials to test live sending.');
    } else {
      const emailService = new EmailService();
      
      const mockSender = {
        id: 'test',
        userId: 'test',
        email: process.env.ETHEREAL_USER,
        displayName: 'Verification Script',
        smtpHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
        smtpPort: Number(process.env.ETHEREAL_PORT) || 587,
        smtpUsername: process.env.ETHEREAL_USER,
        smtpPassword: process.env.ETHEREAL_PASSWORD,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await emailService.sendEmail(
        mockSender,
        'recipient@example.com',
        'Verification Email',
        '<p>This verifies the Email Service integration!</p>'
      );

      console.log('✅ Real Ethereal SMTP email dispatched successfully!');
      if (result.previewUrl) {
        console.log(`🔗 Ethereal Preview URL: ${result.previewUrl}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Ethereal SMTP test failed:', error);
    hasErrors = true;
  }

  console.log('\nNOTE: Services and Controllers that query the PostgreSQL database directly requires external database connectivity.');

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('\n✅ Local verifications completed successfully.');
    process.exit(0);
  }
}

verifyPhase5();
