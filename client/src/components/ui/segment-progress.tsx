import * as React from 'react';
import { cn } from '@/lib/utils';

export type SegmentProgressProps = {
  total: number;
  value: number;
  segments?: number;
  className?: string;
  segmentClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export function SegmentProgress({
  total,
  value,
  segments = 36,
  className,
  segmentClassName,
  activeClassName,
  inactiveClassName,
}: SegmentProgressProps) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const displaySegments = Math.min(segments, safeTotal || segments);
  const fill = safeTotal > 0 ? Math.round((safeValue / safeTotal) * displaySegments) : 0;

  return (
    <div className={cn('flex w-full gap-1', className)}>
      {Array.from({ length: displaySegments }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'h-4 flex-1 rounded-[6px] border border-white/10 bg-white/5 transition-colors',
            index < fill
              ? 'bg-gradient-to-r from-primary/80 to-primary shadow-[0_0_12px_rgba(157,0,255,0.45)] border-primary/60'
              : 'bg-white/5 border-white/10',
            segmentClassName,
            index < fill ? activeClassName : inactiveClassName,
          )}
        />
      ))}
    </div>
  );
}
