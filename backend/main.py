"""Aplicação principal FastAPI: API REST versionada (/api/v1), cabeçalhos OWASP e servidor Front-end."""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import Base, SessionLocal, engine, get_db
from backend.models import User
from backend.schemas import (
    AgendamentoCreate,
    AgendamentoResponse,
    AgendamentoStatusUpdate,
    ContatoCreate,
    ContatoResponse,
    LoginRequest,
    TokenResponse,
    TurmaCreate,
    TurmaResponse,
    UserResponse,
)
from backend.security import (
    check_rate_limit,
    get_current_user,
     hash_password,
    require_roles,
     verify_password,
)
from backend.services import (
    AgendamentoService,
    AuthService,
    ContatoService,
    TurmaService,
    seed_initial_data,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa esquema do banco de dados SQLite e garante dados iniciais (seed)."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Behrend BJJ — Plataforma de Agendamento e Gestão",
    description=(
        "API REST versionada (/api/v1) do Projeto Integrador CEUB (2026/2). "
        "Integra agendamento de aulas experimentais, gestão de contatos e controle de acesso por papel (RBAC)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
      allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:5501",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_owasp_security_headers(request: Request, call_next):
    """Mitigação OWASP A05 (Security Misconfiguration): adiciona cabeçalhos HTTP defensivos."""
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# ==============================================================================
# ROTAS DA API REST VERSIONADA (/api/v1)
# ==============================================================================


@app.get("/api/v1/health", tags=["Infraestrutura"])
def health_check(db: Session = Depends(get_db)):
    """Verifica saúde da aplicação e conectividade com o banco SQLite."""
    turmas = TurmaService.listar_turmas(db)
    return {
        "status": "ok",
        "version": "1.0.0",
        "api": "/api/v1",
        "database": "connected",
        "turmas_ativas": len(turmas),
    }


@app.post("/api/v1/auth/login", response_model=TokenResponse, tags=["Autenticação & RBAC"])
def login(dados: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Autentica usuário e emite token assinado contendo o papel (admin, instrutor, aluno)."""
    client_ip = request.client.host if request.client else "local"
    check_rate_limit(f"login:{client_ip}", max_requests=10, window_seconds=60)
    token, user = AuthService.authenticate(db, dados.email, dados.senha)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        usuario=UserResponse.model_validate(user),
    )


@app.get("/api/v1/auth/me", response_model=UserResponse, tags=["Autenticação & RBAC"])
def me(current_user: User = Depends(get_current_user)):

    """Retorna os dados e o papel do usuário autenticado."""
    return UserResponse.model_validate(current_user)




class AlterarContaRequest(BaseModel):
    senha_atual: str = Field(min_length=1, max_length=256)
    novo_email: EmailStr | None = None
    nova_senha: str | None = Field(default=None, min_length=12, max_length=256)


@app.patch("/api/v1/auth/me", tags=["Autenticação & RBAC"])
def alterar_conta(
    dados: AlterarContaRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_rate_limit(
        f"alterar-conta:{current_user.id}",
        max_requests=5,
        window_seconds=60,
    )

    if not verify_password(dados.senha_atual, current_user.senha_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")

    if dados.novo_email is None and dados.nova_senha is None:
        raise HTTPException(status_code=400, detail="Informe um novo e-mail ou uma nova senha.")

    usuario = db.get(User, current_user.id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")

    if dados.novo_email is not None:
        usuario.email = str(dados.novo_email).lower()

    if dados.nova_senha is not None:
        usuario.senha_hash = hash_password(dados.nova_senha)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Esse e-mail já está em uso.")

 

from backend.security import hash_password, verify_password

@app.get("/api/v1/turmas", response_model=List[TurmaResponse], tags=["Turmas e Horários"])
def listar_turmas(db: Session = Depends(get_db)):
    """Lista todas as turmas ativas e a quantidade de vagas disponíveis."""
    return TurmaService.listar_turmas(db)


@app.post(
    "/api/v1/turmas",
    response_model=TurmaResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Turmas e Horários"],
)
def criar_turma(
    dados: TurmaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Cria uma nova turma (Restrito exclusivamente ao papel 'admin')."""
    return TurmaService.criar_turma(db, dados)


@app.post(
    "/api/v1/agendamentos",
    response_model=AgendamentoResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Agendamentos Experimentais"],
)
def criar_agendamento(
    dados: AgendamentoCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Registra um novo agendamento de aula experimental validando vagas e duplicidade."""
    client_ip = request.client.host if request.client else "local"
    check_rate_limit(f"agendamento:{client_ip}", max_requests=15, window_seconds=60)
    return AgendamentoService.criar_agendamento(db, dados)


@app.get(
    "/api/v1/agendamentos/consulta",
    response_model=List[AgendamentoResponse],
    tags=["Agendamentos Experimentais"],
)
def consultar_agendamento(
    protocolo: Optional[str] = Query(default=None, description="Protocolo ex: BJJ-A1B2C3"),
    email: Optional[str] = Query(default=None, description="E-mail utilizado no agendamento"),
    db: Session = Depends(get_db),
):
    """Consulta pública de status do agendamento por protocolo ou e-mail do aluno."""
    return AgendamentoService.consultar_publico(db, protocolo=protocolo, email=email)


@app.get(
    "/api/v1/agendamentos",
    response_model=List[AgendamentoResponse],
    tags=["Agendamentos Experimentais"],
)
def listar_todos_agendamentos(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    modalidade: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "instrutor")),
):
    """Lista todos os agendamentos (Restrito aos papéis 'admin' e 'instrutor')."""
    return AgendamentoService.listar_todos(db, status_filter=status_filter, modalidade=modalidade)


@app.patch(
    "/api/v1/agendamentos/{agendamento_id}/status",
    response_model=AgendamentoResponse,
    tags=["Agendamentos Experimentais"],
)
def atualizar_status_agendamento(
    agendamento_id: int,
    dados: AgendamentoStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "instrutor")),
):
    """Confirma, marca como realizado ou cancela um agendamento (Restrito a 'admin' e 'instrutor')."""
    return AgendamentoService.atualizar_status(db, agendamento_id, dados.status)


@app.delete(
    "/api/v1/agendamentos/{agendamento_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Agendamentos Experimentais"],
)
def excluir_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Remove um agendamento do banco (Restrito exclusivamente ao papel 'admin')."""
    AgendamentoService.remover_agendamento(db, agendamento_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post(
    "/api/v1/contatos",
    response_model=ContatoResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Mensagens de Contato"],
)
def enviar_contato(
    dados: ContatoCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Recebe e persiste mensagens enviadas pelos formulários de contato do site."""
    client_ip = request.client.host if request.client else "local"
    check_rate_limit(f"contato:{client_ip}", max_requests=15, window_seconds=60)
    return ContatoService.registrar_mensagem(db, dados)


@app.get(
    "/api/v1/contatos",
    response_model=List[ContatoResponse],
    tags=["Mensagens de Contato"],
)
def listar_contatos(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "instrutor")),
):
    """Lista todas as mensagens de contato recebidas (Restrito a 'admin' e 'instrutor')."""
    return ContatoService.listar_mensagens(db)


@app.patch(
    "/api/v1/contatos/{contato_id}/lida",
    response_model=ContatoResponse,
    tags=["Mensagens de Contato"],
)
def marcar_contato_como_lido(
    contato_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "instrutor")),
):
    """Marca uma mensagem de contato como lida/respondida pelo instrutor ou admin."""
    return ContatoService.marcar_como_lida(db, contato_id, current_user.nome)


# ==============================================================================
# SERVIDOR DE ARQUIVOS ESTÁTICOS DO FRONT-END
# ==============================================================================

if (PROJECT_ROOT / "img").exists():
    app.mount("/img", StaticFiles(directory=str(PROJECT_ROOT / "img")), name="img")

if (PROJECT_ROOT / "js").exists():
    app.mount("/js", StaticFiles(directory=str(PROJECT_ROOT / "js")), name="js")


@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse(PROJECT_ROOT / "index.html")


@app.get("/{filename}", include_in_schema=False)
def serve_static_pages(filename: str):
    """Serve páginas HTML e CSS da raiz com proteção contra Path Traversal (OWASP A01)."""
    allowed_files = {
        "index.html",
        "sobre.html",
        "horarios.html",
        "endereço.html",
        "endereco.html",
        "jiujitsuadulto.html",
        "jiujitsuinfantil.html",
        "judoadulto.html",
        "judoinfantil.html",
        "muaythay.html",
        "agendamento.html",
        "painel.html",
        "style.css",
    }
    if filename == "endereco.html" and (PROJECT_ROOT / "endereço.html").exists():
        return FileResponse(PROJECT_ROOT / "endereço.html")
    if filename in allowed_files and (PROJECT_ROOT / filename).is_file():
        return FileResponse(PROJECT_ROOT / filename)
    return Response(status_code=status.HTTP_404_NOT_FOUND, content="Página não encontrada.")
