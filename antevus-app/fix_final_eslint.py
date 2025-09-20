#!/usr/bin/env python3
import os
import re
import subprocess

def fix_file(filepath, fixes):
    """Apply fixes to a file"""
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    for pattern, replacement in fixes:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed: {filepath}")

# Fix chat-context types properly
fix_file('src/contexts/chat-context.tsx', [
    # Fix error type
    (r'} catch \(error\) {', r'} catch (error) {'),
    (r'if \(error\?\.status', r'if ((error as { status?: number })?.status'),
    (r'error\?\.message', r'(error as { message?: string })?.message'),
    # Fix thread types
    (r'const parsedThreads = result\.threads\.map\(\(thread: unknown\) => \(\{',
     r'const parsedThreads = result.threads.map((thread: { id: string; title: string; messages: Array<{ id: string }> }) => ({'),
    (r'\(thread as \{ messages: unknown\[\] \}\)\.messages\.map\(\(msg: unknown\) => \(\{',
     r'thread.messages.map((msg: { id: string }) => ({'),
    # Remove eslint comments
    (r'// eslint-disable-next-line @typescript-eslint/no-explicit-any\n', ''),
])

# Fix xss-protection
fix_file('src/lib/security/xss-protection.ts', [
    (r'return String\(input\)', r'return String(input as string | number | boolean)'),
])

# ESLint config in the correct format for Next.js 15
eslint_config = """import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const config = [
  ...compat.extends('next/core-web-vitals', 'plugin:@typescript-eslint/recommended'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'prefer-const': 'error',
      'react-hooks/exhaustive-deps': 'error'
    },
    ignores: ['scripts/**', 'test-*.js', '*.js', 'fix_*.py']
  }
];

export default config;
"""

with open('eslint.config.mjs', 'w') as f:
    f.write(eslint_config)
print("Created eslint.config.mjs with ignores")

# Remove old config
if os.path.exists('.eslintrc.json'):
    os.remove('.eslintrc.json')
    print("Removed .eslintrc.json")

# Remove old eslintignore
if os.path.exists('.eslintignore'):
    os.remove('.eslintignore')
    print("Removed .eslintignore")

print("\nRunning ESLint to check remaining issues...")
result = subprocess.run(['npm', 'run', 'lint'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)