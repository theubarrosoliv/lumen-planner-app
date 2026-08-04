// Parses a spoken (already-transcribed) sentence into structured Task
// fields, so "adicionar tarefa por voz" works without a paid pipeline while
// the feature is being tried out.
//
// Uses Gemini specifically because it has a real, ongoing free API tier;
// Anthropic and OpenAI's APIs don't (only limited trial credit for new
// accounts) — see the cost discussion this shipped from, 2026-08-04.
//
// Speech-to-text itself happens client-side via the browser's native Web
// Speech API (src/hooks/use-voice-input.ts) — this function only ever sees
// text, never audio.
//
// Required secret (supabase secrets set ...):
//   GEMINI_API_KEY  - from https://aistudio.google.com/apikey (free tier)
// Optional secret:
//   GEMINI_MODEL    - defaults to "gemini-flash-latest" if unset. Verified
//     directly against this account's key 2026-08-04: "gemini-2.0-flash" (an
//     earlier, seemingly reasonable default) has a hard 0 free-tier quota on
//     this project — not "used up", configured at zero — while
//     "gemini-flash-latest" (currently resolving to "gemini-3.6-flash")
//     works. If this default ever starts failing with RESOURCE_EXHAUSTED /
//     quota "limit: 0", the fix is trying other model names against
//     https://generativelanguage.googleapis.com/v1beta/models?key=... rather
//     than assuming the key itself is broken.
//
// Unlike send-notifications, this is called directly by the logged-in
// client (supabase.functions.invoke, which attaches the user's session JWT
// automatically) — so verify_jwt stays at its default (true). That's not
// just the default; it's load-bearing here, since without it anyone could
// hit this function anonymously and burn through the shared Gemini quota.

const WEEKDAY_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

interface ParsedTask {
  title: string;
  date: string | null;
  time: string | null;
  endTime: string | null;
  tags: string[];
  priority: "high" | "medium" | "low" | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Local weekday name for a "YYYY-MM-DD" key — parsed as plain date
 * components (no timezone conversion) since it's just a calendar day, not a
 * moment in time. */
function weekdayNameFor(dateKey: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAY_PT[new Date(y, m - 1, d).getDay()];
}

function buildPrompt(transcript: string, today: string, weekday: string | null, knownTags: string[]): string {
  return `Você recebe uma frase falada em português (Brasil) descrevendo uma tarefa a fazer, e devolve os campos estruturados dela.

Hoje é ${today}${weekday ? ` (${weekday})` : ""}. Resolva datas relativas ("amanhã", "sexta-feira", "semana que vem", "depois de amanhã") para uma data absoluta.

Tags conhecidas nesta conta: ${knownTags.length ? knownTags.join(", ") : "(nenhuma)"}. Use apenas tags desta lista, exatamente como escritas; se nenhuma se aplicar claramente, devolva uma lista vazia — não invente tags novas.

Frase: "${transcript}"

Regras para cada campo:
- title: o essencial da tarefa, sem as partes de data/hora/prioridade (da frase "reunião com o time amanhã às 15h" o título é "Reunião com o time").
- date: a data resolvida em YYYY-MM-DD, ou null se nenhuma data foi mencionada nem implícita.
- time: horário de início em HH:MM (24h), ou null se nenhum foi mencionado.
- endTime: horário de término em HH:MM, apenas se um intervalo foi dito explicitamente (ex.: "das 15h às 16h30"); null caso contrário — não invente um término que não foi dito.
- tags: subconjunto das tags conhecidas listadas acima que se aplica.
- priority: "high" se foi dito "urgente" ou "prioridade alta"; "low" se "sem pressa" ou "prioridade baixa"; "medium" se "prioridade média"; null se nada foi dito sobre prioridade.`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    date: { type: "STRING", nullable: true },
    time: { type: "STRING", nullable: true },
    endTime: { type: "STRING", nullable: true },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    priority: { type: "STRING", nullable: true, enum: ["high", "medium", "low"] },
  },
  required: ["title", "tags"],
};

/** Never trust the model's output shape directly — re-validates every field
 * against the exact formats the rest of the app expects, and drops any tag
 * that isn't actually one of the account's known tags (the prompt asks for
 * that, but asking isn't enforcing). */
function sanitize(raw: unknown, knownTags: string[]): ParsedTask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return null;

  const dateOk = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
  const timeOk = typeof r.time === "string" && /^\d{2}:\d{2}$/.test(r.time);
  const endTimeOk = typeof r.endTime === "string" && /^\d{2}:\d{2}$/.test(r.endTime);
  const priority = r.priority === "high" || r.priority === "medium" || r.priority === "low" ? r.priority : null;
  const tags = Array.isArray(r.tags)
    ? r.tags.filter((t): t is string => typeof t === "string" && knownTags.includes(t))
    : [];

  return {
    title,
    date: dateOk ? (r.date as string) : null,
    time: timeOk ? (r.time as string) : null,
    // An end time only means anything alongside a start time.
    endTime: endTimeOk && timeOk ? (r.endTime as string) : null,
    tags,
    priority,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Secret ausente: GEMINI_API_KEY" }, 500);
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";

  let body: { transcript?: unknown; today?: unknown; knownTags?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  const today = typeof body.today === "string" ? body.today : "";
  const knownTags = Array.isArray(body.knownTags)
    ? body.knownTags.filter((t): t is string => typeof t === "string")
    : [];

  if (!transcript) return jsonResponse({ error: "transcript vazio" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return jsonResponse({ error: "today inválido (esperado YYYY-MM-DD)" }, 400);
  }

  const prompt = buildPrompt(transcript, today, weekdayNameFor(today), knownTags);

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.1,
          },
        }),
      },
    );
  } catch (e) {
    return jsonResponse({ error: `Falha ao chamar o Gemini: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }

  if (!geminiRes.ok) {
    const detail = await geminiRes.text();
    return jsonResponse({ error: `Gemini respondeu ${geminiRes.status}`, detail }, 502);
  }

  // deno-lint-ignore no-explicit-any
  const geminiBody: any = await geminiRes.json();
  const text = geminiBody?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    return jsonResponse({ error: "Resposta do Gemini sem texto utilizável", detail: geminiBody }, 502);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "Gemini não devolveu JSON válido", detail: text }, 502);
  }

  const parsed = sanitize(raw, knownTags);
  if (!parsed) return jsonResponse({ error: "Não entendi um título de tarefa na frase." }, 422);

  return jsonResponse(parsed);
});
