'use client';

import { cn } from '@/lib/utils';
import type { TripType } from '@/lib/trip-types';

const OPTIONS: { id: TripType; label: string }[] = [
  { id: 'oneway', label: 'One way' },
  { id: 'return', label: 'Return' },
  { id: 'multicity', label: 'Multi-city' },
];

export function TripTypeSelector({
  value,
  onChange,
  className,
}: {
  value: TripType;
  onChange: (value: TripType) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-lg border border-navy/15 p-1 bg-white/80', className)}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-xs sm:text-sm font-semibold transition-colors',
            value === opt.id
              ? 'bg-gold text-navy shadow-sm'
              : 'text-navy/60 hover:text-navy hover:bg-navy/5',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
