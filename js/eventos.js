const formularioEvento = document.getElementById("form-evento");
const tipoEvento = document.getElementById("evento-tipo");
const camposCompeticao = document.getElementById("evento-competicao");
const feedbackEvento = document.getElementById("evento-feedback");
const tokenEquipe = sessionStorage.getItem("behrend_token");
const secaoFormulario = document.getElementById("publicar-evento");
const botaoSalvar = formularioEvento.querySelector('[type="submit"]');
const botaoCancelar = document.getElementById("cancelar-edicao-evento");
const rotuloFoto = formularioEvento.querySelector('label[for="evento-foto"]');
const rotuloFotoOriginal = rotuloFoto.textContent;
let podePublicar = false;
let editando = null;
const dataCompeticao = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });

async function eventosApi(caminho, opcoes) {
    const resposta = await fetch(`${API_BASE}${caminho}`, opcoes);
    const dados = await resposta.json();
    if (!resposta.ok) {
        throw new Error(typeof dados.detail === "string" ? dados.detail : "Confira os dados e tente novamente.");
    }
    return dados;
}

function cartaoEvento(item) {
    const cartao = document.createElement("article");
    cartao.className = "app-card evento-cartao";
    if (item.foto) {
        const imagem = document.createElement("img");
        imagem.src = `${API_BASE}${item.foto}`;
        imagem.alt = `Foto da publicação ${item.titulo}`;
        imagem.loading = "lazy";
        cartao.append(imagem);
    }
    const texto = document.createElement("div");
    texto.className = "evento-conteudo";
    const titulo = document.createElement("h3");
    titulo.textContent = item.titulo;
    texto.append(titulo);

    if (item.data_evento) {
        const data = document.createElement("time");
        data.dateTime = item.data_evento;
        data.textContent = dataCompeticao.format(new Date(item.data_evento));
        texto.append(data);
    }

    const descricao = document.createElement("p");
    descricao.textContent = item.descricao;
    texto.append(descricao);
    if (item.link) {
        const link = document.createElement("a");
        link.className = "btn-smais";
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Inscrever-se";
        texto.append(link);
    }
    if (podePublicar) {
        const acoes = document.createElement("div");
        acoes.className = "evento-acoes";
        const editar = document.createElement("button");
        editar.type = "button";
        editar.className = "btn-smais";
        editar.textContent = "Editar";
        editar.addEventListener("click", () => abrirEdicao(item));
        const excluir = document.createElement("button");
        excluir.type = "button";
        excluir.className = "btn-smais";
        excluir.textContent = "Excluir";
        const estado = document.createElement("p");
        estado.setAttribute("role", "status");
        excluir.addEventListener("click", () => excluirEvento(item, excluir, estado));
        acoes.append(editar, excluir);
        texto.append(acoes, estado);
    }
    cartao.append(texto);
    return cartao;
}

const carregarEventos = {};
for (const tipo of ["competicao", "publicacao"]) {
    const lista = document.getElementById(`lista-${tipo}`);
    const estado = document.getElementById(`status-${tipo}`);
    const mais = document.getElementById(`mais-${tipo}`);
    let pagina = 0;
    let consulta = 0;
    carregarEventos[tipo] = async (reiniciar = false) => {
        const numeroConsulta = ++consulta;
        const proxima = reiniciar ? 1 : pagina + 1;
        mais.disabled = true;
        estado.textContent = "Carregando…";
        try {
            const dados = await eventosApi(`/eventos?tipo=${tipo}&pagina=${proxima}`);
            if (numeroConsulta !== consulta) return;
            if (reiniciar) lista.replaceChildren();
            lista.append(...dados.itens.map(cartaoEvento));
            pagina = proxima;
            mais.hidden = !dados.tem_mais;
            estado.textContent = lista.children.length ? "" : "Nenhum item publicado até agora.";
        } catch (erro) {
            if (numeroConsulta === consulta) estado.textContent = "Não foi possível carregar. Tente recarregar a página.";
        } finally {
            if (numeroConsulta === consulta) mais.disabled = false;
        }
    };
    mais.addEventListener("click", () => carregarEventos[tipo]());
}

function atualizarCamposEvento() {
    const competicao = tipoEvento.value === "competicao";
    camposCompeticao.hidden = !competicao;
    camposCompeticao.disabled = !competicao;
}

function limparFormulario() {
    editando = null;
    formularioEvento.reset();
    tipoEvento.disabled = false;
    secaoFormulario.querySelector("summary").textContent = "Nova publicação";
    botaoSalvar.textContent = "Publicar";
    botaoCancelar.hidden = true;
    rotuloFoto.textContent = rotuloFotoOriginal;
    feedbackEvento.textContent = "";
    atualizarCamposEvento();
}

function abrirEdicao(item) {
    if (botaoSalvar.disabled) return;
    limparFormulario();
    editando = item;
    tipoEvento.value = item.tipo;
    tipoEvento.disabled = true;
    for (const nome of ["titulo", "descricao", "data_evento", "link"]) {
        formularioEvento.elements.namedItem(nome).value = item[nome] ?? "";
    }
    atualizarCamposEvento();
    secaoFormulario.open = true;
    secaoFormulario.querySelector("summary").textContent = "Editar publicação";
    botaoSalvar.textContent = "Salvar alterações";
    botaoCancelar.hidden = false;
    if (item.foto) rotuloFoto.textContent = `${rotuloFotoOriginal}. Deixe em branco para manter a foto atual.`;
    formularioEvento.elements.namedItem("titulo").focus();
}

const headersEquipe = { Authorization: `Bearer ${tokenEquipe}` };

async function excluirEvento(item, botao, estado) {
    if (!window.confirm(`Excluir “${item.titulo}”? Esta ação é permanente.`)) return;
    botao.disabled = true;
    estado.textContent = "Excluindo…";
    try {
        await eventosApi(`/eventos/${item.id}`, { method: "DELETE", headers: headersEquipe });
        if (editando?.id === item.id) limparFormulario();
        await carregarEventos[item.tipo](true);
    } catch (erro) {
        estado.textContent = erro.message;
        botao.disabled = false;
    }
}

tipoEvento.addEventListener("change", atualizarCamposEvento);
botaoCancelar.addEventListener("click", limparFormulario);
for (const carregar of Object.values(carregarEventos)) void carregar(true);
if (tokenEquipe) {
    eventosApi("/auth/me", { headers: headersEquipe }).then(usuario => {
        podePublicar = ["admin", "instrutor"].includes(usuario.papel);
        secaoFormulario.hidden = !podePublicar;
        if (podePublicar) {
            for (const carregar of Object.values(carregarEventos)) void carregar(true);
        }
    }).catch(() => {});
    formularioEvento.addEventListener("submit", async evento => {
        evento.preventDefault();
        const item = editando;
        botaoSalvar.disabled = true;
        botaoCancelar.disabled = true;
        feedbackEvento.textContent = item ? "Salvando…" : "Publicando…";
        const body = new FormData(formularioEvento);
        body.set("tipo", tipoEvento.value);
        if (!body.get("foto").size) body.delete("foto");
        try {
            const salvo = await eventosApi(item ? `/eventos/${item.id}` : "/eventos", {
                method: item ? "PUT" : "POST",
                headers: headersEquipe,
                body,
            });
            limparFormulario();
            feedbackEvento.textContent = item ? "Alterações salvas." : "Publicado com sucesso.";
            void carregarEventos[salvo.tipo](true);
        } catch (erro) {
            feedbackEvento.textContent = erro.message;
        } finally {
            botaoSalvar.disabled = false;
            botaoCancelar.disabled = false;
        }
    });
}
