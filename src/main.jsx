import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import brands from '../data/brands.json';
import assetCache from '../data/cache/brand-assets.json';
import historyManifest from '../data/history-manifest.json';
import './styles.css';

const filters = [
  { label: 'Todo', value: 'all' },
  { label: 'Diseño mexicano', value: 'mexican' },
  { label: 'Lujo internacional', value: 'international' },
  { label: 'Emergentes', value: 'emerging' }
];

function formatDate(value) {
  if (!value) return 'Sin actualizar';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function categoryLabel(key) {
  return {
    mexican: 'Diseño mexicano',
    international: 'Lujo internacional en México',
    emerging: 'Emergente'
  }[key] || 'Moda en México';
}

function StatusPill({ type = 'neutral', children }) {
  return <span className={`pill pill-${type}`}>{children}</span>;
}

function BrandCard({ brand }) {
  const assets = assetCache[brand.id] || {};
  const history = historyManifest[brand.id] || [];
  const [historyIndex, setHistoryIndex] = useState(Math.max(0, history.length - 1));
  const selectedHistory = history[historyIndex];
  const heroImage = selectedHistory?.image || assets.instagramGridSnapshot || assets.websiteImage;
  const hasHeroImage = Boolean(heroImage);
  const adsUrl = assets.adsLibraryUrl || null;

  return (
    <article className={`brand-card ${brand.id === 'coco-loco' ? 'featured-card' : ''}`}>
      <div className="visual-frame">
        {hasHeroImage ? (
          <img
            src={heroImage}
            alt={`${brand.name} grid visual`}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextSibling.style.display = 'grid';
            }}
          />
        ) : null}
        <div className="visual-fallback" style={{ display: hasHeroImage ? 'none' : 'grid' }}>
          <span>{initials(brand.name)}</span>
          <small>Vista pendiente</small>
        </div>
      </div>

      <div className="card-body">
        <div className="card-topline">
          <span className="category">{categoryLabel(brand.categoryKey)}</span>
          <span className="refreshed">{selectedHistory?.label || formatDate(assets.lastRefreshed)}</span>
        </div>
        <h2>{brand.name}</h2>
        {brand.description ? <p className="brand-description">{brand.description}</p> : null}

        <div className="pills">
          <StatusPill type={history.length ? 'good' : 'warn'}>{history.length ? 'Historial visual' : 'Sin historial'}</StatusPill>
          {brand.badge ? <StatusPill type="coco">{brand.badge}</StatusPill> : null}
          <StatusPill type={adsUrl ? 'good' : 'neutral'}>{adsUrl ? 'Ads oficiales' : 'Ads pendientes'}</StatusPill>
        </div>

        {history.length > 1 ? (
          <div className="timeline">
            <div className="timeline-label">
              <span>Semana</span>
              <strong>{selectedHistory?.label || 'Actual'}</strong>
            </div>
            <input
              type="range"
              min="0"
              max={history.length - 1}
              value={historyIndex}
              aria-label={`Historial visual de ${brand.name}`}
              onChange={(event) => setHistoryIndex(Number(event.target.value))}
            />
          </div>
        ) : (
          <div className="timeline timeline-empty">
            <div className="timeline-label">
              <span>Historial</span>
              <strong>{selectedHistory?.label || 'Primera captura'}</strong>
            </div>
            <p>El slider se activa cuando haya 2+ semanas capturadas.</p>
          </div>
        )}

        <div className="source-grid" aria-label={`${brand.name} data sources`}>
          <div>
            <strong>Instagram</strong>
            <span>@{brand.instagramHandle}</span>
          </div>
          <div>
            <strong>Historial</strong>
            <span>{history.length} semana{history.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="actions">
          {brand.website && brand.website !== '#' ? <a href={brand.website} target="_blank" rel="noreferrer">Website</a> : <span className="disabled-action">Website pronto</span>}
          {brand.instagram && brand.instagram !== '#' ? <a href={brand.instagram} target="_blank" rel="noreferrer">Instagram</a> : <span className="disabled-action">Instagram pronto</span>}
          {adsUrl ? <a href={adsUrl} target="_blank" rel="noreferrer">Ads oficiales</a> : null}
        </div>
      </div>
    </article>
  );
}

