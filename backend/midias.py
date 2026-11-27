"""Substituições de fotos e vídeos do site, armazenadas no banco."""
import re
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import Column, LargeBinary, String
from sqlalchemy.dialects.postgresql import insert as insert_postgres
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.staticfiles import StaticFiles

from backend.database import Base, SessionLocal, get_db
from backend.security import require_roles

router = APIRouter(prefix="/api/v1/midias", tags=["Mídias do site"])
FOTOS_MB = 8
VIDEOS_MB = 20
CATALOGO = {
    "home1.jpg": "Início · foto principal",
    "equipe.jpg": "Início · foto da equipe",
    "logoacademia1.png": "Logo da academia · várias páginas",
    "app-192.png": "Ícone do app · 192 px",
    "app-512.png": "Ícone do app · 512 px",
    "bjj1.jpeg": "Jiu-Jitsu adulto · foto principal",
    "bjj2.jpeg": "Jiu-Jitsu adulto · foto da modalidade",
    "bjjinf2.jpeg": "Jiu-Jitsu infantil · foto principal",
    "jiuinfantil1.jpg": "Jiu-Jitsu infantil · foto da modalidade",
    "nogi3.jpeg": "NoGi · foto principal",
    "nogi3.jpg": "NoGi · foto da modalidade",
    "bjj7.mp4": "Vídeo de Jiu-Jitsu adulto, infantil e NoGi",
    "bjj6.mp4": "Sobre · vídeo",
    "foto-da-aula.jpg": "Sobre · capa do vídeo",
    "logobehrend2.jpeg": "Foto adicional da academia",
    "behrend01.png": "Unidades · imagem Behrend",
    "logoberhend03.jpeg": "Unidades · foto Behrend",
    "judologo01.png": "Unidades · imagem de judô",
    "judologopb2.png": "Judô · logo",
    "judoadulto1.jpeg": "Judô adulto · foto",
    "judoinfantil.jpeg": "Judô infantil · foto",
    "treinovideo.mp4": "Judô adulto e infantil · vídeo",
    "thay0.jpg": "Muay Thai · foto",
    "videothai.mp4": "Muay Thai · vídeo",
}
ORIGINAIS = {
    "nogi3.jpg": "nogi3.jpeg",
    "foto-da-aula.jpg": "equipe.jpg",
    "logoberhend03.jpeg": "logobehrend2.jpeg",
}
ADMIN = Depends(require_roles("admin"))


class MidiaSite(Base):
    __tablename__ = "midias_site"

    nome = Column(String(100), primary_key=True)
    tipo = Column(String(30), nullable=False)
    conteudo = Column(LargeBinary, nullable=False)


def preparar_imagem(conteudo: bytes, nome: str) -> tuple[bytes, str]:
    try:
        with Image.open(BytesIO(conteudo), formats=["JPEG", "PNG", "WEBP"]) as original:
            if original.width * original.height > 24_000_000:
                raise HTTPException(422, "Envie uma foto com até 24 megapixels.")
            imagem = ImageOps.exif_transpose(original)
            tamanho_icone = {"app-192.png": 192, "app-512.png": 512}.get(nome)
            saida = BytesIO()
            if tamanho_icone:
                imagem = ImageOps.pad(imagem.convert("RGBA"), (tamanho_icone, tamanho_icone))
                imagem.save(saida, format="PNG")
                return saida.getvalue(), "image/png"
            imagem.thumbnail((1600, 1600))
            imagem.convert("RGBA").save(saida, format="WEBP", quality=88)
            return saida.getvalue(), "image/webp"
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as erro:
        raise HTTPException(422, "Envie uma foto válida em JPEG, PNG ou WebP.") from erro


def validar_mp4(conteudo: bytes) -> None:
    # Verifica os blocos obrigatórios do contêiner sem executar um decodificador.
    posicao = 0
    blocos = set()
    while posicao + 8 <= len(conteudo):
        tamanho = int.from_bytes(conteudo[posicao:posicao + 4], "big")
        tipo = conteudo[posicao + 4:posicao + 8]
        cabecalho = 8
        if tamanho == 1:
            cabecalho = 16
            tamanho = int.from_bytes(conteudo[posicao + 8:posicao + 16], "big")
        elif tamanho == 0:
            tamanho = len(conteudo) - posicao
        if tamanho < cabecalho or posicao + tamanho > len(conteudo):
            break
        if tamanho > cabecalho:
            blocos.add(tipo)
        posicao += tamanho
    if posicao != len(conteudo) or not {b"ftyp", b"moov", b"mdat"} <= blocos:
        raise HTTPException(422, "Envie um vídeo válido em MP4.")


