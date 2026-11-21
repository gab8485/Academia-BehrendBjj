"""Camada de Serviço (Regras de Negócio): orquestra validações de domínio, agendamentos e seed."""
import secrets
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.models import AgendamentoExperimental, MensagemContato, Turma, User
from backend.repositories import (
    AgendamentoRepository,
    ContatoRepository,
    TurmaRepository,
    UserRepository,
)
from backend.schemas import (
    AgendamentoCreate,
    AgendamentoResponse,
    ContatoCreate,
    TurmaCreate,
    TurmaResponse,
)
from backend.security import create_access_token, hash_password, verify_password


def seed_initial_data(db: Session) -> None:
    """Popula usuários padrão (RBAC) e turmas reais da Behrend BJJ caso o banco esteja vazio."""
    default_users = [
        ("Erick Behrend (Admin)", "admin@behrendbjj.com", "Admin@2026", "admin"),
        ("Instrutor Gabriel (Tatame)", "instrutor@behrendbjj.com", "Instrutor@2026", "instrutor"),
        ("Aluno Visitante", "aluno@behrendbjj.com", "Aluno@2026", "aluno"),
    ]
    for nome, email, senha, papel in default_users:
        if not UserRepository.get_by_email(db, email):
            UserRepository.create(
                db=db,
                nome=nome,
                email=email,
                senha_hash=hash_password(senha),
                papel=papel,
            )

    if not TurmaRepository.list_all(db, apenas_ativas=False):
        default_turmas = [
            {
                "modalidade": "Jiu-Jitsu Adulto",
                "publico": "Adulto",
                "dias_semana": "Segunda a Sexta",
                "horario": "19:30 - 21:00",
                "instrutor": "Mestre Erick Behrend",
                "capacidade_maxima": 25,
            },
            {
                "modalidade": "Jiu-Jitsu Infantil",
                "publico": "Infantil (5 a 14 anos)",
                "dias_semana": "Terça e Quinta",
                "horario": "18:00 - 19:00",
                "instrutor": "Prof. Erick Behrend",
                "capacidade_maxima": 20,
            },
            {
                "modalidade": "Judô Adulto",
                "publico": "Adulto",
                "dias_semana": "Segunda, Quarta e Sexta",
                "horario": "20:00 - 21:30",
                "instrutor": "Sensei Behrend Team",
                "capacidade_maxima": 20,
            },
            {
                "modalidade": "Judô Infantil",
                "publico": "Infantil (4 a 13 anos)",
                "dias_semana": "Segunda, Quarta e Sexta",
                "horario": "17:30 - 18:30",
                "instrutor": "Sensei Behrend Team",
                "capacidade_maxima": 18,
            },
            {
                "modalidade": "Muay Thai",
                "publico": "Adulto / Juvenil",
                "dias_semana": "Terça, Quinta e Sábado",
                "horario": "19:00 - 20:00",
                "instrutor": "Kru Behrend Team",
                "capacidade_maxima": 22,
            },
            {
                "modalidade": "Submission / No-Gi",
                "publico": "Adulto",
                "dias_semana": "Quarta e Sexta",
                "horario": "21:00 - 22:00",
                "instrutor": "Mestre Erick Behrend",
                "capacidade_maxima": 20,
            },
        ]
        for t in default_turmas:
            TurmaRepository.create(db, **t)


class AuthService:
    @staticmethod
    def authenticate(db: Session, email: str, senha: str) -> tuple[str, User]:
        user = UserRepository.get_by_email(db, email)
        if not user or not user.ativo or not verify_password(senha, user.senha_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou senha incorretos.",
            )
        token = create_access_token(user)
        return token, user


class TurmaService:
    @staticmethod
    def listar_turmas(db: Session) -> List[TurmaResponse]:
        turmas = TurmaRepository.list_all(db, apenas_ativas=True)
        resultado: List[TurmaResponse] = []
        for t in turmas:
            ativos = TurmaRepository.count_active_bookings(db, t.id)
            vagas = max(0, t.capacidade_maxima - ativos)
            resultado.append(
                TurmaResponse(
                    id=t.id,
                    modalidade=t.modalidade,
                    publico=t.publico,
                    dias_semana=t.dias_semana,
                    horario=t.horario,
                    instrutor=t.instrutor,
                    capacidade_maxima=t.capacidade_maxima,
                    ativa=t.ativa,
                    agendamentos_ativos=ativos,
                    vagas_disponiveis=vagas,
                )
            )
        return resultado

    @staticmethod
    def criar_turma(db: Session, dados: TurmaCreate) -> TurmaResponse:
        turma = TurmaRepository.create(
            db,
            modalidade=dados.modalidade,
            publico=dados.publico,
            dias_semana=dados.dias_semana,
            horario=dados.horario,
            instrutor=dados.instrutor,
            capacidade_maxima=dados.capacidade_maxima,
            ativa=True,
        )
        return TurmaResponse(
            id=turma.id,
            modalidade=turma.modalidade,
            publico=turma.publico,
            dias_semana=turma.dias_semana,
            horario=turma.horario,
            instrutor=turma.instrutor,
            capacidade_maxima=turma.capacidade_maxima,
            ativa=turma.ativa,
            agendamentos_ativos=0,
            vagas_disponiveis=turma.capacidade_maxima,
        )


