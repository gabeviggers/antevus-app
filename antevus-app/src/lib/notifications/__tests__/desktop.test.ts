import {
  isDesktopSupported,
  requestDesktopPermission,
  isInDNDWindow,
  sendDesktopNotification
} from '../desktop'

describe('Desktop Notifications', () => {
  // Mock Notification API
  const mockNotification = {
    close: jest.fn(),
    onclick: null as ((this: Notification, ev: Event) => void) | null
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock Notification constructor
    global.Notification = jest.fn(() => mockNotification) as unknown as typeof Notification
    global.Notification.permission = 'default'
    global.Notification.requestPermission = jest.fn()
  })

  describe('isDesktopSupported', () => {
    it('returns true when Notification API is available', () => {
      expect(isDesktopSupported()).toBe(true)
    })

    it('returns false when permission is denied', () => {
      global.Notification.permission = 'denied'
      expect(isDesktopSupported()).toBe(false)
    })

    it('returns false when Notification API is not available', () => {
      const originalNotification = global.Notification
      delete (global as unknown as Record<string, unknown>).Notification
      expect(isDesktopSupported()).toBe(false)
      global.Notification = originalNotification
    })
  })

  describe('requestDesktopPermission', () => {
    it('returns granted when already granted', async () => {
      global.Notification.permission = 'granted'
      const result = await requestDesktopPermission()
      expect(result).toBe('granted')
      expect(global.Notification.requestPermission).not.toHaveBeenCalled()
    })

    it('requests permission when not granted', async () => {
      global.Notification.requestPermission = jest.fn().mockResolvedValue('granted')
      const result = await requestDesktopPermission()
      expect(result).toBe('granted')
      expect(global.Notification.requestPermission).toHaveBeenCalled()
    })

    it('handles permission denial', async () => {
      global.Notification.requestPermission = jest.fn().mockResolvedValue('denied')
      const result = await requestDesktopPermission()
      expect(result).toBe('denied')
    })

    it('handles errors gracefully', async () => {
      global.Notification.requestPermission = jest.fn().mockRejectedValue(new Error('Failed'))
      const result = await requestDesktopPermission()
      expect(result).toBe('denied')
    })
  })

  describe('isInDNDWindow', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('returns false when DND is not configured', () => {
      expect(isInDNDWindow(undefined, undefined)).toBe(false)
      expect(isInDNDWindow('22:00', undefined)).toBe(false)
      expect(isInDNDWindow(undefined, '07:00')).toBe(false)
    })

    it('correctly identifies DND window during day', () => {
      // Set time to 2pm
      const mockDate = new Date('2024-01-01T14:00:00')
      jest.setSystemTime(mockDate)

      // DND from 1pm to 3pm
      expect(isInDNDWindow('13:00', '15:00')).toBe(true)

      // DND from 3pm to 5pm (should be false)
      expect(isInDNDWindow('15:00', '17:00')).toBe(false)
    })

    it('handles overnight DND windows', () => {
      // DND from 10pm to 7am
      const dndStart = '22:00'
      const dndEnd = '07:00'

      // Test at 11pm - should be in DND
      jest.setSystemTime(new Date('2024-01-01T23:00:00'))
      expect(isInDNDWindow(dndStart, dndEnd)).toBe(true)

      // Test at 3am - should be in DND
      jest.setSystemTime(new Date('2024-01-02T03:00:00'))
      expect(isInDNDWindow(dndStart, dndEnd)).toBe(true)

      // Test at 8am - should NOT be in DND
      jest.setSystemTime(new Date('2024-01-02T08:00:00'))
      expect(isInDNDWindow(dndStart, dndEnd)).toBe(false)

      // Test at 9pm - should NOT be in DND
      jest.setSystemTime(new Date('2024-01-01T21:00:00'))
      expect(isInDNDWindow(dndStart, dndEnd)).toBe(false)
    })
  })

  describe('sendDesktopNotification', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted'
    })

    it('creates notification with correct title and body', () => {
      const options = {
        title: 'Test Notification',
        description: 'Test description',
        severity: 'info' as const
      }

      sendDesktopNotification(options, true)

      expect(global.Notification).toHaveBeenCalledWith(
        'Test Notification',
        expect.objectContaining({
          body: 'Test description',
          icon: '/favicon.ico'
        })
      )
    })

    it('redacts content when privacy is enabled', () => {
      const options = {
        title: 'Sensitive Notification',
        description: 'Patient data here',
        severity: 'info' as const,
        privacy: true
      }

      sendDesktopNotification(options, true)

      expect(global.Notification).toHaveBeenCalledWith(
        'Antevus Update',
        expect.objectContaining({
          body: 'You have a new update'
        })
      )
    })

    it('hides preview when showPreviews is false', () => {
      const options = {
        title: 'Test Notification',
        description: 'Test description',
        severity: 'info' as const
      }

      sendDesktopNotification(options, false)

      expect(global.Notification).toHaveBeenCalledWith(
        'Test Notification',
        expect.objectContaining({
          body: 'You have a new update'
        })
      )
    })

    it('sets requireInteraction for sticky notifications', () => {
      const options = {
        title: 'Sticky Notification',
        severity: 'error' as const,
        sticky: true
      }

      sendDesktopNotification(options, true)

      expect(global.Notification).toHaveBeenCalledWith(
        'Sticky Notification',
        expect.objectContaining({
          requireInteraction: true
        })
      )
    })

    it('returns null when permission is not granted', () => {
      global.Notification.permission = 'denied'

      const result = sendDesktopNotification(
        { title: 'Test', severity: 'info' },
        true
      )

      expect(result).toBeNull()
      expect(global.Notification).not.toHaveBeenCalled()
    })

    it('handles notification click events', () => {
      const onClick = jest.fn()
      const mockFocus = jest.fn()
      global.window.focus = mockFocus

      sendDesktopNotification(
        { title: 'Test', severity: 'info' },
        true,
        onClick
      )

      // Simulate click
      const event = { preventDefault: jest.fn() }
      mockNotification.onclick(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockFocus).toHaveBeenCalled()
      expect(mockNotification.close).toHaveBeenCalled()
      expect(onClick).toHaveBeenCalled()
    })

    it('auto-closes non-sticky notifications after TTL', () => {
      jest.useFakeTimers()

      sendDesktopNotification(
        { title: 'Test', severity: 'info', ttl: 5000 },
        true
      )

      expect(mockNotification.close).not.toHaveBeenCalled()

      jest.advanceTimersByTime(5000)

      expect(mockNotification.close).toHaveBeenCalled()

      jest.useRealTimers()
    })
  })
})