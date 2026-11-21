# 🥋 Behrend BJJ — Plataforma de Agendamento Experimental e Gestão (`v1.0`)

Plataforma web Full Stack do centro de treinamento **Behrend BJJ** (Brasília/DF), desenvolvida como **Projeto Integrador (2026/2)** dos cursos de Desenvolvimento de Sistemas e Engenharia de Computação do **CEUB** (Prof. Uender Amaral).

O sistema evolui o site institucional da academia para uma aplicação completa em camadas com **API REST versionada (`/api/v1`)**, **persistência relacional SQLite/SQLAlchemy**, **agendamento de aulas experimentais com validação de capacidade e protocolo**, **gestão de mensagens de contato**, **controle de acesso por papel (RBAC)** e **suíte de testes automatizados (`pytest`)**.

---

## 📚 Documentação do Projeto Integrador (Book 60% · MVP 40%)

- 📘 **[BOOK COMPLETO (Fichas 1 a 20, Diagramas, Rastreabilidade e Defesa)](docs/BOOK.md)**
- 🏛️ **[ADRs — Decisões Arquiteturais (001 a 004)](docs/adr/)**
- 🛡️ **[Segurança OWASP Top 10 — Evidências Antes vs. Depois](docs/seguranca_owasp_antes_depois.md)**
- 📦 **[CHANGELOG — Notas da Versão `v1.0`](CHANGELOG.md)**

---

## 🚀 Funcionalidades do MVP (`v1.0`)

1. **Agendamento de Aula Experimental (`agendamento.html` / `POST /api/v1/agendamentos`):**
   - Seleção dinâmica de turmas e horários com contagem de vagas disponíveis em tempo real (`GET /api/v1/turmas`).
   - Regras de negócio na camada de serviço: bloqueio de agendamento duplicado na mesma turma/data (`HTTP 409 Conflict`) e validação do limite máximo de vagas do tatame (`HTTP 422 Unprocessable Entity`).
   - Emissão imediata de protocolo único (`BJJ-XXXXXX`).
2. **Consulta Pública de Status (`GET /api/v1/agendamentos/consulta`):**
   - O visitante acompanha pelo protocolo ou e-mail se sua aula experimental está `PENDENTE`, `CONFIRMADO`, `REALIZADO` ou `CANCELADO`.
3. **Formulários de Contato Integrados (`POST /api/v1/contatos`):**
   - Todos os formulários *"Entre em contato"* das 9 páginas institucionais agora persistem as mensagens diretamente no banco SQLite via API `/api/v1`.
4. **Painel de Gestão com Controle de Acesso por Papel — RBAC (`painel.html` / `POST /api/v1/auth/login`):**
   - **`admin`:** Permissão total (gerenciar agendamentos, ler contatos, **excluir registros** e **cadastrar novas turmas**).
   - **`instrutor`:** Permissão operacional (listar e confirmar/cancelar aulas experimentais e marcar contatos como lidos). Recebe `HTTP 403 Forbidden` em ações exclusivas de `admin`.
   - **`aluno`:** Autentica-se, mas recebe `HTTP 403 Forbidden` ao tentar acessar listagens administrativas/operacionais.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia | Justificativa (Ref. Slide 11 / ADRs) |
| :--- | :--- | :--- |
| **Front-end** | HTML5, CSS3, Vanilla JavaScript (`fetch`) | Preserva a identidade visual da Behrend BJJ e consome `/api/v1` sem exigir servidor Node separado ([ADR-004](docs/adr/ADR-004-frontend-integrado-vanilla-js.md)). |
| **Back-end e API** | Python 3.10+, **FastAPI**, Pydantic v2 | Contratos REST versionados em `/api/v1` e documentação Swagger automática em `/docs` ([ADR-001](docs/adr/ADR-001-backend-fastapi-api-v1.md)). |
| **Persistência** | **SQLAlchemy 2.0 ORM**, **SQLite** | Persistência transacional em arquivo/volume com proteção contra SQL Injection ([ADR-002](docs/adr/ADR-002-persistencia-sqlalchemy-sqlite.md)). |
| **Segurança** | PBKDF2-HMAC-SHA256, Tokens HMAC-SHA256, OWASP Middleware | Hashing seguro com salt, RBAC declarativo, sanitização XSS e Rate Limiting ([ADR-003](docs/adr/ADR-003-autenticacao-rbac-tokens.md)). |
| **Qualidade & Infra** | **Pytest**, HTTPX, **Docker & Docker Compose**, `venv` | Suíte de testes automatizados e reprodução do zero em qualquer máquina. |

---

## 📂 Estrutura do Repositório

