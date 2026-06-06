import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReminderBell } from "@/components/ReminderBell";
import logoAsset from "@/assets/ke-forge-logo.png.asset.json";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { username, signOut, user } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <div className="w-9 h-9 rounded-lg bg-black grid place-items-center overflow-hidden">
              <img src={logoAsset.url} alt="KE-FORGE LEARN" className="w-full h-full object-contain" />
            </div>
            KE-FORGE LEARN
          </Link>
          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-muted-foreground hidden sm:inline">@{username ?? "you"}</span>}
            <ThemeToggle />
            <ReminderBell />
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
