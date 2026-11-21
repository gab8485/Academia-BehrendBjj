# 📦 CHANGELOG — Notas de Versão (Behrend BJJ)

Todas as mudanças notáveis do Projeto Integrador (CEUB 2026/2) estão documentadas neste arquivo, refletindo a evolução incremental do Ciclo 1 até a Release **`v1.0`** (Critério 9 da rubrica).

---

## [v1.0.0] — 2026-11-18 (Tag `v1.0` · EP4 & Release Final)

### ✨ Adicionado
- **Book Completo do Projeto Integrador (`docs/BOOK.md`):** Documentação integral das **Fichas 1 a 20**, matriz de rastreabilidade, diagramas Mermaid (arquitetura em camadas e DER), decisões Go/No-Go e guia de arguição com citação de autor e obra.
- **Registros de Decisão de Arquitetura (`docs/adr/`):** `ADR-001` (FastAPI `/api/v1`), `ADR-002` (SQLAlchemy + SQLite), `ADR-003` (Autenticação PBKDF2/HMAC e RBAC) e `ADR-004` (Front-end integrado).
- **Evidências OWASP Antes/Depois (`docs/seguranca_owasp_antes_depois.md`):** Documentação comparativa e testes automatizados para OWASP A01, A02, A03, A05 e A07.
- **Reprodutibilidade (`Dockerfile`, `docker-compose.yml`, `requirements.txt`, `.env.example`):** Configuração completa para execução do zero via Docker Compose ou Python `venv`.

---

## [v0.3.0] — 2026-11-15 (Incremento 2 · EP3: Acesso por Papel, Segurança e Validação)

### ✨ Adicionado
- **Controle de Acesso por Papel — RBAC (`backend/security.py`):** Autenticação `/api/v1/auth/login` com emissão de token assinado HMAC-SHA256, hashing PBKDF2-SHA256 e proteção de rotas por papel (`admin`, `instrutor`, `aluno`).
- **Painel de Gestão (`painel.html`):** Interface restrita para confirmação/realização/cancelamento de aulas experimentais, leitura de mensagens de contato e criação de novas turmas (exclusivo `admin`), incluindo barra de preenchimento rápido dos 3 papéis para demonstração.
- **Suíte de Testes Automatizados (`tests/test_api.py`):** 8 testes automatizados com `pytest` cobrindo fluxo ponta a ponta, regras de negócio, RBAC e segurança OWASP.
- **Ajustes da Validação com Usuários (Ficha 18):** Consulta pública de agendamento também por e-mail, campo de observações para empréstimo de kimono e injeção automática do campo `mensagem` em todos os formulários de contato do site.

---

## [v0.2.0] — 2026-11-10 (Incremento 1 · EP2: Arquitetura, Fluxo Mínimo e Persistência)

### ✨ Adicionado
- **Arquitetura Back-end em Camadas (`backend/`):** Modelos SQLAlchemy (`User`, `Turma`, `AgendamentoExperimental`, `MensagemContato`), repositórios, serviços de negócio e rotas REST `/api/v1`.
- **Regras de Negócio no `AgendamentoService`:** Validação de capacidade máxima de vagas da turma na data (`HTTP 422`) e bloqueio de agendamento duplicado do mesmo aluno na mesma turma/data (`HTTP 409`).
- **Página de Agendamento (`agendamento.html`):** Fluxo público ponta a ponta com geração de protocolo `BJJ-XXXXXX` e consulta de status em tempo real.

### 🐛 Corrigido
- Corrigido `ReferenceError: searchForm is not defined` em `js/script.js` ao acionar o menu mobile ou rolar a página.

---

## [v0.1.0] — 2026-10-20 (Ciclo 1 & EP1: Base Institucional Estática e Descoberta)

### ✨ Adicionado
- Site institucional estático da academia Behrend BJJ com 9 páginas HTML (`index.html`, `sobre.html`, `horarios.html`, `endereço.html`, `jiujitsuadulto.html`, `jiujitsuinfantil.html`, `judoadulto.html`, `judoinfantil.html`, `muaythay.html`) e folha de estilo `style.css`.
- Definição do problema, personas, hipóteses e backlog inicial (Fichas 1 a 10).
