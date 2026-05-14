from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CountrySeed:
    code: str
    name: str
    region: str
    flag: str
    lat: float
    lon: float
    env: float
    social: float
    economy: float
    momentum: float
    volatility: float


SEEDS = [
    CountrySeed("TUN", "Tunisia", "Afrique du Nord", "🇹🇳", 34.0, 9.0, 28, 66, 52, 0.62, 4.2),
    CountrySeed("MAR", "Morocco", "Afrique du Nord", "🇲🇦", 31.8, -7.1, 44, 63, 55, 0.74, 3.8),
    CountrySeed("EGY", "Egypt", "Afrique du Nord", "🇪🇬", 26.8, 30.8, 35, 61, 51, 0.48, 4.5),
    CountrySeed("SEN", "Senegal", "Afrique de l'Ouest", "🇸🇳", 14.5, -14.4, 43, 54, 47, 0.68, 4.1),
    CountrySeed("KEN", "Kenya", "Afrique de l'Est", "🇰🇪", -0.0, 37.9, 52, 58, 49, 0.72, 3.6),
    CountrySeed("ETH", "Ethiopia", "Afrique de l'Est", "🇪🇹", 9.1, 40.5, 47, 46, 43, 0.64, 5.3),
    CountrySeed("IND", "India", "Asie du Sud", "🇮🇳", 20.6, 78.9, 39, 60, 59, 0.76, 4.0),
    CountrySeed("BGD", "Bangladesh", "Asie du Sud", "🇧🇩", 23.7, 90.4, 41, 57, 50, 0.71, 4.4),
    CountrySeed("VNM", "Viet Nam", "Asie du Sud-Est", "🇻🇳", 14.0, 108.3, 61, 71, 68, 0.69, 3.3),
    CountrySeed("BRA", "Brazil", "Amérique latine", "🇧🇷", -14.2, -51.9, 64, 70, 66, 0.42, 5.1),
]

COUNTRIES = [
    {
        "code": seed.code,
        "name": seed.name,
        "region": seed.region,
        "flag": seed.flag,
        "lat": seed.lat,
        "lon": seed.lon,
    }
    for seed in SEEDS
]


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def score(env: float, social: float, economy: float) -> float:
    return round((env * 0.4) + (social * 0.35) + (economy * 0.25), 2)


def yearly_series(seed: CountrySeed, start: int = 1998, end: int = 2025) -> list[dict[str, float]]:
    rows = []
    for year in range(start, end + 1):
        t = year - start
        wave = math.sin((t + len(seed.code)) / 2.8)
        policy = max(0, t - 10) * seed.momentum * 0.26
        env = clamp(seed.env - 5 + policy + wave * seed.volatility)
        social = clamp(seed.social - 7 + t * 0.42 + wave * 1.8)
        economy = clamp(seed.economy - 6 + t * 0.36 + math.cos(t / 3.4) * 2.4)
        rows.append(
            {
                "year": year,
                "environment": round(env, 2),
                "social": round(social, 2),
                "economy": round(economy, 2),
                "greenfair": score(env, social, economy),
            }
        )
    return rows


def forecast(seed: CountrySeed, horizon: int = 2050) -> list[dict[str, float]]:
    historical = yearly_series(seed)
    last = historical[-1]
    rows = []
    for year in range(2026, horizon + 1):
        step = year - 2025
        climate_accel = seed.momentum * 0.72
        base = clamp(last["greenfair"] + step * climate_accel - (step**1.18) * 0.035)
        spread = min(12, 2.5 + step * 0.22)
        rows.append(
            {
                "year": year,
                "base": round(base, 2),
                "optimistic": round(clamp(base + spread), 2),
                "pessimistic": round(clamp(base - spread - seed.volatility * 0.18), 2),
                "confidenceLow": round(clamp(base - spread), 2),
                "confidenceHigh": round(clamp(base + spread), 2),
            }
        )
    return rows


def get_seed(code: str) -> CountrySeed:
    return next((seed for seed in SEEDS if seed.code == code), SEEDS[0])


def get_country_payload(code: str, horizon: int = 2050) -> dict[str, Any]:
    seed = get_seed(code)
    history = yearly_series(seed)
    latest = history[-1]
    weak = min(
        {
            "Environnement": latest["environment"],
            "Social": latest["social"],
            "Économie": latest["economy"],
        },
        key=lambda pillar: {
            "Environnement": latest["environment"],
            "Social": latest["social"],
            "Économie": latest["economy"],
        }[pillar],
    )
    projected = forecast(seed, horizon)
    return {
        "country": next(country for country in COUNTRIES if country["code"] == seed.code),
        "history": history,
        "forecast": projected,
        "latest": latest,
        "weakest_pillar": weak,
        "cluster": "Leader durable" if latest["greenfair"] >= 62 else "Transition fragile",
        "ai_recommendations": [
            f"Prioriser le pilier {weak.lower()} avec un portefeuille de mesures mesurables sur 24 mois.",
            "Accélérer les investissements dans les indicateurs à fort effet systémique: énergie, santé, éducation et productivité durable.",
            "Suivre trimestriellement les écarts entre scénario optimiste et pessimiste pour ajuster les politiques publiques.",
        ],
    }


def get_global_payload() -> dict[str, Any]:
    payloads = [get_country_payload(seed.code) for seed in SEEDS]
    latest = [payload["latest"]["greenfair"] for payload in payloads]
    return {
        "average_score": round(sum(latest) / len(latest), 2),
        "countries": len(SEEDS),
        "leaders": sorted(
            [
                {
                    "code": payload["country"]["code"],
                    "name": payload["country"]["name"],
                    "score": payload["latest"]["greenfair"],
                }
                for payload in payloads
            ],
            key=lambda row: row["score"],
            reverse=True,
        ),
    }
