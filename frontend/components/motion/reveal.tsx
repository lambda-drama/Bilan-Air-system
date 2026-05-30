"use client";

import { useEffect, useRef, useState, type ElementType, type Ref } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
  id?: string;
};

function useRevealVisible(threshold = 0.12) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "-48px 0px -32px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  id,
}: RevealProps) {
  const { ref, visible } = useRevealVisible();

  return (
    <Tag
      id={id}
      ref={ref as Ref<HTMLElement>}
      className={cn("bilan-reveal", visible && "bilan-reveal--visible", className)}
      style={{ animationDelay: visible ? `${delay}ms` : undefined }}
    >
      {children}
    </Tag>
  );
}

export function RevealStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, visible } = useRevealVisible(0.08);

  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      className={cn("bilan-stagger", visible && "bilan-stagger--visible", className)}
    >
      {children}
    </div>
  );
}

export function RevealItem({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={cn("bilan-stagger-item", className)}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {children}
    </div>
  );
}
