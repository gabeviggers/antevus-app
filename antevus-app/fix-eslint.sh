#!/bin/bash

echo "Fixing all ESLint issues..."

# Fix unused imports and variables in assistant page
echo "Fixing assistant page..."
sed -i '' '/^import { format } from/d' src/app/\(dashboard\)/assistant/page.tsx

# Fix any types in assistant page - replace with proper types
sed -i '' 's/: any\[\]/: Message[]/g' src/app/\(dashboard\)/assistant/page.tsx
sed -i '' 's/: any)/: unknown)/g' src/app/\(dashboard\)/assistant/page.tsx

# Fix unused imports in reports page
echo "Fixing reports page..."
sed -i '' '/Calendar,/d' src/app/reports/\[id\]/page.tsx
sed -i '' '/Clock,/d' src/app/reports/\[id\]/page.tsx
sed -i '' '/Legend/d' src/app/reports/\[id\]/page.tsx

# Fix unused imports in runs page
echo "Fixing runs page..."
sed -i '' '/AreaChart,/d' src/app/runs/\[id\]/page.tsx
sed -i '' '/Area,/d' src/app/runs/\[id\]/page.tsx
sed -i '' '/BarChart,/d' src/app/runs/\[id\]/page.tsx
sed -i '' '/Bar,/d' src/app/runs/\[id\]/page.tsx

# Fix unused variables in ReportPreview
echo "Fixing ReportPreview..."
sed -i '' '/const \[selectedInstruments/,+1d' src/components/reports/ReportPreview.tsx

# Fix unused imports
sed -i '' '/DocumentArrowDownIcon/d' src/components/reports/ReportPlanCard.tsx

# Fix unused variables in signup page
sed -i '' 's/const { data, error }/const { error }/g' src/app/signup/page.tsx

# Fix unused imports in supabase-session-context
sed -i '' '/getCurrentUser,/d' src/contexts/supabase-session-context.tsx
sed -i '' '/import { UserRole }/d' src/contexts/supabase-session-context.tsx

# Fix unused variables in onboarding files
sed -i '' 's/} catch (error) {/} catch (_error) {/g' src/app/api/onboarding/profile/route.ts
sed -i '' 's/} catch (dbError) {/} catch (_dbError) {/g' src/app/api/onboarding/role/route.ts
sed -i '' 's/const _ =/const _unused =/g' src/app/api/onboarding/profile/route.ts

# Fix unused variable in reports schedule
sed -i '' 's/} catch (error) {/} catch (_error) {/g' src/app/api/reports/schedule/route.ts

# Fix unused variable in auth-manager
sed -i '' '/function validateProductionConfig/,/^}/d' src/lib/security/auth-manager.ts

# Fix unused errors in supabase server
sed -i '' 's/} catch (error) {/} catch (_error) {/g' src/lib/supabase/server.ts

echo "Running ESLint to check remaining issues..."
npm run lint