"""Configuração de conexão e sessão do banco de dados com SQLAlchemy."""
import os
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = make_url(os.getenv("DATABASE_URL", "sqlite:///./behrend_bjj.db"))
if DATABASE_URL.drivername in {"postgres", "postgresql"}:
    DATABASE_URL = DATABASE_URL.set(drivername="postgresql+psycopg")

connect_args = {"check_same_thread": False} if DATABASE_URL.get_backend_name() == "sqlite" else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Provedor de sessão de banco de dados para injeção de dependência no FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrar_faixa_usuarios():
    """Adiciona a faixa às contas de bancos criados antes deste campo."""
    with engine.begin() as conexao:
        if conexao.dialect.name == "postgresql":
            conexao.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS faixa VARCHAR(40)")
        else:
            conexao.exec_driver_sql("BEGIN IMMEDIATE")
            colunas = inspect(conexao).get_columns("users")
            if not any(coluna["name"] == "faixa" for coluna in colunas):
                conexao.exec_driver_sql("ALTER TABLE users ADD COLUMN faixa VARCHAR(40)")
