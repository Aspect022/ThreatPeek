"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BadgesGrid, type BadgeSlug } from "@/components/profile/badges";
import { UserCard } from "@/components/profile/user-card";

export default function ProfilePage() {
  const { user } = useAuth();

  // Website URL (local-only for now)
  const [siteUrl, setSiteUrl] = React.useState("");

  // System-managed badges: show some badges as earned for demonstration
  // Later, award badges from your Advance tests workflow, e.g.:
  // if (ddosTestPassed) earnedBadges.push("ddos-proof")
  const [earnedBadges] = React.useState<BadgeSlug[]>([
    "sqli",
    "xss",
    "nmap",
    "scan-verified",
  ]);

  // Settings (local placeholders)
  const [emailAlerts, setEmailAlerts] = React.useState(true);
  const [slackAlerts, setSlackAlerts] = React.useState(false);
  const [publicProfile, setPublicProfile] = React.useState(false);

  function handleSaveSiteUrl(e: React.FormEvent) {
    e.preventDefault();
    // TODO: Wire to backend action/route to persist the URL
    // console.log("[v0] Save site URL:", siteUrl)
  }

  return (
    <main className="min-h-[60vh] px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-balance">Profile</h1>
          {/* reserved for future actions */}
        </header>

        {/* Website URL */}
        <Card className="p-4">
          <form onSubmit={handleSaveSiteUrl} className="grid gap-3">
            <Label htmlFor="site-url" className="text-sm font-medium">
              Website URL
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="site-url"
                placeholder="https://your-site.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
              <Button type="submit">Save</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This will be used across scans and badges. Saving is local-only
              for now.
            </p>
          </form>
        </Card>

        {/* User Details */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Details of the user</h2>
          {user ? (
            <UserCard />
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">
              You are not logged in.
            </Card>
          )}
        </section>

        {/* Badges Obtained (system-managed) */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Badges obtained</h2>
          <Card className="p-4">
            {earnedBadges.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No badges yet. Badges are awarded automatically from tests in
                Advance (e.g., DDoS drill → “DDoS Proof”).
              </div>
            ) : null}
            <BadgesGrid
              earned={earnedBadges}
              showLocked={false}
              className="mt-3"
            />
          </Card>
        </section>

        {/* Settings and other stuff */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Settings and other stuff</h2>
          <Card className="p-4 grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Email notifications</div>
                <p className="text-xs text-muted-foreground">
                  Receive email updates for scans, logs and alerts.
                </p>
              </div>
              <Switch
                checked={emailAlerts}
                onCheckedChange={setEmailAlerts}
                aria-label="Toggle email alerts"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Slack alerts</div>
                <p className="text-xs text-muted-foreground">
                  Send alerts to Slack (configure in Alerts &gt; Settings).
                </p>
              </div>
              <Switch
                checked={slackAlerts}
                onCheckedChange={setSlackAlerts}
                aria-label="Toggle Slack alerts"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Public profile</div>
                <p className="text-xs text-muted-foreground">
                  Allow sharing a read-only profile with badges.
                </p>
              </div>
              <Switch
                checked={publicProfile}
                onCheckedChange={setPublicProfile}
                aria-label="Toggle public profile"
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" disabled>
                Save settings
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
