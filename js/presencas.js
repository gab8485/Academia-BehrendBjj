const formatoAula = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
});

function descricaoAula(aula) {
    return `${formatoAula.format(new Date(aula.inicio))} · ${aula.modalidade} · ${aula.formato}`;
}

async function apiPresencas(caminho, opcoes = {}, token = sessionStorage.getItem("behrend_token")) {
    const headers = { ...opcoes.headers };
    if (opcoes.body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const resposta = await fetch(`${API_BASE}${caminho}`, { ...opcoes, headers });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados) {
        const erro = new Error(typeof dados?.detail === "string"
            ? dados.detail
            : "Não foi possível concluir. Confira os dados e tente novamente.");
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}

function textoResposta(resposta) {
    if (resposta === "vou") return "Vou";
    if (resposta === "nao_vou") return "Não vou";
    return "Sem resposta";
}

function iniciarConfirmacaoAluno() {
    const formulario = document.getElementById("login-aluno");
    if (!formulario) return;

    const area = document.getElementById("area-minhas-aulas");
    const lista = document.getElementById("lista-minhas-aulas");
    const feedback = document.getElementById("feedback-aulas");
    let tokenAluno = sessionStorage.getItem("behrend_token_aluno");

    function sair() {
        tokenAluno = null;
        sessionStorage.removeItem("behrend_token_aluno");
        area.hidden = true;
        lista.replaceChildren();
        formulario.hidden = false;
        feedback.textContent = "";
    }

    async function carregar() {
        const aulas = await apiPresencas("/minhas-aulas", {}, tokenAluno);
        lista.replaceChildren();
        if (!aulas.length) lista.textContent = "Sem aulas disponíveis nesta semana.";

        for (const aula of aulas) {
            const cartao = document.createElement("article");
            cartao.className = "app-card aula-confirmacao";
            const titulo = document.createElement("h3");
            titulo.textContent = descricaoAula(aula);
            const estado = document.createElement("p");
            estado.setAttribute("role", "status");
            estado.textContent = textoResposta(aula.resposta);
            const botoes = [];
            const colegas = document.createElement("details");
            const resumo = document.createElement("summary");
            resumo.textContent = "Quem vai à aula?";
            const confirmados = document.createElement("p");
            confirmados.setAttribute("role", "status");
            colegas.append(resumo, confirmados);

            colegas.addEventListener("toggle", async () => {
                if (!colegas.open) return;
                confirmados.textContent = "Carregando confirmações…";
                try {
                    const nomes = await apiPresencas(`/minhas-aulas/${aula.id}/colegas`, {}, tokenAluno);
                    confirmados.textContent = nomes.length
                        ? nomes.join(" · ")
                        : "Nenhum colega confirmou presença ainda.";
                } catch (erro) {
                    confirmados.textContent = erro.message;
                }
            });

            cartao.append(titulo, estado);
            for (const resposta of ["vou", "nao_vou"]) {
                const botao = document.createElement("button");
                botao.type = "button";
                botao.className = "btn-mini";
                botao.textContent = textoResposta(resposta);
                botao.setAttribute("aria-pressed", String(aula.resposta === resposta));
                botoes.push([botao, resposta]);
                botao.addEventListener("click", async () => {
                    const sessao = tokenAluno;
                    for (const [item] of botoes) item.disabled = true;
                    try {
                        await apiPresencas(`/minhas-aulas/${aula.id}`, {
                            method: "PUT", body: JSON.stringify({ resposta })
                        }, sessao);
                        estado.textContent = `Resposta salva: ${textoResposta(resposta)}`;
                        for (const [item, valor] of botoes) {
                            item.setAttribute("aria-pressed", String(valor === resposta));
                        }
                    } catch (erro) {
                        if (erro.status === 401 && tokenAluno === sessao) {
                            sair();
                            feedback.textContent = "Sua sessão expirou. Entre novamente.";
                        } else {
                            estado.textContent = erro.message;
                        }
                    } finally {
                        for (const [item] of botoes) item.disabled = false;
                    }
                });
                cartao.append(botao);
            }
            cartao.append(colegas);
            lista.append(cartao);
        }
        formulario.hidden = true;
        area.hidden = false;
    }

    document.getElementById("sair-aulas").addEventListener("click", sair);
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const botao = formulario.querySelector("button");
        botao.disabled = true;
        feedback.textContent = "";
        try {
            const dados = await apiPresencas("/auth/login", {
                method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(formulario)))
            }, null);
            if (dados.usuario.papel !== "aluno") {
                throw new Error("Entre com uma conta de aluno.");
            }
            tokenAluno = dados.access_token;
            await carregar();
            sessionStorage.setItem("behrend_token_aluno", tokenAluno);
            formulario.reset();
        } catch (erro) {
            sair();
            feedback.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });
    if (tokenAluno) carregar().catch((erro) => {
        sair();
        feedback.textContent = erro.message;
    });
}

function iniciarGestaoAulas() {
    const painel = document.getElementById("gestao-confirmacoes");
    if (!painel) return;

    const selecao = document.getElementById("aula-gestao");
    const lista = document.getElementById("lista-confirmacoes");
    const cadastro = document.getElementById("cadastro-aluno");

    painel.addEventListener("toggle", async () => {
        if (!painel.open) return;
        selecao.replaceChildren(new Option("Selecione uma aula", ""));
        lista.replaceChildren();
        try {
            const aulas = await apiPresencas("/gestao/aulas");
            for (const aula of aulas) selecao.add(new Option(descricaoAula(aula), aula.id));
        } catch (erro) {
            lista.textContent = erro.message;
        }
    });

    selecao.addEventListener("change", async () => {
        const aula = selecao.value;
        lista.replaceChildren();
        if (!aula) return;
        try {
            const respostas = await apiPresencas(`/gestao/aulas/${aula}/confirmacoes`);
            if (selecao.value !== aula) return;
            if (!respostas.length) lista.textContent = "Ainda não há confirmações.";
            for (const item of respostas) {
                const linha = document.createElement("li");
                linha.textContent = `${item.nome} · ${textoResposta(item.resposta)}`;
                lista.append(linha);
            }
        } catch (erro) {
            if (selecao.value === aula) lista.textContent = erro.message;
        }
    });

    cadastro.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const botao = cadastro.querySelector("button");
        const feedback = document.getElementById("cadastro-aluno-feedback");
        botao.disabled = true;
        try {
            const dados = await apiPresencas("/gestao/alunos", {
                method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(cadastro)))
            });
            cadastro.reset();
            feedback.textContent = dados.mensagem;
        } catch (erro) {
            feedback.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    iniciarConfirmacaoAluno();
    iniciarGestaoAulas();
});
