import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, Sparkles, Target, Youtube } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-10 bg-background/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <div className="w-8 h-8 rounded-lg bg-[image:var(--gradient-hero)] grid place-items-center text-primary-foreground">
              <Brain className="w-5 h-5" />
            </div>
            LearnPath
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--gradient-soft)] opacity-80" />
        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Adaptive AI tutoring
          </span>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Master any PDF in <span className="bg-clip-text text-transparent bg-[image:var(--gradient-hero)]">1 to 5 days</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload a PDF or paste a topic. We split it page-by-page, build a daily plan, and adapt as you learn — with quizzes, videos, and an "I'm lost" button that actually helps.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="shadow-[var(--shadow-glow)]"><Link to="/auth">Start learning free</Link></Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-6">
        {[
          { icon: BookOpen, title: "Page-by-page", desc: "We detect every page in your PDF and split it across the days you choose." },
          { icon: Target, title: "Adaptive intensity", desc: "Day 1 is foundational. Day 5 is intense — but never overwhelming." },
          { icon: Youtube, title: "Videos & quizzes", desc: "Embedded YouTube, CBT quizzes, and ELI5 mode whenever you're stuck." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="w-10 h-10 rounded-lg bg-secondary grid place-items-center text-primary mb-4">
              <f.icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <span className="font-semibold tracking-widest">ETech</span> · Crafted with care
      </footer>
    </div>
  );
}
