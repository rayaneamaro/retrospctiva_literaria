/* Retrospectiva - Suporte a Notas em ⭐ e meia ⭐ com 🧦, seletor de ano e exportação PNG */
const csvInput = document.getElementById('csvInput');
const demoBtn = document.getElementById('demoBtn');
const downloadImageBtn = document.getElementById('downloadImageBtn');

const yearSelect = document.getElementById('yearSelect');
const authorFilter = document.getElementById('authorFilter');
const publisherFilter = document.getElementById('publisherFilter');
const minRating = document.getElementById('minRating');
const maxRating = document.getElementById('maxRating');
const applyFilters = document.getElementById('applyFilters');
const clearFilters = document.getElementById('clearFilters');

const totalBooks = document.getElementById('totalBooks');
const totalPages = document.getElementById('totalPages');
const avgPages = document.getElementById('avgPages');
const avgRating = document.getElementById('avgRating');

const cardsContainer = document.getElementById('cardsContainer');
const captureArea = document.getElementById('captureArea');

let rawData = [];
let filteredData = [];
let charts = { rating: null, authors: null, publishers: null, indexSeries: null };

const detectDelimiter = (text) => {
  const sample = text.slice(0, 2000);
  const countComma = (sample.match(/,/g) || []).length;
  const countSemi = (sample.match(/;/g) || []).length;
  return countSemi > countComma ? ';' : ',';
};

function splitCSVLine(line, delim) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const parseNumber = (s) => {
  const v = (s || '').toString().trim();
  if (!v) return null;
  const norm = v.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(norm);
  return isNaN(n) ? null : n;
};

// Converte "⭐⭐⭐⭐🧦" -> 4.5; "⭐⭐⭐" -> 3; "—" ou vazio -> null
const parseStarRating = (s) => {
  if (!s) return null;
  const str = s.toString();
  const stars = (str.match(/⭐/g) || []).length;
  const half = (str.match(/🧦/g) || []).length > 0 ? 0.5 : 0;
  const value = stars + half;
  if (value < 0) return 0;
  if (value > 5) return 5;
  return value || null;
};

const parseYear = (s) => {
  const str = (s || '').toString();
  const m = str.match(/\b(19\d{2}|20\d{2}|2100)\b/);
  return m ? parseInt(m[1], 10) : null;
};

const parseCSV = (text) => {
  const delim = detectDelimiter(text);
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length > 0);
  const headerLine = lines[0];
  const headers = splitCSVLine(headerLine, delim).map(h => h.trim().toLowerCase());
  const idx = {
    titulo: headers.indexOf('título') !== -1 ? headers.indexOf('título') : headers.indexOf('titulo'),
    autor: headers.indexOf('autor'),
    editora: headers.indexOf('editora'),
    paginas: headers.indexOf('páginas') !== -1 ? headers.indexOf('páginas') : headers.indexOf('paginas'),
    notas: headers.indexOf('notas'),
    ano: headers.indexOf('ano') // opcional
  };
  if ([idx.titulo, idx.autor, idx.editora, idx.paginas, idx.notas].some(v => v === -1)) {
    throw new Error('Cabeçalhos esperados: Título, Autor, Editora, Páginas, Notas (opcional: Ano)');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delim);
    if (cols.length < headers.length) continue;
    const paginas = parseNumber(cols[idx.paginas]);
    const notaStr = cols[idx.notas];
    const nota = parseStarRating(notaStr) ?? parseNumber(notaStr);
    const explicitYear = idx.ano !== -1 ? parseNumber(cols[idx.ano]) : null;
    const inferredYear =
      explicitYear ??
      parseYear(cols[idx.titulo]) ??
      parseYear(cols[idx.editora]) ??
      parseYear(notaStr);

    rows.push({
      titulo: (cols[idx.titulo] || '').trim(),
      autor: (cols[idx.autor] || '').trim(),
      editora: (cols[idx.editora] || '').trim(),
      paginas: paginas ?? 0,
      nota: nota ?? null,
      ano: inferredYear ?? null,
      index: i
    });
  }
  return rows.filter(r => r.titulo);
};

