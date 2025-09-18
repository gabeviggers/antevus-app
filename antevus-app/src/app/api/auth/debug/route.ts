import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// TEMPORARY DEBUG ENDPOINT - REMOVE BEFORE PRODUCTION
export async function GET() {
  // Test what's actually deployed
  const adminHash = '$2b$12$YoVnZhdaTAvvOPg5v4.bduyUd1yXyT29kguZVCYvnZla35.3zvxta'

  const test1 = await bcrypt.compare('admin123', adminHash)
  const test2 = await bcrypt.compare('demo', adminHash)

  return NextResponse.json({
    message: 'Auth Debug Info',
    timestamp: new Date().toISOString(),
    tests: {
      'admin123_matches_current_hash': test1,
      'demo_matches_current_hash': test2,
      'hash_prefix': adminHash.substring(0, 7),
      'node_version': process.version,
      'env': process.env.NODE_ENV,
    },
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown'
  })
}