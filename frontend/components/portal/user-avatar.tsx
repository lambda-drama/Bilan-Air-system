"use client";

import type { FrappeUser } from "@/services/auth";
import { getUserInitials, resolveUserImageUrl } from "@/lib/user-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  user,
  className,
  fallbackClassName,
}: {
  user: Pick<FrappeUser, "full_name" | "name" | "user_image">;
  className?: string;
  fallbackClassName?: string;
}) {
  const src = resolveUserImageUrl(user.user_image);

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {src ? <AvatarImage src={src} alt={user.full_name || user.name} /> : null}
      <AvatarFallback
        className={cn("bg-gold text-navy text-sm font-semibold", fallbackClassName)}
      >
        {getUserInitials(user)}
      </AvatarFallback>
    </Avatar>
  );
}