```text
Behrend-Bjj/
├── backend/
│   ├── __init__.py
│   ├── database.py             # Conexão SQLAlchemy e sessão SQLite
│   ├── models.py               # Modelos ORM: User, Turma, AgendamentoExperimental, MensagemContato
│   ├── schemas.py              # Contratos Pydantic v2 e sanitização contra XSS
│   ├── security.py             # Hashing PBKDF2, tokens HMAC-SHA256, RBAC e Rate Limiter
│   ├── repositories.py         # Camada de persistência parametrizada (Repository Pattern)
│   ├── services.py             # Camada de regras de negócio e seed inicial automático
│   └── main.py                 # Aplicação FastAPI (/api/v1), cabeçalhos OWASP e servidor estático
├── docs/
│   ├── BOOK.md                 # Caderno completo do Projeto Integrador (Fichas 1 a 20)
│   ├── seguranca_owasp_antes_depois.md
│   └── adr/                    # Architecture Decision Records (ADR-001 a ADR-004)
├── tests/
│   └── test_api.py             # Suíte automatizada Pytest (fluxo E2E, regras, RBAC e OWASP)
├── img/                        # Imagens e vídeos das modalidades
├── js/
│   └── script.js               # Integração Front-end com a API /api/v1
├── index.html                  # Página inicial institucional
├── agendamento.html            # Página de Agendamento Experimental e Consulta de Protocolo
├── painel.html                 # Painel Administrativo e Operacional (RBAC)
├── horarios.html               # Quadro de horários
├── sobre.html                  # História e equipe
├── endereço.html               # Mapa e contato
├── jiujitsuadulto.html         # Modalidade Jiu-Jitsu Adulto
├── jiujitsuinfantil.html       # Modalidade Jiu-Jitsu Infantil
├── judoadulto.html             # Modalidade Judô Adulto
├── judoinfantil.html           # Modalidade Judô Infantil
├── muaythay.html               # Modalidade Muay Thai
├── style.css                   # Folha de estilos global e componentes do MVP
├── requirements.txt            # Dependências Python fixadas
├── pytest.ini                  # Configuração da suíte de testes
├── Dockerfile                  # Imagem Docker da aplicação
├── docker-compose.yml          # Orquestração com volume SQLite persistente
├── CHANGELOG.md                # Notas da release v1.0
└── README.md                   # Guia de reprodução e documentação principal
```

---

## ⚙️ Como Reproduzir do Zero (Critério 6 — Ficha 19)

### Opção 1: Usando Python `venv` (Local)

1. **Clone o repositório e acesse a pasta do projeto:**
   ```bash
   git clone https://github.com/gab8485/Behrend-Bjj.git
   cd Behrend-Bjj
   ```

2. **Crie e ative o ambiente virtual (`venv`):**
   ```powershell
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   ```bash
   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Execute a suíte de testes automatizados (`pytest`):**
   ```bash
   pytest
   ```

5. **Inicie o servidor Full Stack:**
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

### Opção 2: Usando Docker Compose (1 Comando)

```bash
docker compose up --build
```

---

## 🌐 Endereços da Aplicação e Credenciais de Teste (RBAC)

Com a aplicação rodando em `http://localhost:8000`:

- **Página Inicial:** [http://localhost:8000/](http://localhost:8000/)
- **Agendar Aula Experimental:** [http://localhost:8000/agendamento.html](http://localhost:8000/agendamento.html)
- **Painel de Gestão RBAC:** [http://localhost:8000/painel.html](http://localhost:8000/painel.html)
- **Documentação Swagger OpenAPI (`/api/v1`):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck JSON:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### Credenciais de Demonstração (Criadas Automaticamente pelo Seed)

| Papel (RBAC) | E-mail | Senha | Comportamento Esperado no Painel e na API |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin@behrendbjj.com` | `Admin@2026` | Acesso completo (aprovar/cancelar aulas, **excluir agendamentos** e **cadastrar novas turmas**). |
| **`instrutor`** | `instrutor@behrendbjj.com` | `Instrutor@2026` | Acesso operacional (aprovar/cancelar aulas e ler contatos). Recebe `403 Forbidden` ao tentar excluir ou criar turma. |
| **`aluno`** | `aluno@behrendbjj.com` | `Aluno@2026` | Recebe `403 Forbidden` ao tentar listar dados restritos do painel. |

---

## 👥 Autores e Créditos

Projeto desenvolvido para a disciplina de **Projeto Integrador (CEUB — Prof. Uender Amaral)** por:
- **Gabriel Gonçalves**
- **Gabriel Pereira**
- **Edric**
