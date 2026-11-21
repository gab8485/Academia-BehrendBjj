"""Testes automatizados (Pytest): fluxo ponta a ponta, regras de negócio, RBAC e segurança OWASP."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app
from backend.security import reset_rate_limiter
from backend.services import seed_initial_data

# Banco SQLite em memória isolado para a suíte de testes
SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    """Recria o esquema, popula dados iniciais (seed) e limpa rate limiter antes de cada teste."""
    reset_rate_limiter()
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


@pytest.fixture()
def client():
    return TestClient(app)


def obter_token(client: TestClient, email: str, senha: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "senha": senha})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# ==============================================================================
# 1. TESTES DE SAÚDE, INFRAESTRUTURA E SEED INICIAL
# ==============================================================================


def test_health_check_and_security_headers(client: TestClient):
    """Verifica se o endpoint /api/v1/health responde 200 e inclui cabeçalhos OWASP A05."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["api"] == "/api/v1"
    assert body["turmas_ativas"] >= 5
    # Verificação de cabeçalhos de segurança HTTP (OWASP A05)
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert "strict-origin-when-cross-origin" in response.headers["Referrer-Policy"]


def test_listar_turmas_publico(client: TestClient):
    """Garante que visitantes podem consultar as modalidades e vagas disponíveis."""
    response = client.get("/api/v1/turmas")
    assert response.status_code == 200
    turmas = response.json()
    assert len(turmas) == 6
    assert turmas[0]["modalidade"] == "Jiu-Jitsu Adulto"
    assert turmas[0]["vagas_disponiveis"] == turmas[0]["capacidade_maxima"]


# ==============================================================================
# 2. TESTES DE FLUXO PONTA A PONTA E REGRAS DE NEGÓCIO (AGENDAMENTO E CONTATO)
# ==============================================================================


def test_fluxo_completo_agendamento_experimental(client: TestClient):
    """Testa criação, persistência, consulta por protocolo e atualização de status."""
    payload = {
        "nome_aluno": "Carlos Gracie Jr",
        "email": "carlos.teste@exemplo.com",
        "telefone": "(61) 99999-1234",
        "turma_id": 1,
        "data_aula": "2026-12-10",
        "nivel_experiencia": "Iniciante",
        "observacoes": "Primeira aula experimental de Jiu-Jitsu",
    }
    resp_create = client.post("/api/v1/agendamentos", json=payload)
    assert resp_create.status_code == 201
    criado = resp_create.json()
    assert criado["protocolo"].startswith("BJJ-")
    assert criado["status"] == "pendente"
    assert criado["modalidade_turma"] == "Jiu-Jitsu Adulto"

    # Consulta pública pelo protocolo gerado
    resp_consulta = client.get(
        "/api/v1/agendamentos/consulta", params={"protocolo": criado["protocolo"]}
    )
    assert resp_consulta.status_code == 200
    encontrados = resp_consulta.json()
    assert len(encontrados) == 1
    assert encontrados[0]["email"] == "carlos.teste@exemplo.com"

    # Instrutor autenticado confirma o agendamento
    token_instrutor = obter_token(client, "instrutor@behrendbjj.com", "Instrutor@2026")
    resp_patch = client.patch(
        f"/api/v1/agendamentos/{criado['id']}/status",
        json={"status": "confirmado"},
        headers={"Authorization": f"Bearer {token_instrutor}"},
    )
    assert resp_patch.status_code == 200
    assert resp_patch.json()["status"] == "confirmado"


def test_regra_negocio_bloqueio_agendamento_duplicado(client: TestClient):
    """Impede que o mesmo e-mail agende duas vezes na mesma turma e data (HTTP 409)."""
    payload = {
        "nome_aluno": "Marina Silva",
        "email": "marina@exemplo.com",
        "telefone": "(61) 98888-0000",
        "turma_id": 2,
        "data_aula": "2026-12-11",
        "nivel_experiencia": "Iniciante",
    }
    r1 = client.post("/api/v1/agendamentos", json=payload)
    assert r1.status_code == 201

    r2 = client.post("/api/v1/agendamentos", json=payload)
    assert r2.status_code == 409
    assert "Já existe um agendamento ativo" in r2.json()["detail"]


