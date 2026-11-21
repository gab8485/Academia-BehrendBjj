# ADR-003: Autenticação Stateless HMAC-SHA256, Hashing PBKDF2 e RBAC

- **Status:** Aceito (Implementado no Incremento 2 — EP3)
- **Data:** 2026-11-15
- **Decisores:** Gabriel Gonçalves, Gabriel Pereira, Edric

## 1. Contexto
O Incremento 2 (EP3) e o Critério 8 exigem Controle de Acesso Baseado em Papéis (RBAC) diferenciando visitantes/alunos, instrutores e administradores, além de proteção criptográfica de senhas e mitigação de riscos OWASP Top 10.

## 2. Alternativas Consideradas
1. **PBKDF2-HMAC-SHA256 (`hashlib`) + Token JWT-compatível assinado com HMAC-SHA256 + Dependência `require_roles` (Escolhida):** Implementação baseada nos módulos criptográficos nativos do Python (`hashlib`, `hmac`, `secrets`) integrada ao `HTTPBearer` do FastAPI.
2. **Passlib + Bcryp C-Extension:** Frequentemente apresenta incompatibilidades de compilação em ambientes Windows/Python 3.12+ (`AttributeError: module 'bcrypt' has no attribute '__about__'`), prejudicando a reprodutibilidade (Critério 6).
3. **Sessões em memória no servidor:** Perdem o estado de login ao reiniciar o processo ou escalar containers.

## 3. Decisão
Implementamos em [`backend/security.py`](../../backend/security.py):
- Hashing de senha com **PBKDF2-HMAC-SHA256** (120.000 iterações + salt aleatório de 16 bytes) e verificação em tempo constante (`hmac.compare_digest`).
- Emissão de token Bearer *stateless* assinado com **HMAC-SHA256** contendo `sub`, `email`, `nome`, `papel` e `exp`.
- Injeção de dependência `require_roles(*allowed_roles)` que retorna `HTTP 401 Unauthorized` para requisições sem token válido e `HTTP 403 Forbidden` para papéis sem privilégio suficiente.

## 4. Consequências
- **Positivas:**
  - 100% portável em qualquer sistema operacional (Windows, Linux, macOS, Docker) sem erros de compilação de extensões C.
  - Separação clara de privilégios: `instrutor` gerencia o status das aulas experimentais e contatos, enquanto apenas `admin` pode criar turmas ou excluir registros.
- **Negativas / Trade-offs:**
  - Tokens *stateless* permanecem válidos até sua expiração (`exp`) a menos que o usuário seja desativado (`ativo=False`) no banco de dados.
