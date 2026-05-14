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

Réponds uniquement en JSON valide, sans markdown, avec exactement ce format:
[
  {"title":"Diagnostic pays","text":"2 phrases spécifiques au pays, avec les chiffres clés.","tone":"green"},
  {"title":"Priorités 2026-2030","text":"3 actions concrètes adaptées au pays.","tone":"blue"},
  {"title":"Risques et KPI à suivre","text":"Risques principaux + indicateurs mesurables à suivre.","tone":"amber"}
]
`;
}

function extractJson(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Réponse Gemini non JSON.");
  }
  return text.slice(start, end + 1);
}

export function hasGeminiKey() {
  return Boolean(GEMINI_API_KEY);
}

export async function generateGeminiRecommendations(
  country: Country,
  latest: YearPoint,
  forecast2050: ForecastPoint,
  weakest: string
): Promise<GeminiRecommendation[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Clé Gemini absente. Ajoutez VITE_GEMINI_API_KEY dans les secrets GitHub Pages.");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
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
  const parsed = JSON.parse(extractJson(text)) as GeminiRecommendation[];

  return parsed.map((item, index) => ({
    title: item.title || ["Diagnostic pays", "Priorités 2026-2030", "Risques et KPI à suivre"][index] || "Insight IA",
    text: item.text || "",
    tone: item.tone || (["green", "blue", "amber"][index] as GeminiRecommendation["tone"]) || "green"
  }));
}
