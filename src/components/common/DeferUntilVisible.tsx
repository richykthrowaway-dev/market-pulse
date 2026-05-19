import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Reserved placeholder height (px) to avoid layout shift. */
  minHeight?: number;
  /** IntersectionObserver rootMargin — pre-mount slightly before in view. */
  rootMargin?: string;
  className?: string;
}

/**
 * Renders a reserved-height placeholder until it scrolls near the viewport,
 * then mounts `children` once and keeps them mounted. If IntersectionObserver
 * is unavailable (SSR / old engines) it renders children immediately.
 */
export function DeferUntilVisible({
  children,
  minHeight = 300,
  rootMargin = '200px',
  className,
}: Props) {
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return <div ref={ref} className={className} style={{ minHeight }} aria-hidden="true" />;
}
