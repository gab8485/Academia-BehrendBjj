"""Competições externas e publicações da academia."""
from datetime import date, datetime
from io import BytesIO
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Response, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, HttpUrl, ValidationError
from sqlalchemy import Boolean, Column, Date, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Session, deferred

from backend.database import Base, get_db
from backend.security import require_roles

router = APIRouter(prefix="/api/v1/eventos", tags=["Eventos"])
MAX_FOTO = 8 * 1024 * 1024
TAMANHO_PAGINA = 20


class Publicacao(Base):
    __tablename__ = "publicacoes_eventos"

    id = Column(Integer, primary_key=True)
    tipo = Column(String(12), nullable=False)
    titulo = Column(String(120), nullable=False)
    descricao = Column(Text, nullable=False)
    data_evento = Column(Date)
    link = Column(String(2083))
    foto = deferred(Column(LargeBinary))
    tem_foto = Column(Boolean, nullable=False, default=False)


class EventoLink(BaseModel):
    url: HttpUrl


def dados_publicos(item: Publicacao) -> dict:
    return {
        "id": item.id,
        "tipo": item.tipo,
        "titulo": item.titulo,
        "descricao": item.descricao,
        "data_evento": item.data_evento,
        "link": item.link,
        "foto": f"/eventos/{item.id}/foto" if item.tem_foto else None,
    }


def preparar_foto(arquivo: UploadFile) -> bytes:
    conteudo = arquivo.file.read(MAX_FOTO + 1)
    if len(conteudo) > MAX_FOTO:
        raise HTTPException(413, "A foto deve ter até 8 MB.")
    try:
        with Image.open(BytesIO(conteudo), formats=["JPEG", "PNG", "WEBP"]) as original:
            if original.width * original.height > 24_000_000:
                raise HTTPException(422, "Use uma foto com até 24 megapixels.")
            limpa = ImageOps.exif_transpose(original).convert("RGB")
            limpa.thumbnail((1600, 1600))
            buffer = BytesIO()
            limpa.save(buffer, format="JPEG", quality=82, optimize=True)
            return buffer.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as erro:
        raise HTTPException(422, "Envie uma foto válida em JPEG, PNG ou WebP.") from erro


@router.get("")
def listar_eventos(
    tipo: Literal["competicao", "publicacao"],
    pagina: Annotated[int, Query(ge=1)] = 1,
    db: Session = Depends(get_db),
):
    consulta = db.query(Publicacao).filter_by(tipo=tipo)
    if tipo == "competicao":
        hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
        consulta = consulta.filter(Publicacao.data_evento >= hoje).order_by(Publicacao.data_evento, Publicacao.id)
    else:
        consulta = consulta.order_by(Publicacao.id.desc())
    itens = consulta.offset((pagina - 1) * TAMANHO_PAGINA).limit(TAMANHO_PAGINA + 1).all()
    return {
        "itens": [dados_publicos(item) for item in itens[:TAMANHO_PAGINA]],
        "tem_mais": len(itens) > TAMANHO_PAGINA,
    }


@router.get("/{publicacao_id}/foto")
def obter_foto(publicacao_id: int, db: Session = Depends(get_db)):
    foto = db.query(Publicacao.foto).filter_by(id=publicacao_id).scalar()
    if foto is None:
        raise HTTPException(404, "Foto não encontrada.")
    return Response(foto, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})


@router.post("", status_code=201, dependencies=[Depends(require_roles("admin", "instrutor"))])
def publicar(
    tipo: Annotated[Literal["competicao", "publicacao"], Form()],
    titulo: Annotated[str, Form(max_length=120)],
    descricao: Annotated[str, Form(max_length=2000)],
    foto: UploadFile | None = None,
    data_evento: Annotated[date | None, Form()] = None,
    link: Annotated[str | None, Form(max_length=2083)] = None,
    db: Session = Depends(get_db),
):
    titulo, descricao = titulo.strip(), descricao.strip()
    if not titulo or not descricao:
        raise HTTPException(422, "Informe um título e uma descrição.")
    if tipo == "competicao":
        if not data_evento or not link:
            raise HTTPException(422, "Informe a data e o link oficial da competição.")
        if data_evento < datetime.now(ZoneInfo("America/Sao_Paulo")).date():
            raise HTTPException(422, "Informe uma data de competição futura ou de hoje.")
        try:
            link = str(EventoLink(url=link).url)
        except ValidationError as erro:
            raise HTTPException(422, "Informe um link válido que comece com http:// ou https://.") from erro
    else:
        data_evento, link = None, None
    foto_bytes = preparar_foto(foto) if foto else None
    item = Publicacao(
        tipo=tipo, titulo=titulo, descricao=descricao, data_evento=data_evento,
        link=link, foto=foto_bytes, tem_foto=foto_bytes is not None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return dados_publicos(item)
