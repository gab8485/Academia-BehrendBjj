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
            colegas.className = "aula-confirmados";
            const resumo = document.createElement("summary");
            resumo.textContent = "Quem vai à aula?";
            const confirmados = document.createElement("p");
            confirmados.setAttribute("role", "status");
            const listaColegas = document.createElement("ul");
            listaColegas.className = "aula-confirmados-lista";
            colegas.append(resumo, confirmados, listaColegas);

            let consulta = 0;
            async function carregarConfirmados() {
                if (!colegas.open) return;
                const atual = ++consulta;
                listaColegas.replaceChildren();
                confirmados.textContent = "Carregando confirmações…";
                try {
                    const confirmacoes = await apiPresencas(
                        `/minhas-aulas/${aula.id}/colegas?incluir_faixa=true`, {}, tokenAluno
                    );
                    if (consulta !== atual) return;
                    confirmados.textContent = confirmacoes.length ? "" : "Ninguém confirmou presença ainda.";
                    for (const registro of confirmacoes) {
                        const item = typeof registro === "string" ? { nome: registro } : registro;
                        const linha = document.createElement("li");
                        linha.append(item.nome, " · ", rotuloFaixa(item.faixa));
                        listaColegas.append(linha);
                    }
                } catch (erro) {
                    if (consulta === atual) confirmados.textContent = erro.message;
                }
            }
            colegas.addEventListener("toggle", carregarConfirmados);

            cartao.append(titulo, estado);
            for (const resposta of ["vou", "nao_vou", null]) {
                const botao = document.createElement("button");
                botao.type = "button";
                botao.className = "btn-mini";
                botao.textContent = resposta === null ? "Desmarcar" : textoResposta(resposta);
                if (resposta === null) {
                    botao.disabled = aula.resposta === null;
                } else {
                    botao.setAttribute("aria-pressed", String(aula.resposta === resposta));
                }
                botoes.push([botao, resposta]);
                botao.addEventListener("click", async () => {
                    const sessao = tokenAluno;
                    for (const [item] of botoes) item.disabled = true;
                    try {
                        await apiPresencas(`/minhas-aulas/${aula.id}`, {
                            method: "PUT", body: JSON.stringify({ resposta })
                        }, sessao);
                        aula.resposta = resposta;
                        void carregarConfirmados();
                        estado.textContent = resposta === null ? "Sem resposta" : `Resposta salva: ${textoResposta(resposta)}`;
                        for (const [item, valor] of botoes) {
                            if (valor !== null) item.setAttribute("aria-pressed", String(valor === resposta));
                        }
                    } catch (erro) {
                        if (erro.status === 401 && tokenAluno === sessao) {
                            sair();
                            feedback.textContent = "Sua sessão expirou. Entre novamente.";
                        } else {
                            estado.textContent = erro.message;
                        }
                    } finally {
                        for (const [item, valor] of botoes) {
                            item.disabled = valor === null && aula.resposta === null;
                        }
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
        const botao = formulario.querySelector('[type="submit"]');
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
    const lista = document.getElementById("lista-confirmacoes");
    if (!lista) return;

    const feedback = document.getElementById("confirmacoes-feedback");
    let consulta = 0;
    let tokenAtual;

    async function carregarPresencas() {
        const token = sessionStorage.getItem("behrend_token");
        const atual = ++consulta;
        if (token !== tokenAtual) {
            tokenAtual = token;
            lista.replaceChildren();
            feedback.textContent = token ? "Carregando presenças…" : "";
        }
        if (!token) return;

        try {
            const presencas = await apiPresencas("/gestao/presencas", {}, token);
            if (atual !== consulta || token !== sessionStorage.getItem("behrend_token")) return;
            const linhas = presencas.map(item => {
                const linha = document.createElement("tr");
                linha.insertCell().textContent = item.nome;
                linha.insertCell().append(rotuloFaixa(item.faixa));
                linha.insertCell().textContent = formatoAula.format(new Date(item.inicio));
                linha.insertCell().textContent = `${item.modalidade} · ${item.formato}`;
                return linha;
            });
            lista.replaceChildren(...linhas);
            feedback.textContent = linhas.length ? "" : "Nenhuma presença confirmada.";
        } catch (erro) {
            if (atual !== consulta || token !== sessionStorage.getItem("behrend_token")) return;
            lista.replaceChildren();
            feedback.textContent = erro.message;
        }
    }

    document.addEventListener("painel-sessao", carregarPresencas);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) void carregarPresencas();
    });
    window.setInterval(() => {
        if (!document.hidden) void carregarPresencas();
    }, 30000);
    void carregarPresencas();
}

