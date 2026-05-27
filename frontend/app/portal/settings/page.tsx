"use client";

import { Palette } from "lucide-react";
import { ThemeSelector } from "@/components/portal/theme-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function PortalSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Portal appearance and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-gold" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose light, dark, or match your device (system)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="theme">Theme</Label>
          <ThemeSelector />
          <p className="text-xs text-muted-foreground">
            System follows your operating system light or dark preference.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
