'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { UserAvatar } from '@/components/portal/user-avatar';
import { ThemeDropdownSubmenu } from '@/components/theme-dropdown-items';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type TravelerProfileMenuProps = {
  onNavigate?: () => void;
  triggerClassName?: string;
  /** Icon-only circular trigger (navbar). */
  compact?: boolean;
};

export function TravelerProfileMenu({
  onNavigate,
  triggerClassName,
  compact = false,
}: TravelerProfileMenuProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading || !isAuthenticated || !user) {
    return null;
  }

  const close = () => onNavigate?.();

  const handleLogout = async () => {
    close();
    await logout();
    router.push('/account');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            compact
              ? 'h-9 w-9 rounded-full border border-gold/40 p-0 hover:bg-gold/10 hover:text-cream'
              : 'flex h-auto items-center gap-2 px-2 py-1.5 text-cream hover:bg-navy-light hover:text-cream',
            triggerClassName,
          )}
        >
          <UserAvatar user={user} className={compact ? 'h-8 w-8' : undefined} />
          {!compact && (
            <>
              <span className="hidden max-w-[120px] truncate text-sm font-medium lg:inline">
                {user.full_name || user.email}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="border-b px-3 py-2">
          <p className="truncate text-sm font-medium">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-gold font-medium">Traveler</p>
        </div>
        <DropdownMenuItem asChild>
          <Link href="/account" onClick={close}>
            <User className="h-4 w-4" />
            My Account
          </Link>
        </DropdownMenuItem>
        <ThemeDropdownSubmenu />
        <DropdownMenuItem asChild>
          <Link href="/account/settings" onClick={close}>
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
