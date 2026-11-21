from getpass import getpass

from sqlalchemy.orm import Session

from backend.database import engine
from backend.repositories import UserRepository
from backend.security import hash_password

email_atual = input("E-mail atual da conta: ").strip().lower()
email_novo = input("Novo e-mail (Enter para manter o atual): ").strip().lower()
email_novo = email_novo or email_atual

senha = getpass("Nova senha: ")
confirmacao = getpass("Repita a nova senha: ")

if "@" not in email_novo:
    raise SystemExit("Informe um e-mail válido.")

if len(senha) < 12 or senha != confirmacao:
    raise SystemExit("Use pelo menos 12 caracteres e repita a mesma senha.")

with Session(engine) as db:
    usuario = UserRepository.get_by_email(db, email_atual)
    if usuario is None:
        raise SystemExit("Conta atual não encontrada.")

    if email_novo != email_atual and UserRepository.get_by_email(db, email_novo):
        raise SystemExit("Esse e-mail já está em uso.")

    usuario.email = email_novo
    usuario.senha_hash = hash_password(senha)
    db.commit()

print("Conta atualizada com sucesso.")