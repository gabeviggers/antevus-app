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

# Fix assistant page
fix_file('src/app/(dashboard)/assistant/page.tsx', [
    # Remove unused import
    (r'import { format } from \'date-fns\'\n', ''),
    # Fix any types
    (r': any\[\]', ': unknown[]'),
    (r'catch \(e: any\)', 'catch (e: unknown)'),
    (r'onChange: \(messages: any\[\]\)', 'onChange: (messages: Message[])'),
    (r'setMessages\(prev => \(prev as any\)', 'setMessages(prev => (prev as Message[])'),
    # Fix unused variables
    (r'const \[threadId, messageId\] = e\.detail as any;', 'const [_threadId, _messageId] = e.detail as [string, string];'),
])

# Fix reports schedule
fix_file('src/app/api/reports/schedule/route.tsx', [
    (r'const mockScheduledReports: any\[\]', 'const mockScheduledReports: unknown[]'),
    (r'} catch \(error\) {', '} catch (_error) {'),
])

# Fix reports page
fix_file('src/app/reports/[id]/page.tsx', [
    (r'import { .*, Calendar, Clock,.*', 'import { ArrowLeft, Download, Mail, Share2, CheckCircle2, XCircle, AlertCircle } from \'lucide-react\';'),
    (r'const \[reportData, setReportData\] = useState<any>', 'const [reportData, setReportData] = useState<unknown>'),
    (r'\.map\(\(run: any\)', '.map((run: unknown)'),
])

# Fix runs page
fix_file('src/app/runs/[id]/page.tsx', [
    # Remove unused chart imports
    (r'import {[\s\S]*?ResponsiveContainer[\s\S]*?} from \'recharts\'',
     'import {\n  LineChart,\n  Line,\n  XAxis,\n  YAxis,\n  CartesianGrid,\n  Tooltip,\n  ResponsiveContainer\n} from \'recharts\''),
])

# Fix ReportModal
fix_file('src/components/reports/ReportModal.tsx', [
    (r'const \[reportData, setReportData\] = useState<any>', 'const [reportData, setReportData] = useState<unknown>'),
])

# Fix ReportPreview
fix_file('src/components/reports/ReportPreview.tsx', [
    # Remove unused state
    (r'const \[selectedInstruments, setSelectedInstruments\] = useState<string\[\]>\(\[\]\);[\n\s]*', ''),
    # Fix any in tooltip
    (r'const CustomTooltip = \({ active, payload, label }: any\)',
     'const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string })'),
    (r'payload\.map\(\(entry: any, index: number\)',
     'payload.map((entry, index: number)'),
    (r'label=\{\(props: any\)', 'label={(props: { percent: number })'),
])

# Fix ReportPlanCard
fix_file('src/components/reports/ReportPlanCard.tsx', [
    # Remove unused import
    (r'import {[\s\S]*?DocumentArrowDownIcon[\s\S]*?} from[^\n]+\n',
     'import { CalendarIcon, ChartBarIcon, BeakerIcon, ClockIcon } from \'@heroicons/react/24/outline\';\n'),
])

# Fix signup page
fix_file('src/app/signup/page.tsx', [
    (r'const { data, error }', 'const { error }'),
])

# Fix supabase session context
fix_file('src/contexts/supabase-session-context.tsx', [
    (r'import { signIn, signUp, signOut, getCurrentUser, getSession }',
     'import { signIn, signUp, signOut, getSession }'),
    (r'import { UserRole } from[^\n]+\n', ''),
    (r'const { session, user }', 'const { user }'),
    (r'const { data, error }', 'const { data }'),
    # Fix useEffect dependency
    (r'}, \[\]\)', '}, [supabase.auth])'),
])

# Fix chat context
fix_file('src/contexts/chat-context.tsx', [
    (r'assistantMessageId: string \| any', 'assistantMessageId: string | unknown'),
])

# Fix xss-protection
fix_file('src/lib/security/xss-protection.ts', [
    (r'sanitizeObject\(obj: any\)', 'sanitizeObject(obj: Record<string, unknown>)'),
])

# Fix auth-manager
fix_file('src/lib/security/auth-manager.ts', [
    # Remove unused function
    (r'function validateProductionConfig[\s\S]*?^}', ''),
])

# Fix supabase server
fix_file('src/lib/supabase/server.ts', [
    (r'} catch \(error\) {', '} catch (_error) {'),
])

# Fix onboarding profile
fix_file('src/app/api/onboarding/profile/route.ts', [
    (r'} catch \(error\) {', '} catch (_error) {'),
    (r'} catch \(dbError\) {', '} catch (_dbError) {'),
    (r'const _ =', 'const _unused ='),
])

# Fix onboarding role
fix_file('src/app/api/onboarding/role/route.ts', [
    (r'} catch \(dbError\) {', '} catch (_dbError) {'),
])

# Fix users sync
fix_file('src/app/api/users/sync/route.ts', [
    (r'export async function POST\(request: NextRequest\)', 'export async function POST(_request: NextRequest)'),
])

print("\nRunning ESLint to check remaining issues...")
result = subprocess.run(['npm', 'run', 'lint'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)