function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'No se pudo guardar el email.');
      }

      setStatus('success');
      setMessage('Listo. Te avisamos cuando salga el próximo drop.');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Algo falló. Intenta de nuevo.');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="tu@email.com"
        aria-label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input className="hp-field" type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />
      <button disabled={status === 'loading'}>{status === 'loading' ? 'Enviando…' : 'Unirme'}</button>
      {message ? <p className={`form-message form-${status}`}>{message}</p> : null}
    </form>
  );
}

function App() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      const matchesFilter = activeFilter === 'all' || brand.categoryKey === activeFilter;
      const matchesQuery = brand.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  const stats = useMemo(() => {
    const withHistory = brands.filter((brand) => historyManifest[brand.id]?.length).length;
    return {
      total: brands.length,
      mexican: brands.filter((brand) => brand.categoryKey === 'mexican').length,
      international: brands.filter((brand) => brand.categoryKey === 'international').length,
      emerging: brands.filter((brand) => brand.categoryKey === 'emerging').length,
      withHistory
    };
  }, []);

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Radar Moda México home">Radar Moda México</a>
        <nav>
          <a href="#radar">Radar</a>
          <a href="#sugerir">Sugerir marca</a>
          <a href="#cocoloco">Coco Loco</a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Índice visual semanal</p>
          <h1>Radar Moda México</h1>
          <p className="hero-copy">
            Un tracker visual de marcas de moda mexicana, lujo internacional y streetwear emergente que están marcando el estilo en México.
          </p>
          <div className="hero-actions">
            <a href="#radar">Explorar radar</a>
            <a className="secondary" href="#newsletter">Recibir updates</a>
          </div>
        </div>
        <div className="stat-panel">
          <div><strong>{stats.total}</strong><span>marcas</span></div>
          <div><strong>{stats.withHistory}</strong><span>con historial</span></div>
          <div><strong>{stats.mexican}</strong><span>mexicanas</span></div>
          <div><strong>{stats.international}</strong><span>lujo global</span></div>
        </div>
      </section>

      <section className="intro-panel">
        <p>
          Cada semana capturamos el grid visual de Instagram para ver cómo cambia el lenguaje de marca: campañas, colores, producto, styling y dirección creativa. Úsalo como inspiración, investigación o mapa rápido del ecosistema premium en México.
        </p>
        <p className="curated">Curado por <strong>Coco Loco</strong> — drops limitados inspirados en Mexicanismos.</p>
      </section>

      <section className="controls" id="radar" aria-label="Filtros del radar">
        <div className="filter-buttons">
          {filters.map((filter) => (
            <button
              key={filter.value}
              className={activeFilter === filter.value ? 'active' : ''}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Buscar marca…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </section>

      <section className="brand-grid">
        {filteredBrands.map((brand) => <BrandCard key={brand.id} brand={brand} />)}
      </section>

      <section className="lead-panel" id="newsletter">
        <div>
          <p className="eyebrow">Coco Loco</p>
          <h2>Únete a Coco Loco.</h2>
          <p>Acceso temprano a drops limitados, restocks y piezas inspiradas en Mexicanismos.</p>
          <small>Sin spam. Updates ocasionales.</small>
        </div>
        <SubscribeForm />
      </section>

      <section className="footer-grid" id="sugerir">
        <div>
          <h3>Sugiere una marca</h3>
          <p>¿Falta una marca mexicana premium, una casa de lujo activa en México o un proyecto emergente con buen lenguaje visual? Mándanos el nombre.</p>
        </div>
        <div id="cocoloco">
          <h3>Curado por Coco Loco</h3>
          <p>Coco Loco crea drops limitados inspirados en frases, humor y lenguaje cotidiano de México.</p>
        </div>
        <div>
          <h3>Nota editorial</h3>
          <p>Radar Moda México es un índice visual independiente. Marcas, nombres e imágenes pertenecen a sus respectivos propietarios.</p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
