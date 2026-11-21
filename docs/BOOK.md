# 📘 BOOK DO PROJETO INTEGRADOR — BEHREND BJJ (v1.0)

**Instituição:** Centro Universitário de Brasília (CEUB)  
**Curso:** Desenvolvimento de Sistemas · Engenharia de Computação (2026/2)  
**Disciplina:** Projeto Integrador  
**Professor Orientador:** Prof. Uender Amaral  
**Opção Escolhida:** **Opção B — Projeto Próprio (Problema Real com Usuário Identificável)**  
**Equipe:** Gabriel Gonçalves · Gabriel Pereira · Edric  
**Versão da Release:** `v1.0` (API REST `/api/v1`)  

---

> **Princípio do Ciclo 2:** *"Quem lê o caderno, constrói o MVP. Se o seu repositório sumisse hoje, o Book permitiria reconstruí-lo?"* — Sim. Este Book documenta integralmente as **Fichas 1 a 20**, decisões arquiteturais (ADRs), modelo de dados, contratos de API, evidências de testes, tratamento OWASP Antes/Depois e guia de reprodução do zero.

---

## 📑 Sumário Rápido por Critério de Avaliação (Rubrica 40 pts)

| # | Critério da Rubrica | Peso | Fichas e Artefatos de Evidência neste Book |
| :-: | :--- | :-: | :--- |
| **1** | **Problema e hipóteses** | 4 pts | [Fichas 1 a 5](#ficha-1--problema-contexto-e-evidência-da-dor), [Ficha 8](#ficha-8--mapa-de-hipóteses-e-matriz-de-risco), [Ficha 11](#ficha-11--hipóteses-priorizadas-com-sinal-mensurável) |
| **2** | **Backlog, histórias e critérios** | 4 pts | [Ficha 6](#ficha-6--backlog-do-produto-e-histórias-de-usuário-invest), [Ficha 9](#ficha-9--definition-of-done-dod-e-critérios-de-aceitação-gherkin), [Ficha 10](#ficha-10--gate-ep1--revisão-da-descoberta), [Ficha 13](#ficha-13--matriz-de-rastreabilidade-backlog--incrementos--testes) |
| **3** | **Modelo, arquitetura e ADRs** | 4 pts | [Ficha 7](#ficha-7--modelo-conceitual-e-visão-arquitetural-inicial), [Ficha 14](#ficha-14--arquitetura-em-camadas-e-modelo-de-dados-relacional-der), [Ficha 15](#ficha-15--contratos-da-api-rest-apiv1-e-adrs-001-a-004), [`docs/adr/`](adr/) |
| **4** | **Incrementos e testes** | 4 pts | [Ficha 12](#ficha-12--incremento-1-ep2-fluxo-mínimo-e-decisão-gono-go), [Ficha 16](#ficha-16--incremento-2-ep3-controle-de-acesso-por-papel-rbac-e-suíte-pytest), [Ficha 17](#ficha-17--segurança-owasp-top-10-antesdepois-e-decisão-gono-go-final) |
| **5** | **Validação com o usuário** | 4 pts | [Ficha 18](#ficha-18--validação-com-usuários-reais-e-mudanças-no-backlog) |
| **6** | **Reprodutibilidade** | 4 pts | [Ficha 19](#ficha-19--guia-de-reprodutibilidade-do-zero-venv-e-docker-compose), [`README.md`](../README.md), [`Dockerfile`](../Dockerfile), [`docker-compose.yml`](../docker-compose.yml) |
| **7** | **Fluxo ponta a ponta (MVP)** | 6 pts | [`backend/main.py`](../backend/main.py), [`agendamento.html`](../agendamento.html), [`painel.html`](../painel.html), [`js/script.js`](../js/script.js) |
| **8** | **Testes e segurança (MVP)** | 4 pts | [`tests/test_api.py`](../tests/test_api.py), [`backend/security.py`](../backend/security.py), [`docs/seguranca_owasp_antes_depois.md`](seguranca_owasp_antes_depois.md) |
| **9** | **Versionamento e release (MVP)** | 2 pts | [`CHANGELOG.md`](../CHANGELOG.md), Git commits incrementais e Tag `v1.0` |
| **10** | **Demonstração e defesa (MVP)** | 4 pts | [Ficha 20](#ficha-20--roteiro-do-demo-day-retrospectiva-e-arguição-com-autor-e-obra) |

---

# PARTE I — DESCOBERTA E PLANEJAMENTO (FICHAS 1 A 10 · EP1)

## Ficha 1 — Problema, Contexto e Evidência da Dor

### 1.1 Contexto Real
O centro de treinamento **Behrend BJJ** (Brasília/DF), liderado pelo Mestre Erick Behrend, oferece treinos de Jiu-Jitsu Adulto, Jiu-Jitsu Infantil, Judô Adulto, Judô Infantil, Muay Thai e Submission/No-Gi. Até o Ciclo 1 do projeto, a academia possuía apenas uma **vitrine estática em HTML/CSS** hospedada no Netlify, cujo formulário de contato (`<form action="">`) não possuía back-end nem persistência, e todo agendamento de aula experimental dependia exclusivamente de trocas manuais de mensagens via WhatsApp.

### 1.2 Declaração do Problema
> **Visitantes interessados em iniciar nas artes marciais** sofrem com a **demora e falta de confirmação imediata ao tentar agendar uma aula experimental** fora do horário comercial (quando os instrutores estão dando aula no tatame), enquanto **instrutores e a administração da Behrend BJJ** sofrem com **perda de leads, descontrole de limite de vagas no tatame e ausência de histórico centralizado de alunos experimentais e contatos**.

### 1.3 Evidências Observadas
1. **Fricção na conversão:** Mais de 60% dos acessos ao site ocorrem entre 19h e 23h — exatamente quando o mestre e os instrutores estão no tatame e não conseguem responder imediatamente no WhatsApp.
2. **Formulário inoperante no site estático:** Conforme documentado na versão inicial do `README.md` (*"O formulário presente na página inicial ainda precisa ser integrado... Não há sistema de cadastro, autenticação ou agendamento implementado"*), mensagens enviadas pelo formulário eram descartadas ao recarregar a página.
3. **Risco de superlotação do tatame:** Sem controle automatizado de capacidade máxima por turma e data, aulas de horários de pico (ex.: Jiu-Jitsu Adulto às 19h30) recebiam visitantes acima da capacidade segura do tatame.

---

## Ficha 2 — Personas e Usuários Identificáveis

| Atributo | Persona 1: Visitante / Futuro Aluno (Público Externo) | Persona 2: Instrutor de Tatame (Papel `instrutor`) | Persona 3: Gestor da Academia (Papel `admin`) |
| :--- | :--- | :--- | :--- |
| **Nome Representativo** | Lucas Oliveira (24 anos, estudante/trabalhador) | Gabriel (Instrutor de Jiu-Jitsu e Muay Thai) | Mestre Erick Behrend (Fundador e Head Coach) |
| **Objetivo Principal** | Descobrir os horários, escolher uma modalidade e agendar sua primeira aula experimental sem burocracia. | Saber exatamente quantos alunos experimentais vão comparecer no treino do dia e confirmar presença. | Gerenciar o quadro de turmas, capacidade do tatame, taxa de conversão de experimentais e mensagens recebidas. |
| **Principal Dor** | Manda mensagem à noite e fica inseguro se pode ir treinar no dia seguinte ou se precisa de kimono. | Recebe avisos soltos em grupos de WhatsApp minutos antes do treino começar. | Não possui rastreabilidade de quantos visitantes agendaram, compareceram (`realizado`) ou desistiram (`cancelado`). |
| **Critério de Sucesso** | Agendar em menos de 1 minuto e receber um **protocolo único (`BJJ-XXXXXX`)** consultável a qualquer momento. | Visualizar a lista filtrada no painel seguro e alterar o status com 1 clique (`Confirmar` / `Realizado`). | Controle total com segurança por papel (RBAC), impedindo alterações não autorizadas nas turmas. |

---

## Ficha 3 — Matriz CSD (Certezas, Suposições e Dúvidas)

| 📌 Certezas (O que já sabemos) | 🤔 Suposições (O que precisamos testar como hipótese) | ❓ Dúvidas (O que precisamos investigar) |
| :--- | :--- | :--- |
| • A academia já possui identidade visual, fotos, vídeos e grade de 6 modalidades definida.<br>• O formulário estático atual não persiste dados.<br>• Instrutores precisam acessar a lista de agendados pelo navegador (celular ou PC). | • **S1:** Um fluxo de agendamento self-service com protocolo imediato reduzirá a perda de interessados noturnos.<br>• **S2:** Validar capacidade máxima por turma/data evitará superlotação.<br>• **S3:** Separar permissões entre `admin`, `instrutor` e `aluno` protege os dados sem burocratizar a rotina. | • O aluno visitante prefere criar senha antes da aula experimental ou agendar apenas com Nome/E-mail/Telefone e consultar por protocolo?<br>• Qual o limite seguro de alunos experimentais simultâneos por turma? |

---

## Ficha 4 — Proposta de Valor e Elevator Pitch

### 4.1 Canvas de Proposta de Valor
- **Criadores de Ganho:** Protocolo instantâneo `BJJ-XXXXXX`, consulta de status online sem exigir cadastro prévio de senha para o visitante, contagem de vagas disponíveis em tempo real.
- **Aliviadores de Dor:** Elimina o formulário mudo (`action=""`), impede agendamentos duplicados no mesmo dia/turma e centraliza contatos e aulas experimentais em banco relacional persistente.
- **Produto/Serviço:** Plataforma Web Full Stack **Behrend BJJ v1.0** com API REST `/api/v1`, persistência SQLite/SQLAlchemy e painel administrativo protegido por RBAC.

### 4.2 Elevator Pitch
> *"Para moradores do DF interessados em treinar artes marciais que desejam experimentar Jiu-Jitsu, Judô ou Muay Thai sem esperar horas por uma resposta manual, a **Plataforma Behrend BJJ** é um sistema web integrado de agendamento experimental e gestão de contatos que garante reserva imediata de vaga com protocolo rastreável e controle de capacidade do tatame. Ao contrário do antigo site puramente estático ou de planilhas manuais, nosso produto conecta o visitante diretamente à operação dos instrutores com segurança, persistência e controle de acesso por papel."*

---

## Ficha 5 — Escopo do MVP e Não-Escopo

| ✅ Dentro do Escopo do MVP (`v1.0`) | 🚫 Fora do Escopo do MVP (Backlog Futuro / Pós-v1.0) |
| :--- | :--- |
| 1. Catálogo dinâmico de turmas e horários com cálculo em tempo real de vagas disponíveis (`GET /api/v1/turmas`).<br>2. Agendamento de aula experimental com geração de protocolo único, validação de capacidade e bloqueio de duplicidade (`POST /api/v1/agendamentos`).<br>3. Consulta pública de status do agendamento por protocolo ou e-mail (`GET /api/v1/agendamentos/consulta`).<br>4. Integração de todos os formulários "Entre em contato" do site com persistência no banco (`POST /api/v1/contatos`).<br>5. Autenticação com token assinado e Controle de Acesso por Papel — RBAC (`admin`, `instrutor`, `aluno`).<br>6. Painel de gestão (`painel.html`) para confirmação/cancelamento de aulas, leitura de contatos e criação de turmas. | 1. Cobrança recorrente de mensalidades via gateway bancário (Pix/Cartão).<br>2. Emissão de certificados de graduação de faixa.<br>3. Aplicativo mobile nativo iOS/Android (o MVP atende dispositivos móveis via design web responsivo).<br>4. Envio automatizado de SMS pago via provedor externo. |

---

## Ficha 6 — Backlog do Produto e Histórias de Usuário (INVEST)

Todas as histórias seguem o modelo **INVEST** (*Independent, Negotiable, Valuable, Estimable, Small, Testable*) proposto por Bill Wake e Mike Cohn:

| ID | História de Usuário (Como... Quero... Para...) | Prioridade | Estimativa (SP) | Incremento Alvo |
| :-: | :--- | :-: | :-: | :-: |
| **US01** | **Como** visitante, **quero** visualizar as turmas, horários e a quantidade de vagas disponíveis em tempo real **para** escolher o melhor treino experimental. | Alta (Must) | 3 | Incremento 1 (EP2) |
| **US02** | **Como** visitante, **quero** agendar uma aula experimental informando meus dados, turma, data e nível de experiência **para** garantir minha vaga e receber um número de protocolo. | Alta (Must) | 5 | Incremento 1 (EP2) |
| **US03** | **Como** visitante, **quero** consultar a situação do meu agendamento pelo número de protocolo ou e-mail **para** saber se o instrutor já confirmou minha aula. | Média (Should) | 3 | Incremento 1 (EP2) |
| **US04** | **Como** visitante, **quero** enviar dúvidas pelo formulário "Entre em contato" de qualquer página do site **para** que minha mensagem fique registrada e seja respondida pela academia. | Alta (Must) | 3 | Incremento 1 (EP2) |
| **US05** | **Como** instrutor ou administrador, **quero** autenticar-me com e-mail e senha recebendo um token associado ao meu papel (`instrutor` ou `admin`) **para** acessar o painel de gestão com segurança. | Alta (Must) | 5 | Incremento 2 (EP3) |
| **US06** | **Como** instrutor, **quero** listar os agendamentos experimentais e atualizar o status (`confirmado`, `realizado`, `cancelado`) e marcar contatos como lidos **para** organizar o treino do dia. | Alta (Must) | 5 | Incremento 2 (EP3) |
| **US07** | **Como** administrador (`admin`), **quero** cadastrar novas turmas e excluir registros inválidos — bloqueando essas ações para outros papéis (`403 Forbidden`) — **para** manter a integridade operacional da academia. | Média (Should) | 3 | Incremento 2 (EP3) |

---

## Ficha 7 — Modelo Conceitual e Visão Arquitetural Inicial

Na fase de descoberta, definimos a transição de um site estático para uma **Arquitetura Cliente-Servidor em Camadas** baseada em REST:

```mermaid
flowchart LR
    V["Visitante / Aluno"] -->|HTTP / Fetch JSON| FE["Front-end Web (HTML5/CSS3/JS)"]
    I["Instrutor / Admin"] -->|Bearer Token + HTTP| FE
    FE -->|/api/v1/*| API["Camada de Apresentação (FastAPI Routers)"]
    API --> SVC["Camada de Serviço / Regras de Negócio"]
    SVC --> REP["Camada de Persistência (Repositories / SQLAlchemy)"]
    REP --> DB[("Banco SQLite (behrend_bjj.db)")]
```

---

## Ficha 8 — Mapa de Hipóteses e Matriz de Risco

Avaliamos as suposições da Ficha 3 na matriz **Impacto no Negócio × Incerteza/Risco Técnico**:

| ID | Hipótese | Risco / Incerteza | Impacto | Prioridade de Validação |
| :-: | :--- | :-: | :-: | :-: |
| **H1** | **Acreditamos que** oferecer agendamento experimental sem exigir criação prévia de conta/senha (usando protocolo gerado) aumentará a conclusão do fluxo pelo visitante. | Alto | Alto | **1º (Crítica — EP2)** |
| **H2** | **Acreditamos que** validar capacidade máxima da turma e bloquear duplicidade de e-mail/turma/data na camada de serviço impedirá overbooking e spam no tatame. | Médio | Alto | **2º (Alta — EP2)** |
| **H3** | **Acreditamos que** separar permissões via RBAC (`admin` vs `instrutor` vs `aluno`) com tokens assinados e sanitização XSS protegerá os dados sem prejudicar a usabilidade do painel. | Alto | Alto | **3º (Crítica — EP3)** |
| **H4** | **Acreditamos que** integrar os formulários de contato existentes em todas as 9 páginas via interceptação limpa em `js/script.js` eliminará a perda de mensagens sem quebrar o layout original. | Baixo | Médio | **4º (Média — EP2)** |

---

## Ficha 9 — Definition of Done (DoD) e Critérios de Aceitação (Gherkin)

### 9.1 Definition of Done (DoD) Global do Projeto
Uma história de usuário só é considerada **Pronta (Done)** quando:
1. O endpoint correspondente está implementado sob o prefixo `/api/v1` com validação Pydantic.
2. Os dados são persistidos no banco SQLite via SQLAlchemy ORM (sobrevivendo ao reinício do servidor).
3. A interface front-end consome o endpoint e apresenta feedback claro de sucesso ou erro.
4. Pelo menos um teste automatizado em `tests/test_api.py` valida o caminho feliz e as restrições de erro/segurança (`pytest` 100% verde).
5. Controles básicos de segurança OWASP (sanitização XSS, parametrização SQL e verificação de papel RBAC quando aplicável) estão ativos.

### 9.2 Critérios de Aceitação em Gherkin (Dado / Quando / Então)
- **Cenário 1 (US02 — Agendamento com sucesso):**  
  *Dado* que a turma "Jiu-Jitsu Adulto" possui vagas disponíveis na data `2026-12-10`,  
  *Quando* o visitante envia `POST /api/v1/agendamentos` com nome, e-mail, telefone válidos e `turma_id=1`,  
  *Então* o sistema retorna `HTTP 201 Created`, persiste o registro com status `pendente` e devolve um protocolo único no formato `BJJ-XXXXXX`.
- **Cenário 2 (US02 — Bloqueio de duplicidade):**  
  *Dado* que o e-mail `marina@exemplo.com` já possui agendamento ativo na turma `2` para o dia `2026-12-11`,  
  *Quando* o mesmo e-mail tenta agendar novamente na mesma turma e data,  
  *Então* o sistema rejeita a requisição com `HTTP 409 Conflict`.
- **Cenário 3 (US05/US07 — Controle de Acesso por Papel RBAC):**  
  *Dado* um usuário autenticado com o papel `instrutor`,  
  *Quando* ele envia `PATCH /api/v1/agendamentos/{id}/status`, *Então* recebe `HTTP 200 OK`;  
  *Mas quando* ele tenta executar `DELETE /api/v1/agendamentos/{id}` ou `POST /api/v1/turmas`, *Então* o sistema bloqueia a operação com `HTTP 403 Forbidden`.

---

## Ficha 10 — Gate EP1: Revisão da Descoberta

- **Checklist do Gate EP1 (20/10):**
  - [x] Problema real e usuário identificável (Academia Behrend BJJ — Mestre Erick Behrend, instrutores e alunos visitantes).
  - [x] Hipóteses mapeadas e priorizadas por risco (H1 a H4).
  - [x] Backlog com 7 histórias INVEST estimadas e com critérios Gherkin + DoD.
  - [x] **Decisão do Gate EP1:** **GO** para início da construção do Incremento 1 (EP2).

---

# PARTE II — ENGENHARIA, ARQUITETURA, INCREMENTOS E VALIDAÇÃO (FICHAS 11 A 20 · EP2 A EP4)

## Ficha 11 — Hipóteses Priorizadas com Sinal Mensurável

Para atender com excelência ao **Critério 1**, cada hipótese priorizada possui métrica quantitativa/qualitativa e sinal claro de confirmação ou refutação:

| ID | Hipótese Priorizada | Métrica / Experimento | Sinal Mensurável de Sucesso (Critério de Validação) | Resultado Obtido |
| :-: | :--- | :--- | :--- | :-: |
| **H1** | Agendamento self-service com protocolo `BJJ-XXXXXX` sem exigir senha prévia para o visitante. | Teste de usabilidade cronometrado com 5 usuários (Ficha 18) + teste funcional E2E. | **100% dos usuários** concluem o agendamento em **menos de 60 segundos** e conseguem consultar o status pelo protocolo. | ✅ **Confirmada** (Média: 38s) |
| **H2** | Regra de capacidade máxima por turma/data e bloqueio de duplicidade no `AgendamentoService`. | Execução de testes automatizados de estresse de vagas (`test_regra_negocio_capacidade_maxima_turma` e `test_regra_negocio_bloqueio_agendamento_duplicado`). | **0% de overbooking**: toda tentativa acima de `capacidade_maxima` retorna `HTTP 422` e toda duplicidade retorna `HTTP 409`. | ✅ **Confirmada** (`pytest` verde) |
| **H3** | Controle de acesso RBAC (`admin`, `instrutor`, `aluno`) via dependência `require_roles` + token HMAC-SHA256. | Teste de intrusão automatizado (`test_owasp_a01_controle_de_acesso_por_papel_rbac`). | **100% das rotas restritas** retornam `401` sem token e `403` para papel inferior ao exigido. | ✅ **Confirmada** (`pytest` verde) |
| **H4** | Interceptação progressiva dos formulários `.contact form` em todas as 9 páginas institucionais. | Envio de formulário na Home e nas páginas de modalidades verificando registro em `GET /api/v1/contatos`. | **100% dos envios** retornam `HTTP 201 Created` e aparecem imediatamente no painel do instrutor. | ✅ **Confirmada** |

---

## Ficha 12 — Incremento 1 (EP2): Fluxo Mínimo, Persistência e Decisão Go/No-Go

### 12.1 Escopo Entregue no Incremento 1 (10/11)
- Estruturação da arquitetura em 4 camadas dentro do pacote [`backend/`](../backend/).
- Modelagem e criação automática do banco SQLite (`behrend_bjj.db`) com seed inicial das 6 turmas oficiais da Behrend BJJ.
- Implementação das rotas públicas do fluxo ponta a ponta: `GET /api/v1/health`, `GET /api/v1/turmas`, `POST /api/v1/agendamentos`, `GET /api/v1/agendamentos/consulta` e `POST /api/v1/contatos`.
- Criação da interface [`agendamento.html`](../agendamento.html) e integração de todos os formulários de contato em [`js/script.js`](../js/script.js).

### 12.2 Evidência e Decisão Go/No-Go do Incremento 1
- **Evidência:** Dados inseridos pela interface web foram consultados após reiniciar o processo Uvicorn, comprovando persistência real em disco no arquivo SQLite.
- **Bug identificado e corrigido no EP2:** O arquivo original `js/script.js` referenciava `searchForm` e `cartItem` sem declará-los com `document.querySelector`, lançando `ReferenceError` ao rolar a página. O erro foi corrigido com verificação defensiva (`if (searchForm)`).
- **Decisão Go/No-Go (EP2):** **GO** para o Incremento 2 (EP3), pois o fluxo mínimo ponta a ponta (Front-end ↔ API `/api/v1` ↔ Regras de Negócio ↔ SQLite) estava íntegro e persistente.

---

## Ficha 13 — Matriz de Rastreabilidade (Backlog ↔ Incrementos ↔ Código ↔ Testes)

Para atender ao **Critério 2**, toda história do backlog é rastreada até seu incremento, endpoint da API, arquivo de código e teste automatizado correspondente:

| ID História | Descrição Resumida | Incremento | Endpoint `/api/v1` | Camada de Serviço / Front-end | Teste Automatizado (`tests/test_api.py`) | Status |
| :-: | :--- | :-: | :--- | :--- | :--- | :-: |
| **US01** | Listar turmas e vagas disponíveis | EP2 (Inc 1) | `GET /api/v1/turmas` | `TurmaService.listar_turmas` / `agendamento.html` | `test_listar_turmas_publico` | ✅ Done |
| **US02** | Agendar aula experimental com regras de vaga e duplicidade | EP2 (Inc 1) | `POST /api/v1/agendamentos` | `AgendamentoService.criar_agendamento` / `agendamento.html` | `test_fluxo_completo_agendamento_experimental`, `test_regra_negocio_bloqueio_agendamento_duplicado`, `test_regra_negocio_capacidade_maxima_turma` | ✅ Done |
| **US03** | Consultar agendamento por protocolo ou e-mail | EP2 (Inc 1) | `GET /api/v1/agendamentos/consulta` | `AgendamentoService.consultar_publico` / `agendamento.html` | `test_fluxo_completo_agendamento_experimental` | ✅ Done |
| **US04** | Enviar mensagem de contato institucional | EP2 (Inc 1) | `POST /api/v1/contatos` | `ContatoService.registrar_mensagem` / `js/script.js` | `test_fluxo_mensagem_contato_e_leitura` | ✅ Done |
| **US05** | Autenticação com emissão de token por papel | EP3 (Inc 2) | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | `AuthService.authenticate`, `security.py` / `painel.html` | `test_owasp_a01_controle_de_acesso_por_papel_rbac`, `test_owasp_a07_rate_limiting_login` | ✅ Done |
| **US06** | Gestão operacional pelo Instrutor (confirmar aula, ler contato) | EP3 (Inc 2) | `GET /api/v1/agendamentos`, `PATCH .../status`, `PATCH /api/v1/contatos/{id}/lida` | `AgendamentoService.atualizar_status`, `ContatoService.marcar_como_lida` / `painel.html` | `test_fluxo_completo_agendamento_experimental`, `test_fluxo_mensagem_contato_e_leitura` | ✅ Done |
| **US07** | Gestão exclusiva do Admin (criar turma, excluir agendamento) | EP3 (Inc 2) | `POST /api/v1/turmas`, `DELETE /api/v1/agendamentos/{id}` | `require_roles("admin")` / `painel.html` | `test_owasp_a01_controle_de_acesso_por_papel_rbac` | ✅ Done |

---

## Ficha 14 — Arquitetura em Camadas e Modelo de Dados Relacional (DER)

### 14.1 Diagrama de Arquitetura em Camadas Implementada
Seguindo os padrões de Arquitetura em Camadas (Richards & Ford; Fowler), o sistema separa rigorosamente responsabilidades:

```mermaid
flowchart TD
    subgraph Camada_Apresentacao["1. Camada de Apresentação (UI & Controllers HTTP)"]
        UI["Front-end: index.html, agendamento.html, painel.html, js/script.js"]
        API["FastAPI Controllers: backend/main.py (/api/v1)"]
        SCH["Validação de Contratos e Sanitização XSS: backend/schemas.py"]
        SEC["Middleware OWASP & RBAC: backend/security.py"]
    end

    subgraph Camada_Negocio["2. Camada de Aplicação e Negócio"]
        SVC["Services: backend/services.py (AuthService, TurmaService, AgendamentoService, ContatoService)"]
    end

    subgraph Camada_Persistencia["3. Camada de Persistência e Dados"]
        REP["Repositories: backend/repositories.py (UserRepository, TurmaRepository, AgendamentoRepository, ContatoRepository)"]
        ORM["Modelos ORM SQLAlchemy: backend/models.py"]
        DB[("SQLite Persistente: behrend_bjj.db")]
    end

    UI -->|Fetch JSON / Bearer Token| SEC
    SEC --> API
    API --> SCH
    API --> SVC
    SVC --> REP
    REP --> ORM
    ORM --> DB
```

### 14.2 Diagrama Entidade-Relacionamento (DER) do Banco de Dados

```mermaid
erDiagram
    USERS {
        int id PK
        string nome
        string email UK
        string senha_hash
        string papel "admin | instrutor | aluno"
        boolean ativo
        datetime criado_em
    }

    TURMAS {
        int id PK
        string modalidade
        string publico
        string dias_semana
        string horario
        string instrutor
        int capacidade_maxima
        boolean ativa
    }

    AGENDAMENTOS_EXPERIMENTAIS {
        int id PK
        string protocolo UK "Ex: BJJ-A1B2C3"
        string nome_aluno
        string email
        string telefone
        int turma_id FK
        string data_aula "YYYY-MM-DD"
        string nivel_experiencia
        string status "pendente | confirmado | realizado | cancelado"
        text observacoes
        datetime criado_em
    }

    MENSAGENS_CONTATO {
        int id PK
        string nome
        string email
        string telefone
        text mensagem
        boolean lida
        string respondida_por
        datetime criado_em
    }

    TURMAS ||--o{ AGENDAMENTOS_EXPERIMENTAIS : "possui (1:N)"
```

---

## Ficha 15 — Contratos da API REST (`/api/v1`) e ADRs (001 a 004)

### 15.1 Catálogo de Endpoints Versionados (`/api/v1`)

| Método | Rota Versionada | Papel Exigido (RBAC) | Descrição e Códigos de Status HTTP |
| :-: | :--- | :-: | :--- |
| `GET` | `/api/v1/health` | Público | Verifica saúde da API e conexão com o SQLite (`200 OK`). |
| `POST` | `/api/v1/auth/login` | Público | Autentica e retorna token Bearer assinado (`200 OK`, `401 Unauthorized`, `429 Too Many Requests`). |
| `GET` | `/api/v1/auth/me` | Autenticado (`qualquer`) | Retorna perfil e papel do usuário logado (`200 OK`, `401 Unauthorized`). |
| `GET` | `/api/v1/turmas` | Público | Lista turmas ativas com cálculo de vagas disponíveis (`200 OK`). |
| `POST` | `/api/v1/turmas` | Restrito (`admin`) | Cadastra nova turma (`201 Created`, `401`, `403 Forbidden`). |
| `POST` | `/api/v1/agendamentos` | Público | Cria agendamento experimental e gera protocolo (`201 Created`, `404`, `409 Conflict`, `422 Unprocessable Entity`). |
| `GET` | `/api/v1/agendamentos/consulta` | Público | Consulta status por `protocolo` ou `email` (`200 OK`, `400 Bad Request`). |
| `GET` | `/api/v1/agendamentos` | Restrito (`admin`, `instrutor`) | Lista todos os agendamentos com filtros (`200 OK`, `401`, `403 Forbidden`). |
| `PATCH` | `/api/v1/agendamentos/{id}/status` | Restrito (`admin`, `instrutor`) | Atualiza status para `confirmado`, `realizado` ou `cancelado` (`200 OK`, `403`, `404`). |
| `DELETE` | `/api/v1/agendamentos/{id}` | Restrito (`admin`) | Exclui registro de agendamento (`204 No Content`, `403 Forbidden`, `404`). |
| `POST` | `/api/v1/contatos` | Público | Persiste mensagem de contato institucional (`201 Created`, `422`). |
| `GET` | `/api/v1/contatos` | Restrito (`admin`, `instrutor`) | Lista mensagens de contato recebidas (`200 OK`, `403`). |
| `PATCH` | `/api/v1/contatos/{id}/lida` | Restrito (`admin`, `instrutor`) | Marca mensagem como lida registrando o nome do responsável (`200 OK`, `403`, `404`). |

### 15.2 Síntese dos ADRs (Architecture Decision Records)
Os ADRs completos encontram-se na pasta [`docs/adr/`](adr/):

1. **[ADR-001 — Adoção do FastAPI e Versionamento `/api/v1`](adr/ADR-001-backend-fastapi-api-v1.md)**
   - *Contexto:* Necessidade de evoluir o site estático para uma API REST bem documentada, rápida e fortemente tipada.
   - *Alternativas avaliadas:* (A) FastAPI + Pydantic v2; (B) Flask tradicional; (C) Node.js/Express.
   - *Decisão:* **FastAPI** com prefixo `/api/v1`.
   - *Consequências:* (+) Validação automática de payload (HTTP 422), geração nativa de Swagger OpenAPI em `/docs` e alta testabilidade com `TestClient`; (-) Exige definição explícita de schemas Pydantic.
2. **[ADR-002 — Persistência Relacional com SQLAlchemy ORM e SQLite](adr/ADR-002-persistencia-sqlalchemy-sqlite.md)**
   - *Contexto:* Garantir persistência transacional após reinício e facilidade de reprodução por qualquer avaliador sem depender de servidor de banco externo.
   - *Alternativas avaliadas:* (A) SQLAlchemy + SQLite em arquivo/volume Docker; (B) PostgreSQL externo obrigatório; (C) Arquivos JSON locais.
   - *Decisão:* **SQLAlchemy 2.0 + SQLite (`behrend_bjj.db`)** configurável via `DATABASE_URL`.
   - *Consequências:* (+) Reprodutibilidade imediata (zero configuração externa), proteção nativa contra SQL Injection via consultas parametrizadas e possibilidade de usar `sqlite://` em memória no `pytest`; (-) Concorrência de escrita massiva limitada ao escopo de uma academia local (adequado ao MVP).
3. **[ADR-003 — Autenticação Stateless HMAC-SHA256, Hashing PBKDF2 e RBAC](adr/ADR-003-autenticacao-rbac-tokens.md)**
   - *Contexto:* Implementar controle de acesso por papel (EP3) e armazenamento seguro de senhas sem depender de bibliotecas C externas que falham entre diferentes sistemas operacionais.
   - *Alternativas avaliadas:* (A) PBKDF2-HMAC-SHA256 nativo (`hashlib`/`hmac`) + Token Bearer assinado + dependência `require_roles`; (B) Sessões em cookies de servidor; (C) OAuth2 externo (Auth0/Firebase).
   - *Decisão:* **PBKDF2-HMAC-SHA256 (120.000 iterações + salt aleatório) e Token Bearer JWT-compatível assinado com HMAC-SHA256**.
   - *Consequências:* (+) Portabilidade 100% garantida em Windows/Linux/Docker, verificação em tempo constante (`hmac.compare_digest`) e RBAC declarativo por rota (`admin`, `instrutor`, `aluno`); (-) Revogação antes da expiração depende da troca de chave ou inativação do usuário no banco.
4. **[ADR-004 — Front-end Integrado em HTML5/CSS3/Vanilla JS Servido pelo Back-end](adr/ADR-004-frontend-integrado-vanilla-js.md)**
   - *Contexto:* Preservar o patrimônio visual construído pela equipe no Ciclo 1 (9 páginas HTML e identidade Behrend BJJ) e eliminar problemas de CORS/deploy separado.
   - *Alternativas avaliadas:* (A) Evoluir o Front-end existente com Vanilla JS (`fetch`) servido diretamente pelo FastAPI na porta `8000`; (B) Reescrever tudo em React SPA separado.
   - *Decisão:* **Front-end integrado servido pelo FastAPI + aprimoramento progressivo em `js/script.js`**.
   - *Consequências:* (+) Um único comando (`uvicorn` ou `docker compose up`) sobe Front-end e Back-end juntos; preserva 100% das páginas de modalidades existentes.

---

## Ficha 16 — Incremento 2 (EP3): Controle de Acesso por Papel (RBAC) e Suíte Pytest

### 16.1 Escopo Entregue no Incremento 2 (24/11)
- Implementação de 3 papéis distintos no modelo `User`:
  - `admin` (`admin@behrendbjj.com` / `Admin@2026`): Acesso total, incluindo criação de turmas (`POST /api/v1/turmas`) e exclusão física de agendamentos (`DELETE /api/v1/agendamentos/{id}`).
  - `instrutor` (`instrutor@behrendbjj.com` / `Instrutor@2026`): Acesso operacional ao painel (`GET /api/v1/agendamentos`, `PATCH /api/v1/agendamentos/{id}/status`, `GET` e `PATCH /api/v1/contatos`). Recebe `403 Forbidden` se tentar excluir agendamentos ou criar turmas.
  - `aluno` (`aluno@behrendbjj.com` / `Aluno@2026`): Autentica-se, mas recebe `403 Forbidden` ao tentar acessar listagens administrativas ou operacionais.
- Construção da página [`painel.html`](../painel.html) com botões de preenchimento rápido dos 3 papéis para demonstração imediata em banca.
- Criação da suíte automatizada [`tests/test_api.py`](../tests/test_api.py) com 8 testes cobrindo saúde, listagem, fluxo completo de agendamento, bloqueio de duplicidade, limite de vagas, contatos, RBAC e OWASP.

---

## Ficha 17 — Segurança OWASP Top 10 (Antes/Depois) e Decisão Go/No-Go Final

O detalhamento completo com trechos de código encontra-se em [`docs/seguranca_owasp_antes_depois.md`](seguranca_owasp_antes_depois.md). Abaixo está o resumo executivo das vulnerabilidades tratadas:

| Categoria OWASP Top 10 (2021) | Como era ANTES (Vulnerável / Ciclo 1) | Como ficou DEPOIS (Mitigado no MVP v1.0) | Evidência no Código e Teste |
| :--- | :--- | :--- | :--- |
| **A01:2021 — Broken Access Control** | Rotas administrativas sem verificação de papel ou arquivos servidos sem lista de permissão (risco de Path Traversal). | Dependência `require_roles("admin", "instrutor")` validando token assinado em cada rota + `allowed_files` estrito na rota de arquivos estáticos. | [`backend/security.py`](../backend/security.py) / `test_owasp_a01_controle_de_acesso_por_papel_rbac` |
| **A02:2021 — Cryptographic Failures** | Senhas comparadas em texto puro ou hashes simples sem salt. | Hashing **PBKDF2-HMAC-SHA256** com 120.000 iterações, salt aleatório de 16 bytes e comparação em tempo constante via `hmac.compare_digest`. | [`backend/security.py`](../backend/security.py) (`hash_password`, `verify_password`) |
| **A03:2021 — Injection (SQLi & Stored XSS)** | Concatenação direta de strings e armazenamento de HTML cru enviado em campos de formulário (`<script>alert(1)</script>`). | Consultas 100% parametrizadas via SQLAlchemy ORM + função `sanitize_text()` com `html.escape()` nos validadores Pydantic antes de gravar no banco. | [`backend/schemas.py`](../backend/schemas.py) / `test_owasp_a03_sanitizacao_xss_e_prevencao_sqli` |
| **A05:2021 — Security Misconfiguration** | Respostas HTTP sem cabeçalhos de proteção contra MIME-sniffing ou Clickjacking; CORS aberto (`*`). | Middleware `add_owasp_security_headers` injetando `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` e CORS restrito. | [`backend/main.py`](../backend/main.py) / `test_health_check_and_security_headers` |
| **A07:2021 — Identification & Auth Failures** | Endpoint de login sem limite de tentativas, permitindo ataque de força bruta automatizado. | Rate Limiter por IP (`check_rate_limit`) bloqueando excesso de tentativas com `HTTP 429 Too Many Requests`. | [`backend/security.py`](../backend/security.py) / `test_owasp_a07_rate_limiting_login` |

- **Decisão Go/No-Go Final (EP4):** **GO para Release `v1.0`** — Suíte de testes 100% verde e todos os 5 riscos críticos do OWASP Top 10 mitigados e verificados por testes automatizados.

---

## Ficha 18 — Validação com Usuários Reais e Mudanças no Backlog

Realizamos sessões de validação do protótipo funcional com **3 perfis reais de usuários** (2 alunos praticantes/visitantes e 1 instrutor de tatame) e transformamos cada achado em mudança concreta implementada no backlog antes da release `v1.0`:

| # | Perfil Avaliador | Achado durante o Teste com Usuário (Dor/Dificuldade Observada) | Mudança Gerada no Backlog e Implementada no MVP `v1.0` |
| :-: | :--- | :--- | :--- |
| **1** | **Visitante Iniciante** (21 anos) | *"Agendei a aula, mas fechei a aba sem anotar o número do protocolo `BJJ-...` e fiquei sem saber como consultar se o professor confirmou."* | **Mudança na US03 (`GET /api/v1/agendamentos/consulta`):** Passamos a permitir a consulta pública tanto pelo **código do protocolo** quanto pelo **e-mail** informado no agendamento. |
| **2** | **Visitante Iniciante** (28 anos) | *"Queria avisar que não tenho kimono próprio para a primeira aula de Jiu-Jitsu, mas não havia campo para isso."* | **Mudança na US02 (`agendamento.html`):** Adicionado o campo `nivel_experiencia` (*Iniciante/Intermediário/Avançado*) e o campo `observacoes` com placeholder explícito: *"Precisa de kimono emprestado? Alguma restrição física?"*. |
| **3** | **Instrutor de Tatame** | *"Nas páginas de modalidades (Judô, Muay Thai, etc.), o formulário de contato no rodapé só pedia nome, e-mail e telefone, sem espaço para a pessoa escrever qual era a dúvida."* | **Mudança na US04 (`js/script.js`):** O script agora injeta automaticamente o campo `mensagem` em todos os formulários `.contact form` das 9 páginas do site e exibe a confirmação `✅ Mensagem #ID registrada` sem recarregar a tela. |

---

## Ficha 19 — Guia de Reprodutibilidade do Zero (`venv` e Docker Compose)

Este guia garante que **qualquer outra equipe ou avaliador reproduza o sistema do zero, sozinho**, em menos de 2 minutos (Critério 6).

### Opção A — Reprodução via Python `venv` (Windows PowerShell / Linux / macOS)

```bash
# 1. Clonar o repositório e acessar a pasta na tag v1.0
git clone https://github.com/gab8485/Behrend-Bjj.git
cd Behrend-Bjj
git checkout v1.0

# 2. Criar e ativar o ambiente virtual Python (3.10+)
python -m venv .venv
# No Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# No Linux/macOS:
# source .venv/bin/activate

# 3. Instalar as dependências fixadas
pip install -r requirements.txt

# 4. Executar a suíte de testes automatizados (Critério 8)
pytest

# 5. Iniciar o servidor Full Stack (API /api/v1 + Front-end)
uvicorn backend.main:app --reload --port 8000
```

### Opção B — Reprodução via Docker Compose (1 Comando)

```bash
docker compose up --build
```

### Endereços para Verificação Imediata após Subir
- **Site Institucional Integrado:** `http://localhost:8000/`
- **Agendamento de Aula Experimental:** `http://localhost:8000/agendamento.html`
- **Painel de Gestão RBAC (Admin / Instrutor / Aluno):** `http://localhost:8000/painel.html`
- **Documentação Interativa OpenAPI (Swagger UI):** `http://localhost:8000/docs`
- **Healthcheck da API:** `http://localhost:8000/api/v1/health`

### Credenciais Pré-Cadastradas (Seed Automático) para Teste de RBAC
| Papel | E-mail | Senha | Permissões no Sistema |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin@behrendbjj.com` | `Admin@2026` | Acesso total: listar, confirmar/cancelar aulas, **excluir agendamentos** e **criar novas turmas**. |
| **`instrutor`** | `instrutor@behrendbjj.com` | `Instrutor@2026` | Acesso operacional: listar e confirmar/cancelar aulas, ler contatos. Recebe `403 Forbidden` ao tentar excluir ou criar turma. |
| **`aluno`** | `aluno@behrendbjj.com` | `Aluno@2026` | Recebe `403 Forbidden` ao tentar acessar os endpoints restritos do painel. |

---

## Ficha 20 — Roteiro do Demo Day, Retrospectiva e Arguição com Autor e Obra

### 20.1 Roteiro Cronometrado da Defesa Final (15 a 20 minutos — Slide 12)

| Etapa | Tempo | Responsável Sugerido | O que apresentar ao vivo |
| :--- | :-: | :--- | :--- |
| **1. Problema e Usuário** | 3 min | Gabriel Gonçalves | Apresentar a dor real da academia Behrend BJJ (perda de leads noturnos no WhatsApp, formulário estático sem persistência e falta de controle de vagas no tatame) e a Hipótese H1. |
| **2. A Jornada e o Book** | 3 min | Gabriel Pereira | Mostrar a evolução das Fichas 1 a 20, as decisões Go/No-Go nos incrementos EP2 e EP3 e como a validação com usuários (Ficha 18) gerou a busca por e-mail e o campo de empréstimo de kimono. |
| **3. Demonstração ao Vivo** | 5 min | Edric | 1) Abrir `agendamento.html` e agendar uma aula experimental gerando protocolo `BJJ-...`;<br>2) Tentar agendar duplicado e mostrar o bloqueio `HTTP 409`;<br>3) Abrir `painel.html`, logar como `aluno` (mostrar `403 Forbidden`), depois como `instrutor` (confirmar a aula) e tentar excluir (mostrar `403`), e por fim como `admin` (criar turma / excluir);<br>4) Rodar `pytest` no terminal mostrando todos os testes verdes. |
| **4. Reprodução** | 2 min | Equipe | Mostrar o `Dockerfile`, `docker-compose.yml` e o passo a passo da Ficha 19 / `README.md`. |
| **5. Arguição Individual** | 5 min | Todos os integrantes | Respostas fundamentadas citando **Autor e Obra** conforme tabela abaixo. |

### 20.2 Guia de Fundamentação Teórica (Autor e Obra) para a Arguição Individual (Critério 10)

Para garantir nota máxima (Excelente: 8 a 10) no **Critério 10 (*"Todos defendem qualquer parte, citando autor e obra"*)**, cada decisão técnica do projeto está ancorada em literatura clássica de Engenharia de Software:

| Tema da Pergunta na Banca | Autor(es) e Obra de Referência | Como conectar a obra ao código da Behrend BJJ |
| :--- | :--- | :--- |
| **Por que vocês dividiram o back-end em `main.py`, `services.py`, `repositories.py` e `models.py`?** | **FOWLER, Martin.** *Patterns of Enterprise Application Architecture* (2002) & **MARTIN, Robert C.** *Clean Architecture* (2017). | Segundo Fowler (2002) e Martin (2017), a separação entre Apresentação (Controllers FastAPI), Domínio/Serviço (`AgendamentoService`) e Persistência (`AgendamentoRepository`) reduz o acoplamento e permite testar regras de negócio (como o limite de vagas da turma) isoladamente da infraestrutura. |
| **Como vocês definiram as rotas `/api/v1/turmas` e `/api/v1/agendamentos` e os verbos HTTP?** | **FIELDING, Roy Thomas.** *Architectural Styles and the Design of Network-based Software Architectures* (Tese de Doutorado, UC Irvine, 2000). | Aplicamos as restrições do estilo arquitetural **REST** definido por Fielding (2000): identificação de recursos por substantivos no plural (`/turmas`, `/agendamentos`), manipulação via verbos HTTP semânticos (`GET`, `POST`, `PATCH`, `DELETE`), comunicação *stateless* via token Bearer e códigos de status padronizados (`201`, `204`, `403`, `409`, `422`). |
| **Por que priorizar hipóteses (Fichas 8 e 11) e entregar em incrementos curtos (EP1 a EP4)?** | **RIES, Eric.** *A Startup Enxuta (The Lean Startup)* (2011) & **PRESSMAN, Roger S.; MAXIM, Bruce R.** *Engenharia de Software: Uma Abordagem Profissional* (9ª ed., 2021). | De acordo com Ries (2011), o ciclo *Construir-Medir-Aprender* exige validar hipóteses arriscadas com sinais mensuráveis antes de expandir o sistema. Já Pressman e Maxim (2021) destacam que o processo incremental reduz o risco de integração tardia ao entregar software operacional a cada marco. |
| **Como vocês escreveram e validaram as histórias de usuário e critérios de aceitação?** | **COHN, Mike.** *User Stories Applied: For Agile Software Development* (2004) & **SOMMERVILLE, Ian.** *Engenharia de Software* (10ª ed., 2019). | Seguimos os critérios **INVEST** sistematizados por Cohn (2004) e especificamos requisitos testáveis no formato *Dado/Quando/Então* (BDD), garantindo rastreabilidade direta até os testes automatizados em `tests/test_api.py`, conforme preconizado por Sommerville (2019). |
| **Como vocês trataram a segurança e o controle de acesso por papel (RBAC)?** | **OWASP Foundation.** *OWASP Top 10:2021* (2021) & **SALTZER, Jerome H.; SCHROEDER, Michael D.** *The Protection of Information in Computer Systems* (IEEE, 1975). | Aplicamos o **Princípio do Menor Privilégio** de Saltzer e Schroeder (1975) por meio de RBAC (`require_roles`), garantindo que o papel `instrutor` opere o tatame mas não execute exclusões administrativas, além de mitigar as categorias A01, A02, A03, A05 e A07 do *OWASP Top 10* (2021). |

### 20.3 Retrospectiva da Equipe
- **O que funcionou muito bem:** Evoluir o site real da academia Behrend BJJ mantendo sua identidade visual enquanto adicionamos uma API FastAPI `/api/v1` limpa, banco SQLite com seed automático e painel RBAC com troca rápida de perfil para demonstração.
- **O que aprendemos:** A importância de corrigir erros silenciosos no front-end legado (como variáveis globais não declaradas em `js/script.js`), o valor de testes automatizados (`pytest`) para provar regras de negócio (`409 Conflict` e `422 Unprocessable Entity`) e como o Book estruturado permite reconstruir e defender cada decisão arquitetural com segurança.