const coresFaixas = new Map([
    ["Branca", ["#fff"]],
    ["Cinza e branca", ["#9ca3af", "#fff"]], ["Cinza", ["#9ca3af"]], ["Cinza e preta", ["#9ca3af", "#111"]],
    ["Amarela e branca", ["#facc15", "#fff"]], ["Amarela", ["#facc15"]], ["Amarela e preta", ["#facc15", "#111"]],
    ["Laranja e branca", ["#fb923c", "#fff"]], ["Laranja", ["#fb923c"]], ["Laranja e preta", ["#fb923c", "#111"]],
    ["Verde e branca", ["#22c55e", "#fff"]], ["Verde", ["#22c55e"]], ["Verde e preta", ["#22c55e", "#111"]],
    ["Azul", ["#3b82f6"]], ["Roxa", ["#a855f7"]], ["Marrom", ["#965d36"]], ["Preta", ["#111"]],
    ["Coral", ["#ef4444", "#111"]], ["Vermelha", ["#ef4444"]],
]);

function aplicarCorFaixa(circulo, faixa) {
    const cores = coresFaixas.get(faixa);
    circulo.hidden = !cores;
    circulo.style.background = cores?.length === 2
        ? `linear-gradient(90deg, ${cores[0]} 50%, ${cores[1]} 50%)`
        : (cores?.[0] ?? "");
}

function criarCirculoFaixa() {
    const circulo = document.createElement("span");
    circulo.className = "faixa-cor";
    circulo.setAttribute("aria-hidden", "true");
    return circulo;
}

function rotuloFaixa(faixa) {
    const rotulo = document.createElement("span");
    rotulo.className = "faixa-rotulo";
    const circulo = criarCirculoFaixa();
    aplicarCorFaixa(circulo, faixa);
    rotulo.append(circulo, faixa ?? "Não informada");
    return rotulo;
}

function adicionarCirculoAoSeletor(seletor) {
    const linha = document.createElement("div");
    linha.className = "faixa-seletor";
    seletor.before(linha);
    const circulo = criarCirculoFaixa();
    circulo.hidden = true;
    linha.append(circulo, seletor);
    return circulo;
}

