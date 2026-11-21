"""Camada de Persistência (Repository Pattern): consultas parametrizadas via SQLAlchemy ORM."""
from typing import List, Optional
from sqlalchemy.orm import Session

from backend.models import AgendamentoExperimental, MensagemContato, Turma, User


class UserRepository:
    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.lower().strip()).first()

    @staticmethod
    def create(db: Session, nome: str, email: str, senha_hash: str, papel: str) -> User:
        user = User(nome=nome, email=email.lower().strip(), senha_hash=senha_hash, papel=papel)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


class TurmaRepository:
    @staticmethod
    def list_all(db: Session, apenas_ativas: bool = True) -> List[Turma]:
        query = db.query(Turma)
        if apenas_ativas:
            query = query.filter(Turma.ativa.is_(True))
        return query.order_by(Turma.id.asc()).all()

    @staticmethod
    def get_by_id(db: Session, turma_id: int) -> Optional[Turma]:
        return db.query(Turma).filter(Turma.id == turma_id).first()

    @staticmethod
    def create(db: Session, **kwargs) -> Turma:
        turma = Turma(**kwargs)
        db.add(turma)
        db.commit()
        db.refresh(turma)
        return turma

    @staticmethod
    def count_active_bookings(db: Session, turma_id: int, data_aula: Optional[str] = None) -> int:
        query = db.query(AgendamentoExperimental).filter(
            AgendamentoExperimental.turma_id == turma_id,
            AgendamentoExperimental.status.in_(["pendente", "confirmado"]),
        )
        if data_aula:
            query = query.filter(AgendamentoExperimental.data_aula == data_aula)
        return query.count()


class AgendamentoRepository:
    @staticmethod
    def create(db: Session, **kwargs) -> AgendamentoExperimental:
        agendamento = AgendamentoExperimental(**kwargs)
        db.add(agendamento)
        db.commit()
        db.refresh(agendamento)
        return agendamento

    @staticmethod
    def get_by_id(db: Session, agendamento_id: int) -> Optional[AgendamentoExperimental]:
        return (
            db.query(AgendamentoExperimental)
            .filter(AgendamentoExperimental.id == agendamento_id)
            .first()
        )

    @staticmethod
    def get_by_protocolo_or_email(
        db: Session, protocolo: Optional[str] = None, email: Optional[str] = None
    ) -> List[AgendamentoExperimental]:
        query = db.query(AgendamentoExperimental)
        if protocolo:
            query = query.filter(AgendamentoExperimental.protocolo == protocolo.strip().upper())
        if email:
            query = query.filter(AgendamentoExperimental.email == email.strip().lower())
        return query.order_by(AgendamentoExperimental.criado_em.desc()).all()

    @staticmethod
    def find_duplicate(
        db: Session, email: str, turma_id: int, data_aula: str
    ) -> Optional[AgendamentoExperimental]:
        return (
            db.query(AgendamentoExperimental)
            .filter(
                AgendamentoExperimental.email == email.lower().strip(),
                AgendamentoExperimental.turma_id == turma_id,
                AgendamentoExperimental.data_aula == data_aula,
                AgendamentoExperimental.status.in_(["pendente", "confirmado"]),
            )
            .first()
        )

    @staticmethod
    def list_all(
        db: Session, status_filter: Optional[str] = None, modalidade: Optional[str] = None
    ) -> List[AgendamentoExperimental]:
        query = db.query(AgendamentoExperimental).join(Turma)
        if status_filter:
            query = query.filter(AgendamentoExperimental.status == status_filter)
        if modalidade:
            query = query.filter(Turma.modalidade.ilike(f"%{modalidade}%"))
        return query.order_by(AgendamentoExperimental.criado_em.desc()).all()

    @staticmethod
    def update_status(
        db: Session, agendamento: AgendamentoExperimental, novo_status: str
    ) -> AgendamentoExperimental:
        agendamento.status = novo_status
        db.commit()
        db.refresh(agendamento)
        return agendamento

    @staticmethod
    def delete(db: Session, agendamento: AgendamentoExperimental) -> None:
        db.delete(agendamento)
        db.commit()


class ContatoRepository:
    @staticmethod
    def create(db: Session, **kwargs) -> MensagemContato:
        contato = MensagemContato(**kwargs)
        db.add(contato)
        db.commit()
        db.refresh(contato)
        return contato

    @staticmethod
    def list_all(db: Session) -> List[MensagemContato]:
        return db.query(MensagemContato).order_by(MensagemContato.criado_em.desc()).all()

    @staticmethod
    def get_by_id(db: Session, contato_id: int) -> Optional[MensagemContato]:
        return db.query(MensagemContato).filter(MensagemContato.id == contato_id).first()

    @staticmethod
    def mark_as_read(
        db: Session, contato: MensagemContato, respondida_por: str
    ) -> MensagemContato:
        contato.lida = True
        contato.respondida_por = respondida_por
        db.commit()
        db.refresh(contato)
        return contato
