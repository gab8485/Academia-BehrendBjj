"""Grade semanal usada nas aulas experimentais e nas confirmações."""

SEG_QUA = (
    ("adulto", "06:15", "Gi"), ("adulto", "10:15", "NoGi"),
    ("adulto", "12:15", "Gi"), ("adulto", "17:30", "NoGi"),
    ("adulto", "19:30", "Gi"), ("adulto", "21:00", "Gi"),
    ("infantil", "09:00", "Gi"), ("infantil", "16:30", "Gi"),
    ("infantil", "18:30", "Gi"),
)
TER_QUI = (
    ("adulto", "08:00", "Gi"), ("adulto", "12:00", "NoGi"),
    ("adulto", "18:00", "Gi"), ("adulto", "20:00", "Gi"),
    ("infantil", "10:00", "Gi"), ("infantil", "19:00", "Gi"),
)
GRADE = {
    0: SEG_QUA, 1: TER_QUI, 2: SEG_QUA, 3: TER_QUI,
    4: (
        ("adulto", "06:15", "NoGi"), ("adulto", "08:00", "Gi"),
        ("adulto", "17:30", "Gi"), ("adulto", "19:30", "NoGi"),
        ("infantil", "18:30", "NoGi"),
    ),
    5: (("adulto", "11:00", "Gi"), ("infantil", "10:00", "Gi")),
}


DIAS = ("Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo")


def horarios_experimentais():
    horarios = {}
    for dia, aulas in GRADE.items():
        for grupo, hora, formato in aulas:
            horarios.setdefault((grupo, hora, formato), []).append(dia)
    return horarios
