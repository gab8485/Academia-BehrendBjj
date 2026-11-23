"""Confirmações de presença na grade semanal da academia."""
from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import Base, get_db
from backend.models import User
from backend.security import hash_password, require_roles

router = APIRouter(prefix="/api/v1", tags=["Confirmação de aulas"])

SEG_QUA = (
    ("adulto", "06:15", "Gi"), ("adulto", "10:15", "NoGi"),
    ("adulto", "12:15", "Gi"), ("adulto", "17:30", "NoGi"),
    ("adulto", "19:30", "Gi"), ("adulto", "21:00", "Gi"),
    ("infantil", "09:00", "Gi"), ("infantil", "16:30", "Gi"),
    ("infantil", "18:30", "Gi"),
)
TER_QUI = (
    ("adulto", "08:00", "Gi"), ("adulto", "12:00", "NoGi"),
    ("adulto", "18:00", "Gi"), ("adulto", "20:00", "Gi"),
    ("infantil", "10:00", "Gi"), ("infantil", "19:00", "Gi"),
)
GRADE = {
    0: SEG_QUA, 1: TER_QUI, 2: SEG_QUA, 3: TER_QUI,
    4: (
        ("adulto", "06:15", "NoGi"), ("adulto", "08:00", "Gi"),
        ("adulto", "17:30", "Gi"), ("adulto", "19:30", "NoGi"),
        ("infantil", "18:30", "NoGi"),
    ),
    5: (("adulto", "11:00", "Gi"), ("infantil", "10:00", "Gi")),
}


class ConfirmacaoAula(Base):
    __tablename__ = "confirmacoes_aulas"

    aula_id = Column(String(32), primary_key=True)
    aluno_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    resposta = Column(String(10), nullable=False)


class RespostaAula(BaseModel):
    resposta: Literal["vou", "nao_vou"]


class CadastroAluno(BaseModel):
    nome: str = Field(min_length=1, max_length=120, pattern=r"\S")
    email: EmailStr = Field(max_length=150)
    senha: str = Field(min_length=12, max_length=128)


def aulas_da_grade(dias_anteriores: int = 0):
    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    aulas = {}
    for offset in range(-dias_anteriores, 7):
        dia = agora.date() + timedelta(days=offset)
        for grupo, hora, formato in sorted(GRADE.get(dia.weekday(), ()), key=lambda aula: aula[1]):
            inicio = datetime.fromisoformat(f"{dia}T{hora}").replace(tzinfo=agora.tzinfo)
            aula_id = f"{dia}-{grupo}-{hora.replace(':', '')}"
            aulas[aula_id] = {
                "id": aula_id,
                "inicio": inicio.isoformat(),
                "modalidade": f"Jiu-Jitsu {grupo.capitalize()}",
                "formato": formato,
                "aberta": inicio > agora,
            }
    return aulas


@router.get("/minhas-aulas")
def listar_minhas_aulas(
    aluno: User = Depends(require_roles("aluno")),
    db: Session = Depends(get_db),
):
    aulas = {chave: aula for chave, aula in aulas_da_grade().items() if aula["aberta"]}
    respostas = {
        row.aula_id: row.resposta
        for row in db.query(ConfirmacaoAula).filter(
            ConfirmacaoAula.aluno_id == aluno.id,
            ConfirmacaoAula.aula_id.in_(aulas),
        )
    }
    return [{**aula, "resposta": respostas.get(chave)} for chave, aula in aulas.items()]


@router.get("/minhas-aulas/{aula_id}/colegas")
def listar_colegas_confirmados(
    aula_id: str,
    response: Response,
    aluno: User = Depends(require_roles("aluno")),
    db: Session = Depends(get_db),
):
    aula = aulas_da_grade().get(aula_id)
    if not aula or not aula["aberta"]:
        raise HTTPException(404, "Aula indisponível para consulta.")

    colegas = db.query(User.nome).join(
        ConfirmacaoAula, ConfirmacaoAula.aluno_id == User.id,
    ).filter(
        ConfirmacaoAula.aula_id == aula_id,
        ConfirmacaoAula.resposta == "vou",
        User.papel == "aluno",
    ).order_by(User.nome, User.id)
    response.headers["Cache-Control"] = "no-store"
    return [nome.strip() for (nome,) in colegas]


@router.put("/minhas-aulas/{aula_id}")
def confirmar_aula(
    aula_id: str,
    dados: RespostaAula,
    aluno: User = Depends(require_roles("aluno")),
    db: Session = Depends(get_db),
):
    aula = aulas_da_grade().get(aula_id)
    if not aula or not aula["aberta"]:
        raise HTTPException(404, "Aula indisponível para confirmação.")

    comando = insert(ConfirmacaoAula).values(
        aula_id=aula_id, aluno_id=aluno.id, resposta=dados.resposta,
    )
    db.execute(comando.on_conflict_do_update(
        index_elements=["aula_id", "aluno_id"],
        set_={"resposta": comando.excluded.resposta},
    ))
    db.commit()
    return {"resposta": dados.resposta}


@router.get("/gestao/aulas")
def listar_aulas_gestao(
    gestor: User = Depends(require_roles("admin", "instrutor")),
):
    return list(aulas_da_grade(dias_anteriores=7).values())


@router.get("/gestao/aulas/{aula_id}/confirmacoes")
def listar_confirmacoes(
    aula_id: str,
    gestor: User = Depends(require_roles("admin", "instrutor")),
    db: Session = Depends(get_db),
):
    if aula_id not in aulas_da_grade(dias_anteriores=7):
        raise HTTPException(404, "Aula não encontrada.")
    registros = db.query(User.nome, ConfirmacaoAula.resposta).join(
        ConfirmacaoAula, ConfirmacaoAula.aluno_id == User.id,
    ).filter(ConfirmacaoAula.aula_id == aula_id).order_by(User.nome, User.id)
    return [{"nome": nome, "resposta": resposta} for nome, resposta in registros]


@router.post("/gestao/alunos", status_code=201)
def cadastrar_aluno(
    dados: CadastroAluno,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    aluno = User(
        nome=dados.nome.strip(), email=str(dados.email).lower(),
        senha_hash=hash_password(dados.senha), papel="aluno",
    )
    db.add(aluno)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Esse e-mail já está em uso.")
    return {"mensagem": "Conta de aluno criada."}
