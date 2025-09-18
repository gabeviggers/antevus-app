import { cn } from '@/lib/utils'

interface ChatLoadingSkeletonProps {
  className?: string
}

export function ChatLoadingSkeleton({ className }: ChatLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4 p-4", className)}>
      {/* Simulate thread header */}
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 bg-muted-foreground/20 rounded animate-pulse" />
        <div className="h-4 w-32 bg-muted-foreground/20 rounded animate-pulse" />
      </div>

      {/* Simulate messages */}
      <div className="space-y-6">
        {/* User message skeleton */}
        <div className="flex gap-3 justify-end">
          <div className="max-w-[70%] space-y-2">
            <div className="h-4 w-48 bg-primary/20 rounded animate-pulse ml-auto" />
            <div className="h-4 w-36 bg-primary/20 rounded animate-pulse ml-auto" />
          </div>
          <div className="w-8 h-8 bg-primary/20 rounded-full animate-pulse flex-shrink-0" />
        </div>

        {/* Assistant message skeleton */}
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse flex-shrink-0" />
          <div className="max-w-[70%] space-y-2">
            <div className="h-4 w-64 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-52 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-40 bg-muted-foreground/20 rounded animate-pulse" />
          </div>
        </div>

        {/* Another user message */}
        <div className="flex gap-3 justify-end">
          <div className="max-w-[70%] space-y-2">
            <div className="h-4 w-56 bg-primary/20 rounded animate-pulse ml-auto" />
          </div>
          <div className="w-8 h-8 bg-primary/20 rounded-full animate-pulse flex-shrink-0" />
        </div>

        {/* Assistant thinking indicator */}
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse flex-shrink-0" />
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChatInputSkeleton() {
  return (
    <div className="border-t border-border p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 min-h-[40px] bg-muted/50 rounded-lg animate-pulse" />
        <div className="w-10 h-10 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

export function ChatThreadListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <div className="w-4 h-4 bg-muted-foreground/20 rounded animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-3/4 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-muted-foreground/10 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}