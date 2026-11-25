"""Confirmações de presença na grade semanal da academia."""
from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, ForeignKey, Integer, String, delete
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import Base, get_db
from backend.grade import GRADE
from backend.models import User
from backend.security import hash_password, require_roles

router = APIRouter(prefix="/api/v1", tags=["Confirmação de aulas"])

class ConfirmacaoAula(Base):
    __tablename__ = "confirmacoes_aulas"

    aula_id = Column(String(32), primary_key=True)
    aluno_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    resposta = Column(String(10), nullable=False)


class RespostaAula(BaseModel):
    resposta: Literal["vou", "nao_vou"] | None


GrupoContas = Literal["alunos", "instrutores"]
PAPEIS = {"alunos": "aluno", "instrutores": "instrutor"}
Faixa = Literal[
    "Branca", "Cinza e branca", "Cinza", "Cinza e preta",
    "Amarela e branca", "Amarela", "Amarela e preta",
    "Laranja e branca", "Laranja", "Laranja e preta",
    "Verde e branca", "Verde", "Verde e preta",
    "Azul", "Roxa", "Marrom", "Preta", "Coral", "Vermelha",
]


class PerfilConta(BaseModel):
    nome: str = Field(min_length=1, max_length=120, pattern=r"\S")
    email: EmailStr = Field(max_length=150)
    faixa: Faixa | None = None


class CadastroConta(PerfilConta):
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
    incluir_faixa: bool = False,
    aluno: User = Depends(require_roles("aluno")),
    db: Session = Depends(get_db),
):
    aula = aulas_da_grade().get(aula_id)
    if not aula or not aula["aberta"]:
        raise HTTPException(404, "Aula indisponível para consulta.")

    colegas = db.query(User.nome, User.faixa).join(
        ConfirmacaoAula, ConfirmacaoAula.aluno_id == User.id,
    ).filter(
        ConfirmacaoAula.aula_id == aula_id,
        ConfirmacaoAula.resposta == "vou",
        User.papel == "aluno",
        User.ativo.is_(True),
    ).order_by(User.nome, User.id)
    response.headers["Cache-Control"] = "no-store"
    if incluir_faixa:
        return [{"nome": nome.strip(), "faixa": faixa} for nome, faixa in colegas]
    return [nome.strip() for nome, _ in colegas]


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

    if dados.resposta is None:
        db.execute(delete(ConfirmacaoAula).where(
            ConfirmacaoAula.aula_id == aula_id,
            ConfirmacaoAula.aluno_id == aluno.id,
        ))
    else:
        insert = postgresql_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
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


@router.get("/gestao/presencas")
def listar_presencas(
    response: Response,
    gestor: User = Depends(require_roles("admin", "instrutor")),
    db: Session = Depends(get_db),
):
    aulas = aulas_da_grade()
    registros = db.query(ConfirmacaoAula.aula_id, User.nome, User.faixa).join(
        User, User.id == ConfirmacaoAula.aluno_id,
    ).filter(
        ConfirmacaoAula.aula_id.in_(aulas),
        ConfirmacaoAula.resposta == "vou",
        User.papel == "aluno",
        User.ativo.is_(True),
    ).order_by(ConfirmacaoAula.aula_id, User.nome, User.id)
    response.headers["Cache-Control"] = "no-store"
    presencas = [
        {**aulas[aula_id], "nome": nome, "faixa": faixa}
        for aula_id, nome, faixa in registros
    ]
    return sorted(presencas, key=lambda item: item["inicio"])


def salvar_conta(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Esse e-mail já está em uso.")


@router.post("/gestao/{grupo}", status_code=201)
def cadastrar_conta(
    grupo: GrupoContas,
    dados: CadastroConta,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    papel = PAPEIS[grupo]
    db.add(User(
        nome=dados.nome.strip(), email=str(dados.email).lower(), faixa=dados.faixa,
        senha_hash=hash_password(dados.senha), papel=papel,
    ))
    salvar_conta(db)
    return {"mensagem": f"Conta de {papel} criada."}


@router.patch("/gestao/{grupo}/{conta_id}")
def editar_conta(
    grupo: GrupoContas,
    conta_id: int,
    dados: PerfilConta,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    conta = conta_ativa(conta_id, PAPEIS[grupo], db)
    conta.nome = dados.nome.strip()
    conta.email = str(dados.email).lower()
    conta.faixa = dados.faixa
    salvar_conta(db)
    return {"mensagem": "Alterações salvas."}


class NovaSenhaAluno(BaseModel):
    senha: str = Field(min_length=12, max_length=128)


@router.get("/gestao/{grupo}")
def listar_contas(
    grupo: GrupoContas,
    response: Response,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    contas = db.query(User.id, User.nome, User.email, User.faixa).filter(
        User.papel == PAPEIS[grupo], User.ativo.is_(True),
    ).order_by(User.nome, User.id)
    return [{"id": id_, "nome": nome, "email": email, "faixa": faixa} for id_, nome, email, faixa in contas]


def conta_ativa(conta_id: int, papel: str, db: Session) -> User:
    conta = db.query(User).filter_by(id=conta_id, papel=papel, ativo=True).first()
    if conta is None:
        raise HTTPException(404, "Conta ativa não encontrada.")
    return conta


@router.patch("/gestao/alunos/{aluno_id}/senha")
def redefinir_senha_aluno(
    aluno_id: int,
    dados: NovaSenhaAluno,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    conta_ativa(aluno_id, "aluno", db).senha_hash = hash_password(dados.senha)
    db.commit()
    return {"mensagem": "Senha redefinida. O aluno pode entrar com a nova senha."}


@router.delete("/gestao/alunos/{aluno_id}")
def desativar_aluno(
    aluno_id: int,
    admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    conta_ativa(aluno_id, "aluno", db).ativo = False
    db.commit()
    return {"mensagem": "Aluno removido da lista e acesso desativado."}
