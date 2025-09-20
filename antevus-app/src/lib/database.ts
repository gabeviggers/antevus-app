/**
 * Database Connection and Prisma Client
 *
 * SECURITY NOTICE:
 * - Single Prisma instance to prevent connection exhaustion
 * - Secure connection string from environment variables
 * - Query logging disabled in production
 * - Connection pooling configured for performance
 *
 * PRODUCTION REQUIREMENTS:
 * - Use connection pooling with PgBouncer or similar
 * - Enable SSL/TLS for database connections
 * - Use read replicas for heavy read operations
 * - Implement connection retry logic
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

// Prevent multiple instances during development hot reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma client with appropriate logging and connection pooling
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // Log database connection
  client.$connect()
    .then(() => {
      logger.info('Database connected successfully', {
        environment: process.env.NODE_ENV
      })
    })
    .catch((error) => {
      logger.error('Failed to connect to database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    })

  return client
}

// Use singleton pattern to prevent multiple connections
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
    logger.info('Database disconnected')
  })
}