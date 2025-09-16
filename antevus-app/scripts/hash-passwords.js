/**
 * Utility script to generate bcrypt hashes for passwords
 * Run with: node scripts/hash-passwords.js
 */

const bcrypt = require('bcryptjs')

const passwords = [
  { user: 'admin', password: 'admin123' },
  { user: 'scientist', password: 'scientist123' },
  { user: 'manager', password: 'manager123' },
  { user: 'viewer', password: 'viewer123' }
]

async function hashPasswords() {
  console.log('Generating bcrypt hashes for passwords...\n')

  for (const { user, password } of passwords) {
    const hash = await bcrypt.hash(password, 12)
    console.log(`${user}: ${password}`)
    console.log(`Hash: ${hash}`)
    console.log('---')
  }

  // Test that hashes work
  console.log('\nVerifying hashes...')
  for (const { user, password } of passwords) {
    const hash = await bcrypt.hash(password, 12)
    const valid = await bcrypt.compare(password, hash)
    console.log(`${user}: ${valid ? '✓ Valid' : '✗ Invalid'}`)
  }
}

hashPasswords().catch(console.error)