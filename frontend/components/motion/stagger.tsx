"use client";

import { Children } from "react";
import { cn } from "@/lib/utils";

export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bilan-stagger bilan-stagger--visible", className)}>
      {Children.map(children, (child, index) => (
        <div
          key={index}
          className="bilan-stagger-item"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export function StaggerItem({
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
