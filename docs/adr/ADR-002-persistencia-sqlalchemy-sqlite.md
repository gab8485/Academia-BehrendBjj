# ADR-002: Persistência Relacional com SQLAlchemy ORM e SQLite

- **Status:** Aceito (Implementado no Incremento 1 — EP2)
- **Data:** 2026-10-28
- **Decisores:** Gabriel Gonçalves, Gabriel Pereira, Edric

## 1. Contexto
O Critério 7 do MVP exige que os dados persistam após o reinício da aplicação, e o Critério 6 do Book exige que qualquer outra equipe consiga reproduzir o sistema do zero, sozinha. Além disso, o Critério 8 exige prevenção contra SQL Injection (OWASP A03).

## 2. Alternativas Consideradas
1. **SQLAlchemy 2.0 ORM + SQLite em arquivo persistente (`behrend_bjj.db`) com suporte a `DATABASE_URL` (Escolhida):** Banco relacional embarcado na biblioteca padrão do Python, mapeado via ORM.
2. **PostgreSQL obrigatório em servidor separado:** Excelente para alta concorrência, mas adiciona complexidade de infraestrutura caso o avaliador execute o projeto fora do Docker.
3. **Persistência em arquivos JSON locais:** Frágil contra corrupção concorrente, sem integridade referencial (Foreign Keys) e sem transações ACID.

## 3. Decisão
Utilizamos **SQLAlchemy 2.0 ORM** conectado por padrão ao banco **SQLite** (`sqlite:///./behrend_bjj.db` local e volume persistente `behrend_sqlite_data` no Docker Compose), com inicialização e *seed* automático das turmas e usuários no ciclo de vida (`lifespan`) da aplicação.

## 4. Consequências
- **Positivas:**
  - Zero configuração externa para rodar localmente (`venv` ou Docker).
  - Prevenção nativa contra SQL Injection por meio de *bind parameters* do SQLAlchemy ORM.
  - Permite substituir o banco por `sqlite://` em memória durante a execução do `pytest` via *dependency override*, tornando a suíte de testes rápida e determinística.
- **Negativas / Trade-offs:**
  - O SQLite realiza bloqueio em nível de arquivo durante escritas simultâneas, o que é perfeitamente adequado ao volume de agendamentos de um centro de treinamento, podendo ser migrado para PostgreSQL apenas alterando a variável `DATABASE_URL`.
