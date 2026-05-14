import type { Country, ForecastPoint, YearPoint } from "../data/greenfair";

export type GeminiRecommendation = {
  title: string;
  text: string;
  tone: "green" | "blue" | "amber";
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";
const STORAGE_KEY = "greenfair_gemini_api_key";

function buildPrompt(country: Country, latest: YearPoint, forecast2050: ForecastPoint, weakest: string) {
  return `
Tu es Gemini, expert en stratégie de développement durable, économie publique et analyse prédictive.

Analyse le pays suivant avec des recommandations spécifiques, concrètes et non génériques.

Pays: ${country.name}
Région: ${country.region}
Population estimée: ${country.population} millions
Score GreenFair 2025: ${latest.greenfair}/100
Projection centrale 2050: ${forecast2050.base}/100
Scénario optimiste 2050: ${forecast2050.optimistic}/100
Scénario pessimiste 2050: ${forecast2050.pessimistic}/100
Pilier environnement: ${latest.environment}/100
Pilier social: ${latest.social}/100
Pilier économie: ${latest.economy}/100
CO2 estimé: ${latest.co2} t/habitant
Énergies renouvelables estimées: ${latest.renewable}%
Croissance estimée: ${latest.growth}%
Pilier le plus faible: ${weakest}

Réponds uniquement avec un tableau JSON valide.
N'ajoute aucune phrase avant ou après le JSON.
N'utilise pas de bloc markdown.
Chaque valeur "tone" doit être exactement "green", "blue" ou "amber".
Format obligatoire:
[
  {"title":"Diagnostic pays","text":"2 phrases spécifiques au pays, avec les chiffres clés.","tone":"green"},
  {"title":"Priorités 2026-2030","text":"3 actions concrètes adaptées au pays.","tone":"blue"},
  {"title":"Risques et KPI à suivre","text":"Risques principaux + indicateurs mesurables à suivre.","tone":"amber"}
]
`;
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Réponse Gemini non JSON.");
  }
  return cleaned.slice(start, end + 1);
}

function textToRecommendations(text: string): GeminiRecommendation[] {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parts = cleaned
    .split(/\n(?=\d+\.|[-*]\s|Diagnostic|Priorit|Risque)/i)
    .map((part) => part.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);

  const defaults = ["Diagnostic pays", "Priorités 2026-2030", "Risques et KPI à suivre"];
  const tones: GeminiRecommendation["tone"][] = ["green", "blue", "amber"];
  const selected = parts.length >= 3 ? parts.slice(0, 3) : [cleaned];

  return selected.map((part, index) => {
    const [rawTitle, ...rest] = part.split(/:\s+/);
    const hasTitle = rest.length > 0 && rawTitle.length < 60;
    return {
      title: hasTitle ? rawTitle : defaults[index] || "Insight Gemini",
      text: hasTitle ? rest.join(": ") : part,
      tone: tones[index] || "green"
    };
  });
}

export function hasGeminiKey() {
  return Boolean(getGeminiKey());
}

export function getGeminiKey() {
  if (GEMINI_API_KEY) {
    return GEMINI_API_KEY;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_KEY) || "";
}

export function saveGeminiKey(apiKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, apiKey.trim());
}

export async function generateGeminiRecommendations(
  country: Country,
  latest: YearPoint,
  forecast2050: ForecastPoint,
  weakest: string
): Promise<GeminiRecommendation[]> {
  const apiKey = getGeminiKey();

  if (!apiKey) {
    throw new Error("Clé Gemini absente. Ajoutez VITE_GEMINI_API_KEY dans les secrets GitHub Pages.");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(country, latest, forecast2050, weakest) }]
        }
      ],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 900,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  let parsed: GeminiRecommendation[];

  try {
    parsed = JSON.parse(extractJson(text)) as GeminiRecommendation[];
  } catch {
    parsed = textToRecommendations(text);
  }

  return parsed.map((item, index) => ({
    title: item.title || ["Diagnostic pays", "Priorités 2026-2030", "Risques et KPI à suivre"][index] || "Insight IA",
    text: item.text || "",
    tone: item.tone || (["green", "blue", "amber"][index] as GeminiRecommendation["tone"]) || "green"
  }));
}
