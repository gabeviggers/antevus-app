const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function syncUser() {
  try {
    const user = await prisma.user.upsert({
      where: { id: '4af21a4a-cfdd-4920-a91c-5d0b7bc51326' },
      update: {
        email: 'gabeviggers@gmail.com',
        emailVerified: true,
        updatedAt: new Date()
      },
      create: {
        id: '4af21a4a-cfdd-4920-a91c-5d0b7bc51326',
        email: 'gabeviggers@gmail.com',
        emailVerified: true,
        passwordHash: 'supabase-auth',
        name: 'gabeviggers',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log('User synced successfully:', user)
  } catch (error) {
    console.error('Failed to sync user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

syncUser()