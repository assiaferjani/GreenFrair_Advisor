# GreenFair Advisor

Plateforme SaaS moderne issue du notebook Colab `GreenFair_Advisor (7).ipynb`.

Le prototype transforme l'analyse data science en expérience produit:

- landing page startup responsive;
- recherche et filtrage de pays avec drapeaux;
- dashboard pays avec courbes, radar, bar chart, pie chart, heatmap et carte interactive;
- projections jusqu'en 2050 avec scénarios optimiste, central et pessimiste;
- recommandations IA compatibles Gemini;
- comparaison entre pays;
- export PDF, Excel et CSV;
- API FastAPI prête à intégrer le preprocessing et les modèles du notebook.

## Stack

- Frontend: React, TypeScript, Vite, Recharts, Framer Motion, Lucide, jsPDF, XLSX.
- Backend: FastAPI, pandas, scikit-learn, Gemini API optionnelle.
- Déploiement: Vercel/Render/Railway/Docker.

## Lancer le frontend

```bash
npm install
npm run dev
```

L'application sera disponible sur `http://127.0.0.1:5173`.

## Lancer l'API

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --host 127.0.0.1 --port 8000
```

Endpoints principaux:

- `GET /countries`
- `GET /global`
- `GET /country/TUN`
- `POST /recommendations`

## Gemini AI

Créer un fichier `.env` ou définir la variable:

```bash
GEMINI_API_KEY=your_key_here
```

Sans clé, l'API renvoie un moteur local de recommandations stratégiques pour garder la démo fluide.

## Intégration du notebook

La logique reprise du notebook:

- indicateurs World Bank environnement, social et économie;
- normalisation et GreenFair Score pondéré;
- extrapolation temporelle;
- scénarios futurs;
- identification du pilier faible;
- clustering narratif leader durable / transition fragile;
- recommandations IA.

Pour une version production, placer les exports CSV du notebook dans `apps/api/data/` puis remplacer les fonctions de génération démo dans `apps/api/model.py` par un chargement pandas.
