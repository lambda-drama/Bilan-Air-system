"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Save } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatar } from "@/components/portal/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRoleLabel } from "@/lib/user-display";
import {
  fetchMyBookingCompanyBranding,
  updateMyBookingCompanyBranding,
  uploadMyBookingCompanyLogo,
  type BookingCompanyBranding,
} from "@/services/bookingCompanyBranding";
import {
  updatePortalUserProfile,
  updateUserPassword,
  uploadUserProfileImage,
} from "@/services/userProfile";
import { toast } from "sonner";

export default function PortalProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [branding, setBranding] = useState<BookingCompanyBranding | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [showOnTicket, setShowOnTicket] = useState(false);
  const [showOnBaggage, setShowOnBaggage] = useState(false);
  const [showOnBoardingPass, setShowOnBoardingPass] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name || "");
    setLastName(user.last_name || "");
    setPhone(user.phone || "");
    setMobile(user.mobile_no || "");
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setLoadingBranding(true);
    fetchMyBookingCompanyBranding()
      .then((data) => {
        if (cancelled) return;
        setBranding(data);
        setShowOnTicket(!!data?.show_logo_on_ticket);
        setShowOnBaggage(!!data?.show_logo_on_baggage);
        setShowOnBoardingPass(!!data?.show_logo_on_boarding_pass);
      })
      .catch(() => {
        if (!cancelled) setBranding(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingBranding(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updatePortalUserProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        mobile_no: mobile.trim(),
      });
      await refreshUser();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploadingImage(true);
    try {
      await uploadUserProfileImage(file);
      await refreshUser();
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const updated = await uploadMyBookingCompanyLogo(file);
      setBranding(updated);
      toast.success("Agency logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const updated = await updateMyBookingCompanyBranding({
        show_logo_on_ticket: showOnTicket,
        show_logo_on_baggage: showOnBaggage,
        show_logo_on_boarding_pass: showOnBoardingPass,
      });
      setBranding(updated);
      toast.success("Print logo settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save logo settings");
    } finally {
      setSavingBranding(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Enter your current and new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSavingPassword(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Your account details and security</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Photo & identity</CardTitle>
          <CardDescription>Update how you appear in the portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar user={user} className="h-20 w-20" fallbackClassName="text-lg" />
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingImage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Change photo
              </Button>
              <p className="text-xs text-muted-foreground">JPG or PNG, max 5 MB</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user.email} disabled />
            <p className="text-xs text-muted-foreground">
              Contact an administrator to change your login email.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Role</Label>
            <Input value={formatRoleLabel(user.roles)} disabled />
          </div>

          <Button
            className="bg-gold text-navy hover:bg-gold-dark"
            onClick={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save profile
          </Button>
        </CardContent>
      </Card>

      {!loadingBranding && branding ? (
        <Card>
          <CardHeader>
            <CardTitle>Agency logo</CardTitle>
            <CardDescription>
              Upload your company logo for {branding.company_agency}. Choose where it appears on
              printed documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-muted">
                {branding.logo ? (
                  <img
                    src={branding.logo}
                    alt={branding.company_agency}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-2 text-center text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleLogoChange(e)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-gold hover:border-gold hover:bg-gold hover:text-navy"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  Upload logo
                </Button>
                <p className="text-xs text-muted-foreground">JPG or PNG, max 5 MB</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Show logo on</p>
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={showOnTicket}
                  onCheckedChange={(v) => setShowOnTicket(v === true)}
                />
                <span className="text-sm">Print ticket</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={showOnBaggage}
                  onCheckedChange={(v) => setShowOnBaggage(v === true)}
                />
                <span className="text-sm">Baggage</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={showOnBoardingPass}
                  onCheckedChange={(v) => setShowOnBoardingPass(v === true)}
                />
                <span className="text-sm">Boarding pass</span>
              </label>
            </div>

            <Button
              className="bg-gold text-navy hover:bg-gold-dark"
              onClick={() => void handleSaveBranding()}
              disabled={savingBranding}
            >
              {savingBranding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save logo settings
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your portal login password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" onClick={handleUpdatePassword} disabled={savingPassword}>
            {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
