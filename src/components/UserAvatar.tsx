export function UserAvatar({ name, src, size = 28 }: { name?: string | null; src?: string | null; size?: number }) {
  const initials = (name ?? "?").replace(/^@/, "").split(/[\s_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return (
    <span
      className="inline-grid place-items-center rounded-full overflow-hidden bg-accent text-accent-foreground font-display font-semibold shrink-0 border border-border"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? <img src={src} alt={name ?? ""} className="w-full h-full object-cover" /> : initials}
    </span>
  );
}
