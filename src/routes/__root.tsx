import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KE-FORGE LEARN — AI-paced learning" },
      { name: "description", content: "KE-FORGE LEARN is an AI-powered platform that creates personalized study plans from your content." },
      { name: "author", content: "ke-forge" },
      { property: "og:title", content: "KE-FORGE LEARN — AI-paced learning" },
      { property: "og:description", content: "KE-FORGE LEARN is an AI-powered platform that creates personalized study plans from your content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "KE-FORGE LEARN — AI-paced learning" },
      { name: "twitter:description", content: "KE-FORGE LEARN is an AI-powered platform that creates personalized study plans from your content." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/R8MKuakcAFgaimMA8ZMksqh5gPu1/social-images/social-1778110309284-1778013166411.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/R8MKuakcAFgaimMA8ZMksqh5gPu1/social-images/social-1778110309284-1778013166411.webp" },
      { name: "theme-color", content: "#0b0b0b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "KE-FORGE" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__l5e/assets-v1/b7fa5631-67a6-4800-a0f0-4fdc7d365dd3/ke-forge-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  if (typeof window !== "undefined" && !(window as any).__etechReminderStarted) {
    (window as any).__etechReminderStarted = true;
    import("@/lib/reminders").then((m) => m.startReminderLoop());
    import("@/lib/accessibility").then((m) => m.applyA11y(m.loadA11y()));
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Toaster richColors position="top-center" />
          <Outlet />
          <div className="pointer-events-none fixed bottom-2 right-3 z-[9999] text-[10px] font-medium text-muted-foreground/60 select-none">
            ©ke-forge
          </div>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
