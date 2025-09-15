#!/usr/bin/env node

/**
 * Test script to verify credential security implementation
 */

const BASE_URL = 'http://localhost:3001';

// Test 1: Verify generic endpoint rejects credentials
async function testCredentialRejection() {
  console.log('\n=== Test 1: Generic endpoint should reject credentials ===');

  const testCases = [
    { config: { apiKey: 'test-key-123' }, shouldReject: true },
    { config: { webhookUrl: 'https://test.com/hook' }, shouldReject: true },
    { config: { secretKey: 'secret123' }, shouldReject: true },
    { config: { accessToken: 'token123' }, shouldReject: true },
    { config: { password: 'pass123' }, shouldReject: true },
    { config: { syncInterval: 300 }, shouldReject: false },
    { config: { enableNotifications: true }, shouldReject: false },
  ];

  for (const testCase of testCases) {
    try {
      const response = await fetch(`${BASE_URL}/api/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'test-token', // Would need real token in production
        },
        body: JSON.stringify({
          integrationId: 'test-integration',
          name: 'Test Integration',
          config: testCase.config
        }),
      });

      const data = await response.json();

      if (testCase.shouldReject) {
        if (response.status === 400 && data.error?.includes('credentials')) {
          console.log(`✅ PASS: Correctly rejected ${Object.keys(testCase.config)[0]}`);
        } else {
          console.log(`❌ FAIL: Should have rejected ${Object.keys(testCase.config)[0]}`);
          console.log(`   Response: ${response.status} - ${JSON.stringify(data)}`);
        }
      } else {
        if (response.status !== 400 || !data.error?.includes('credentials')) {
          console.log(`✅ PASS: Correctly accepted ${Object.keys(testCase.config)[0]}`);
        } else {
          console.log(`❌ FAIL: Should have accepted ${Object.keys(testCase.config)[0]}`);
          console.log(`   Response: ${response.status} - ${JSON.stringify(data)}`);
        }
      }
    } catch (error) {
      console.log(`❌ ERROR testing ${Object.keys(testCase.config)[0]}: ${error.message}`);
    }
  }
}

// Test 2: Verify credentials endpoint exists and requires auth
async function testCredentialsEndpoint() {
  console.log('\n=== Test 2: Credentials endpoint security ===');

  try {
    // Test without auth
    const response1 = await fetch(`${BASE_URL}/api/integrations/test-id/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-key' }),
    });

    if (response1.status === 401) {
      console.log('✅ PASS: Credentials endpoint requires authentication');
    } else {
      console.log(`❌ FAIL: Expected 401, got ${response1.status}`);
    }

    // Test GET without auth
    const response2 = await fetch(`${BASE_URL}/api/integrations/test-id/credentials`);

    if (response2.status === 401) {
      console.log('✅ PASS: GET credentials endpoint requires authentication');
    } else {
      console.log(`❌ FAIL: Expected 401 for GET, got ${response2.status}`);
    }

  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
}

// Test 3: Verify SECURITY.md claims match implementation
async function testSecurityDocClaims() {
  console.log('\n=== Test 3: Security documentation accuracy ===');

  const fs = require('fs');
  const securityDoc = fs.readFileSync('./SECURITY.md', 'utf8');

  const claims = [
    {
      claim: 'AES-256-GCM encryption',
      check: securityDoc.includes('AES-256-GCM') &&
             fs.readFileSync('./src/app/api/integrations/[id]/credentials/route.ts', 'utf8').includes('aes-256-gcm')
    },
    {
      claim: 'PBKDF2 key derivation',
      check: fs.readFileSync('./src/app/api/integrations/[id]/credentials/route.ts', 'utf8').includes('pbkdf2')
    },
    {
      claim: 'Generic endpoint rejects credentials',
      check: fs.readFileSync('./src/app/api/integrations/route.ts', 'utf8').includes('forbiddenFields')
    },
    {
      claim: '100,000 iterations for PBKDF2',
      check: fs.readFileSync('./src/app/api/integrations/[id]/credentials/route.ts', 'utf8').includes('100000')
    }
  ];

  claims.forEach(({ claim, check }) => {
    if (check) {
      console.log(`✅ PASS: ${claim} - correctly implemented`);
    } else {
      console.log(`❌ FAIL: ${claim} - implementation mismatch`);
    }
  });
}

// Run all tests
async function runTests() {
  console.log('🔒 Credential Security Test Suite');
  console.log('==================================');

  await testCredentialRejection();
  await testCredentialsEndpoint();
  await testSecurityDocClaims();

  console.log('\n==================================');
  console.log('✅ Security tests complete');
}

runTests().catch(console.error);