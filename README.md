# Rumo

Duas folhas do mesmo método de planeamento pessoal: **Rumo** define o caminho a
longo prazo e revê-se uma vez por mês; **Foco** organiza a semana corrente e
recolhe informação uma vez por semana. Nos dois casos: **nem antes, nem depois**.

App estática (HTML/CSS/JS, sem build), instalável como PWA. Os dados ficam só no teu
dispositivo (`localStorage`). Publicável de graça no GitHub Pages.

> Implementação própria de um exercício de planeamento pessoal (dois pontos —
> onde estás e onde queres chegar — com revisão num dia fixo). Não usa nome,
> texto nem material de nenhum curso.

## Rumo

1. **Onde estou agora** e **onde quero chegar** (a projeção). O horizonte é à tua
   escolha — dias, semanas, meses ou anos — e a app mostra a data-alvo.
2. **O que preciso de reunir** — informações, conteúdos e conhecimentos concretos.
3. **Compromisso** com a direção apontada.
4. **Revisão mensal** num dia fixo (sugestão: dia 22). Fora desse dia o plano está
   fechado — é a *blindagem* contra a procrastinação e a fuga.

Extras: desbloqueio de emergência (facto novo real, com justificação, fica no
histórico), histórico completo, exportar/importar, imprimir A4.

## Foco

1. **Assuntos da semana** — os temas que vão centralizar a tua atenção.
2. **Coleta de informação** num único momento (sugestão: segunda de manhã). Depois
   da coleta, a lista fica fechada até à semana seguinte.
3. Referências novas a meio da semana ficam **em espera** — só entram na próxima
   coleta. É a blindagem contra consumir informação fora de hora.
4. **Cada semana é uma folha nova** — a semana anterior fica no histórico
   automaticamente ao abrires a app numa segunda-feira nova.

## Correr localmente

Abre `index.html` no browser. Para o service worker (PWA) funcionar precisas de
`http://localhost`:

```
npx serve .
```

## Ícones do PWA

Abre `icons/generate.html` uma vez num browser, descarrega `icon-192.png` e
`icon-512.png` e coloca-os em `icons/`.

## Deploy (GitHub Pages)

`git push` para `main` → Pages publica em ~2 min. Sem CI.

## Línguas

`i18n.js` tem `pt` (Portugal) e `en`. Acrescentar uma língua = mais uma chave de
topo com o mesmo conjunto de campos.

## Próximos passos (fora da v1)

- Contas + sincronização na nuvem (Supabase) — permite multi-user.
- Assistente de IA (sugerir conhecimentos, questionar coerência) — implica chave de
  API, Termos & Condições e aviso do AI Act.
- Planos pagos / checkout (Stripe / referência `pt-checkout-builder`).
