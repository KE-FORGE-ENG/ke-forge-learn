import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/templates";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/templates")({ component: Templates });

function Templates() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);
  if (!user) return null;

  return (
    <AppShell>
      <h1 className="text-2xl sm:text-3xl font-bold">Template study plans</h1>
      <p className="text-sm text-muted-foreground mt-1">Start from a proven shape, then tweak the topic.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {TEMPLATES.map((t) => (
          <Card key={t.id} className="p-5 flex flex-col">
            <div className="text-3xl">{t.emoji}</div>
            <h2 className="font-semibold mt-3">{t.title}</h2>
            <p className="text-xs text-muted-foreground mt-1 flex-1">{t.description}</p>
            <div className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" /> {t.days}-day plan</div>
            <Button asChild className="mt-3 w-full" size="sm">
              <Link to="/new" search={{ template: t.id } as any}>Use this template</Link>
            </Button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
