# ADR-004: Front-end Integrado em HTML5/CSS3/Vanilla JS Servido pelo FastAPI

- **Status:** Aceito (Implementado nos Incrementos 1 e 2)
- **Data:** 2026-11-18
- **Decisores:** Gabriel Gonçalves, Gabriel Pereira, Edric

## 1. Contexto
A equipe já possuía 9 páginas HTML institucionais desenvolvidas para a Behrend BJJ (`index.html`, `horarios.html`, `sobre.html`, `endereço.html` e páginas das 5 modalidades). Precisávamos evoluir esse front-end para consumir a API `/api/v1`, corrigir falhas de JavaScript existentes e adicionar as telas de Agendamento Experimental e Painel RBAC sem criar complexidade desnecessária de build (Node/Webpack) para quem for reproduzir o projeto.

## 2. Alternativas Consideradas
1. **Aprimoramento Progressivo em HTML5/CSS3/Vanilla JS servido pelo próprio FastAPI (Escolhida):** O FastAPI serve os arquivos estáticos e as páginas HTML na mesma origem (`http://localhost:8000`), enquanto `js/script.js` consome `/api/v1` via Fetch API.
2. **Reescrita completa em React/Vite em servidor separado:** Exigiria `npm install` + dois servidores rodando simultaneamente (Node + Python), aumentando o risco de falhas de reprodução por outras equipes.

## 3. Decisão
Mantivemos e aprimoramos o Front-end em HTML5/CSS3/Vanilla JS, adicionando [`agendamento.html`](../../agendamento.html) e [`painel.html`](../../painel.html), interceptando todos os formulários de contato existentes em [`js/script.js`](../../js/script.js) e servindo toda a aplicação pelo FastAPI com lista branca de arquivos permitidos (`allowed_files`) contra Path Traversal.

## 4. Consequências
- **Positivas:**
  - Um único comando (`uvicorn backend.main:app` ou `docker compose up`) disponibiliza tanto a interface completa quanto a API `/api/v1` e o `/docs`.
  - Preserva 100% da identidade visual e mídias reais da academia Behrend BJJ.
- **Negativas / Trade-offs:**
  - A manipulação de estado da tabela do painel é feita diretamente via DOM (`innerHTML` com dados previamente sanitizados contra XSS pelo back-end).
