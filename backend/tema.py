"""Cor principal do site, compartilhada por todas as páginas."""
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import insert as insert_postgres
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.orm import Session

from backend.database import Base, get_db
from backend.security import require_roles

router = APIRouter(prefix="/api/v1/tema", tags=["Aparência"])
COR_PADRAO = "#0000ff"
TEMA_SITE_ID = 1


class TemaSite(Base):
    __tablename__ = "tema_site"

    id = Column(Integer, primary_key=True)
    cor = Column(String(7), nullable=False)


class CorTema(BaseModel):
    cor: str = Field(min_length=7, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")


@router.get("", response_model=CorTema)
def obter_tema(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    tema = db.get(TemaSite, TEMA_SITE_ID)
    return CorTema(cor=tema.cor if tema else COR_PADRAO)


@router.put("", response_model=CorTema, dependencies=[Depends(require_roles("admin"))])
def salvar_tema(dados: CorTema, db: Session = Depends(get_db)):
    cor = dados.cor.lower()
    insert = insert_postgres if db.get_bind().dialect.name == "postgresql" else insert_sqlite
    comando = insert(TemaSite).values(id=TEMA_SITE_ID, cor=cor)
    db.execute(comando.on_conflict_do_update(index_elements=["id"], set_={"cor": comando.excluded.cor}))
    db.commit()
    return CorTema(cor=cor)


@router.delete("", response_model=CorTema, dependencies=[Depends(require_roles("admin"))])
def restaurar_tema(db: Session = Depends(get_db)):
    db.query(TemaSite).filter_by(id=TEMA_SITE_ID).delete()
    db.commit()
    return CorTema(cor=COR_PADRAO)
