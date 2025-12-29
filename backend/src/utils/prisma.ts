import { PrismaClient } from '@prisma/client';

// Singleton Prisma client to avoid exhausting database connections
const globalForPrisma = global as typeof global & { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
