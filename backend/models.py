"""Modelos relacionais SQLAlchemy para persistência da plataforma Behrend BJJ."""
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Usuários do sistema com controle de acesso baseado em papéis (RBAC)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(120), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    senha_hash = Column(String(255), nullable=False)
    papel = Column(String(30), nullable=False, default="aluno")  # admin, instrutor, aluno
    ativo = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime, default=utc_now, nullable=False)


class Turma(Base):
    """Turmas e horários de artes marciais oferecidos pela Behrend BJJ."""

    __tablename__ = "turmas"

    id = Column(Integer, primary_key=True, index=True)
    modalidade = Column(String(80), nullable=False, index=True)
    publico = Column(String(40), nullable=False)  # Adulto, Infantil, Misto
    dias_semana = Column(String(100), nullable=False)
    horario = Column(String(40), nullable=False)
    instrutor = Column(String(100), nullable=False)
    capacidade_maxima = Column(Integer, nullable=False, default=20)
    ativa = Column(Boolean, default=True, nullable=False)

    agendamentos = relationship(
        "AgendamentoExperimental",
        back_populates="turma",
        cascade="all, delete-orphan",
    )


class AgendamentoExperimental(Base):
    """Agendamentos de aulas experimentais vinculados a uma turma."""

    __tablename__ = "agendamentos_experimentais"

    id = Column(Integer, primary_key=True, index=True)
    protocolo = Column(String(32), unique=True, index=True, nullable=False)
    nome_aluno = Column(String(120), nullable=False)
    email = Column(String(150), nullable=False, index=True)
    telefone = Column(String(30), nullable=False)
    turma_id = Column(Integer, ForeignKey("turmas.id"), nullable=False)
    data_aula = Column(String(10), nullable=False)  # YYYY-MM-DD
    nivel_experiencia = Column(String(40), nullable=False, default="Iniciante")
    status = Column(
        String(30), nullable=False, default="pendente"
    )  # pendente, confirmado, realizado, cancelado
    observacoes = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=utc_now, nullable=False)

    turma = relationship("Turma", back_populates="agendamentos")


class MensagemContato(Base):
    """Mensagens enviadas pelo formulário de contato institucional."""

    __tablename__ = "mensagens_contato"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(120), nullable=False)
    email = Column(String(150), nullable=False, index=True)
    telefone = Column(String(30), nullable=False)
    mensagem = Column(Text, nullable=False)
    lida = Column(Boolean, default=False, nullable=False)
    respondida_por = Column(String(120), nullable=True)
    criado_em = Column(DateTime, default=utc_now, nullable=False)
