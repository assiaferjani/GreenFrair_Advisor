import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Bell,
  Bot,
  Download,
  FileSpreadsheet,
  Globe2,
  Heart,
  LineChart,
  Moon,
  Search,
  Share2,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Users
} from "lucide-react";
import { buildForecast, buildHistory, countries, Country, countryProfile, leaderboard } from "./data/greenfair";
import collabGreenfairData from "./data/collabGreenfairData.json";
import { exportDashboardPdf, exportRowsCsv, exportRowsXlsx } from "./lib/exports";
import { generateGeminiRecommendations, GeminiRecommendation, getGeminiKey, hasGeminiKey, saveGeminiKey } from "./lib/gemini";

const formatScore = (score: number) => `${score.toFixed(1)}/100`;
const collabData = collabGreenfairData as any;

function getCollabCountry(code: string) {
  return collabData.latestScores.find((row: any) => row.countryCode === code) ?? collabData.latestScores[0];
}

function getPillarRows(row: any) {
  return [
    { name: "Environnement", value: row?.pillarScores?.environment ?? 0, fill: "#16a34a" },
    { name: "Social", value: row?.pillarScores?.social ?? 0, fill: "#0284c7" },
    { name: "Économie", value: row?.pillarScores?.economy ?? 0, fill: "#d97706" }
  ];
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function DetailCard({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <article className="detail-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{text}</p>
    </article>
  );
}

function CountryMap({ selected, onSelect }: { selected: Country; onSelect: (country: Country) => void }) {
  const x = (lon: number) => ((lon + 180) / 360) * 100;
  const y = (lat: number) => ((85 - lat) / 170) * 100;
  return (
    <div className="map-panel">
      <div className="map-grid" />
      {countries.map((country) => {
        const score = countryProfile(country).latest.greenfair;
        return (
          <button
            className={`map-point ${selected.code === country.code ? "active" : ""}`}
            key={country.code}
            style={{ left: `${x(country.lon)}%`, top: `${y(country.lat)}%` }}
            onClick={() => onSelect(country)}
            title={`${country.name} - ${formatScore(score)}`}
          >
            <span>{country.flag}</span>
          </button>
        );
      })}
      <div className="map-caption">Carte stratégique des pays analysés</div>
    </div>
  );
}

function CountrySelector({
  selected,
  onSelect,
  favorites,
  onFavorite
}: {
  selected: Country;
  onSelect: (country: Country) => void;
  favorites: string[];
  onFavorite: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Tous");
  const regions = ["Tous", ...Array.from(new Set(countries.map((country) => country.continent)))];
  const visibleCountries = countries.filter((country) => {
    const matchesQuery = `${country.name} ${country.region} ${country.code}`.toLowerCase().includes(query.toLowerCase());
    const matchesRegion = region === "Tous" || country.continent === region;
    return matchesQuery && matchesRegion;
  });

  return (
    <aside className="country-rail">
      <div className="rail-head">
        <div>
          <span className="eyebrow">Portfolio pays</span>
          <h2>Explorer</h2>
        </div>
        <Globe2 size={22} />
      </div>
      <label className="search-box">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un pays" />
      </label>
      <div className="segmented">
        {regions.map((item) => (
          <button className={region === item ? "selected" : ""} key={item} onClick={() => setRegion(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="country-list">
        {visibleCountries.map((country) => {
          const profile = countryProfile(country);
          return (
            <button
              className={`country-card ${selected.code === country.code ? "active" : ""}`}
              key={country.code}
              onClick={() => onSelect(country)}
            >
              <span className="flag">{country.flag}</span>
              <span>
                <strong>{country.name}</strong>
                <small>{country.region}</small>
              </span>
              <span className="mini-score">{Math.round(profile.latest.greenfair)}</span>
              <Heart
                className={favorites.includes(country.code) ? "favorite active" : "favorite"}
                size={16}
                onClick={(event) => {
                  event.stopPropagation();
                  onFavorite(country.code);
                }}
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function AiRecommendations({ country, weakest, forecast2050 }: { country: Country; weakest: string; forecast2050: number }) {
  const profile = useMemo(() => countryProfile(country), [country]);
  const fallbackRecommendations: GeminiRecommendation[] = [
    {
      title: "Diagnostic stratégique",
      text: `${country.name} doit renforcer le pilier ${weakest.toLowerCase()} pour réduire l'écart avec les leaders GreenFair. Score actuel: ${profile.latest.greenfair.toFixed(1)}/100, projection 2050: ${forecast2050.toFixed(1)}/100.`,
      tone: "green"
    },
    {
      title: "Projection 2050",
      text: `Le scénario central atteint ${forecast2050.toFixed(1)}/100. Le levier prioritaire est ${weakest.toLowerCase()}, avec un suivi annuel des écarts optimiste/pessimiste.`,
      tone: "blue"
    },
    {
      title: "Priorités IA",
      text: "Ajoutez VITE_GEMINI_API_KEY pour générer une recommandation Gemini vraiment personnalisée à chaque pays.",
      tone: "amber"
    }
  ];
  const [recommendations, setRecommendations] = useState<GeminiRecommendation[]>(fallbackRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState(hasGeminiKey() ? "Gemini 2.5 Flash" : "Fallback local");
  const [error, setError] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState(getGeminiKey());

  const runGemini = async () => {
    if (!hasGeminiKey()) {
      setProvider("Fallback local");
      setRecommendations(fallbackRecommendations);
      setError("Clé Gemini non configurée. Collez votre clé puis cliquez sur Enregistrer.");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const generated = await generateGeminiRecommendations(country, profile.latest, profile.forecast2050, weakest);
      setRecommendations(generated);
      setProvider("Gemini 2.5 Flash");
    } catch (requestError) {
      setRecommendations(fallbackRecommendations);
      setProvider("Fallback local");
      setError(requestError instanceof Error ? requestError.message : "Gemini n'a pas répondu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setRecommendations(fallbackRecommendations);
    void runGemini();
  }, [country.code]);

  return (
    <section className="panel ai-panel">
      <div className="panel-title split">
        <div className="panel-title-inline">
          <Bot size={20} />
          <div>
            <span className="eyebrow">{provider}</span>
            <h3>AI Recommendations</h3>
          </div>
        </div>
        <button className="ai-refresh" onClick={runGemini} disabled={isLoading}>
          <Sparkles size={16} />
          {isLoading ? "Analyse..." : "Générer"}
        </button>
      </div>
      <div className="gemini-key-row">
        <input
          value={apiKeyDraft}
          onChange={(event) => setApiKeyDraft(event.target.value)}
          placeholder="Coller la clé Gemini API"
          type="password"
        />
        <button
          onClick={() => {
            saveGeminiKey(apiKeyDraft);
            setProvider("Gemini 2.5 Flash");
            void runGemini();
          }}
        >
          Enregistrer
        </button>
      </div>
      {error && <p className="ai-error">{error}</p>}
      <div className="ai-thread">
        {recommendations.map((item, index) => (
          <motion.article
            className={`ai-card ${item.tone}`}
            key={item.title}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Sparkles size={16} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function Dashboard({
  selected,
  compare,
  onCompareChange
}: {
  selected: Country;
  compare: Country;
  onCompareChange: (country: Country) => void;
}) {
  const profile = useMemo(() => countryProfile(selected), [selected]);
  const compareProfile = useMemo(() => countryProfile(compare), [compare]);
  const collabCountry = useMemo(() => getCollabCountry(selected.code), [selected]);
  const collabPillars = useMemo(() => getPillarRows(collabCountry), [collabCountry]);
  const collabYearly = useMemo(() => collabData.yearlyScores.filter((row: any) => row.countryCode === selected.code), [selected]);
  const collabProjection = useMemo(() => collabData.projection2030.find((row: any) => row.countryCode === selected.code), [selected]);
  const cluster = useMemo(() => collabData.clusterAssignments.find((row: any) => row.countryCode === selected.code), [selected]);
  const comparisonRows = useMemo(
    () =>
      countries.map((country) => {
        const profile = countryProfile(country);
        return {
          name: country.name,
          score: profile.latest.greenfair,
          environment: profile.latest.environment,
          social: profile.latest.social,
          economy: profile.latest.economy
        };
      }),
    []
  );
  const forecastRows = profile.forecast.map((row) => ({ year: row.year, central: row.base, optimistic: row.optimistic, pessimistic: row.pessimistic }));
  const heatmapYears = profile.history.slice(-8);

  const exportRows = [
    ...profile.history.map((row) => ({ type: "historical", country: selected.name, ...row })),
    ...profile.forecast.map((row) => ({ type: "forecast", country: selected.name, ...row }))
  ];

  return (
    <main className="dashboard" id="greenfair-dashboard">
      <section className="country-hero">
        <div>
          <span className="eyebrow">Dashboard prédictif</span>
          <h1>
            {selected.flag} {selected.name}
          </h1>
          <p>
            Analyse GreenFair par piliers, scoring durable, projection IA jusqu'en 2050 et recommandations stratégiques
            prêtes à être branchées à Gemini.
          </p>
        </div>
        <div className="hero-actions">
          <button onClick={() => exportDashboardPdf("greenfair-dashboard", selected.name)}>
            <Download size={17} /> PDF
          </button>
          <button onClick={() => exportRowsXlsx(exportRows, selected.name)}>
            <FileSpreadsheet size={17} /> Excel
          </button>
          <button onClick={() => exportRowsCsv(exportRows, selected.name)}>
            <Share2 size={17} /> CSV
          </button>
        </div>
      </section>

      <section className="metrics-row">
        <Stat label="Score GreenFair 2025" value={formatScore(profile.latest.greenfair)} tone="green-text" />
        <Stat label="Projection 2050" value={formatScore(profile.forecast2050.base)} tone="blue-text" />
        <Stat label="Scénario optimiste" value={formatScore(profile.forecast2050.optimistic)} />
        <Stat label="Pilier prioritaire" value={profile.weakest.name} tone="amber-text" />
      </section>

      <section className="fusion-grid">
        <DetailCard
          label="Données collaboratives"
          value={`Rang #${collabCountry.rank} - ${collabCountry.level}`}
          text={`Score notebook 2025: ${collabCountry.greenfairScore.toFixed(1)}/100. Source: ${collabData.metadata.dataSource.replaceAll("_", " ")}.`}
        />
        <DetailCard
          label="Projection 2030"
          value={formatScore(collabProjection?.score ?? collabCountry.projection2030.score)}
          text={`Variation vs 2025: ${(collabProjection?.variation ?? collabCountry.projection2030.variation).toFixed(2)} points. Lecture scénario, non prévision officielle.`}
        />
        <DetailCard
          label="Clustering K-Means"
          value={cluster?.clusterLabel ?? "Profil stratégique"}
          text={`Cluster ${cluster?.cluster ?? collabCountry.cluster}: comparaison avec des pays au profil GreenFair proche.`}
        />
      </section>

      <section className="chart-grid">
        <div className="panel wide">
          <div className="panel-title">
            <LineChart size={20} />
            <h3>Évolution historique et trajectoire 2050</h3>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <ComposedChart data={[...profile.history, ...forecastRows]}>
              <defs>
                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#20c997" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#20c997" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="year" stroke="var(--muted)" />
              <YAxis domain={[0, 100]} stroke="var(--muted)" />
              <Tooltip contentStyle={{ background: "#0e1918", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
              <Legend />
              <Area type="monotone" dataKey="greenfair" name="Historique" stroke="#20c997" fill="url(#scoreFill)" strokeWidth={3} />
              <Line type="monotone" dataKey="central" name="Prévision centrale" stroke="#60a5fa" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="optimistic" name="Optimiste" stroke="#a3e635" strokeDasharray="6 6" dot={false} />
              <Line type="monotone" dataKey="pessimistic" name="Pessimiste" stroke="#f97316" strokeDasharray="6 6" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">
            <Target size={20} />
            <h3>Radar piliers 2025</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={collabPillars}>
              <PolarGrid stroke="rgba(255,255,255,.14)" />
              <PolarAngleAxis dataKey="name" stroke="var(--muted)" />
              <Radar dataKey="value" stroke="#20c997" fill="#20c997" fillOpacity={0.38} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">
            <TrendingUp size={20} />
            <h3>Classement pays</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonRows.sort((a, b) => a.score - b.score)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="score" type="number" domain={[0, 100]} hide />
              <YAxis dataKey="name" type="category" width={82} stroke="var(--muted)" />
              <Tooltip />
              <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                {comparisonRows.map((row) => (
                  <Cell key={row.name} fill={row.name === selected.name ? "#20c997" : "#334155"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">
            <Users size={20} />
            <h3>Mix des piliers notebook</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={collabPillars} dataKey="value" nameKey="name" innerRadius={58} outerRadius={98} paddingAngle={4}>
                {collabPillars.map((entry) => (
                  <Cell fill={entry.fill} key={entry.name} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">
            <Sparkles size={20} />
            <h3>Heatmap récente</h3>
          </div>
          <div className="heatmap">
            {heatmapYears.map((row) => (
              <div className="heat-row" key={row.year}>
                <span>{row.year}</span>
                {["environment", "social", "economy", "greenfair"].map((key) => {
                  const value = Number(row[key as keyof typeof row]);
                  return (
                    <div className="heat-cell" key={key} style={{ opacity: 0.25 + value / 135 }}>
                      {Math.round(value)}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="heat-labels">
              <span />
              <span>Env</span>
              <span>Soc</span>
              <span>Eco</span>
              <span>GF</span>
            </div>
          </div>
        </div>

        <div className="panel wide compare-panel">
          <div className="panel-title split">
            <div>
              <span className="eyebrow">Benchmark</span>
              <h3>Comparaison entre pays</h3>
            </div>
            <select value={compare.code} onChange={(event) => onCompareChange(countries.find((item) => item.code === event.target.value) ?? countries[0])}>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={profile.history.map((row, index) => ({
                year: row.year,
                [selected.name]: row.greenfair,
                [compare.name]: compareProfile.history[index]?.greenfair
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="year" stroke="var(--muted)" />
              <YAxis domain={[0, 100]} stroke="var(--muted)" />
              <Tooltip />
              <Area dataKey={selected.name} stroke="#20c997" fill="#20c99733" strokeWidth={3} />
              <Area dataKey={compare.name} stroke="#60a5fa" fill="#60a5fa22" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel wide">
          <div className="panel-title split">
            <div>
              <span className="eyebrow">Fusion du deuxième site</span>
              <h3>Historique notebook 1998-2025 et scénario 2030</h3>
            </div>
            <span className="level-pill">{collabCountry.level}</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={[...collabYearly, { year: 2030, greenfairScore: collabProjection?.score, dataType: "projection" }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,118,110,.12)" />
              <XAxis dataKey="year" stroke="var(--muted)" />
              <YAxis domain={[0, 100]} stroke="var(--muted)" />
              <Tooltip contentStyle={{ background: "var(--surface-strong)", border: "1px solid var(--line)", borderRadius: 12 }} />
              <Area type="monotone" dataKey="greenfairScore" name="Score notebook" stroke="#16a34a" fill="#16a34a24" strokeWidth={3} />
              <Bar dataKey="pillarScores.environment" name="Env" fill="#16a34a55" radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">
            <Sparkles size={20} />
            <h3>Recommandations notebook</h3>
          </div>
          <div className="insight-list">
            {(collabData.recommendationsByCountry[selected.code] ?? collabCountry.recommendations).map((item: string) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <Target size={20} />
            <h3>Modèles ML comparés</h3>
          </div>
          <div className="model-list">
            {collabData.modelComparison.map((model: any) => (
              <article key={model.id}>
                <strong>{model.label}</strong>
                <span>MAE {model.mae} - RMSE {model.rmse} - R² {model.r2}</span>
              </article>
            ))}
          </div>
        </div>

        <AiRecommendations country={selected} weakest={profile.weakest.name} forecast2050={profile.forecast2050.base} />
      </section>
    </main>
  );
}

export default function App() {
  const [selected, setSelected] = useState(countries[0]);
  const [compare, setCompare] = useState(countries[8]);
  const [dark, setDark] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(["TUN"]);
  const profile = countryProfile(selected);

  const toggleFavorite = (code: string) => {
    setFavorites((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  };

  return (
    <div className={dark ? "app dark" : "app light"}>
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-mark">G</span>
          <span>GreenFair Advisor</span>
        </a>
        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#countries">Pays</a>
          <a href="#insights">Insights</a>
        </nav>
        <div className="top-actions">
          <button title="Notifications">
            <Bell size={18} />
          </button>
          <button title="Mode clair/sombre" onClick={() => setDark((value) => !value)}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <section className="landing" id="home">
        <div className="landing-copy">
          <motion.span className="eyebrow" initial={false} animate={{ opacity: 1, y: 0 }}>
            AI country intelligence platform
          </motion.span>
          <motion.h1 initial={false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            Prédire les trajectoires durables des pays jusqu'en 2050.
          </motion.h1>
          <p>
            Une plateforme SaaS premium inspirée de votre notebook Colab: données World Bank, scoring GreenFair,
            forecasting, clustering, comparaison et recommandations IA.
          </p>
          <div className="cta-row">
            <a href="#dashboard" className="primary-cta">
              Explorer le dashboard
            </a>
            <a href="#insights" className="secondary-cta">
              Voir les insights
            </a>
          </div>
          <div className="global-stats">
            <Stat label="Pays analysés" value={`${countries.length}`} />
            <Stat label="Score moyen" value={formatScore(leaderboard.reduce((sum, row) => sum + row.score, 0) / leaderboard.length)} />
            <Stat label="Horizon" value="2050" />
          </div>
        </div>
        <motion.div className="landing-visual" initial={false} animate={{ opacity: 1, scale: 1 }}>
          <CountryMap selected={selected} onSelect={setSelected} />
          <div className="floating-card">
            <span>{selected.flag} {selected.name}</span>
            <strong>{formatScore(profile.latest.greenfair)}</strong>
          </div>
        </motion.div>
      </section>

      <section className="workspace" id="dashboard">
        <CountrySelector selected={selected} onSelect={setSelected} favorites={favorites} onFavorite={toggleFavorite} />
        <Dashboard selected={selected} compare={compare} onCompareChange={setCompare} />
      </section>

      <section className="insights-band" id="insights">
        <div>
          <span className="eyebrow">Investor-ready narrative</span>
          <h2>Deux dashboards fusionnés dans une expérience SaaS claire.</h2>
          <p>
            Le site combine l’expérience premium GreenFair Advisor avec les détails du dashboard collaboratif:
            méthodologie World Bank, 15 indicateurs, clustering, focus Tunisie, projections 2030 et recommandations
            Gemini dynamiques.
          </p>
          <div className="method-grid">
            {collabData.methodology.thresholds.map((item: any) => (
              <article key={item.label}>
                <strong>{item.label}</strong>
                <span>à partir de {item.minScore}/100</span>
              </article>
            ))}
          </div>
        </div>
        <div className="leader-strip">
          {leaderboard.slice(0, 4).map(({ country, score }) => (
            <article key={country.code}>
              <span>{country.flag}</span>
              <strong>{country.name}</strong>
              <small>{formatScore(score)}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
