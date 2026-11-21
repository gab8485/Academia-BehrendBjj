"""Schemas Pydantic para validação rigorosa de entrada e serialização da API /api/v1."""
from datetime import datetime
import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.security import sanitize_text

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_REGEX = re.compile(r"^[0-9()\-\s+]{8,25}$")
DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    senha: str = Field(..., min_length=4, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("Formato de e-mail inválido.")
        return cleaned


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: str
    papel: str
    ativo: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UserResponse


class TurmaCreate(BaseModel):
    modalidade: str = Field(..., min_length=3, max_length=80)
    publico: str = Field(..., min_length=3, max_length=40)
    dias_semana: str = Field(..., min_length=3, max_length=100)
    horario: str = Field(..., min_length=3, max_length=40)
    instrutor: str = Field(..., min_length=3, max_length=100)
    capacidade_maxima: int = Field(default=20, ge=1, le=100)

    @field_validator("modalidade", "publico", "dias_semana", "horario", "instrutor")
    @classmethod
    def clean_fields(cls, v: str) -> str:
        return sanitize_text(v) or ""


class TurmaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    modalidade: str
    publico: str
    dias_semana: str
    horario: str
    instrutor: str
    capacidade_maxima: int
    ativa: bool
    agendamentos_ativos: int = 0
    vagas_disponiveis: int = 20


class AgendamentoCreate(BaseModel):
    nome_aluno: str = Field(..., min_length=3, max_length=120)
    email: str = Field(..., min_length=5, max_length=150)
    telefone: str = Field(..., min_length=8, max_length=25)
    turma_id: int = Field(..., ge=1)
    data_aula: str = Field(..., description="Data no formato YYYY-MM-DD")
    nivel_experiencia: str = Field(default="Iniciante", max_length=40)
    observacoes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("nome_aluno", "nivel_experiencia")
    @classmethod
    def clean_text_fields(cls, v: str) -> str:
        cleaned = sanitize_text(v) or ""
        if len(cleaned) < 2:
            raise ValueError("Campo textual muito curto após sanitização.")
        return cleaned

    @field_validator("observacoes")
    @classmethod
    def clean_observacoes(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v) if v else None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("Informe um endereço de e-mail válido.")
        return cleaned

    @field_validator("telefone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.strip()
        if not PHONE_REGEX.match(cleaned):
            raise ValueError("Informe um telefone válido (apenas números, DDD e símbolos básicos).")
        return cleaned

    @field_validator("data_aula")
    @classmethod
    def validate_date(cls, v: str) -> str:
        cleaned = v.strip()
        if not DATE_REGEX.match(cleaned):
            raise ValueError("A data da aula deve estar no formato YYYY-MM-DD.")
        return cleaned


class AgendamentoStatusUpdate(BaseModel):
    status: str = Field(..., description="pendente, confirmado, realizado ou cancelado")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"pendente", "confirmado", "realizado", "cancelado"}
        cleaned = v.strip().lower()
        if cleaned not in allowed:
            raise ValueError(f"Status inválido. Valores permitidos: {', '.join(sorted(allowed))}")
        return cleaned


class AgendamentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    protocolo: str
    nome_aluno: str
    email: str
    telefone: str
    turma_id: int
    modalidade_turma: Optional[str] = None
    horario_turma: Optional[str] = None
    data_aula: str
    nivel_experiencia: str
    status: str
    observacoes: Optional[str] = None
    criado_em: datetime


class ContatoCreate(BaseModel):
    nome: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=150)
    telefone: str = Field(..., min_length=8, max_length=25)
    mensagem: str = Field(
        default="Solicitação de contato via site institucional.",
        min_length=3,
        max_length=1000,
    )

    @field_validator("nome", "mensagem")
    @classmethod
    def clean_text(cls, v: str) -> str:
        cleaned = sanitize_text(v) or ""
        if len(cleaned) < 2:
            raise ValueError("Conteúdo inválido.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("Informe um e-mail válido.")
        return cleaned

    @field_validator("telefone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.strip()
        if not PHONE_REGEX.match(cleaned):
            raise ValueError("Informe um telefone válido.")
        return cleaned


class ContatoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: str
    telefone: str
    mensagem: str
    lida: bool
    respondida_por: Optional[str] = None
    criado_em: datetime
