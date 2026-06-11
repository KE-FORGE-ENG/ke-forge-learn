import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LogOut, Menu, BarChart3, Layout, Users, Settings as SettingsIcon, LayoutDashboard, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReminderBell } from "@/components/ReminderBell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import logoAsset from "@/assets/ke-forge-logo.png.asset.json";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { username, signOut, user } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold min-w-0">
            <div className="w-9 h-9 rounded-lg bg-black grid place-items-center overflow-hidden flex-shrink-0">
              <img src={logoAsset.url} alt="KE-FORGE LEARN" className="w-full h-full object-contain" />
            </div>
            <span className="truncate hidden xs:inline">KE-FORGE LEARN</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Menu"><Menu className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => nav({ to: "/dashboard" })}><LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav({ to: "/analytics" })}><BarChart3 className="w-4 h-4 mr-2" /> Analytics</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav({ to: "/templates" })}><Layout className="w-4 h-4 mr-2" /> Templates</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav({ to: "/groups" })}><Users className="w-4 h-4 mr-2" /> Study groups</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav({ to: "/youtube-tool" })}><Youtube className="w-4 h-4 mr-2" /> YouTube key points</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => nav({ to: "/settings" })}><SettingsIcon className="w-4 h-4 mr-2" /> Settings</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {user && <span className="text-sm text-muted-foreground hidden md:inline">@{username ?? "you"}</span>}
            <ThemeToggle />
            <ReminderBell />
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
              <LogOut className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
