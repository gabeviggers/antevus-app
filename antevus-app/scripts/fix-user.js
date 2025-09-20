const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixUser() {
  try {
    // First, find and delete the old user with this email
    const oldUser = await prisma.user.findUnique({
      where: { email: 'gabeviggers@gmail.com' }
    })

    if (oldUser && oldUser.id !== '4af21a4a-cfdd-4920-a91c-5d0b7bc51326') {
      console.log('Found old user with same email, ID:', oldUser.id)

      // Delete related data first
      await prisma.onboardingProgress.deleteMany({
        where: { userId: oldUser.id }
      })

      // Delete the old user
      await prisma.user.delete({
        where: { id: oldUser.id }
      })

      console.log('Deleted old user')
    }

    // Now create/update the new user with Supabase ID
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

fixUser()