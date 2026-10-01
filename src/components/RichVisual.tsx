import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, PieChart, Pie, Cell } from "recharts";

export function MermaidDiagram({ code }: { code: string }) {
  const id = "m" + useId().replace(/[^a-z0-9]/gi, "");
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([import("mermaid"), import("dompurify")]);
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", securityLevel: "strict" });
        const { svg } = await mermaid.render(id + tick, code);
        if (alive) { setSvg(DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ["foreignObject"] })); setErr(false); }
      } catch { if (alive) setErr(true); }
    })();
    return () => { alive = false; };
  }, [code, id, tick]);
  if (err) return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
      <p className="text-muted-foreground mb-2">Diagram couldn't be drawn — here's the text version:</p>
      <pre className="whitespace-pre-wrap overflow-x-auto">{code}</pre>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setTick((t) => t + 1)}>Retry</Button>
    </div>
  );
  if (!svg) return <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />;
  const download = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a"); a.href = url; a.download = "diagram.svg"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>+</Button>
        <Button size="sm" variant="outline" onClick={download}>Download</Button>
      </div>
      <div className="overflow-auto max-h-[70vh]">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }} className="[&_svg]:mx-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}

const COLORS = ["var(--primary)", "var(--accent)", "var(--chart-3, #888)", "var(--chart-4, #aaa)", "var(--chart-5, #666)"];

export function ChartVisual({ chart }: { chart: { kind?: string; title?: string; data?: { name: string; value: number }[] } }) {
  const data = (chart?.data ?? []).filter((d) => d && Number.isFinite(Number(d.value))).map((d) => ({ name: String(d.name), value: Number(d.value) }));
  if (!data.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {chart.title && <p className="text-sm font-medium mb-2">{chart.title}</p>}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === "pie" ? (
            <PieChart><Tooltip /><Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart>
          ) : chart.kind === "line" ? (
            <LineChart data={data}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="value" stroke="var(--primary)" strokeWidth={2} /></LineChart>
          ) : (
            <BarChart data={data}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} /></BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LessonVisual({ visual }: { visual: any }) {
  if (!visual || visual.type === "none") return null;
  if (visual.type === "mermaid" && visual.code) return <MermaidDiagram code={visual.code} />;
  if (visual.type === "chart" && visual.chart) return <ChartVisual chart={visual.chart} />;
  return null;
}
