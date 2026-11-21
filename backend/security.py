"""Módulo de segurança: hashing PBKDF2-SHA256, tokens assinados, RBAC, sanitização XSS e Rate Limiting."""
import base64
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import time
from typing import Callable, List, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User

SECRET_KEY = os.getenv(
    "BEHREND_SECRET_KEY",
    "behrend-bjj-ceub-2026-default-dev-secret-key-change-in-prod",
)
TOKEN_EXPIRATION_SECONDS = int(os.getenv("TOKEN_EXPIRATION_SECONDS", "28800"))  # 8h
PBKDF2_ITERATIONS = 120_000

bearer_scheme = HTTPBearer(auto_error=False)

# Armazenamento em memória para Rate Limiting (IP -> lista de timestamps)
_RATE_LIMIT_STORE: dict[str, list[float]] = {}


def reset_rate_limiter() -> None:
    """Limpa o estado do rate limiter (útil em suítes de teste)."""
    _RATE_LIMIT_STORE.clear()


def check_rate_limit(
    client_key: str, max_requests: int = 15, window_seconds: int = 60
) -> None:
    """Mitigação OWASP A04/A07: limita requisições por janela de tempo."""
    now = time.time()
    timestamps = _RATE_LIMIT_STORE.get(client_key, [])
    timestamps = [ts for ts in timestamps if now - ts < window_seconds]
    if len(timestamps) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas requisições em curto período. Tente novamente em instantes.",
        )
    timestamps.append(now)
    _RATE_LIMIT_STORE[client_key] = timestamps


def sanitize_text(value: Optional[str]) -> Optional[str]:
    """Mitigação OWASP A03 (XSS): escapa entidades HTML e remove caracteres de controle."""
    if value is None:
        return None
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value.strip())
    return html.escape(cleaned, quote=True)


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Gera hash seguro PBKDF2-HMAC-SHA256 com salt aleatório."""
    if not salt:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verifica senha em tempo constante (hmac.compare_digest) contra ataques de timing."""
    try:
        algorithm, iterations_str, salt, _ = stored_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_str)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        expected = f"pbkdf2_sha256${iterations}${salt}${dk.hex()}"
        return hmac.compare_digest(expected, stored_hash)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(user: User) -> str:
    """Gera token JWT-compatível assinado com HMAC-SHA256 contendo identidade e papel."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "nome": user.nome,
        "papel": user.papel,
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_EXPIRATION_SECONDS,
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    signature_b64 = _b64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> dict:
    """Valida assinatura HMAC-SHA256 e expiração do token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Formato de token inválido.")
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(
            SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        expected_b64 = _b64url_encode(expected_sig)
        if not hmac.compare_digest(expected_b64, signature_b64):
            raise ValueError("Assinatura de token inválida.")
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Token expirado.")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Credenciais inválidas ou expiradas: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extrai e valida o usuário autenticado a partir do cabeçalho Authorization: Bearer."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação obrigatória. Informe o token Bearer.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id, User.ativo.is_(True)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo.",
        )
    return user


def require_roles(*allowed_roles: str) -> Callable:
    """Mitigação OWASP A01 (Broken Access Control): restringe acesso por papel (RBAC)."""

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.papel not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Acesso negado para o papel '{current_user.papel}'. "
                    f"Papéis exigidos: {', '.join(allowed_roles)}."
                ),
            )
        return current_user

    return role_checker
