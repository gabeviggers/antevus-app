'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProtocolStage {
  name: string;
  status: 'pending' | 'running' | 'completed';
  duration?: number; // in seconds
}

interface ProtocolProgressProps {
  protocolId: string;
  protocolName: string;
  stages: ProtocolStage[];
  onComplete?: () => void;
}

export function ProtocolProgress({ protocolId, protocolName, stages: initialStages, onComplete }: ProtocolProgressProps) {
  const [stages, setStages] = useState<ProtocolStage[]>(initialStages);
  const [currentStage, setCurrentStage] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    // Start the first stage immediately
    if (currentStage === 0 && stages.length > 0) {
      setStages(prev => {
        const updated = [...prev];
        updated[0].status = 'running';
        return updated;
      });
      setCurrentStage(1);
      setOverallProgress((1 / stages.length) * 100);
      return;
    }

    if (currentStage > stages.length) {
      // All stages completed
      if (onComplete) {
        onComplete();
      }
      return;
    }

    // Progress through stages
    const timer = setTimeout(() => {
      setStages(prev => {
        const updated = [...prev];
        const currentIndex = currentStage - 1;

        // Mark current stage as completed
        if (currentIndex >= 0 && currentIndex < stages.length) {
          updated[currentIndex].status = 'completed';
        }

        // Start next stage if available
        if (currentIndex + 1 < stages.length) {
          updated[currentIndex + 1].status = 'running';
        }

        return updated;
      });

      setCurrentStage(prev => prev + 1);
      setOverallProgress(Math.min(100, ((currentStage + 1) / stages.length) * 100));
    }, stages[currentStage - 1]?.duration || 3000); // Default 3 seconds per stage

    return () => clearTimeout(timer);
  }, [currentStage, stages, onComplete]);

  return (
    <div className="w-full p-4 bg-card border rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Executing Protocol: {protocolName}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">Protocol ID: {protocolId}</p>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Overall Progress</span>
          <span className="text-xs font-medium">{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Stages List */}
      <div className="space-y-2">
        {stages.map((stage, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-3 p-2 rounded-md transition-all duration-300",
              stage.status === 'running' && "bg-primary/10",
              stage.status === 'completed' && "bg-green-500/10"
            )}
          >
            <div>
              {stage.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : stage.status === 'running' ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className={cn(
                "text-xs",
                stage.status === 'running' && "font-medium",
                stage.status === 'completed' && "text-green-600 line-through"
              )}>
                {stage.name}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Status Message */}
      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-muted-foreground">
          {currentStage >= stages.length
            ? '✅ Protocol completed successfully'
            : `Running stage ${currentStage + 1} of ${stages.length}...`}
        </p>
      </div>
    </div>
  );
}