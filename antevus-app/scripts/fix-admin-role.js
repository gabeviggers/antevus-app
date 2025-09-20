const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixAdminRole() {
  try {
    // Update gabeviggers to have lowercase 'admin' role
    const user = await prisma.user.update({
      where: { email: 'gabeviggers@gmail.com' },
      data: {
        role: 'admin' // lowercase to match UserRole enum
      }
    })

    console.log('Updated user role:', user)
  } catch (error) {
    console.error('Failed to update user role:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixAdminRole()