import { supabase } from "@/integrations/supabase/client";

export type PublicProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null };

/** Only name + picture are ever shared with the community. */
export async function fetchPublicProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return new Map();
  const { data } = await supabase.rpc("get_public_profiles", { _ids: uniq });
  return new Map(((data ?? []) as PublicProfile[]).map((p) => [p.id, p]));
}

/** Resize an image file to a small square JPEG data URL for the profile picture. */
export function resizeAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d")!;
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image")); };
    img.src = url;
  });
}