def test_regra_negocio_capacidade_maxima_turma(client: TestClient):
    """Impede novos agendamentos quando a capacidade máxima da turma é atingida (HTTP 422)."""
    token_admin = obter_token(client, "admin@behrendbjj.com", "Admin@2026")
    resp_turma = client.post(
        "/api/v1/turmas",
        json={
            "modalidade": "Treino Especial Particular",
            "publico": "Adulto",
            "dias_semana": "Sábado",
            "horario": "10:00 - 11:00",
            "instrutor": "Mestre Erick Behrend",
            "capacidade_maxima": 1,
        },
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert resp_turma.status_code == 201
    turma_id = resp_turma.json()["id"]

    # Primeiro aluno ocupa a única vaga
    r1 = client.post(
        "/api/v1/agendamentos",
        json={
            "nome_aluno": "Aluno Um",
            "email": "aluno1@exemplo.com",
            "telefone": "61991112222",
            "turma_id": turma_id,
            "data_aula": "2026-12-12",
            "nivel_experiencia": "Intermediário",
        },
    )
    assert r1.status_code == 201

    # Segundo aluno na mesma data deve receber 422 Unprocessable Entity
    r2 = client.post(
        "/api/v1/agendamentos",
        json={
            "nome_aluno": "Aluno Dois",
            "email": "aluno2@exemplo.com",
            "telefone": "61993334444",
            "turma_id": turma_id,
            "data_aula": "2026-12-12",
            "nivel_experiencia": "Iniciante",
        },
    )
    assert r2.status_code == 422
    assert "Limite de vagas experimentais atingido" in r2.json()["detail"]


def test_fluxo_mensagem_contato_e_leitura(client: TestClient):
    """Testa envio de formulário de contato público e marcação de leitura pelo instrutor."""
    resp = client.post(
        "/api/v1/contatos",
        json={
            "nome": "Rafael Souza",
            "email": "rafael@exemplo.com",
            "telefone": "(61) 97777-5555",
            "mensagem": "Gostaria de saber valores do plano trimestral de Muay Thai.",
        },
    )
    assert resp.status_code == 201
    contato_id = resp.json()["id"]
    assert resp.json()["lida"] is False

    token_instrutor = obter_token(client, "instrutor@behrendbjj.com", "Instrutor@2026")
    resp_lida = client.patch(
        f"/api/v1/contatos/{contato_id}/lida",
        headers={"Authorization": f"Bearer {token_instrutor}"},
    )
    assert resp_lida.status_code == 200
    assert resp_lida.json()["lida"] is True
    assert "Instrutor Gabriel" in resp_lida.json()["respondida_por"]


# ==============================================================================
# 3. TESTES DE SEGURANÇA: RBAC (OWASP A01), XSS/SQLi (OWASP A03) E RATE LIMIT (A07)
# ==============================================================================


def test_owasp_a01_controle_de_acesso_por_papel_rbac(client: TestClient):
    """Garante que rotas restritas bloqueiam anônimos (401), alunos (403) e instrutores em ações de admin (403)."""
    # 1. Sem token -> 401 Unauthorized
    r_anon = client.get("/api/v1/agendamentos")
    assert r_anon.status_code == 401

    # 2. Com token de 'aluno' -> 403 Forbidden ao tentar acessar painel de agendamentos
    token_aluno = obter_token(client, "aluno@behrendbjj.com", "Aluno@2026")
    r_aluno = client.get(
        "/api/v1/agendamentos", headers={"Authorization": f"Bearer {token_aluno}"}
    )
    assert r_aluno.status_code == 403

    # 3. Criar agendamento para testar permissão de exclusão (DELETE exclusivo de 'admin')
    ag = client.post(
        "/api/v1/agendamentos",
        json={
            "nome_aluno": "Teste RBAC",
            "email": "rbac@exemplo.com",
            "telefone": "61988887777",
            "turma_id": 1,
            "data_aula": "2026-12-14",
            "nivel_experiencia": "Iniciante",
        },
    ).json()

    # Instrutor pode listar (200), mas NÃO pode excluir (403)
    token_instrutor = obter_token(client, "instrutor@behrendbjj.com", "Instrutor@2026")
    r_inst_list = client.get(
        "/api/v1/agendamentos", headers={"Authorization": f"Bearer {token_instrutor}"}
    )
    assert r_inst_list.status_code == 200

    r_inst_del = client.delete(
        f"/api/v1/agendamentos/{ag['id']}",
        headers={"Authorization": f"Bearer {token_instrutor}"},
    )
    assert r_inst_del.status_code == 403

    # Admin pode excluir (204)
    token_admin = obter_token(client, "admin@behrendbjj.com", "Admin@2026")
    r_admin_del = client.delete(
        f"/api/v1/agendamentos/{ag['id']}",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert r_admin_del.status_code == 204


def test_owasp_a03_sanitizacao_xss_e_prevencao_sqli(client: TestClient):
    """Verifica se scripts maliciosos são escapados (XSS) e payloads SQLi não quebram consultas."""
    xss_payload = {
        "nome_aluno": "<script>alert('xss')</script>João",
        "email": "joao.xss@exemplo.com",
        "telefone": "(61) 91234-5678",
        "turma_id": 1,
        "data_aula": "2026-12-15",
        "nivel_experiencia": "Iniciante",
        "observacoes": "<img src=x onerror=alert(1)>",
    }
    resp = client.post("/api/v1/agendamentos", json=xss_payload)
    assert resp.status_code == 201
    dados = resp.json()
    assert "<script>" not in dados["nome_aluno"]
    assert "&lt;script&gt;" in dados["nome_aluno"]
    assert "<img" not in dados["observacoes"]

    # Tentativa de SQL Injection na consulta pública por protocolo
    sqli_resp = client.get(
        "/api/v1/agendamentos/consulta",
        params={"protocolo": "' OR '1'='1' --"},
    )
    assert sqli_resp.status_code == 200
    assert sqli_resp.json() == []


def test_owasp_a07_rate_limiting_login(client: TestClient):
    """Verifica bloqueio HTTP 429 após múltiplas tentativas seguidas de login (força bruta)."""
    for _ in range(10):
        r = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@behrendbjj.com", "senha": "SenhaErrada123"},
        )
        assert r.status_code == 401

    # A 11ª tentativa dentro da janela de 60s deve retornar 429 Too Many Requests
    r_bloqueado = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@behrendbjj.com", "senha": "SenhaErrada123"},
    )
    assert r_bloqueado.status_code == 429
