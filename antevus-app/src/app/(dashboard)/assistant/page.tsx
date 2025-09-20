'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Sparkles, Beaker, Activity, FileText, AlertCircle, Share2, MoreVertical, Archive, Flag, Pencil, Trash2, BarChart3, Calendar, TrendingUp, Mail, ExternalLink, ChevronLeft, Clock, PlayCircle, CheckCircle2, XCircle, Loader2, FlaskConical, PauseCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChat } from '@/contexts/chat-context'
import { sanitizeInput } from '@/lib/security/xss-protection'
import { SafeMessageContent } from '@/components/chat/safe-message-content'
import { auditLogger, AuditEventType } from '@/lib/security/audit-logger'
import { authorizationService, Resource, Action, UserRole } from '@/lib/security/authorization'
import { useSession } from '@/contexts/session-context'
import { PermissionDenied } from '@/components/auth/permission-denied'
import { ChatErrorBoundary } from '@/components/chat/chat-error-boundary'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
// ReportModal removed - using full report page instead
import type { ReportPlan } from '@/types/reports'

interface SuggestedPrompt {
  icon: React.ReactNode
  title: string
  prompt: string
}

function AssistantPageContent() {
  const { activeThread, addMessage, updateMessage, switchThread, renameThread, deleteThread } = useChat()
  const { user, isLoading: sessionLoading } = useSession()
  const router = useRouter()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState<{ requiredRole?: string; message?: string } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showReportsPanel, setShowReportsPanel] = useState(false)
  const [recentReports, setRecentReports] = useState<Array<{ id: string; title: string; createdAt: string; type: string }>>([])
  const [recentCommands, setRecentCommands] = useState<Array<{
    id: string;
    type: 'protocol' | 'command' | 'report' | 'run';
    title: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
    progress?: number;
    stages?: Array<{ name: string; status: 'pending' | 'running' | 'completed' }>;
    createdAt: string;
    runId?: string;
    duration?: string;
    samples?: number;
    result?: 'success' | 'failure' | 'partial';
  }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentThreadIdRef = useRef<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Use activeThread messages directly, no local state
  const messages = useMemo(() => activeThread?.messages || [], [activeThread?.messages])

  // Track the current thread ID
  useEffect(() => {
    currentThreadIdRef.current = activeThread?.id || null
  }, [activeThread?.id])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Check authorization when user changes
  useEffect(() => {
    const checkAuthorization = async () => {
      // Check for demo mode admin first via secure API
      if (process.env.NODE_ENV === 'development') {
        try {
          // Use the PUT endpoint to validate existing demo session
          const demoResponse = await fetch('/api/auth/demo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
          })

          if (demoResponse.ok) {
            const demoData = await demoResponse.json()
            if (demoData.valid) {
              // Demo user has full access
              setHasPermission(true)
              setAuthError(null)
              return
            }
          }
        } catch {
          logger.debug('Demo check failed, continuing with regular auth')
        }
      }

      if (!user) {
        setHasPermission(false)
        setAuthError({ message: 'You must be logged in to use the Lab Assistant' })
        return
      }

      const result = await authorizationService.can({
        user,
        resource: Resource.ASSISTANT,
        action: Action.EXECUTE
      })

      setHasPermission(result.allowed)

      if (!result.allowed) {
        setAuthError({
          requiredRole: result.requiredRole,
          message: result.reason || 'You do not have permission to use the Lab Assistant'
        })
      } else {
        setAuthError(null)
      }
    }

    if (!sessionLoading) {
      checkAuthorization()
    }
  }, [user, sessionLoading])

  // Audit log: Track page access (only if authorized)
  useEffect(() => {
    if (hasPermission && user) {
      auditLogger.log({
        eventType: AuditEventType.CHAT_HISTORY_VIEWED,
        action: 'Lab Assistant page accessed',
        userId: user.id,
        metadata: {
          activeThreadId: activeThread?.id || null,
          threadCount: messages.length,
          userRole: user.roles
        }
      })

      return () => {
        // Log when user leaves the page
        auditLogger.log({
          eventType: AuditEventType.CHAT_HISTORY_VIEWED,
          action: 'Lab Assistant page exited',
          userId: user.id,
          metadata: {
            activeThreadId: activeThread?.id || null,
            sessionDuration: 'tracked_server_side'
          }
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, user])

  const suggestedPrompts: SuggestedPrompt[] = [
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: "Weekly Lab Report",
      prompt: "Generate a report for this week's lab activity"
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      title: "Failed Runs Analysis",
      prompt: "Show me all failed runs in the past 7 days with failure analysis"
    },
    {
      icon: <Activity className="h-5 w-5" />,
      title: "Instrument Performance",
      prompt: "Generate an instrument utilization report for HPLC and qPCR"
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      title: "Monthly QC Summary",
      prompt: "Create a monthly quality control summary report"
    },
    {
      icon: <Beaker className="h-5 w-5" />,
      title: "Start a protocol",
      prompt: "Start ELISA protocol on plate reader PR-07"
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Generate report",
      prompt: "Summarize today's qPCR runs and failed tests"
    },
    {
      icon: <AlertCircle className="h-5 w-5" />,
      title: "Check for errors",
      prompt: "Show me all instruments with errors or maintenance needs"
    }
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const simulateStreaming = async (threadId: string, messageId: string, responseText: string) => {
    const words = responseText.split(' ')
    let currentText = ''
    const streamingTimeouts: NodeJS.Timeout[] = []

    try {
      for (let i = 0; i < words.length; i++) {
        currentText += (i === 0 ? '' : ' ') + words[i]
        const isStreaming = i < words.length - 1

        updateMessage(threadId, messageId, currentText, isStreaming)
        // Use smaller delay for smoother streaming
        await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 20)
          streamingTimeouts.push(timeout)
        })
      }
    } finally {
      // Clean up any remaining timeouts
      streamingTimeouts.forEach(timeout => clearTimeout(timeout))
    }
  }

  const simulateProtocolExecution = (protocolId: string) => {
    setRecentCommands(prev => {
      const commandIndex = prev.findIndex(cmd => cmd.id === protocolId);
      if (commandIndex === -1) return prev;

      const updatedCommands = [...prev];
      const command = { ...updatedCommands[commandIndex] };

      // Start the protocol
      command.status = 'running';
      updatedCommands[commandIndex] = command;

      // Simulate stage progression
      let stageIndex = 0;
      const stageInterval = setInterval(() => {
        setRecentCommands(currentCommands => {
          const cmdIdx = currentCommands.findIndex(cmd => cmd.id === protocolId);
          if (cmdIdx === -1) {
            clearInterval(stageInterval);
            return currentCommands;
          }

          const updated = [...currentCommands];
          const cmd = { ...updated[cmdIdx] };

          if (!cmd.stages || stageIndex >= cmd.stages.length) {
            // Protocol completed
            cmd.status = 'completed';
            updated[cmdIdx] = cmd;
            clearInterval(stageInterval);
            return updated;
          }

          // Mark previous stage as completed
          if (stageIndex > 0) {
            cmd.stages[stageIndex - 1].status = 'completed';
          }

          // Start next stage
          if (stageIndex < cmd.stages.length) {
            cmd.stages[stageIndex].status = 'running';
          }

          cmd.progress = ((stageIndex + 1) / cmd.stages.length) * 100;
          updated[cmdIdx] = cmd;

          stageIndex++;

          // If this was the last stage, mark protocol as completed and create run result
          if (stageIndex === cmd.stages.length) {
            setTimeout(() => {
              setRecentCommands(finalCommands => {
                const finalIdx = finalCommands.findIndex(c => c.id === protocolId);
                if (finalIdx === -1) return finalCommands;

                const final = [...finalCommands];
                const finalCmd = { ...final[finalIdx] };

                // Mark last stage as completed
                if (finalCmd.stages && finalCmd.stages.length > 0) {
                  finalCmd.stages[finalCmd.stages.length - 1].status = 'completed';
                }

                finalCmd.status = 'completed';
                finalCmd.progress = 100;
                final[finalIdx] = finalCmd;

                // Create a run result entry
                const timestamp = Date.now();
                const runResult = {
                  id: `RUN-${timestamp}-${Math.random().toString(36).substring(2, 11)}`,
                  type: 'run' as const,
                  title: finalCmd.title + ' - Complete',
                  status: 'completed' as const,
                  runId: `ELISA-${timestamp}`,
                  duration: '45 minutes',
                  samples: 96,
                  result: 'success' as const,
                  createdAt: new Date().toISOString()
                };

                // Add run result to the list
                final.unshift(runResult);

                clearInterval(stageInterval);
                return final.slice(0, 15); // Keep last 15 items
              });
            }, 2000);
          }

          return updated;
        });
      }, 3000); // Each stage takes 3 seconds

      return updatedCommands;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const originalInput = input.trim()

    // Type for window with protocol
    interface WindowWithProtocol extends Window {
      __pendingProtocol?: { protocolId: string; threadId: string; messageId: string };
    }

    // Check if this is a confirmation for a pending protocol
    const pendingProtocol = (window as unknown as WindowWithProtocol).__pendingProtocol;
    if (pendingProtocol &&
        (originalInput.toLowerCase().includes('confirm') ||
         originalInput.toLowerCase().includes('yes') ||
         originalInput.toLowerCase().includes('proceed'))) {
      const { protocolId } = pendingProtocol;

      // Clear pending protocol
      delete (window as unknown as WindowWithProtocol).__pendingProtocol;

      // Update the assistant message to show protocol started
      const startedMessage = `Protocol execution confirmed! ✅\n\nStarting ELISA protocol on PR-07...\n\nYou can track the progress in the right panel →`;

      // Add confirmation message
      addMessage({
        role: 'user',
        content: 'Confirm protocol execution'
      });

      // Add assistant response
      const assistantResult = addMessage({
        role: 'assistant',
        content: ''
      });

      if (assistantResult) {
        simulateStreaming(assistantResult.threadId, assistantResult.messageId, startedMessage).then(() => {
          // Start protocol simulation
          simulateProtocolExecution(protocolId);

          // Show the reports panel if it's hidden
          setShowReportsPanel(true);
        });
      }

      setInput('');
      return;
    }

    // Check if this is a cancellation
    const cancelPendingProtocol = (window as unknown as WindowWithProtocol).__pendingProtocol;
    if (cancelPendingProtocol &&
        (originalInput.toLowerCase().includes('cancel') ||
         originalInput.toLowerCase().includes('no') ||
         originalInput.toLowerCase().includes('stop'))) {
      const { protocolId } = cancelPendingProtocol;

      // Clear pending protocol
      delete (window as unknown as WindowWithProtocol).__pendingProtocol;

      // Add cancellation message
      addMessage({
        role: 'user',
        content: 'Cancel protocol'
      });

      const assistantResult = addMessage({
        role: 'assistant',
        content: ''
      });

      if (assistantResult) {
        simulateStreaming(assistantResult.threadId, assistantResult.messageId, 'Protocol execution cancelled. The instrument remains in standby mode.');

        // Create a cancelled run entry
        const cancelTimestamp = Date.now();
        const cancelledRun = {
          id: `RUN-${cancelTimestamp}-${Math.random().toString(36).substring(2, 11)}`,
          type: 'run' as const,
          title: 'ELISA Protocol - Cancelled',
          status: 'cancelled' as const,
          runId: `ELISA-CANCELLED-${cancelTimestamp}`,
          duration: '0 minutes',
          samples: 0,
          result: 'failure' as const,
          createdAt: new Date().toISOString()
        };

        // Update the protocol command status and add cancelled run
        setRecentCommands(prev => {
          const updated = prev.map(cmd =>
            cmd.id === protocolId ? { ...cmd, status: 'cancelled' as const } : cmd
          );
          return [cancelledRun, ...updated].slice(0, 15);
        });
      }

      setInput('');
      return;
    }

    // Sanitize user input to prevent XSS
    const userContent = sanitizeInput(originalInput)

    // Audit log: Check if XSS was prevented
    if (originalInput !== userContent) {
      auditLogger.logSecurityEvent('xss', {
        action: 'Input sanitization applied',
        originalLength: originalInput.length,
        sanitizedLength: userContent.length,
        difference: originalInput.length - userContent.length,
        source: 'chat_input'
      })
    }

    setInput('')
    setIsLoading(true)

    try {
      // Add user message to context (will create thread if needed)
      const userMessageResult = addMessage({
        role: 'user',
        content: userContent
      })

      if (!userMessageResult) {
        setIsLoading(false)
        return
      }

      const threadId = userMessageResult.threadId

      if (!threadId) {
        logger.error('No threadId returned from user message')
        setIsLoading(false)
        return
      }

      logger.info('User message added with threadId', { threadId })

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Delay adding assistant message to show thinking animation first
      const currentThreadId = threadId // Capture in closure

      // Add assistant message after delay
      timeoutRef.current = setTimeout(() => {
        logger.info('Adding assistant message to thread', { threadId: currentThreadId })

        // Ensure thread is active
        switchThread(currentThreadId)

        // Use a small delay to ensure state has updated
        setTimeout(() => {
            // Check if this is a report request
            const isReportRequest = userContent.toLowerCase().includes('report') ||
                                   userContent.toLowerCase().includes('generate') ||
                                   userContent.toLowerCase().includes('analysis') ||
                                   userContent.toLowerCase().includes('summary');

            // Generate report ID if this is a report request
            const reportMetadata = isReportRequest ? {
              reportId: `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              reportPlan: undefined // Will be set later
            } : undefined;

            const assistantMessageResult = addMessage({
              role: 'assistant',
              content: '',
              isStreaming: true,
              metadata: reportMetadata
            })

            logger.info('Assistant message result', { assistantMessageResult })

            if (!assistantMessageResult) {
              logger.error('Failed to add assistant message')
              setIsLoading(false)
              return
            }

            const assistantMessageId = assistantMessageResult.messageId
            const assistantThreadId = assistantMessageResult.threadId

            logger.info('Assistant IDs', { assistantMessageId, assistantThreadId })

            if (isReportRequest) {
              // Parse the request to create a report plan
              const plan: ReportPlan = {
                title: userContent.includes('week') ? 'Weekly Lab Report' :
                      userContent.includes('month') ? 'Monthly Lab Report' :
                      userContent.includes('failed') ? 'Failed Runs Analysis' :
                      userContent.includes('qc') || userContent.includes('quality') ? 'Quality Control Summary' :
                      'Lab Activity Report',
                description: userContent,
                scope: {
                  instruments: userContent.toLowerCase().includes('hplc') || userContent.toLowerCase().includes('qpcr')
                    ? ['HPLC', 'qPCR']
                    : ['All Instruments'],
                  dateRange: userContent.includes('week') ? 'Past 7 days' :
                           userContent.includes('month') ? 'Past 30 days' :
                           'Past 7 days',
                  filters: userContent.includes('failed') ? ['Status: Failed'] : []
                },
                metrics: ['Total runs', 'Failure rate', 'Average runtime', 'QC exceptions', 'Throughput'],
                outputs: ['On-screen preview', 'CSV export', 'PDF report']
              };

              // Send initial response about report generation
              const reportResponse = `I'll generate that report for you. Here's what I'll include:

**${plan.title}**

📊 **Scope:**
• Instruments: ${plan.scope.instruments.join(', ')}
• Time period: ${plan.scope.dateRange}
${plan.scope.filters.length > 0 ? '• Filters: ' + plan.scope.filters.join(', ') : ''}

📈 **Metrics:**
${plan.metrics.map(m => '• ' + m).join('\n')}

📤 **Available Outputs:**
${plan.outputs.map(o => '• ' + o).join('\n')}

*Generating your report now...*`;

              simulateStreaming(assistantThreadId, assistantMessageId, reportResponse)

              // After a delay, generate report ID and update message
              setTimeout(() => {
                const reportId = reportMetadata?.reportId || `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

                // Add to recent reports panel
                const newReport = {
                  id: reportId,
                  title: plan.title,
                  createdAt: new Date().toISOString(),
                  type: 'Performance Report'
                };
                setRecentReports(prev => [newReport, ...prev].slice(0, 5)); // Keep only last 5

                // Add report ready message with elegant envelope icon
                const reportReadyMessage = `\n\n📨 **Report Ready!**\n\nYour ${plan.title} has been generated successfully.\n\n[Open Full Report →](/reports/${reportId})`;

                updateMessage(assistantThreadId, assistantMessageId, reportResponse + reportReadyMessage);
              }, 3000);

              return;
            }

            // Generate response based on input
            let response = ""

            // Check for specific demo prompts first (exact matches from suggested prompts)
            if (userContent === "What instruments are currently running?") {
              response = `Currently monitoring 5 active instruments:

• **HPLC System A** - Running protocol "Protein_Purification_v2" (45% complete, ~23 min remaining)
• **Mass Spectrometer MS-03** - Idle, last run completed 2 hours ago
• **PCR Thermocycler TC-01** - Running "COVID_Detection_96well" (72% complete, ~8 min remaining)
• **Liquid Handler LH-02** - Preparing samples for next run (queue: 3 protocols)
• **Plate Reader PR-04** - Running ELISA assay (12% complete, ~35 min remaining)

All instruments operating within normal parameters. No errors detected.`
          } else if (userContent === "Generate a QC report for today's runs") {
            response = `# Quality Control Report - ${new Date().toLocaleDateString()}

## Summary Statistics
- **Total Runs Today**: 42
- **Success Rate**: 95.2%
- **Average Runtime**: 1h 23min
- **Samples Processed**: 384

## Instrument Performance
| Instrument | Uptime | Efficiency | Status |
|-----------|---------|------------|---------|
| HPLC-A | 98.5% | 92% | ✅ Optimal |
| MS-03 | 99.1% | 88% | ✅ Optimal |
| TC-01 | 96.2% | 94% | ⚠️ Maintenance due |
| LH-02 | 99.8% | 91% | ✅ Optimal |

## Failed Runs Analysis
- 2 failures due to sample preparation errors
- 1 failure due to power fluctuation at 14:23

## Recommendations
1. Schedule maintenance for TC-01 within next 48 hours
2. Review sample prep protocol for consistency
3. All critical metrics within acceptable range`
          } else if (userContent === "Show recent failed experiments") {
            response = `Found 3 failed experiments in the last 7 days:

1. **EXP-2024-0187** (2 days ago)
   - Protocol: Protein Expression Optimization
   - Failure: Temperature deviation detected at hour 6
   - Root Cause: Incubator cooling system malfunction
   - Action Taken: Maintenance completed, system recalibrated

2. **EXP-2024-0181** (4 days ago)
   - Protocol: qPCR Viral Detection
   - Failure: No amplification in positive controls
   - Root Cause: Expired master mix reagent
   - Action Taken: New reagents ordered and validated

3. **EXP-2024-0175** (6 days ago)
   - Protocol: Cell Culture Expansion
   - Failure: Contamination detected
   - Root Cause: HEPA filter replacement overdue
   - Action Taken: Filter replaced, workspace decontaminated

Would you like detailed logs for any of these experiments?`
          } else if (userContent === "Help optimize ELISA protocol efficiency") {
            response = `Based on your historical ELISA data, here are optimization recommendations:

## Current Protocol Analysis
- Average CV: 12.3% (target: <10%)
- Signal/Background Ratio: 8.5:1
- Time to completion: 4.5 hours

## Optimization Suggestions

### 1. Blocking Buffer Enhancement
Change from 3% BSA to 5% non-fat milk in PBS-T
- Expected improvement: 15% reduction in background
- Validated on similar assays

### 2. Incubation Time Adjustment
- Primary antibody: Reduce from 2h to 1.5h at room temp
- Secondary antibody: Maintain at 1h
- This saves 30 min without signal loss

### 3. Wash Protocol Optimization
- Increase wash cycles from 3x to 5x
- Add 0.1% Tween-20 to wash buffer
- Expected CV improvement: ~3%

### 4. Detection Enhancement
- Switch to TMB Ultra substrate
- 20% signal increase observed in pilot tests

**Estimated new metrics after optimization:**
- CV: <9%
- S/B Ratio: 12:1
- Time: 3.5 hours

Would you like me to generate the updated protocol document?`
          }
          // Fallback to keyword matching for other queries
          else if (userContent.toLowerCase().includes('running') || userContent.toLowerCase().includes('status')) {
            response = "Currently, 2 instruments are running:\n\n• **qPCR System (PCR-001)**: COVID-19 Detection protocol, 23 minutes remaining\n• **MiSeq (SEQ-003)**: 16S rRNA Sequencing, 4 hours 12 minutes remaining\n\nAll other instruments are idle and ready for use."
          } else if (userContent.toLowerCase().includes('elisa') || userContent === "Start ELISA protocol on plate reader PR-07") {
            // Create protocol execution plan
            const protocolId = `PROT-${Date.now()}`;

            response = `I'll prepare to start the ELISA protocol on plate reader PR-07.

## Protocol Details

**Protocol**: ELISA_v3
**Instrument**: PR-07 (Plate Reader)
**Estimated Duration**: 45 minutes
**Current Status**: ✅ Instrument ready

### Execution Stages:
1. **Pre-check** - Verify instrument calibration
2. **Sample Loading** - Load 96-well plate
3. **Primary Incubation** - 15 min at 37°C
4. **Wash Cycle** - 5x automated wash
5. **Secondary Incubation** - 10 min at 37°C
6. **Detection** - Substrate reaction & reading
7. **Data Analysis** - Generate results

Would you like to proceed with this protocol?`;

            // Stream the initial response
            simulateStreaming(assistantThreadId, assistantMessageId, response).then(() => {
              // After streaming completes, add confirmation actions
              setTimeout(() => {
                const confirmationPrompt = `\n\n**[Confirm Protocol Execution]** or **[Cancel]**`;
                updateMessage(assistantThreadId, assistantMessageId, response + confirmationPrompt);

                // Store protocol metadata
                const protocolCommand = {
                  id: protocolId,
                  type: 'protocol' as const,
                  title: 'ELISA Protocol - PR-07',
                  status: 'pending' as const,
                  stages: [
                    { name: 'Pre-check - Verify calibration', status: 'pending' as const },
                    { name: 'Sample Loading - 96-well plate', status: 'pending' as const },
                    { name: 'Primary Incubation - 15 min', status: 'pending' as const },
                    { name: 'Wash Cycle - 5x automated', status: 'pending' as const },
                    { name: 'Secondary Incubation - 10 min', status: 'pending' as const },
                    { name: 'Detection - Substrate reaction', status: 'pending' as const },
                    { name: 'Data Analysis - Generate results', status: 'pending' as const }
                  ],
                  createdAt: new Date().toISOString()
                };

                // Add to commands list (will be displayed in right panel)
                setRecentCommands(prev => [protocolCommand, ...prev].slice(0, 10));

                // Store protocol data for confirmation handling
                (window as unknown as WindowWithProtocol).__pendingProtocol = {
                  protocolId,
                  threadId: assistantThreadId,
                  messageId: assistantMessageId
                };

                // Finally set loading to false after everything is done
                setIsLoading(false);
              }, 500);
            });

            return;
          } else if (userContent.toLowerCase().includes('report') || userContent.toLowerCase().includes('qc')) {
            response = "Here's today's qPCR summary:\n\n**Total Runs**: 12\n**Successful**: 10 (83%)\n**Failed**: 2 (17%)\n\n**Failed Tests**:\n1. Sample QC-2341: Ct value out of range (>35)\n2. Sample QC-2355: Negative control contamination detected\n\n**Average Ct Value**: 24.3\n**Total Runtime**: 6 hours 45 minutes\n\nWould you like me to export this report or send it to the QA team?"
          } else if (userContent.toLowerCase().includes('error') || userContent.toLowerCase().includes('maintenance')) {
            response = "I found 2 instruments requiring attention:\n\n**⚠️ Errors (1)**:\n• **HPLC-002**: Pressure sensor fault detected. Last error: 2 hours ago\n\n**🔧 Maintenance Required (1)**:\n• **MS-001**: Scheduled calibration overdue by 3 days\n\nWould you like to create maintenance tickets for these issues?"
          } else {
            // Default response for unmatched queries
            response = `I understand you're asking about: "${userContent}"

I can help you with various lab operations including:
- Monitoring instrument status and runs
- Generating QC and compliance reports
- Troubleshooting failed experiments
- Optimizing protocols for efficiency
- Managing maintenance schedules

How can I assist you with your lab operations today?`
            }

            // Debug logging
            logger.info('Streaming response', {
              threadId: assistantThreadId,
              messageId: assistantMessageId,
              responseLength: response.length,
              responsePreview: response.substring(0, 50)
            })

            // Stream the response immediately
            simulateStreaming(assistantThreadId, assistantMessageId, response).then(() => {
              setIsLoading(false)
            })
        }, 100) // Small delay for state update
      }, 500) // Show thinking for 500ms
    } catch {
      // Error handled internally
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as React.FormEvent)
    }
  }

  // Show loading state
  if (sessionLoading || hasPermission === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)]">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show permission denied if user doesn't have access
  if (!hasPermission) {
    return (
      <PermissionDenied
        resource="Lab Assistant"
        action="use the Lab Assistant"
        requiredRole={authError?.requiredRole as UserRole | undefined}
        currentRole={user?.roles[0]}
        message={authError?.message}
        onBack={() => router.push('/dashboard')}
      />
    )
  }

  const handleShare = async () => {
    if (!activeThread) return

    // Create shareable content
    const shareContent = messages.map(m =>
      `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`
    ).join('\n\n')

    try {
      await navigator.clipboard.writeText(shareContent)
      // You could show a toast here
    } catch (err) {
      logger.error('Failed to copy', err)
    }
  }

  const handleArchive = () => {
    if (!activeThread) return
    // Archive functionality - you can implement this in the chat context
    setShowMenu(false)
  }

  const handleReport = () => {
    if (!activeThread) return
    // Report functionality
    setShowMenu(false)
  }

  const handleRename = () => {
    if (!activeThread) return
    const newTitle = prompt('Enter new title:', activeThread.title)
    if (newTitle && newTitle !== activeThread.title) {
      renameThread(activeThread.id, newTitle)
    }
    setShowMenu(false)
  }

  const handleDelete = () => {
    if (!activeThread) return
    if (confirm('Are you sure you want to delete this conversation?')) {
      deleteThread(activeThread.id)
      router.push('/assistant')
    }
    setShowMenu(false)
  }

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)] relative">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative">
        {/* Action buttons when chat is active */}
        {activeThread && messages.length > 0 && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <Button
            onClick={handleShare}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-accent"
            title="Share conversation"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          <div className="relative" ref={menuRef}>
            <Button
              onClick={() => setShowMenu(!showMenu)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-accent"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent w-full text-left transition-colors"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
                <button
                  onClick={handleReport}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent w-full text-left transition-colors"
                >
                  <Flag className="h-4 w-4" />
                  Report
                </button>
                <button
                  onClick={handleRename}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent w-full text-left transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Rename
                </button>
                <div className="border-t border-border" />
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-destructive/10 text-destructive w-full text-left transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          // Hero Section - When no messages
          <div className="flex flex-col items-center justify-center h-full px-4 py-8">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="relative bg-muted rounded-full p-3 md:p-4">
                  <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-foreground" />
                </div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold text-center mb-2">
              What can I help with?
            </h1>
            <p className="text-sm md:text-base text-muted-foreground text-center mb-8 max-w-2xl px-4">
              Ask me about instrument status, start protocols, generate reports, or get help with lab operations
            </p>

            {/* Suggested Prompts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-3xl px-2 md:px-0">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedPrompt(prompt.prompt)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
                >
                  <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {prompt.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{prompt.title}</div>
                    <div className="text-xs text-muted-foreground">{prompt.prompt}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Messages Thread
          <div className="max-w-3xl mx-auto w-full px-3 md:px-4 py-6 md:py-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "mb-4 md:mb-6 flex gap-3 md:gap-4",
                  message.role === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}>
                  {message.role === 'user' ? 'Y' : <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-foreground" />}
                </div>

                {/* Message Content */}
                <div className={cn(
                  "flex-1 space-y-2 min-w-0",
                  message.role === 'user' ? 'text-right' : ''
                )}>
                  <div className={cn(
                    "inline-block px-3 md:px-4 py-2 rounded-2xl max-w-[85%] md:max-w-full text-sm relative",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}>
                    <SafeMessageContent
                      content={message.containsPHI || message.containsPII ? message.redactedContent || message.content : message.content}
                      isStreaming={message.isStreaming}
                      renderMarkdown={message.role === 'assistant'}
                    />
                    {message.metadata?.reportId && typeof message.metadata.reportId === 'string' ? (
                      <div className="mt-4">
                        <button
                          onClick={() => router.push(`/reports/${message.metadata?.reportId as string}`)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all group hover:scale-105"
                        >
                          <Mail className="h-5 w-5 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-medium">View Report</span>
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-foreground animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-muted rounded-2xl">
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto w-full p-3 md:p-4">
          <div className="relative flex items-end gap-2 bg-muted rounded-xl md:rounded-2xl px-3 md:px-4 py-2 shadow-sm transition-shadow focus-within:shadow-md">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "Lab Assistant is thinking..." : "Ask anything..."}
              className="flex-1 bg-transparent resize-none outline-none min-h-[24px] max-h-[200px] py-1 text-sm md:text-base placeholder:text-muted-foreground transition-opacity"
              rows={1}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.5 : 1 }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className={cn(
                "rounded-lg md:rounded-xl h-8 w-8 flex-shrink-0 transition-all",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Lab Assistant can make mistakes. Verify critical operations before execution.
            </p>
          </div>
        </form>
        </div>
      </div>

      {/* Recent Reports Panel */}
      <div className={cn(
        "border-l bg-card transition-all duration-300",
        showReportsPanel ? "w-80" : "w-12"
      )}>
        {showReportsPanel ? (
          <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <h3 className="font-semibold text-sm">Reports & Commands</h3>
              </div>
              <button
                onClick={() => setShowReportsPanel(false)}
                className="p-1 hover:bg-accent rounded-lg transition-colors"
                title="Close panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Reports & Commands List */}
            <div className="flex-1 overflow-y-auto p-4">
              {recentReports.length === 0 && recentCommands.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reports and commands will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Commands/Protocols/Runs */}
                  {recentCommands.map((command) => {
                    const isRun = command.type === 'run';
                    const isClickable = isRun && command.runId;

                    return (
                    <div
                      key={command.id}
                      onClick={() => isClickable && router.push(`/runs/${command.runId}`)}
                      className={`p-3 bg-background rounded-lg border transition-all ${
                        isClickable ? 'cursor-pointer hover:border-primary/50 hover:shadow-sm' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Icon based on type and status */}
                        {command.type === 'run' ? (
                          command.result === 'success' ? (
                            <FlaskConical className="h-4 w-4 text-green-500 mt-0.5" />
                          ) : command.result === 'failure' ? (
                            <FlaskConical className="h-4 w-4 text-red-500 mt-0.5" />
                          ) : (
                            <FlaskConical className="h-4 w-4 text-yellow-500 mt-0.5" />
                          )
                        ) : command.status === 'running' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5" />
                        ) : command.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        ) : command.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        ) : command.status === 'cancelled' ? (
                          <XCircle className="h-4 w-4 text-gray-500 mt-0.5" />
                        ) : command.status === 'paused' ? (
                          <PauseCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                        ) : (
                          <PlayCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {command.title}
                          </p>

                          {/* Progress for running protocols */}
                          {command.status === 'running' && command.stages && (
                            <div className="mt-2 space-y-1">
                              {command.stages.map((stage, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    stage.status === 'completed' ? "bg-green-500" :
                                    stage.status === 'running' ? "bg-primary animate-pulse" :
                                    "bg-muted"
                                  )} />
                                  <p className={cn(
                                    "text-[10px]",
                                    stage.status === 'completed' ? "text-green-600 line-through" :
                                    stage.status === 'running' ? "text-primary font-medium" :
                                    "text-muted-foreground"
                                  )}>
                                    {stage.name}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Additional info for runs */}
                          {command.type === 'run' && (
                            <div className="mt-1 space-y-0.5">
                              {command.duration && (
                                <p className="text-xs text-muted-foreground">
                                  Duration: {command.duration}
                                </p>
                              )}
                              {command.samples && (
                                <p className="text-xs text-muted-foreground">
                                  Samples: {command.samples}
                                </p>
                              )}
                              {command.result && (
                                <p className={`text-xs font-medium ${
                                  command.result === 'success' ? 'text-green-600' :
                                  command.result === 'failure' ? 'text-red-600' :
                                  'text-yellow-600'
                                }`}>
                                  Result: {command.result.toUpperCase()}
                                </p>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(command.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>

                        {/* Arrow indicator for clickable runs */}
                        {isClickable && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
                        )}
                      </div>
                    </div>
                    );
                  })}

                  {/* Reports */}
                  {recentReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => router.push(`/reports/${report.id}`)}
                      className="p-3 bg-background rounded-lg border hover:border-primary/50 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {report.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {report.type}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(report.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View All Button */}
            {recentReports.length > 0 && (
              <div className="p-4 border-t">
                <button
                  onClick={() => router.push('/reports')}
                  className="w-full py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                >
                  View All Reports
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <button
              onClick={() => setShowReportsPanel(true)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="Open recent reports"
            >
              <FileText className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>

    </>
  )
}

// Wrap the component with error boundary
export default function AssistantPage() {
  return (
    <ChatErrorBoundary>
      <AssistantPageContent />
    </ChatErrorBoundary>
  )
}