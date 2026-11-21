# ADR-001: Adoção do FastAPI e Versionamento de API (`/api/v1`)

- **Status:** Aceito (Implementado no Incremento 1 — EP2)
- **Data:** 2026-10-25
- **Decisores:** Gabriel Gonçalves, Gabriel Pereira, Edric

## 1. Contexto
O projeto Behrend BJJ iniciou no Ciclo 1 como um site institucional estático em HTML5, CSS3 e JavaScript. Para resolver o problema real de agendamento de aulas experimentais com validação de capacidade e persistência de mensagens de contato, precisávamos de um framework back-end Python que suportasse arquitetura em camadas, validação rigorosa de dados, documentação automática de contratos REST e alta testabilidade com `pytest`.

## 2. Alternativas Consideradas
1. **FastAPI + Pydantic v2 (Escolhida):** Framework ASGI moderno, com validação declarativa via type hints, geração nativa de OpenAPI/Swagger (`/docs`) e `TestClient` integrado ao `pytest`.
2. **Flask:** Microframework WSGI clássico, porém exige bibliotecas adicionais manuais para validação de schemas, serialização e geração de documentação OpenAPI.
3. **Django + Django REST Framework:** Solução robusta ("baterias inclusas"), mas com sobrecarga estrutural excessiva para o escopo enxuto do MVP da academia.

## 3. Decisão
Adotamos o **FastAPI** estruturado sob o prefixo de rota **`/api/v1`** (`backend/main.py`), separando a validação de contratos (`backend/schemas.py`), as regras de negócio (`backend/services.py`) e o acesso a dados (`backend/repositories.py`).

## 4. Consequências
- **Positivas:**
  - Contratos REST explícitos e versionados (`/api/v1/turmas`, `/api/v1/agendamentos`, `/api/v1/contatos`, `/api/v1/auth/login`).
  - Rejeição automática de payloads malformados com código semântico `HTTP 422 Unprocessable Entity`.
  - Documentação interativa disponível automaticamente em `/docs` para inspeção da banca avaliadora.
- **Negativas / Trade-offs:**
  - Exige manutenção sincronizada entre os modelos SQLAlchemy (`models.py`) e os schemas Pydantic (`schemas.py`).
