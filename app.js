let booksData = [];
let stats = {};
let selectedYear = 2025;

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const yearSelector = document.getElementById('yearSelector');
  const csvInput = document.getElementById('csvInput');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = `${btn.dataset.tab}Tab`;
      document.getElementById(tabId).classList.add('active');
    });
  });

  yearSelector.addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value, 10);
  });

  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  });
});

function tokenizeLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if ((c === ',' || c === ';') && !inQ) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
}

function normalizeTipo(tipo) {
  return (tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSerieBase(name) {
  if (!name) return '';
  let base = name
    .replace(/vol\.?\s*\d+/gi, '')
    .replace(/volume\s*\d+/gi, '')
    .replace(/#\s*\d+/g, '')
    .replace(/-\s*\d+$/g, '')
    .replace(/-\s*#?\s*\d+$/g, '')
    .replace(/-\s*vol\.?\s*\d+$/gi, '')
    .replace(/-\s*volume\s*\d+$/gi, '')
    .replace(/\s+#\s*\d+$/g, '')
    .replace(/\s+vol\.?\s*\d+$/gi, '')
    .replace(/\s+volume\s*\d+$/gi, '')
    .replace(/[–-]\s*$/g, '')
    .trim();
  return base.toLowerCase();
}

function stripSerieNumbering(name) {
  if (!name) return '';
  return name
    .replace(/vol\.?\s*\d+/gi, '')
    .replace(/volume\s*\d+/gi, '')
    .replace(/#\s*\d+/g, '')
    .replace(/-\s*\d+$/g, '')
    .replace(/-\s*#?\s*\d+$/g, '')
    .replace(/-\s*vol\.?\s*\d+$/gi, '')
    .replace(/-\s*volume\s*\d+$/gi, '')
    .replace(/\s+#\s*\d+$/g, '')
    .replace(/\s+vol\.?\s*\d+$/gi, '')
    .replace(/\s+volume\s*\d+$/gi, '')
    .replace(/[–-]\s*$/g, '')
    .trim();
}

function categorizeTipo(tipo) {
  const norm = normalizeTipo(tipo);
  if (!norm) return null;
  if (norm.includes('unico') || norm.includes('avulso') || norm.includes('standalone')) return 'unico';
  if (norm.includes('duologia')) return 'duologia';
  if (norm.includes('trilogia')) return 'trilogia';
  if (norm.includes('tetralogia') || norm.includes('quadrilogia')) return 'tetralogia';
  if (norm.includes('saga') || norm.includes('franquia')) return 'saga';
  if (norm.includes('serie')) return 'serie';
  return 'outro';
}

function findCol(headerNorm, names) {
  for (const name of names) {
    const idx = headerNorm.findIndex(h => h.includes(normalize(name)));
    if (idx >= 0) return idx;
  }
  return -1;
}

function getCol(cols, idx) {
  return idx >= 0 && idx < cols.length ? cols[idx] : '';
}

function parseNumber(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function parseFavorito(str) {
  const s = (str || '').trim().toLowerCase();
  return s.includes('favorito') || s.includes('fav') || s.includes('sim') || s.includes('yes') || s.includes('true') || s.includes('1') || s.includes('x');
}

function parseNota(notaStr, statusStr) {
  const raw = (notaStr || '').trim().toLowerCase();
  const status = (statusStr || '').trim().toLowerCase();

  if (raw.includes('abandonado') || raw === 'dnf' || raw.includes('desistido') || status.includes('abandonado') || status === 'dnf') {
    return { value: null, dnf: true };
  }

  const num = parseFloat(raw.replace(',', '.'));
  if (!Number.isNaN(num) && num >= 0 && num <= 5) {
    return { value: Math.round(Math.min(5, num) * 2) / 2, dnf: false };
  }

  const fullStars = (raw.match(/⭐️|⭐|★|🌟/g) || []).length;
  const halfStars = (raw.match(/🧦|½|☆/g) || []).length;
  let value = fullStars + 0.5 * halfStars;

  if (value > 0) {
    return { value: Math.min(5, value), dnf: false };
  }

  return { value: null, dnf: false };
}

function parseCSV(text) {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter(l => l.trim());
  if (!lines.length) return [];

  let headerIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if ((l.includes('titulo') || l.includes('title')) && (l.includes('autor') || l.includes('author'))) {
      headerIdx = i;
      break;
    }
  }

  const header = tokenizeLine(lines[headerIdx]);
  const headerNorm = header.map(normalize);

  const idx = {
    titulo: findCol(headerNorm, ['titulo', 'title', 'livro']),
    autor: findCol(headerNorm, ['autor', 'autora', 'author']),
    editora: findCol(headerNorm, ['editora', 'publisher']),
    paginas: findCol(headerNorm, ['paginas', 'pages', 'pag']),
    nota: findCol(headerNorm, ['nota', 'rating', 'avaliacao', 'estrelas']),
    favorito: findCol(headerNorm, ['favorito', 'favorite', 'fav']),
    status: findCol(headerNorm, ['status', 'estado']),
    tipo: findCol(headerNorm, ['tipo', 'tipo de livro', 'formato']),
    serie: findCol(headerNorm, ['serie', 'série', 'saga', 'franquia', 'nome da serie', 'titulo da serie']),
    volume: findCol(headerNorm, ['vol', 'volume'])
  };

  const books = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = tokenizeLine(lines[i]);
    if (!cols.length || cols.every(c => !c.trim())) continue;

    const titulo = getCol(cols, idx.titulo) || (idx.titulo < 0 ? cols[0] : '');
    const autor = getCol(cols, idx.autor) || (idx.autor < 0 ? cols[1] : '');
    const editora = getCol(cols, idx.editora) || '';
    const paginasStr = getCol(cols, idx.paginas) || '';
    const notaStr = getCol(cols, idx.nota) || '';
    const favoritoStr = getCol(cols, idx.favorito) || '';
    const statusStr = getCol(cols, idx.status) || '';
    const tipoStr = getCol(cols, idx.tipo) || '';
    const serieStr = getCol(cols, idx.serie) || '';
    const volumeStr = getCol(cols, idx.volume) || '';
    const volume = parseInt(volumeStr, 10);
    const serieBase = normalizeSerieBase(serieStr) || normalizeSerieBase(titulo);

    if (!titulo.trim()) continue;

    const { value: nota, dnf } = parseNota(notaStr, statusStr);
    const favorito = parseFavorito(favoritoStr);
    const paginas = parseNumber(paginasStr);

    books.push({
      titulo: titulo.trim(),
      autor: autor.trim(),
      editora: editora.trim(),
      paginas,
      nota,
      dnf,
      favorito,
      tipo: tipoStr.trim(),
      serieNome: serieStr.trim(),
      serieBase,
      volume: Number.isFinite(volume) ? volume : null
    });
  }
  return books;
}

function calculateStats(books) {
  const completed = books.filter(b => !b.dnf);
  const abandoned = books.filter(b => b.dnf);
  const favorites = books.filter(b => b.favorito);
  const rated = completed.filter(b => b.nota !== null);

  const seriesCountMap = {};
  completed.forEach(b => {
    const base = b.serieBase || '';
    if (base) seriesCountMap[base] = (seriesCountMap[base] || 0) + 1;
  });

  const totalBooks = completed.length;
  const totalPages = completed.reduce((sum, b) => sum + (b.paginas || 0), 0);
  const ratings = rated.map(b => b.nota);
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '-';
  const maxRating = ratings.length ? Math.max(...ratings) : '-';
  const minRating = ratings.length ? Math.min(...ratings) : '-';

  const ratingDist = {};
  ratings.forEach(r => { ratingDist[r] = (ratingDist[r] || 0) + 1; });

  const authorCounts = {};
  completed.forEach(b => {
    if (b.autor) authorCounts[b.autor] = (authorCounts[b.autor] || 0) + 1;
  });
  const topAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const authorRatings = {};
  rated.forEach(b => {
    if (!b.autor) return;
    const cur = authorRatings[b.autor] || { sum: 0, count: 0 };
    cur.sum += b.nota || 0;
    cur.count += 1;
    authorRatings[b.autor] = cur;
  });
  let bestAuthorName = '-';
  let bestAuthorAvg = '-';
  const authorEntries = Object.entries(authorRatings);
  if (authorEntries.length) {
    authorEntries.sort((a, b) => {
      const avgA = a[1].sum / a[1].count;
      const avgB = b[1].sum / b[1].count;
      if (avgB !== avgA) return avgB - avgA;
      return b[1].count - a[1].count;
    });
    bestAuthorName = authorEntries[0][0];
    bestAuthorAvg = (authorEntries[0][1].sum / authorEntries[0][1].count).toFixed(2);
  }

  const pubCounts = {};
  completed.forEach(b => {
    if (b.editora) pubCounts[b.editora] = (pubCounts[b.editora] || 0) + 1;
  });
  const topPublishers = Object.entries(pubCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topPublisher = topPublishers.length ? topPublishers[0][0] : '-';

  const typeCounts = {};
  completed.forEach(b => {
    const catFromTipo = categorizeTipo(b.tipo);
    const serieNome = (b.serieNome || '').trim();
    const serieBase = b.serieBase || '';
    const vols = serieBase ? seriesCountMap[serieBase] || 0 : 0;
    const hasMultiVolume = vols >= 2;

    let cat = null;
    if (catFromTipo === 'unico') cat = 'unico';
    else if (['duologia', 'trilogia', 'tetralogia', 'saga', 'serie'].includes(catFromTipo) && hasMultiVolume) cat = catFromTipo === 'serie' ? 'serie' : catFromTipo;
    else if (!catFromTipo && hasMultiVolume) cat = 'serie';

    if (cat) typeCounts[cat] = (typeCounts[cat] || 0) + 1;
  });

  const hasTypeCounts = Object.values(typeCounts).some(count => count > 0);

  const counts = {
    unico: typeCounts.unico || 0,
    duologia: typeCounts.duologia || 0,
    trilogia: typeCounts.trilogia || 0,
    tetralogia: typeCounts.tetralogia || 0,
    saga: typeCounts.saga || 0,
    serie: typeCounts.serie || 0
  };

  const familySeries = counts.serie + counts.saga + counts.duologia + counts.trilogia + counts.tetralogia;

  let dominantType = '-';
  const totalKnown = counts.unico + familySeries;
  if (totalKnown > 0) {
    const { unico, duologia, trilogia } = counts;
    const maxSpecific = Math.max(unico, duologia, trilogia, familySeries);
    const winners = [];

    if (duologia === maxSpecific && duologia > 0 && duologia > trilogia && duologia > unico && duologia > (familySeries - duologia)) {
      winners.push('Duologias');
    } else if (trilogia === maxSpecific && trilogia > 0 && trilogia > duologia && trilogia > unico && trilogia > (familySeries - trilogia)) {
      winners.push('Trilogias');
    } else if (unico === maxSpecific && unico > familySeries) {
      winners.push('Livros únicos');
    } else if (familySeries === maxSpecific && familySeries > 0 && familySeries > unico) {
      winners.push('Séries');
    }

    if (winners.length === 1) {
      dominantType = winners[0];
    } else if (winners.length === 0) {
      // fallback to tie detection across all categories
      const all = [counts.unico, counts.duologia, counts.trilogia, counts.tetralogia, counts.saga, counts.serie];
      const top = Math.max(...all);
      const ties = all.filter(c => c === top && c > 0).length;
      dominantType = ties > 1 ? 'Equilíbrio' : '-';
    } else {
      dominantType = 'Equilíbrio';
    }
  }

  const seriesRatings = {};
  const seriesDisplayNames = {};
  rated.forEach(b => {
    const cat = categorizeTipo(b.tipo);
    const serieNome = (b.serieNome || '').trim();
    const serieBase = b.serieBase || '';
    const vols = serieBase ? seriesCountMap[serieBase] || 0 : 0;
    const hasMultiVolume = vols >= 2;
    const isSeriesEntry = ['duologia', 'trilogia', 'tetralogia', 'saga', 'serie'].includes(cat) && hasMultiVolume;
    const inferredSeries = !cat && hasMultiVolume;
    if (!isSeriesEntry && !inferredSeries) return;
    if (!serieBase) return;

    if (!seriesDisplayNames[serieBase]) {
      const cleaned = stripSerieNumbering(serieNome) || stripSerieNumbering(b.titulo) || serieBase;
      seriesDisplayNames[serieBase] = cleaned;
    }

    const cur = seriesRatings[serieBase] || { sum: 0, count: 0 };
    cur.sum += b.nota || 0;
    cur.count += 1;
    seriesRatings[serieBase] = cur;
  });

  let bestSeriesName = '-';
  let bestSeriesAvg = '-';
  const seriesEntries = Object.entries(seriesRatings);
  if (seriesEntries.length) {
    seriesEntries.sort((a, b) => {
      const avgA = a[1].sum / a[1].count;
      const avgB = b[1].sum / b[1].count;
      if (avgB !== avgA) return avgB - avgA;
      return b[1].count - a[1].count;
    });
    const bestKey = seriesEntries[0][0];
    bestSeriesName = seriesDisplayNames[bestKey] || bestKey;
    bestSeriesAvg = (seriesEntries[0][1].sum / seriesEntries[0][1].count).toFixed(2);
  }

  const hasSeriesRatings = seriesEntries.length > 0;

  const typeLabels = {
    serie: 'Séries',
    saga: 'Sagas',
    duologia: 'Duologias',
    trilogia: 'Trilogias',
    tetralogia: 'Tetralogias',
    unico: 'Livros únicos'
  };

  const typeChartData = Object.entries(typeCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => [typeLabels[key] || 'Outros formatos', count]);

  const highlights = [...rated].sort((a, b) => (b.nota || 0) - (a.nota || 0)).slice(0, 6);

  return {
    totalBooks,
    totalPages,
    avgRating,
    maxRating,
    minRating,
    topPublisher,
    abandoned,
    favorites,
    ratingDist,
    topAuthors,
    topPublishers,
    bestAuthorName,
    bestAuthorAvg,
    highlights,
    allBooks: books,
    typeCounts,
    dominantType,
    bestSeriesName,
    bestSeriesAvg,
    typeChartData,
    hasTypeCounts,
    hasSeriesRatings
  };
}

function renderMetrics(currentStats) {
  const grid = document.getElementById('metricsGrid');
  const cards = [
    { icon: '📖', label: 'Livros lidos', value: currentStats.totalBooks, tone: 'cyan' },
    { icon: '📄', label: 'Páginas lidas', value: currentStats.totalPages.toLocaleString('pt-BR'), tone: 'purple' },
    { icon: '⭐', label: 'Média de notas', value: currentStats.avgRating, tone: 'yellow' },
    { icon: '📈', label: 'Nota mais alta', value: currentStats.maxRating, tone: 'green' },
    { icon: '📉', label: 'Nota mais baixa', value: currentStats.minRating, tone: 'red' },
    { icon: '🏢', label: 'Editora mais lida', value: currentStats.topPublisher, tone: 'purple', valueStyle: 'font-size: 1.25rem;' },
    { icon: '✍️', label: 'Autor(a) favorito(a)', value: currentStats.bestAuthorName, tone: 'cyan', valueStyle: 'font-size: 1.2rem;' },
    { icon: '❤️', label: 'Favoritos', value: currentStats.favorites.length, tone: 'pink' },
    { icon: '🚫', label: 'Abandonados', value: currentStats.abandoned.length, tone: 'red' }
  ];

  if (currentStats.hasTypeCounts) {
    cards.push({ icon: '🧭', label: 'Predomínio', value: currentStats.dominantType, tone: 'cyan', valueStyle: 'font-size: 1.1rem;' });
  }

  if (currentStats.hasSeriesRatings) {
    const seriesValue = currentStats.bestSeriesName === '-' ? '-' : currentStats.bestSeriesName;
    cards.push({ icon: '📚', label: 'Top série', value: seriesValue, tone: 'green', valueStyle: 'font-size: 1.1rem;' });
  }

  grid.innerHTML = cards.map(card => `
    <div class="metric-card ${card.tone}">
      <div class="icon">${card.icon}</div>
      <div class="label">${card.label}</div>
      <div class="value"${card.valueStyle ? ` style="${card.valueStyle}"` : ''}>${card.value}</div>
    </div>
  `).join('');
}

function renderBarChart(container, data, colors) {
  if (!data.length) {
    container.innerHTML = '<div class="empty-state">Sem dados</div>';
    return;
  }

  const maxVal = Math.max(...data.map(d => d[1]), 1);
  container.innerHTML = data.map((d, i) => `
    <div class="bar-item">
      <div class="bar-label" title="${d[0]}">${d[0]}</div>
      <div class="bar-container">
        <div class="bar-fill ${colors[i % colors.length]}" style="width: ${(d[1] / maxVal) * 100}%">
          ${d[1]}
        </div>
      </div>
    </div>
  `).join('');
}

function renderCharts(currentStats) {
  const ratingData = Object.entries(currentStats.ratingDist)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([r, c]) => [`${r} estrelas`, c]);
  renderBarChart(document.getElementById('ratingChart'), ratingData, ['cyan', 'purple', 'green', 'yellow', 'pink']);

  renderBarChart(document.getElementById('authorsChart'), currentStats.topAuthors, ['purple', 'cyan', 'green', 'yellow', 'pink']);

  renderBarChart(document.getElementById('publishersChart'), currentStats.topPublishers, ['green', 'cyan', 'purple', 'yellow', 'pink']);

  const typesChartEl = document.getElementById('typesChart');
  const typesCard = typesChartEl?.parentElement;
  if (currentStats.hasTypeCounts && currentStats.typeChartData.length) {
    if (typesCard) typesCard.style.display = '';
    renderBarChart(typesChartEl, currentStats.typeChartData, ['yellow', 'cyan', 'purple']);
  } else if (typesCard) {
    typesCard.style.display = 'none';
  }
}

function renderBookCard(book, extraClass = '') {
  const ratingStars = book.nota !== null ? '⭐'.repeat(Math.floor(book.nota)) + (book.nota % 1 ? '½' : '') : '';
  const tipoLabel = book.tipo ? `<span>Tipo: ${book.tipo}</span>` : '';
  const serieLabel = book.serieNome ? `<span>Série: ${book.serieNome}</span>` : '';
  const volLabel = Number.isFinite(book.volume) ? `<span>Vol.: ${book.volume}</span>` : '';
  return `
    <div class="book-card ${extraClass}">
      <div class="title">${book.titulo}</div>
      <div class="author">${book.autor || 'Autor desconhecido'}</div>
      <div class="meta">
        ${book.editora ? `<span>${book.editora}</span>` : ''}
        ${book.paginas ? `<span>${book.paginas} pág.</span>` : ''}
        ${book.nota !== null ? `<span class="rating">${ratingStars} (${book.nota})</span>` : ''}
        ${book.dnf ? '<span style="color: #f87171;">Abandonado</span>' : ''}
        ${book.favorito ? '<span style="color: #f472b6;">❤️ Favorito</span>' : ''}
        ${tipoLabel}
        ${serieLabel}
        ${volLabel}
      </div>
    </div>
  `;
}

function renderBooks(currentStats) {
  document.getElementById('highlightsGrid').innerHTML = currentStats.highlights.length
    ? currentStats.highlights.map(b => renderBookCard(b)).join('')
    : '<div class="empty-state">Nenhum destaque encontrado</div>';

  document.getElementById('favoritesGrid').innerHTML = currentStats.favorites.length
    ? currentStats.favorites.map(b => renderBookCard(b, 'favorite')).join('')
    : '<div class="empty-state">Nenhum livro favorito marcado</div>';

  document.getElementById('abandonedGrid').innerHTML = currentStats.abandoned.length
    ? currentStats.abandoned.map(b => renderBookCard(b, 'abandoned')).join('')
    : '<div class="empty-state">Nenhum livro abandonado</div>';

  document.getElementById('allBooksGrid').innerHTML = currentStats.allBooks
    .map(b => renderBookCard(b, b.favorito ? 'favorite' : (b.dnf ? 'abandoned' : '')))
    .join('');
}

function exportStory() {
  const canvas = document.getElementById('storyCanvas');
  const ctx = canvas.getContext('2d');
  const w = 1080;
  const h = 1920;

  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#0b1224');
  gradient.addColorStop(0.45, '#111a36');
  gradient.addColorStop(1, '#1b1033');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.25, 80, w * 0.5, h * 0.25, 520);
  glow.addColorStop(0, 'rgba(167, 139, 250, 0.35)');
  glow.addColorStop(1, 'rgba(11, 18, 36, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  const titleGrad = ctx.createLinearGradient(0, 0, w, 0);
  titleGrad.addColorStop(0, '#22d3ee');
  titleGrad.addColorStop(1, '#a78bfa');
  ctx.fillStyle = titleGrad;
  ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Retrospectiva Literária', w / 2, 160);

  ctx.font = 'bold 88px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(selectedYear, w / 2, 260);

  const cards = [
    { icon: '📖', label: 'Livros lidos', value: stats.totalBooks, color: '#22d3ee' },
    { icon: '📄', label: 'Páginas lidas', value: stats.totalPages.toLocaleString('pt-BR'), color: '#a78bfa' },
    { icon: '⭐', label: 'Média de notas', value: stats.avgRating, color: '#fbbf24' },
    { icon: '📈', label: 'Nota mais alta', value: stats.maxRating, color: '#34d399' },
    { icon: '📉', label: 'Nota mais baixa', value: stats.minRating, color: '#f87171' },
    { icon: '🏢', label: 'Editora mais lida', value: stats.topPublisher, color: '#a78bfa' },
    { icon: '✍️', label: 'Autor(a) favorito(a)', value: stats.bestAuthorName, color: '#22d3ee' }
  ];

  if ((stats.favorites || []).length > 0) {
    cards.push({ icon: '❤️', label: 'Favoritos', value: stats.favorites.length, color: '#f472b6' });
  }

  if (stats.hasTypeCounts) {
    cards.push({ icon: '🧭', label: 'Predomínio', value: stats.dominantType, color: '#fbbf24' });
  }

  if (stats.hasSeriesRatings) {
    const seriesValue = stats.bestSeriesName === '-' ? '-' : stats.bestSeriesName;
    cards.push({ icon: '📚', label: 'Top série', value: seriesValue, color: '#34d399' });
  }

  const cardW = 420;
  const cardH = 200;
  const gap = 26;
  const startX = (w - (cardW * 2 + gap)) / 2;
  let startY = 360;

  function fitFontSize(text, baseSize, maxWidth) {
    let size = baseSize;
    while (size > 32) {
      ctx.font = `bold ${size}px -apple-system, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  function wrapText(text, maxWidth, fontSize) {
    ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
    const words = String(text).split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const testLine = current ? `${current} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        current = testLine;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [String(text)];
  }

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;

    const cardBg = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
    cardBg.addColorStop(0, 'rgba(34, 51, 82, 0.65)');
    cardBg.addColorStop(1, 'rgba(22, 28, 46, 0.75)');
    ctx.fillStyle = cardBg;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 18);
    ctx.fill();

    const strokeGrad = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
    strokeGrad.addColorStop(0, 'rgba(34, 211, 238, 0.45)');
    strokeGrad.addColorStop(1, 'rgba(167, 139, 250, 0.45)');
    ctx.strokeStyle = strokeGrad;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = '28px -apple-system, sans-serif';
    ctx.fillStyle = card.color;
    ctx.fillText(`${card.icon}  ${card.label}`, x + cardW / 2, y + 54);

    const baseValue = String(card.value);
    const maxValueWidth = cardW - 60;
    let valueFontSize = card.label === 'Editora mais lida' || card.label === 'Autor(a) favorito(a)' || card.label === 'Melhor série/duologia' ? 48 : 58;
    valueFontSize = fitFontSize(baseValue, valueFontSize, maxValueWidth);
    const lines = wrapText(baseValue, maxValueWidth, valueFontSize).slice(0, 2);
    const lineHeight = valueFontSize + 6;
    const totalHeight = lines.length * lineHeight;
    let startYValue = y + 130;
    if (lines.length > 1) startYValue -= (totalHeight - lineHeight) / 2;

    ctx.font = `bold ${valueFontSize}px -apple-system, sans-serif`;
    ctx.fillStyle = '#f8fafc';
    lines.forEach((line, idx) => {
      ctx.fillText(line, x + cardW / 2, startYValue + idx * lineHeight);
    });
  });

  ctx.textAlign = 'center';
  ctx.font = '22px -apple-system, sans-serif';
  ctx.fillStyle = '#8ba3c7';
  ctx.fillText('Gerado via Retrospectiva Literária', w / 2, h - 120);

  ctx.font = '20px -apple-system, sans-serif';
  ctx.fillStyle = '#a78bfa';
  ctx.fillText('https://github.com/rayaneamaro', w / 2, h - 80);

  const link = document.createElement('a');
  link.download = `retrospectiva-${selectedYear}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function processFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    booksData = parseCSV(text);
    if (booksData.length) {
      stats = calculateStats(booksData);
      renderMetrics(stats);
      renderCharts(stats);
      renderBooks(stats);
      document.getElementById('uploadSection').style.display = 'none';
      document.getElementById('dashboard').classList.add('active');
      document.getElementById('yearDisplay').textContent = selectedYear;
      document.title = `Retrospectiva Literária ${selectedYear}`;
    } else {
      alert('Nenhum livro encontrado no arquivo CSV.');
    }
  };
  reader.readAsText(file);
}

function resetApp() {
  booksData = [];
  stats = {};
  document.getElementById('uploadSection').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('active');
  document.getElementById('csvInput').value = '';
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