const escapeHTML = (str) => (str || '').toString().replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const populateYearSelect = (data) => {
  const years = Array.from(new Set(data.map(d => d.ano).filter(Boolean))).sort((a,b)=>a-b);
  yearSelect.innerHTML = '<option value="">Todos os anos</option>';
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });
};

const applyCurrentFilters = () => {
  const selectedYear = yearSelect.value ? parseInt(yearSelect.value, 10) : null;
  const authorQ = (authorFilter.value || '').trim().toLowerCase();
  const publisherQ = (publisherFilter.value || '').trim().toLowerCase();
  const minR = minRating.value !== '' ? parseFloat(minRating.value) : null;
  const maxR = maxRating.value !== '' ? parseFloat(maxRating.value) : null;

  filteredData = rawData.filter(item => {
    if (selectedYear !== null && item.ano !== selectedYear) return false;
    if (authorQ && !item.autor.toLowerCase().includes(authorQ)) return false;
    if (publisherQ && !item.editora.toLowerCase().includes(publisherQ)) return false;
    if (minR !== null && item.nota !== null && item.nota < minR) return false;
    if (maxR !== null && item.nota !== null && item.nota > maxR) return false;
    return true;
  });

  updateSummary(filteredData);
  renderCharts(filteredData);
  renderCards(filteredData);
};

const updateSummary = (data) => {
  const total = data.length;
  const pagesSum = data.reduce((acc, d) => acc + (d.paginas || 0), 0);
  const avgP = total ? Math.round((pagesSum / total) * 10) / 10 : 0;
  const ratings = data.filter(d => d.nota !== null).map(d => d.nota);
  const avgR = ratings.length ? Math.round((ratings.reduce((a,b)=>a+b,0)/ratings.length) * 10) / 10 : 0;

  totalBooks.textContent = total;
  totalPages.textContent = pagesSum;
  avgPages.textContent = avgP;
  avgRating.textContent = avgR;
};

const groupCount = (arr, keyFn) => {
  const m = new Map();
  arr.forEach(item => {
    const k = keyFn(item);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return m;
};

const renderCharts = (data) => {
  const buckets = Array.from({ length: 11 }, (_, i) => i * 0.5);
  const counts = buckets.map(b => data.filter(d => d.nota !== null && Math.abs(d.nota - b) < 0.001).length);

  charts.rating?.destroy();
  charts.rating = new Chart(document.getElementById('ratingChart'), {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.toFixed(1)),
      datasets: [{ label: 'Quantidade', data: counts, backgroundColor: '#f5c16c', borderRadius: 6 }]
    },
    options: {
      scales: { x: { ticks: { color: '#e6edf3' } }, y: { ticks: { color: '#e6edf3' }, beginAtZero: true, precision: 0 } },
      plugins: { legend: { labels: { color: '#e6edf3' } } }
    }
  });

  const aMap = groupCount(data, d => (d.autor || '—').toLowerCase());
  const topAuthors = Array.from(aMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
  charts.authors?.destroy();
  charts.authors = new Chart(document.getElementById('authorsChart'), {
    type: 'bar',
    data: {
      labels: topAuthors.map(([k]) => capitalize(k)),
      datasets: [{ label: 'Livros', data: topAuthors.map(([_,v])=>v), backgroundColor: '#5cc9f5', borderRadius: 6 }]
    },
    options: {
      scales: { x: { ticks: { color: '#e6edf3' } }, y: { ticks: { color: '#e6edf3' }, beginAtZero: true, precision: 0 } },
      plugins: { legend: { labels: { color: '#e6edf3' } } }
    }
  });

  const pMap = groupCount(data, d => (d.editora || '—').toLowerCase());
  const topPublishers = Array.from(pMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
  charts.publishers?.destroy();
  charts.publishers = new Chart(document.getElementById('publishersChart'), {
    type: 'bar',
    data: {
      labels: topPublishers.map(([k]) => capitalize(k)),
      datasets: [{ label: 'Livros', data: topPublishers.map(([_,v])=>v), backgroundColor: '#8be38b', borderRadius: 6 }]
    },
    options: {
      scales: { x: { ticks: { color: '#e6edf3' } }, y: { ticks: { color: '#e6edf3' }, beginAtZero: true, precision: 0 } },
      plugins: { legend: { labels: { color: '#e6edf3' } } }
    }
  });

  const labels = data.map((_, i) => i + 1);
  const values = labels.map(() => 1);
  charts.indexSeries?.destroy();
  charts.indexSeries = new Chart(document.getElementById('indexSeriesChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Livros', data: values, borderColor: '#7aa9f7', backgroundColor: 'rgba(122,169,247,0.2)', tension: 0.3, fill: true }]
    },
    options: {
      scales: { x: { ticks: { color: '#e6edf3' } }, y: { ticks: { color: '#e6edf3' }, beginAtZero: true, precision: 0 } },
      plugins: { legend: { labels: { color: '#e6edf3' } } }
    }
  });
};

