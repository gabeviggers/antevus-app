'use client'

import { useState, useEffect, useRef } from 'react'
import { z } from 'zod'
import { type Integration, type IntegrationConfig } from '@/lib/mock-data/integrations'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { secureApiCall } from '@/lib/security/auth-manager'
import { logger } from '@/lib/logger'
import {
  X,
  Save,
  TestTube,
  CheckCircle,
  AlertCircle,
  Info,
  Key,
  Link,
  Hash,
  Users,
  FolderOpen,
  Clock,
  Bell,
  AlertTriangle
} from 'lucide-react'

// Validation schemas for different integration types
const IntegrationConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required').max(500, 'API key too long').optional(),
  webhookUrl: z.string().url('Invalid URL format').optional(),
  projectId: z.string().min(1, 'Project ID is required').optional(),
  channel: z.string().min(1, 'Channel is required').optional(),
  workspace: z.string().min(1, 'Workspace is required').optional(),
  folder: z.string().min(1, 'Folder is required').optional(),
  syncInterval: z.number().min(60, 'Minimum 60 seconds').max(3600, 'Maximum 3600 seconds'),
  enableNotifications: z.boolean(),
  autoSync: z.boolean()
})

interface IntegrationConfigModalProps {
  integration: Integration | null
  isOpen: boolean
  onClose: () => void
  onSave: (integration: Integration, config: IntegrationConfig) => void
}