function iniciarGestaoContas(papel, grupo, tituloCadastro) {
    const gestao = document.getElementById(`gestao-${grupo}`);
    if (!gestao) return;

    const cadastro = document.getElementById(`cadastro-${papel}`);
    const selecao = document.getElementById(`${papel}-cadastrado`);
    const feedback = document.getElementById(`cadastro-${papel}-feedback`);
    const feedbackLista = document.getElementById(`gestao-${grupo}-feedback`);
    const faixa = cadastro.elements.namedItem("faixa");
    const senhaInicial = document.getElementById(`senha-inicial-${papel}`);
    const editar = gestao.querySelector(".editar-conta");
    const cancelar = cadastro.querySelector(".cancelar-conta");
    const salvar = cadastro.querySelector('[type="submit"]');
    const titulo = cadastro.querySelector("h3");
    const excluir = gestao.querySelector("#excluir-aluno");
    const novaSenha = gestao.querySelector("#aluno-nova-senha");
    const caminho = `/gestao/${grupo}`;
    let contas = [];
    let contaEditada = null;
    let consulta = 0;

    faixa.add(new Option("Não informada", ""));
    for (const cor of coresFaixas.keys()) faixa.add(new Option(cor, cor));

    const circuloFaixa = adicionarCirculoAoSeletor(faixa);
    const circuloConta = adicionarCirculoAoSeletor(selecao);
    faixa.addEventListener("change", () => aplicarCorFaixa(circuloFaixa, faixa.value));

    function atualizarAcoes() {
        editar.disabled = !selecao.value || salvar.disabled;
        if (excluir) excluir.disabled = !selecao.value;
        const conta = contas.find(item => String(item.id) === selecao.value);
        aplicarCorFaixa(circuloConta, conta?.faixa);
    }

    function modoCadastro() {
        contaEditada = null;
        cadastro.reset();
        aplicarCorFaixa(circuloFaixa, faixa.value);
        senhaInicial.hidden = false;
        senhaInicial.disabled = false;
        cancelar.textContent = "Cancelar cadastro";
        titulo.textContent = tituloCadastro;
        salvar.textContent = `Criar conta de ${papel}`;
        feedback.textContent = "";
    }

    async function carregarContas(id = "") {
        const token = sessionStorage.getItem("behrend_token");
        const atual = ++consulta;
        selecao.replaceChildren(new Option(`Selecione um ${papel}`, ""));
        contas = [];
        atualizarAcoes();
        feedbackLista.textContent = "";
        try {
            const dados = await apiPresencas(caminho, {}, token);
            if (atual !== consulta || token !== sessionStorage.getItem("behrend_token")) return;
            contas = dados;
            for (const item of contas) {
                const rotulo = `${item.nome} · ${item.faixa ?? "Faixa não informada"} · ${item.email}`;
                selecao.add(new Option(rotulo, item.id));
            }
            if (contas.some(item => String(item.id) === id)) selecao.value = id;
            if (!contas.length) feedbackLista.textContent = `Nenhum ${papel} ativo cadastrado.`;
            atualizarAcoes();
        } catch (erro) {
            if (atual === consulta && token === sessionStorage.getItem("behrend_token")) feedbackLista.textContent = erro.message;
        }
    }

    gestao.addEventListener("toggle", () => {
        if (gestao.open && !gestao.hidden) void carregarContas(selecao.value);
    });
    let tokenConta = sessionStorage.getItem("behrend_token");
    document.addEventListener("painel-sessao", () => {
        const token = sessionStorage.getItem("behrend_token");
        if (token === tokenConta) return;
        tokenConta = token;
        gestao.open = false;
        consulta++;
        modoCadastro();
        selecao.replaceChildren(new Option(`Selecione um ${papel}`, ""));
        contas = [];
        feedbackLista.textContent = "";
        if (novaSenha) novaSenha.value = "";
        atualizarAcoes();
    });
    selecao.addEventListener("change", () => {
        atualizarAcoes();
        if (novaSenha) novaSenha.value = "";
    });
    cancelar.addEventListener("click", modoCadastro);
    editar.addEventListener("click", () => {
        const conta = contas.find(item => String(item.id) === selecao.value);
        if (!conta) return;
        modoCadastro();
        contaEditada = conta;
        for (const campo of ["nome", "email", "faixa"]) {
            cadastro.elements.namedItem(campo).value = conta[campo] ?? "";
        }
        aplicarCorFaixa(circuloFaixa, faixa.value);
        senhaInicial.hidden = true;
        senhaInicial.disabled = true;
        cancelar.textContent = "Cancelar edição";
        titulo.textContent = `Editar ${papel}`;
        salvar.textContent = "Salvar alterações";
        cadastro.elements.namedItem("nome").focus();
    });

    cadastro.addEventListener("submit", async evento => {
        evento.preventDefault();
        const token = sessionStorage.getItem("behrend_token");
        const id = contaEditada ? String(contaEditada.id) : "";
        const dados = Object.fromEntries(new FormData(cadastro));
        dados.faixa = dados.faixa || null;
        salvar.disabled = cancelar.disabled = true;
        atualizarAcoes();
        try {
            const resposta = await apiPresencas(id ? `${caminho}/${id}` : caminho, {
                method: id ? "PATCH" : "POST",
                body: JSON.stringify(dados),
            }, token);
            if (token !== sessionStorage.getItem("behrend_token")) return;
            modoCadastro();
            feedback.textContent = resposta.mensagem;
            if (papel === "aluno") document.dispatchEvent(new Event("painel-sessao"));
            await carregarContas(id);
        } catch (erro) {
            if (token === sessionStorage.getItem("behrend_token")) feedback.textContent = erro.message;
        } finally {
            salvar.disabled = cancelar.disabled = false;
            atualizarAcoes();
        }
    });

    if (papel !== "aluno") return;
    const formularioAluno = document.getElementById("administrar-aluno");
    formularioAluno.addEventListener("submit", async evento => {
        evento.preventDefault();
        const botao = formularioAluno.querySelector('[type="submit"]');
        botao.disabled = true;
        try {
            const dados = await apiPresencas(`/gestao/alunos/${selecao.value}/senha`, {
                method: "PATCH", body: JSON.stringify({ senha: novaSenha.value })
            });
            novaSenha.value = "";
            feedbackLista.textContent = dados.mensagem;
        } catch (erro) {
            feedbackLista.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });

    excluir.addEventListener("click", async () => {
        if (!selecao.value || !window.confirm(`Remover o acesso de ${selecao.selectedOptions[0].text}?`)) return;
        excluir.disabled = true;
        try {
            const dados = await apiPresencas(`/gestao/alunos/${selecao.value}`, { method: "DELETE" });
            novaSenha.value = "";
            await carregarContas();
            document.dispatchEvent(new Event("painel-sessao"));
            feedbackLista.textContent = dados.mensagem;
        } catch (erro) {
            feedbackLista.textContent = erro.message;
            excluir.disabled = !selecao.value;
        }
    });

}

document.addEventListener("DOMContentLoaded", () => {
    for (const botao of document.querySelectorAll("[data-alternar-senha]")) {
        const campo = document.getElementById(botao.getAttribute("aria-controls"));
        const rotulo = botao.querySelector("span");

        function mostrarSenha(mostrar) {
            campo.type = mostrar ? "text" : "password";
            rotulo.textContent = mostrar ? "Ocultar senha" : "Mostrar senha";
        }

        botao.addEventListener("click", () => mostrarSenha(campo.type === "password"));
        campo.form.addEventListener("reset", () => mostrarSenha(false));
    }
    iniciarConfirmacaoAluno();
    iniciarGestaoAulas();
    iniciarGestaoContas("aluno", "alunos", "Cadastrar aluno");
    iniciarGestaoContas("instrutor", "instrutores", "Cadastrar instrutor");
});