const capitalize = (s) => s.replace(/\b\w/g, c => c.toUpperCase());

const renderCards = (data) => {
  cardsContainer.innerHTML = '';
  if (!data.length) {
    cardsContainer.innerHTML = `<div class="item-card"><div class="details">Nenhum livro encontrado com os filtros atuais.</div></div>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  data.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item-card';
    el.innerHTML = `
      <div class="meta">
        <span class="badge rating">⭐ ${item.nota !== null ? item.nota.toFixed(1) : '—'}</span>
        <span>•</span>
        <span>${item.paginas || 0} págs</span>
        ${item.ano ? `<span>•</span><span>${item.ano}</span>` : ''}
        <span>•</span>
        <span>${escapeHTML(item.editora || '—')}</span>
      </div>
      <div class="title">${escapeHTML(item.titulo)}</div>
      <div class="details">Autor: <strong>${escapeHTML(item.autor || '—')}</strong></div>
    `;
    fragment.appendChild(el);
  });
  cardsContainer.appendChild(fragment);
};

// Exporta imagem PNG da área de retrospectiva
downloadImageBtn.addEventListener('click', async () => {
  await new Promise(r => setTimeout(r, 150));
  const scale = window.devicePixelRatio || 2;
  html2canvas(captureArea, {
    backgroundColor: '#0f141b',
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight
  }).then(canvas => {
    const link = document.createElement('a');
    const year = yearSelect.value || 'todos';
    link.download = `retrospectiva-${year}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
    alert('Falha ao gerar imagem: ' + err.message);
    console.error(err);
  });
});

// Eventos
csvInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    rawData = parseCSV(text);
    filteredData = rawData.slice();
    populateYearSelect(rawData);
    applyCurrentFilters();
  } catch (err) {
    alert('Erro ao processar CSV: ' + err.message);
  }
});

yearSelect.addEventListener('change', applyCurrentFilters);
applyFilters.addEventListener('click', applyCurrentFilters);
clearFilters.addEventListener('click', () => {
  authorFilter.value = '';
  publisherFilter.value = '';
  minRating.value = '';
  maxRating.value = '';
  yearSelect.value = '';
  filteredData = rawData.slice();
  updateSummary(filteredData);
  renderCharts(filteredData);
  renderCards(filteredData);
});

demoBtn.addEventListener('click', async () => {
  const res = await fetch('./example.csv');
  const text = await res.text();
  rawData = parseCSV(text);
  filteredData = rawData.slice();
  populateYearSelect(rawData);
  applyCurrentFilters();
});

(function init(){})();