export function IntegrationConfigModal({
  integration,
  isOpen,
  onClose,
  onSave
}: IntegrationConfigModalProps) {
  // Non-sensitive config in state
  const [config, setConfig] = useState<Omit<IntegrationConfig, 'apiKey' | 'webhookUrl' | 'secretKey'>>({})
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [validationErrors, setValidationErrors] = useState<z.ZodIssue[]>([])

  // Use refs for sensitive inputs to avoid storing in state
  const apiKeyRef = useRef<HTMLInputElement>(null)
  const webhookUrlRef = useRef<HTMLInputElement>(null)
  const secretKeyRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (integration?.config) {
      setConfig(integration.config)
    } else {
      setConfig({})
    }
    setTestResult(null)
  }, [integration])

  if (!isOpen || !integration) return null

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    // Simulate API test
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Random success/failure for demo
    const success = Math.random() > 0.2
    setTestResult(success ? 'success' : 'error')
    setIsTesting(false)
  }

  const handleSave = async () => {
    // Gather all config including sensitive data from refs
    const fullConfig = {
      ...config,
      apiKey: apiKeyRef.current?.value,
      webhookUrl: webhookUrlRef.current?.value,
      secretKey: secretKeyRef.current?.value
    }

    // Validate configuration before saving
    const validation = IntegrationConfigSchema.safeParse(fullConfig)

    if (!validation.success) {
      setValidationErrors(validation.error.issues)
      return
    }

    // Clear any previous validation errors
    setValidationErrors([])

    try {
      // Send credentials directly to secure server-side storage
      const hasCredentials = !!(fullConfig.apiKey || fullConfig.webhookUrl || fullConfig.secretKey)

      if (hasCredentials) {
        // Use secure API call that handles auth tokens in memory
        const response = await secureApiCall(
          `/api/integrations/${integration.id}/credentials`,
          {
            method: 'POST',
            body: JSON.stringify({
              apiKey: fullConfig.apiKey,
              webhookUrl: fullConfig.webhookUrl,
              secretKey: fullConfig.secretKey
            })
          }
        )

        if (!response.ok) {
          throw new Error('Failed to store credentials securely')
        }
      }

      // Only send non-sensitive config to parent component
      const nonSensitiveConfig = {
        syncInterval: config.syncInterval,
        enableNotifications: config.enableNotifications,
        autoSync: config.autoSync,
        projectId: config.projectId,
        channel: config.channel,
        workspace: config.workspace,
        folder: config.folder,
        // Mark as configured without exposing values
        hasCredentials
      }

      onSave(integration, nonSensitiveConfig)

      // Clear sensitive inputs
      if (apiKeyRef.current) apiKeyRef.current.value = ''
      if (webhookUrlRef.current) webhookUrlRef.current.value = ''
      if (secretKeyRef.current) secretKeyRef.current.value = ''

      onClose()
    } catch (error) {
      logger.error('Error saving integration', error)
      setValidationErrors([{
        code: 'custom',
        message: 'Failed to save credentials securely. Please try again.',
        path: []
      }])
    }
  }

  const getFieldError = (field: string): string | undefined => {
    const error = validationErrors.find(err => err.path[0] === field)
    return error?.message
  }

  const renderConfigFields = () => {
    switch (integration.id) {
      case 'benchling':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key
              </Label>
              <input
                id="apiKey"
                ref={apiKeyRef}
                type="password"
                placeholder="bench_xxxxxxxxxxxxx"
                className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                  getFieldError('apiKey') ? 'border-red-500' : 'border-input'
                }`}
              />
              {getFieldError('apiKey') && (
                <p className="text-xs text-red-500 mt-1">{getFieldError('apiKey')}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Find your API key in Benchling Settings → API
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Project ID
              </Label>
              <input
                id="projectId"
                type="text"
                placeholder="proj_ABC123"
                value={config.projectId || ''}
                onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )

      case 'slack':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Webhook URL
              </Label>
              <input
                id="webhookUrl"
                ref={webhookUrlRef}
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Create an incoming webhook in your Slack workspace
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Channel
              </Label>
              <input
                id="channel"
                type="text"
                placeholder="#lab-instruments"
                value={config.channel || ''}
                onChange={(e) => setConfig({ ...config, channel: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )

      case 'teams':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Webhook URL
              </Label>
              <input
                id="webhookUrl"
                ref={webhookUrlRef}
                type="text"
                placeholder="https://outlook.office.com/webhook/..."
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Add an incoming webhook connector to your Teams channel
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team/Channel
              </Label>
              <input
                id="workspace"
                type="text"
                placeholder="Research Team / Lab Updates"
                value={config.workspace || ''}
                onChange={(e) => setConfig({ ...config, workspace: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )

      case 'aws-s3':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Access Key ID
              </Label>
              <input
                id="apiKey"
                ref={apiKeyRef}
                type="password"
                placeholder="AKIA..."
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Bucket/Folder
              </Label>
              <input
                id="folder"
                type="text"
                placeholder="my-bucket/lab-data/"
                value={config.folder || ''}
                onChange={(e) => setConfig({ ...config, folder: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )

      default:
        return (
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key / Token
            </Label>
            <input
              id="apiKey"
              ref={apiKeyRef}
              type="password"
              placeholder="Enter your API key"
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.icon}</span>
            <div>
              <h2 className="text-xl font-semibold">Configure {integration.name}</h2>
              <p className="text-sm text-muted-foreground">
                {integration.status === 'connected' ? 'Update your connection settings' : 'Set up your integration'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="text-sm text-red-900 dark:text-red-100">
                <p className="font-medium mb-1">Please fix the following errors:</p>
                <ul className="list-disc list-inside">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Setup time: {integration.setupTime}</p>
              <p>This integration will sync data automatically once connected.</p>
            </div>
          </div>

          {/* Configuration Fields */}
          <div className="space-y-4">
            {renderConfigFields()}
          </div>

          {/* Common Settings */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor="syncInterval" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Sync Interval (seconds)
              </Label>
              <input
                id="syncInterval"
                type="number"
                min="60"
                max="3600"
                placeholder="300"
                value={config.syncInterval || 300}
                onChange={(e) => setConfig({ ...config, syncInterval: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoSync" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Enable Notifications
              </Label>
              <button
                id="autoSync"
                onClick={() => setConfig({ ...config, enableNotifications: !config.enableNotifications })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.enableNotifications ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enableNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoSync" className="flex items-center gap-2">
                Auto-sync Data
              </Label>
              <button
                onClick={() => setConfig({ ...config, autoSync: !config.autoSync })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.autoSync ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.autoSync ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              testResult === 'success'
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
            }`}>
              {testResult === 'success' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div className="text-sm text-green-900 dark:text-green-100">
                    <p className="font-medium">Connection successful!</p>
                    <p>Your integration is ready to use.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div className="text-sm text-red-900 dark:text-red-100">
                    <p className="font-medium">Connection failed</p>
                    <p>Please check your credentials and try again.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}