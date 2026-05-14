export type CountryCode =
  | "TUN"
  | "MAR"
  | "EGY"
  | "SEN"
  | "KEN"
  | "ETH"
  | "IND"
  | "BGD"
  | "VNM"
  | "BRA";

export type Country = {
  code: CountryCode;
  name: string;
  region: string;
  continent: string;
  flag: string;
  lat: number;
  lon: number;
  env: number;
  social: number;
  economy: number;
  momentum: number;
  volatility: number;
  population: number;
};

export type YearPoint = {
  year: number;
  environment: number;
  social: number;
  economy: number;
  greenfair: number;
  co2: number;
  renewable: number;
  growth: number;
};

export type ForecastPoint = {
  year: number;
  base: number;
  optimistic: number;
  pessimistic: number;
  confidenceLow: number;
  confidenceHigh: number;
};

export const countries: Country[] = [
  { code: "TUN", name: "Tunisia", region: "Afrique du Nord", continent: "Afrique", flag: "🇹🇳", lat: 34, lon: 9, env: 28, social: 66, economy: 52, momentum: 0.62, volatility: 4.2, population: 12.5 },
  { code: "MAR", name: "Morocco", region: "Afrique du Nord", continent: "Afrique", flag: "🇲🇦", lat: 31.8, lon: -7.1, env: 44, social: 63, economy: 55, momentum: 0.74, volatility: 3.8, population: 37.8 },
  { code: "EGY", name: "Egypt", region: "Afrique du Nord", continent: "Afrique", flag: "🇪🇬", lat: 26.8, lon: 30.8, env: 35, social: 61, economy: 51, momentum: 0.48, volatility: 4.5, population: 112.7 },
  { code: "SEN", name: "Senegal", region: "Afrique de l'Ouest", continent: "Afrique", flag: "🇸🇳", lat: 14.5, lon: -14.4, env: 43, social: 54, economy: 47, momentum: 0.68, volatility: 4.1, population: 18.3 },
  { code: "KEN", name: "Kenya", region: "Afrique de l'Est", continent: "Afrique", flag: "🇰🇪", lat: 0, lon: 37.9, env: 52, social: 58, economy: 49, momentum: 0.72, volatility: 3.6, population: 55.1 },
  { code: "ETH", name: "Ethiopia", region: "Afrique de l'Est", continent: "Afrique", flag: "🇪🇹", lat: 9.1, lon: 40.5, env: 47, social: 46, economy: 43, momentum: 0.64, volatility: 5.3, population: 126.5 },
  { code: "IND", name: "India", region: "Asie du Sud", continent: "Asie", flag: "🇮🇳", lat: 20.6, lon: 78.9, env: 39, social: 60, economy: 59, momentum: 0.76, volatility: 4, population: 1428.6 },
  { code: "BGD", name: "Bangladesh", region: "Asie du Sud", continent: "Asie", flag: "🇧🇩", lat: 23.7, lon: 90.4, env: 41, social: 57, economy: 50, momentum: 0.71, volatility: 4.4, population: 172.9 },
  { code: "VNM", name: "Viet Nam", region: "Asie du Sud-Est", continent: "Asie", flag: "🇻🇳", lat: 14, lon: 108.3, env: 61, social: 71, economy: 68, momentum: 0.69, volatility: 3.3, population: 98.9 },
  { code: "BRA", name: "Brazil", region: "Amérique latine", continent: "Amériques", flag: "🇧🇷", lat: -14.2, lon: -51.9, env: 64, social: 70, economy: 66, momentum: 0.42, volatility: 5.1, population: 216.4 }
];

const clamp = (value: number, low = 0, high = 100) => Math.max(low, Math.min(high, value));
const round = (value: number) => Number(value.toFixed(2));
export const greenfairScore = (env: number, social: number, economy: number) => round(env * 0.4 + social * 0.35 + economy * 0.25);

export function buildHistory(country: Country, start = 1998, end = 2025): YearPoint[] {
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const year = start + index;
    const wave = Math.sin((index + country.code.length) / 2.8);
    const policyLift = Math.max(0, index - 10) * country.momentum * 0.26;
    const environment = clamp(country.env - 5 + policyLift + wave * country.volatility);
    const social = clamp(country.social - 7 + index * 0.42 + wave * 1.8);
    const economy = clamp(country.economy - 6 + index * 0.36 + Math.cos(index / 3.4) * 2.4);
    return {
      year,
      environment: round(environment),
      social: round(social),
      economy: round(economy),
      greenfair: greenfairScore(environment, social, economy),
      co2: round(clamp(9 - environment * 0.075 + Math.sin(index / 2) * 0.42, 0.4, 12)),
      renewable: round(clamp(environment * 0.72 + country.momentum * 18 + wave * 2.4, 4, 92)),
      growth: round(clamp(economy / 14 + Math.cos(index / 2.7) * 1.4, -4, 9))
    };
  });
}

export function buildForecast(country: Country, horizon = 2050): ForecastPoint[] {
  const latest = buildHistory(country).at(-1)!;
  return Array.from({ length: horizon - 2025 }, (_, index) => {
    const step = index + 1;
    const year = 2025 + step;
    const base = clamp(latest.greenfair + step * country.momentum * 0.72 - Math.pow(step, 1.18) * 0.035);
    const spread = Math.min(12, 2.5 + step * 0.22);
    return {
      year,
      base: round(base),
      optimistic: round(clamp(base + spread)),
      pessimistic: round(clamp(base - spread - country.volatility * 0.18)),
      confidenceLow: round(clamp(base - spread)),
      confidenceHigh: round(clamp(base + spread))
    };
  });
}

export function countryProfile(country: Country) {
  const history = buildHistory(country);
  const latest = history.at(-1)!;
  const forecast = buildForecast(country);
  const forecast2050 = forecast.at(-1)!;
  const pillars = [
    { name: "Environnement", value: latest.environment, fill: "#16a34a" },
    { name: "Social", value: latest.social, fill: "#0ea5e9" },
    { name: "Économie", value: latest.economy, fill: "#f59e0b" }
  ];
  const weakest = pillars.reduce((a, b) => (a.value < b.value ? a : b));
  return { history, forecast, latest, forecast2050, pillars, weakest };
}

export const leaderboard = countries
  .map((country) => ({ country, score: countryProfile(country).latest.greenfair }))
  .sort((a, b) => b.score - a.score);
