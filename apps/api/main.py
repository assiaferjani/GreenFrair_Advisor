import os
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .model import COUNTRIES, get_country_payload, get_global_payload


class RecommendationRequest(BaseModel):
    country_code: str
    horizon: int = 2050


app = FastAPI(title="GreenFair Advisor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "greenfair-advisor-api"}


@app.get("/countries")
def countries() -> list[dict[str, Any]]:
    return COUNTRIES


@app.get("/global")
def global_payload() -> dict[str, Any]:
    return get_global_payload()


@app.get("/country/{country_code}")
def country(country_code: str) -> dict[str, Any]:
    return get_country_payload(country_code.upper())


@app.post("/recommendations")
def recommendations(request: RecommendationRequest) -> dict[str, Any]:
    payload = get_country_payload(request.country_code.upper(), request.horizon)
    fallback = payload["ai_recommendations"]
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return {
            "provider": "local-strategy-engine",
            "country": payload["country"]["name"],
            "recommendations": fallback,
        }

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        latest = payload["latest"]
        prompt = f"""
Tu es un expert international en stratégie de développement durable.
Analyse le pays {payload["country"]["name"]}.
Score GreenFair actuel: {latest["greenfair"]:.1f}/100.
Projection {request.horizon}: {payload["forecast"][-1]["base"]:.1f}/100.
Pilier faible: {payload["weakest_pillar"]}.
Réponds en français avec un diagnostic, 3 priorités, les risques et les KPI à suivre.
"""
        response = model.generate_content(prompt)
        return {
            "provider": "gemini-2.5-flash",
            "country": payload["country"]["name"],
            "recommendations": [response.text],
        }
    except Exception:
        return {
            "provider": "local-strategy-engine",
            "country": payload["country"]["name"],
            "recommendations": fallback,
        }
