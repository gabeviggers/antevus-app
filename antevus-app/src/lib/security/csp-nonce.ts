import { headers } from 'next/headers'

/**
 * Get the CSP nonce from the middleware-generated headers
 * This nonce should be used for all inline scripts and styles in production
 *
 * @returns The CSP nonce string or null if not in production
 */
export async function getCspNonce(): Promise<string | null> {
  try {
    const headersList = await headers()
    const nonce = headersList.get('x-csp-nonce')
    return nonce
  } catch {
    // If headers are not available (e.g., during static generation), return null
    return null
  }
}

/**
 * Get nonce attributes for HTML elements
 * Returns an object with nonce attribute if available, empty object otherwise
 *
 * @returns Object with nonce attribute or empty object
 */
export async function getNonceAttributes(): Promise<{ nonce?: string }> {
  const nonce = await getCspNonce()
  return nonce ? { nonce } : {}
}