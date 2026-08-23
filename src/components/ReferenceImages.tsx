import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image as ImageIcon } from "lucide-react";

export type RefImage = { url: string; thumbnail: string; title: string; source: string; author?: string };

export function ReferenceImages({ images, className }: { images: RefImage[]; className?: string }) {
  const [active, setActive] = useState<RefImage | null>(null);
  if (!images.length) return null;

  return (
    <>
      <Card className={`p-4 ${className ?? ""}`}>
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold">
          <ImageIcon className="w-3 h-3 text-primary" /> Reference images
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {images.slice(0, 8).map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(img)}
              className="group block text-left"
              title={img.title}
            >
              <div className="aspect-video overflow-hidden rounded border bg-muted">
                <img
                  src={img.thumbnail}
                  alt={img.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              </div>
              <div className="text-[10px] text-muted-foreground truncate mt-1">{img.title}</div>
            </button>
          ))}
        </div>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">{active?.title}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-2">
              <div className="max-h-[70vh] overflow-auto rounded border bg-muted">
                <img src={active.url || active.thumbnail} alt={active.title} className="w-full h-auto object-contain" />
              </div>
              {active.author && (
                <p className="text-[11px] text-muted-foreground">Credit: {active.author}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
