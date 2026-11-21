# 🛡️ Evidências de Segurança OWASP Top 10 — Antes vs. Depois

Este documento apresenta as evidências concretas de código (**Antes** e **Depois**) e os testes automatizados que comprovam o tratamento dos riscos do **OWASP Top 10 (2021)** no MVP da plataforma **Behrend BJJ v1.0** (Critérios 4 e 8 da rubrica do Projeto Integrador CEUB).

---

## 1. OWASP A01:2021 — Broken Access Control (Quebra de Controle de Acesso e Path Traversal)

### ❌ ANTES (Vulnerável)
Rotas operacionais e administrativas não validavam o papel (*role*) do usuário autenticado, permitindo que qualquer usuário comum listasse ou apagasse agendamentos de terceiros, além de servir arquivos arbitrários do sistema de arquivos sem lista de permissão:

```python
# ANTES: Sem verificação de papel (RBAC) e vulnerável a Path Traversal
@app.delete("/api/v1/agendamentos/{agendamento_id}")
def excluir_agendamento(agendamento_id: int, db: Session = Depends(get_db)):
    AgendamentoService.remover_agendamento(db, agendamento_id)

@app.get("/{filename}")
def serve_file(filename: str):
    return FileResponse(PROJECT_ROOT / filename)  # Risco de ../.env
```

### ✅ DEPOIS (Mitigado em `backend/security.py` e `backend/main.py`)
Implementamos Controle de Acesso Baseado em Papéis (**RBAC**) via injeção de dependência `require_roles(...)` validando a assinatura HMAC-SHA256 do token Bearer, além de *allowlist* estrita (`allowed_files`) para arquivos estáticos:

```python
# DEPOIS (backend/security.py e backend/main.py)
def require_roles(*allowed_roles: str) -> Callable:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.papel not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acesso negado para o papel '{current_user.papel}'."
            )
        return current_user
    return role_checker

@app.delete("/api/v1/agendamentos/{agendamento_id}", status_code=204)
def excluir_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),  # Exclusivo Admin!
):
    AgendamentoService.remover_agendamento(db, agendamento_id)
```

- **Teste automatizado que comprova:** `test_owasp_a01_controle_de_acesso_por_papel_rbac` em [`tests/test_api.py`](../tests/test_api.py).

---

## 2. OWASP A03:2021 — Injection (Cross-Site Scripting - XSS & SQL Injection)

### ❌ ANTES (Vulnerável)
Entradas textuais vindas de formulários públicos (`nome_aluno`, `observacoes`, `mensagem`) eram gravadas diretamente no banco sem sanitização de tags HTML/JS, e consultas SQL montadas por interpolação de strings permitiam SQL Injection:

```python
# ANTES: Vulnerável a Stored XSS e SQL Injection
query = f"SELECT * FROM agendamentos_experimentais WHERE protocolo = '{protocolo}'"
db.execute(query)
```

### ✅ DEPOIS (Mitigado em `backend/security.py`, `backend/schemas.py` e `backend/repositories.py`)
1. **Contra XSS:** Todos os schemas Pydantic sanitizam os campos textuais com `html.escape(..., quote=True)` e removem caracteres de controle antes de chegar à camada de serviço.
2. **Contra SQL Injection:** Todas as consultas no `repositories.py` utilizam expressões parametrizadas do SQLAlchemy ORM (`AgendamentoExperimental.protocolo == protocolo`).

```python
# DEPOIS (backend/security.py & backend/repositories.py)
def sanitize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value.strip())
    return html.escape(cleaned, quote=True)

# Consulta parametrizada segura via ORM:
query = query.filter(AgendamentoExperimental.protocolo == protocolo.strip().upper())
```

- **Teste automatizado que comprova:** `test_owasp_a03_sanitizacao_xss_e_prevencao_sqli` em [`tests/test_api.py`](../tests/test_api.py).

---

## 3. OWASP A02 & A07:2021 — Cryptographic Failures & Identification/Authentication Failures

### ❌ ANTES (Vulnerável)
Senhas armazenadas sem *salt* ou comparadas com `==` (sujeito a *timing attack*) e rota `/api/v1/auth/login` sem limite de tentativas (sujeita a ataque de força bruta).

### ✅ DEPOIS (Mitigado em `backend/security.py` e `backend/main.py`)
- Senhas derivadas com **PBKDF2-HMAC-SHA256** (`120.000` iterações + `salt` criptográfico de 16 bytes via `secrets.token_hex`) e verificadas com `hmac.compare_digest`.
- Rate limiting por IP (`check_rate_limit`) bloqueando mais de 10 tentativas de login em 60 segundos com `HTTP 429 Too Many Requests`.

```python
# DEPOIS (backend/security.py)
dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
# Comparação resistente a timing attack:
return hmac.compare_digest(expected, stored_hash)
```

- **Teste automatizado que comprova:** `test_owasp_a07_rate_limiting_login` em [`tests/test_api.py`](../tests/test_api.py).

---

## 4. OWASP A05:2021 — Security Misconfiguration (Cabeçalhos HTTP Defensivos)

### ❌ ANTES (Vulnerável)
O servidor entregava respostas HTTP sem cabeçalhos de proteção de navegador (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).

### ✅ DEPOIS (Mitigado em `backend/main.py`)
Middleware HTTP injeta cabeçalhos defensivos em todas as respostas da aplicação:

```python
@app.middleware("http")
async def add_owasp_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response
```

- **Teste automatizado que comprova:** `test_health_check_and_security_headers` em [`tests/test_api.py`](../tests/test_api.py).
