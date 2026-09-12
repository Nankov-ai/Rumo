# Rumo — instruções para o Claude

App estática (HTML/CSS/JS, sem build, sem framework, sem servidor) com **duas
folhas** do mesmo método de planeamento, cada uma com o seu próprio ciclo de
blindagem:

- **Rumo** — direção a longo prazo (horizonte configurável), revisão num dia fixo
  do mês.
- **Foco** — foco da semana corrente, com um único momento de coleta de informação
  por semana.

Publicável no GitHub Pages. Dados só no dispositivo (`localStorage`).

Nome do projeto: **Rumo** (antes "Folha Norte" — renomeado em 2026-09 por ser o
nome de um curso, não do Nando; nenhum texto ou material do curso é usado, só o
método de duas folhas descrito acima, implementado de raiz).

## Ficheiros

| Ficheiro | Papel |
|---|---|
| `index.html` | Separadores `#tab-norte` / `#tab-projeto` sobre `#pane-norte` / `#pane-projeto` (ids técnicos mantidos do nome antigo — só o texto visível mudou para "Rumo"/"Foco"). Norte tem dois estados: `#view-empty` (sem folha) e `#view-folha`. Projeto tem sempre `#view-projeto` (a semana é criada automaticamente). |
| `app.js` | Toda a lógica. IIFE, `localStorage`, blindagem das duas folhas, histórico, export/import. |
| `i18n.js` | `window.I18N.{pt,en}`. Acrescentar língua = nova chave de topo completa (verificar sempre simetria pt/en). |
| `styles.css` | Design "instrumento de navegação": banda com bússola + separadores + folha A4. |
| `sw.js` / `manifest.json` | PWA. App shell offline. |
| `icons/generate.html` | Gera os PNG dos ícones (correr uma vez no browser). |

## Nomenclatura interna vs. nome visível

Os identificadores internos (variáveis, chaves de `localStorage`, ids do DOM) usam
os nomes técnicos originais — `folha`, `projeto`, `K_FOLHA`, `#tab-norte`, etc. —
por não valer a pena o custo/risco de os renomear. **Só o texto visível ao
utilizador muda**: título, separadores, textos de `i18n.js`. Ao adicionar texto
novo, usar sempre "Rumo" (folha de longo prazo) e "Foco" (folha semanal) — nunca
"Folha Norte" nem "Folha Projeto".

## Estado (localStorage)

- `rumo.folha` — `{ createdAt, horizon, projecao, atual, needs[], commit, nome, history[] }`
  - `horizon` — `{ n, unit: "day"|"week"|"month"|"year" }`. A data-alvo é calculada
    a partir de `createdAt` (ver `addHorizon()`), não guardada. Folhas importadas
    sem `horizon` assumem `{ n: 1, unit: "year" }`.
- `rumo.config` — `{ reviewDay }` (1–28)
- `rumo.lang` — `"pt"` | `"en"`
- `rumo.tab` — `"norte"` | `"projeto"` (último separador aberto)
- `rumo.projeto` — semana corrente: `{ weekStart, createdAt, assuntos[], collected, collectedAt, informacoes[], history[] }`
  - `weekStart` — segunda-feira da semana (`YYYY-MM-DD`), ver `mondayOf()`/`weekKeyOf()`.
  - Ao entrar numa nova semana, `ensureCurrentWeek()` arquiva a semana anterior em
    `rumo.projeto.archive` (máx. 12) e cria uma folha nova vazia.
- `rumo.pendentes` — fila de referências fora do momento de coleta: `{ id, desc, addedAt }[]`.
  Persiste entre semanas até serem processadas na próxima coleta.

Chaves antigas (`fn.*`, antes do rename) não são migradas automaticamente — só
afetava dados de teste do Nando, sem utilizadores reais. `exportCopy()`/`importCopy()`
aceitam tanto `_app: "rumo"` como o antigo `_app: "folha-norte"`, para não perder
exportações feitas antes do rename.

`needs[]` = `{ id, type: "informacao"|"conteudo"|"conhecimento", desc, done }`
`history[]` (Rumo) = `{ at, type: "created"|"review"|"reflection"|"emergency", text }`
`assuntos[]` (Foco) = `{ id, desc, done }`
`informacoes[]` (Foco) = `{ id, desc, consumida }`
`history[]` (Foco) = `{ at, type: "created"|"collected", text }`

## Blindagem — não enfraquecer sem o Nando confirmar

Núcleo do método em ambas as folhas, não um detalhe de UI.

**Rumo:**
- Fora do `reviewDay` os campos do plano ficam `disabled` (ver `renderLock()`).
- No `reviewDay` a folha abre e guardar exige uma nota de revisão (`#dlg-review`).
- Sempre disponível: registar reflexão (append-only, não altera o plano).
- Desbloqueio de emergência: exige justificação (≥40 caz.), regista `emergency` no
  histórico, dura só a sessão, fecha ao guardar.

**Foco:**
- A coleta de informação (`#btn-collect` → `#dlg-collect`) só pode acontecer **uma
  vez por semana** — depois de `projeto.collected = true` o botão esconde-se e o
  banner passa a indicar que só a próxima coleta aceita novas referências.
- Referências que surgem fora da coleta vão sempre para `rumo.pendentes` (nunca
  direto para `informacoes`) — só entram na semana seguinte, na próxima coleta.
- `assuntos[]` (temas da semana) não têm blindagem — o método só a exige para a
  coleta de informação, não para a definição dos temas.

Não adicionar "editar sempre", nem remover os diálogos de revisão/coleta, nem
alargar as janelas de edição além do que o método define.

## Segurança

- Nunca introduzir chamadas de rede em uso normal. A app é 100% offline.
- Sem tokens, sem chaves. Se algum dia entrar IA/nuvem, é backend separado (padrão
  `Task.Talk` / Cloudflare Worker do `Dashboard do Dinis`), nunca segredos no cliente.

## Fluxo de trabalho

Ficheiro único por área — ao pedir alterações, devolver o(s) ficheiro(s) completo(s).
Testar abrindo `index.html` ou `npx serve .`.
