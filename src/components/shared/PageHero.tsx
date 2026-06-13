import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeroProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  className?: string;
}

export const PageHero: React.FC<PageHeroProps> = ({ title, description, icon, actions, stats, className }) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 mb-6 px-6 py-6 md:px-8 md:py-7',
        'bg-[image:var(--gradient-page-hero)]',
        className
      )}
      dir="rtl"
    >
      {/* Radial gold glow */}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-radial-glow)]" />
      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative flex flex-wrap items-start gap-4 justify-between">
        <div className="flex items-start gap-4 min-w-0">
          {icon && (
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-[var(--shadow-gold)]">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {stats && (
        <div className="relative mt-5 flex flex-wrap gap-2">{stats}</div>
      )}
    </div>
  );
};

export default PageHero;
