import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LogOut, Menu, BarChart3, Layout, Users, Settings as SettingsIcon, LayoutDashboard, Youtube, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReminderBell } from "@/components/ReminderBell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { UserCircle } from "lucide-react";
import logoAsset from "@/assets/ke-forge-logo.png.asset.json";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { username, signOut, user } = useAuth();
  const nav = useNavigate();
  const { data: me } = useQuery({
    queryKey: ["my-avatar", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => (await supabase.from("profiles").select("display_name,avatar_url").eq("id", user!.id).maybeSingle()).data,
  });
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-between">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-semibold">
            <div className="w-9 h-9 rounded-lg bg-black grid place-items-center overflow-hidden flex-shrink-0">
              <img src={logoAsset.url} alt="KE-FORGE LEARN" className="w-full h-full object-contain" />
            </div>
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-sm sm:text-base md:text-lg font-semibold tracking-tight truncate">KE-FORGE LEARN</span>
              <span className="hidden md:block text-[11px] text-muted-foreground font-normal">Knowledge for a Brighter Tomorrow</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Menu"><Menu className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild><Link to="/dashboard" preload="render"><LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/analytics" preload="render"><BarChart3 className="w-4 h-4 mr-2" /> Analytics</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/templates" preload="render"><Layout className="w-4 h-4 mr-2" /> Templates</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/community" preload="render"><Users className="w-4 h-4 mr-2" /> Community Commons</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/groups" preload="render"><Users className="w-4 h-4 mr-2" /> Study groups</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/notes" preload="render"><StickyNote className="w-4 h-4 mr-2" /> Notes</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/youtube-tool" preload="render"><Youtube className="w-4 h-4 mr-2" /> YouTube key points</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/profile" preload="render"><UserCircle className="w-4 h-4 mr-2" /> Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/settings" preload="render"><SettingsIcon className="w-4 h-4 mr-2" /> Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={async () => { await signOut(); nav({ to: "/" }); }}><LogOut className="w-4 h-4 mr-2" /> Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {user && (
              <Link to="/profile" className="flex items-center gap-2 rounded-full px-1 py-1 hover:bg-muted" aria-label="Your profile">
                <UserAvatar name={me?.display_name || username} src={me?.avatar_url} size={30} />
                <span className="text-sm text-muted-foreground hidden md:inline">{me?.display_name || `@${username ?? "you"}`}</span>
              </Link>
            )}
            <ThemeToggle />
            <ReminderBell />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
              <LogOut className="w-4 h-4 mr-1" /> <span>Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}

