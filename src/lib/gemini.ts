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
Tu es Gemini, expert en strategie de developpement durable, economie publique et analyse predictive.

Analyse le pays suivant avec des recommandations specifiques, concretes et non generiques.

Pays: ${country.name}
Region: ${country.region}
Population estimee: ${country.population} millions
Score GreenFair 2025: ${latest.greenfair}/100
Projection centrale 2050: ${forecast2050.base}/100
Scenario optimiste 2050: ${forecast2050.optimistic}/100
Scenario pessimiste 2050: ${forecast2050.pessimistic}/100
Pilier environnement: ${latest.environment}/100
Pilier social: ${latest.social}/100
Pilier economie: ${latest.economy}/100
CO2 estime: ${latest.co2} t/habitant
Energies renouvelables estimees: ${latest.renewable}%
Croissance estimee: ${latest.growth}%
Pilier le plus faible: ${weakest}

Reponds uniquement avec un tableau JSON valide.
N'ajoute aucune phrase avant ou apres le JSON.
N'utilise pas de bloc markdown.
Chaque valeur "tone" doit etre exactement "green", "blue" ou "amber".
Format obligatoire:
[
  {"title":"Diagnostic pays","text":"2 phrases specifiques au pays, avec les chiffres cles.","tone":"green"},
  {"title":"Priorites 2026-2030","text":"3 actions concretes adaptees au pays.","tone":"blue"},
  {"title":"Risques et KPI a suivre","text":"Risques principaux + indicateurs mesurables a suivre.","tone":"amber"}
]
`;
}

function cleanGeminiText(text: string) {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function extractJson(text: string) {
  const cleaned = cleanGeminiText(text);
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Reponse Gemini non JSON.");
  }
  return cleaned.slice(start, end + 1);
}

function textToRecommendations(text: string): GeminiRecommendation[] {
  const cleaned = cleanGeminiText(text);
  const defaults = ["Diagnostic pays", "Priorites 2026-2030", "Risques et KPI a suivre"];
  const tones: GeminiRecommendation["tone"][] = ["green", "blue", "amber"];
  const jsonLikeMatches = Array.from(
    cleaned.matchAll(
      /"title"\s*:\s*"([^"]+)"[\s\S]*?"text"\s*:\s*"([^"]+)"(?:[\s\S]*?"tone"\s*:\s*"(green|blue|amber)")?/gi
    )
  );

  if (jsonLikeMatches.length > 0) {
    return jsonLikeMatches.slice(0, 3).map((match, index) => ({
      title: match[1].trim(),
      text: match[2].trim(),
      tone: (match[3] as GeminiRecommendation["tone"]) || tones[index] || "green"
    }));
  }

  const parts = cleaned
    .split(/\n(?=\d+\.|[-*]\s|Diagnostic|Priorit|Risque)/i)
    .map((part) =>
      part
        .replace(/^[-*\d.\s]+/, "")
        .replace(/^\[?\s*\{?\s*"?(title|text|tone)"?\s*:?\s*/i, "")
        .replace(/[{}[\]"]/g, "")
        .trim()
    )
    .filter(Boolean);
  const selected = parts.length >= 3 ? parts.slice(0, 3) : [cleaned.replace(/[{}[\]"]/g, "").trim()];

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
    throw new Error("Cle Gemini absente. Collez votre cle dans le champ Gemini.");
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
        temperature: 0.25,
        maxOutputTokens: 1600,
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
    title: item.title || ["Diagnostic pays", "Priorites 2026-2030", "Risques et KPI a suivre"][index] || "Insight IA",
    text: item.text || "",
    tone: item.tone || (["green", "blue", "amber"][index] as GeminiRecommendation["tone"]) || "green"
  }));
}
