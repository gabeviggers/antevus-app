import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

declare global {
  var prisma: PrismaClient | undefined
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// Test database connection on initialization
prisma.$connect()
  .then(() => logger.info('Prisma connected to database'))
  .catch((error) => logger.error('Failed to connect to database', error))