@router.get("", dependencies=[ADMIN])
def listar_midias(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    alteradas = set(db.scalars(db.query(MidiaSite.nome).statement))
    return [
        {
            "nome": nome, "rotulo": rotulo, "video": nome.endswith(".mp4"),
            "personalizada": nome in alteradas,
            "limite_mb": VIDEOS_MB if nome.endswith(".mp4") else FOTOS_MB,
        }
        for nome, rotulo in CATALOGO.items()
    ]


@router.put("/{nome}", dependencies=[ADMIN])
def substituir_midia(nome: str, arquivo: UploadFile, db: Session = Depends(get_db)):
    if nome not in CATALOGO:
        raise HTTPException(404, "Mídia não encontrada.")
    video = nome.endswith(".mp4")
    limite = VIDEOS_MB if video else FOTOS_MB
    conteudo = arquivo.file.read(limite * 1024 * 1024 + 1)
    if len(conteudo) > limite * 1024 * 1024:
        raise HTTPException(413, f"O arquivo deve ter até {limite} MB.")
    if video:
        validar_mp4(conteudo)
        tipo = "video/mp4"
    else:
        conteudo, tipo = preparar_imagem(conteudo, nome)
    insert = insert_postgres if db.get_bind().dialect.name == "postgresql" else insert_sqlite
    comando = insert(MidiaSite).values(nome=nome, tipo=tipo, conteudo=conteudo)
    db.execute(comando.on_conflict_do_update(
        index_elements=["nome"],
        set_={"tipo": comando.excluded.tipo, "conteudo": comando.excluded.conteudo},
    ))
    db.commit()
    return {"mensagem": "Mídia atualizada."}


@router.delete("/{nome}", status_code=204, dependencies=[ADMIN])
def restaurar_midia(nome: str, db: Session = Depends(get_db)):
    if nome not in CATALOGO:
        raise HTTPException(404, "Mídia não encontrada.")
    db.query(MidiaSite).filter_by(nome=nome).delete()
    db.commit()


def buscar_midia(nome: str):
    with SessionLocal() as db:
        return db.query(MidiaSite.tipo, MidiaSite.conteudo).filter_by(nome=nome).first()


def responder_midia(tipo: str, conteudo: bytes, scope) -> Response:
    metodo = scope["method"]
    total = len(conteudo)
    headers = {"Cache-Control": "no-store", "Content-Length": str(total)}
    if tipo == "video/mp4":
        headers["Accept-Ranges"] = "bytes"
        faixa = dict(scope["headers"]).get(b"range", b"")
        if faixa and metodo == "GET":
            partes = re.fullmatch(rb"bytes=([0-9]{0,20})-([0-9]{0,20})", faixa)
            if partes and any(partes.groups()):
                primeiro, ultimo = partes.groups()
                inicio = int(primeiro) if primeiro else max(0, total - int(ultimo))
                fim = min(total - 1, int(ultimo)) if primeiro and ultimo else total - 1
                if inicio <= fim:
                    headers["Content-Range"] = f"bytes {inicio}-{fim}/{total}"
                    headers["Content-Length"] = str(fim - inicio + 1)
                    return Response(conteudo[inicio:fim + 1], 206, headers, tipo)
            headers["Content-Range"] = f"bytes */{total}"
            headers.pop("Content-Length")
            return Response(status_code=416, headers=headers)
    return Response(conteudo if metodo == "GET" else b"", headers=headers, media_type=tipo)


class ArquivosMidia(StaticFiles):
    def __init__(self, pasta: Path):
        super().__init__(directory=pasta)

    async def get_response(self, path, scope):
        if path in CATALOGO and scope["method"] in {"GET", "HEAD"}:
            midia = await run_in_threadpool(buscar_midia, path)
            if midia is not None:
                return responder_midia(midia.tipo, midia.conteudo, scope)
            resposta = await super().get_response(ORIGINAIS.get(path, path), scope)
            resposta.headers["Cache-Control"] = "no-cache"
            return resposta
        return await super().get_response(path, scope)
