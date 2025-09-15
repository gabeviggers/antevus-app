'use client'

import { type Integration } from '@/lib/mock-data/integrations'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  ExternalLink,
  Clock,
  Zap
} from 'lucide-react'

interface IntegrationCardProps {
  integration: Integration
  onConnect: (integration: Integration) => void
  onDisconnect: (integration: Integration) => void
  onConfigure: (integration: Integration) => void
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onConfigure
}: IntegrationCardProps) {
  const getStatusIcon = () => {
    switch (integration.status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'syncing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (integration.status) {
      case 'connected':
        return 'Connected'
      case 'error':
        return 'Error'
      case 'syncing':
        return 'Syncing...'
      default:
        return 'Not connected'
    }
  }

  const getStatusColor = () => {
    switch (integration.status) {
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800'
      case 'syncing':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950 dark:border-gray-800'
    }
  }

  const formatLastSync = (date?: string) => {
    if (!date) return 'Never'
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/50">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{integration.icon}</div>
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              {integration.name}
              {integration.isPremium && (
                <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">
                  PRO
                </span>
              )}
              {integration.isPopular && (
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  Popular
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{integration.description}</p>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor()} mb-4`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {/* Features */}
      <div className="space-y-2 mb-4">
        {integration.features.slice(0, 3).map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </div>
        ))}
        {integration.features.length > 3 && (
          <span className="text-sm text-muted-foreground ml-6">
            +{integration.features.length - 3} more features
          </span>
        )}
      </div>

      {/* Metadata */}
      {integration.status === 'connected' && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Synced {formatLastSync(integration.lastSync)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>{integration.setupTime}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {integration.status === 'connected' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfigure(integration)}
              className="flex-1"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDisconnect(integration)}
              className="flex-1"
            >
              Disconnect
            </Button>
          </>
        ) : integration.status === 'error' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfigure(integration)}
              className="flex-1"
            >
              <Settings className="h-4 w-4 mr-2" />
              Fix Connection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDisconnect(integration)}
            >
              Remove
            </Button>
          </>
        ) : integration.status === 'syncing' ? (
          <Button variant="outline" size="sm" disabled className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Syncing...
          </Button>
        ) : (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={() => onConnect(integration)}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              Connect
            </Button>
            {integration.documentation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(integration.documentation, '_blank')}
                title="View documentation"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}