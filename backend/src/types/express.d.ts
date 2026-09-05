import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    // Inject Prisma User type into the Express Request User
    interface User extends PrismaUser {}
  }
}
