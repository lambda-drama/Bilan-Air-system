'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

const DESK_REDIRECT = '/account?redirect=%2Fapp';

export function StaffDeskLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const href = !isLoading && isAuthenticated ? '/app' : DESK_REDIRECT;

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
