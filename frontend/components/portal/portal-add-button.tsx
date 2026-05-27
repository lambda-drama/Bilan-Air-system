"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const addButtonClass = "bg-gold text-navy hover:bg-gold-dark";

/** Primary portal action: + icon before label (new booking, new route, etc.). */
export function PortalAddButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button className={cn(addButtonClass, className)} {...props}>
      <Plus className="mr-2 h-4 w-4 shrink-0" />
      {children}
    </Button>
  );
}

export function PortalAddLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button asChild className={cn(addButtonClass, className)}>
      <Link href={href} className="inline-flex items-center">
        <Plus className="mr-2 h-4 w-4 shrink-0" />
        {children}
      </Link>
    </Button>
  );
}
