// Server-only: streamed Lovable AI Gateway Responses call that returns parsed JSON.
const URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function aiJson(system: string, user: string): Promise<any> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("AI is not configured.", 401);
  let lastErr: AiError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: system + "\nRespond with ONE valid JSON object only. No markdown fences.",
        input: [{ role: "user", content: [{ type: "input_text", text: user }] }],
      }),
    });
    if (!r.ok || !r.body) {
      const body = (await r.text()).slice(0, 300);
      lastErr = new AiError(
        r.status === 429 ? "The AI is busy right now. Please try again in a minute."
          : r.status === 402 ? "AI credits are exhausted. Please add credits and try again."
          : `AI request failed (${r.status}). ${body}`,
        r.status,
      );
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 1500 * 2 ** attempt + Math.random() * 500));
        continue;
      }
      throw lastErr;
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          if (ev.type === "error" || ev.type === "response.failed") throw new AiError("The AI could not complete this request.", 500);
        } catch (e) { if (e instanceof AiError) throw e; }
      }
    }
    return parseJson(text);
  }
  throw lastErr ?? new AiError("AI request failed.", 500);
}

function parseJson(t: string) {
  const s = t.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch {
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new AiError("The AI returned an unreadable answer. Please retry.", 500);
  }
}
