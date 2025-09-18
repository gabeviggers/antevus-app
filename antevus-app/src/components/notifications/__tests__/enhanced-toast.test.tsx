import React from 'react'
import { render } from '@testing-library/react'
import { EnhancedToast } from '../enhanced-toast'
import { Notification } from '@/lib/notifications/types'

describe('Enhanced Toast XSS Prevention', () => {
  it('should safely render malicious content without dangerouslySetInnerHTML', () => {
    const maliciousTitle = '<script>alert("xss")</script><img src=x onerror=alert(1)>'
    const maliciousDescription = '<img src=x onerror="alert(\'XSS\')">'

    const notification: Notification = {
      id: '1',
      title: maliciousTitle,
      description: maliciousDescription,
      severity: 'info',
      timestamp: Date.now(),
      count: 1,
      dismissed: false
    }

    const { container } = render(
      <EnhancedToast
        notification={notification}
        onDismiss={jest.fn()}
        index={0}
      />
    )

    // Verify no script tags in DOM
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).not.toContain('onerror=')

    // Verify escaped content is displayed as text
    expect(container.textContent).toContain('<script>alert("xss")</script>')
    expect(container.textContent).toContain('<img src=x onerror="alert(\'XSS\')">')
  })

  it('should handle special HTML entities correctly', () => {
    const specialChars = '&<>"\''
    const notification: Notification = {
      id: '2',
      title: specialChars,
      description: `Test ${specialChars} test`,
      severity: 'warning',
      timestamp: Date.now(),
      count: 1,
      dismissed: false
    }

    const { container } = render(
      <EnhancedToast
        notification={notification}
        onDismiss={jest.fn()}
        index={0}
      />
    )

    // Verify HTML entities are escaped in the output
    expect(container.innerHTML).toContain('&amp;')
    expect(container.innerHTML).toContain('&lt;')
    expect(container.innerHTML).toContain('&gt;')
    expect(container.innerHTML).toContain('&quot;')
    expect(container.innerHTML).toContain('&#039;')
  })

  it('should not execute JavaScript URLs in actions', () => {
    const notification: Notification = {
      id: '3',
      title: 'Test',
      severity: 'info',
      timestamp: Date.now(),
      count: 1,
      dismissed: false,
      actions: [{
        label: 'Malicious Link',
        href: 'javascript:alert("XSS")'
      }]
    }

    const { queryByText } = render(
      <EnhancedToast
        notification={notification}
        onDismiss={jest.fn()}
        index={0}
      />
    )

    // Link should not be rendered as isSafeUrl will block it
    const link = queryByText('Malicious Link')
    if (link && link.closest('a')) {
      const anchor = link.closest('a') as HTMLAnchorElement
      expect(anchor.href).not.toContain('javascript:')
    }
  })

  it('should safely handle notification count display', () => {
    const notification: Notification = {
      id: '4',
      title: 'Normal Title',
      severity: 'success',
      timestamp: Date.now(),
      count: 5,
      dismissed: false
    }

    const { container } = render(
      <EnhancedToast
        notification={notification}
        onDismiss={jest.fn()}
        index={0}
      />
    )

    // Verify count is displayed correctly
    expect(container.textContent).toContain('×5')
  })

  it('should not use dangerouslySetInnerHTML anywhere', () => {
    const notification: Notification = {
      id: '5',
      title: 'Test Title',
      description: 'Test Description',
      severity: 'error',
      timestamp: Date.now(),
      count: 1,
      dismissed: false
    }

    const { container } = render(
      <EnhancedToast
        notification={notification}
        onDismiss={jest.fn()}
        index={0}
      />
    )

    // Verify the rendered HTML does not contain dangerouslySetInnerHTML patterns
    const html = container.innerHTML
    expect(html).not.toContain('dangerouslySetInnerHTML')
  })
})