class AgendamentoService:
    @staticmethod
    def _to_response(ag: AgendamentoExperimental) -> AgendamentoResponse:
        return AgendamentoResponse(
            id=ag.id,
            protocolo=ag.protocolo,
            nome_aluno=ag.nome_aluno,
            email=ag.email,
            telefone=ag.telefone,
            turma_id=ag.turma_id,
            modalidade_turma=ag.turma.modalidade if ag.turma else None,
            horario_turma=f"{ag.turma.dias_semana} ({ag.turma.horario})" if ag.turma else None,
            data_aula=ag.data_aula,
            nivel_experiencia=ag.nivel_experiencia,
            status=ag.status,
            observacoes=ag.observacoes,
            criado_em=ag.criado_em,
        )

    @staticmethod
    def criar_agendamento(db: Session, dados: AgendamentoCreate) -> AgendamentoResponse:
        turma = TurmaRepository.get_by_id(db, dados.turma_id)
        if not turma or not turma.ativa:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Turma selecionada não existe ou está inativa.",
            )

        # Regra de Negócio 1: Prevenção de agendamento duplicado na mesma turma e data
        duplicado = AgendamentoRepository.find_duplicate(
            db, dados.email, dados.turma_id, dados.data_aula
        )
        if duplicado:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Já existe um agendamento ativo (protocolo {duplicado.protocolo}) "
                    "para este e-mail nesta turma e data."
                ),
            )

        # Regra de Negócio 2: Verificação de capacidade máxima da turma na data
        ocupadas_na_data = TurmaRepository.count_active_bookings(
            db, dados.turma_id, dados.data_aula
        )
        if ocupadas_na_data >= turma.capacidade_maxima:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Limite de vagas experimentais atingido para esta turma na data escolhida.",
            )

        protocolo = f"BJJ-{secrets.token_hex(3).upper()}"
        agendamento = AgendamentoRepository.create(
            db,
            protocolo=protocolo,
            nome_aluno=dados.nome_aluno,
            email=dados.email,
            telefone=dados.telefone,
            turma_id=dados.turma_id,
            data_aula=dados.data_aula,
            nivel_experiencia=dados.nivel_experiencia,
            status="pendente",
            observacoes=dados.observacoes,
        )
        return AgendamentoService._to_response(agendamento)

    @staticmethod
    def consultar_publico(
        db: Session, protocolo: Optional[str] = None, email: Optional[str] = None
    ) -> List[AgendamentoResponse]:
        if not protocolo and not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe o número de protocolo ou o e-mail para consultar o agendamento.",
            )
        registros = AgendamentoRepository.get_by_protocolo_or_email(
            db, protocolo=protocolo, email=email
        )
        return [AgendamentoService._to_response(r) for r in registros]

    @staticmethod
    def listar_todos(
        db: Session, status_filter: Optional[str] = None, modalidade: Optional[str] = None
    ) -> List[AgendamentoResponse]:
        registros = AgendamentoRepository.list_all(
            db, status_filter=status_filter, modalidade=modalidade
        )
        return [AgendamentoService._to_response(r) for r in registros]

    @staticmethod
    def atualizar_status(
        db: Session, agendamento_id: int, novo_status: str
    ) -> AgendamentoResponse:
        agendamento = AgendamentoRepository.get_by_id(db, agendamento_id)
        if not agendamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agendamento não encontrado.",
            )
        atualizado = AgendamentoRepository.update_status(db, agendamento, novo_status)
        return AgendamentoService._to_response(atualizado)

    @staticmethod
    def remover_agendamento(db: Session, agendamento_id: int) -> None:
        agendamento = AgendamentoRepository.get_by_id(db, agendamento_id)
        if not agendamento:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agendamento não encontrado.",
            )
        AgendamentoRepository.delete(db, agendamento)


class ContatoService:
    @staticmethod
    def registrar_mensagem(db: Session, dados: ContatoCreate) -> MensagemContato:
        return ContatoRepository.create(
            db,
            nome=dados.nome,
            email=dados.email,
            telefone=dados.telefone,
            mensagem=dados.mensagem,
        )

    @staticmethod
    def listar_mensagens(db: Session) -> List[MensagemContato]:
        return ContatoRepository.list_all(db)

    @staticmethod
    def marcar_como_lida(
        db: Session, contato_id: int, usuario_nome: str
    ) -> MensagemContato:
        contato = ContatoRepository.get_by_id(db, contato_id)
        if not contato:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mensagem de contato não encontrada.",
            )
        return ContatoRepository.mark_as_read(db, contato, respondida_por=usuario_nome)
