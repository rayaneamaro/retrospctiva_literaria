# Retrospectiva Literária

Aplicação single-page em HTML/CSS/JS que transforma um arquivo CSV de leituras em um painel com métricas, destaques e exportação em PNG pronta para Stories.

## Como usar

1. Abra `index.html` em qualquer navegador moderno (não há dependências externas).
2. Escolha o ano para exibição (afeta o título e o PNG exportado).
3. Clique em “Carregar CSV” e selecione seu arquivo.
4. Explore as abas: Visão Geral (métricas + gráficos + destaques), Favoritos, Abandonados e Todos os Livros.
5. Clique em “📸 Exportar Story (PNG)” para baixar a imagem. A assinatura "rayaneamaro" fica no rodapé para identificar a criadora.

## Formato do CSV

- O parser encontra a linha de cabeçalho procurando por combinações de título/autor. Aceita separador `,` ou `;` e lida com aspas e aspas escapadas.
- Nomes de colunas aceitos (variações comuns):
  - Título: `titulo`, `title`, `livro`
  - Autor: `autor`, `autora`, `author`
  - Editora: `editora`, `publisher`
  - Páginas: `paginas`, `pages`, `pag`
  - Nota: `nota`, `rating`, `avaliacao`, `estrelas`
  - Favorito: `favorito`, `favorite`, `fav`
  - Status: `status`, `estado`

### Regras de parsing

- Notas aceitas: números (0–5), estrelas (`⭐`, `★`, `🌟`) e meia estrela (`½`, `☆`, ou meia-estrela “🧦” em alguns CSVs). Valores são arredondados para passo 0.5.
- "Abandonado"/`dnf` é detectado tanto na coluna de nota quanto na de status; livros assim entram na aba Abandonados e não contam em média/contagem lida.
- "Favorito" é reconhecido por strings como `favorito`, `fav`, `sim`, `yes`, `true`, `1` ou `x`.

## O que o painel mostra

- Cards de métricas: livros lidos, páginas lidas, média, nota máxima, nota mínima, editora mais lida, favoritos, abandonados.
- Gráficos de barras nativos (sem libs externas): distribuição de notas, top autores, top editoras.
- Destaques: top 6 livros com melhor nota.
- Abas dedicadas para Favoritos, Abandonados e Todos.
- Exportação em PNG com gradiente profundo, cartões em glassmorphism e assinatura "rayaneamaro" no rodapé (edite a string no fim de `exportStory()` se quiser trocar o nome).

## Observações

- O seletor de ano hoje só altera título/PNG; se quiser filtrar dados por ano, será preciso ler esse campo e aplicar o filtro em `calculateStats`.
- Animação do ícone inicial está desativada para manter o layout estável na primeira dobra.

## Licença

Consulte [LICENSE](LICENSE).# Retrospectiva (CSV) — Notas em ⭐ e 🧦

Aplicação web em HTML, CSS e JavaScript para gerar uma retrospectiva visual das suas leituras a partir de um CSV com notas em estrelas e meia estrela (🧦). Inclui filtros, gráficos (Chart.js) e exportação em imagem (PNG) ideal para Stories.

## CSV esperado

Cabeçalhos:
```
Título,Autor,Editora,Páginas,Notas
```
Opcional:
```
Ano
```

- `Notas` pode ser:
  - Estrelas: `⭐⭐⭐⭐` (4), `⭐⭐⭐` (3), etc.
  - Meia estrela: adicione `🧦` (ex.: `⭐⭐⭐⭐🧦` = 4.5)
  - Números também funcionam (ex.: `4.5`)

Separadores `,` ou `;` são detectados automaticamente. Campos com aspas (e aspas escapadas `""`) são suportados.

## Funcionalidades

- Título central “Retrospectiva”
- Parser de `Notas` em ⭐ e 🧦 para valor numérico 0–5
- Filtros por Ano (se disponível), Autor, Editora e faixa de Notas
- Cards-resumo: total de livros, páginas, média de páginas, média de notas
- Gráficos:
  - Distribuição de notas (0–5, passo de 0.5)
  - Top autores
  - Top editoras
  - Evolução por índice (1..N)
- Exportação da retrospectiva em PNG com html2canvas

## Como usar

1. Coloque `index.html`, `styles.css`, `script.js` e `example.csv` na mesma pasta.
2. Abra `index.html` no navegador.
3. Clique em “Carregar CSV” e selecione seu arquivo.
4. Use filtros para refinar a visão.
5. Clique em “Baixar imagem” para salvar a retrospectiva em PNG.

## Personalização

- Cores em `styles.css` (variáveis no `:root`).
- Gráficos e buckets em `script.js` (Chart.js).
- Campos adicionais: amplie o parser em `script.js`.

```

