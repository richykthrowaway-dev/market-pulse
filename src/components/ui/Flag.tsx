
import React from 'react';
import { getFlagUrl } from '@/lib/flags';

interface FlagProps {
  code: string;
  size?: number;
  className?: string;
}

/** Renders a tiny flag image from flagcdn.com (~1KB PNG) */
export function Flag({ code, size = 34, className }: FlagProps) {
  const url = getFlagUrl(code, size <= 20 ? 20 : 40);
  if (!url) return null;
  const height = Math.round(size * 0.67);
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height,
        borderRadius: 4,
        overflow: 'hidden',
        flexShrink: 0,
        background: '#1a2332',
      }}
    >
      <img
        src={url}
        alt={code}
        loading="lazy"
        decoding="async"
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
