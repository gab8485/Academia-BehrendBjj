"""Textos configuráveis das páginas, com conteúdo original nos arquivos HTML."""
import re
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import insert as insert_postgres
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.orm import Session

from backend.database import Base, get_db
from backend.security import require_roles

router = APIRouter(prefix="/api/v1/textos", tags=["Textos do site"])
ROOT = Path(__file__).resolve().parent.parent
ADMIN = Depends(require_roles("admin"))
PAGINAS = {
    "index.html": "Início", "sobre.html": "Sobre nós", "horarios.html": "Horários",
    "endereço.html": "Endereço", "jiujitsuadulto.html": "Jiu-Jitsu adulto",
    "jiujitsuinfantil.html": "Jiu-Jitsu infantil", "nogi.html": "NoGi",
    "agendamento.html": "Aula experimental", "confirmar-aula.html": "Confirmar aula",
    "eventos.html": "Eventos", "painel.html": "Painel", "judoadulto.html": "Judô adulto",
    "judoinfantil.html": "Judô infantil", "muaythay.html": "Muay Thai",
}


class TextoSite(Base):
    __tablename__ = "textos_site"

    pagina = Column(String(64), primary_key=True)
    chave = Column(String(96), primary_key=True)
    texto = Column(Text, nullable=False)


class AlteracaoTexto(BaseModel):
    chave: str = Field(max_length=96)
    texto: str | None = Field(max_length=8000)


@lru_cache(maxsize=len(PAGINAS))
def fonte_pagina(pagina: str) -> str:
    if pagina not in PAGINAS:
        raise HTTPException(404, "Página não encontrada.")
    return (ROOT / pagina).read_text(encoding="utf-8")


@lru_cache(maxsize=len(PAGINAS))
def chaves_pagina(pagina: str) -> set[str]:
    return set(re.findall(r'data-texto="([a-z0-9-]+)"', fonte_pagina(pagina)))


@router.get("", dependencies=[ADMIN])
def listar_paginas():
    return PAGINAS


@router.get("/{pagina}/original", response_class=PlainTextResponse, dependencies=[ADMIN])
def obter_original(pagina: str):
    return fonte_pagina(pagina)


@router.get("/{pagina}")
def obter_textos(pagina: str, response: Response, db: Session = Depends(get_db)):
    if pagina not in PAGINAS:
        raise HTTPException(404, "Página não encontrada.")
    response.headers["Cache-Control"] = "no-store"
    return dict(db.query(TextoSite.chave, TextoSite.texto).filter_by(pagina=pagina).all())


@router.put("/{pagina}", status_code=204, dependencies=[ADMIN])
def salvar_texto(pagina: str, dados: AlteracaoTexto, db: Session = Depends(get_db)):
    chaves = chaves_pagina(pagina)
    campo, separador, indice = dados.chave.partition(":")
    if dados.chave != "texto-adicional" and (
        campo not in chaves or not separador or not re.fullmatch(r"placeholder|[0-9]{1,2}", indice)
    ):
        raise HTTPException(404, "Trecho não encontrado.")
    if dados.texto is None:
        db.query(TextoSite).filter_by(pagina=pagina, chave=dados.chave).delete()
    else:
        insert = insert_postgres if db.get_bind().dialect.name == "postgresql" else insert_sqlite
        comando = insert(TextoSite).values(pagina=pagina, chave=dados.chave, texto=dados.texto)
        db.execute(comando.on_conflict_do_update(
            index_elements=["pagina", "chave"], set_={"texto": comando.excluded.texto},
        ))
    db.commit()
