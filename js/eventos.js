const formularioEvento = document.getElementById("form-evento");
const tipoEvento = document.getElementById("evento-tipo");
const camposCompeticao = document.getElementById("evento-competicao");
const feedbackEvento = document.getElementById("evento-feedback");
const tokenEquipe = sessionStorage.getItem("behrend_token");
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
        link.textContent = "Ver competição";
        texto.append(link);
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
    void carregarEventos[tipo](true);
}

function atualizarCamposEvento() {
    const competicao = tipoEvento.value === "competicao";
    camposCompeticao.hidden = !competicao;
    camposCompeticao.disabled = !competicao;
}

tipoEvento.addEventListener("change", atualizarCamposEvento);
if (tokenEquipe) {
    const headers = { Authorization: `Bearer ${tokenEquipe}` };
    eventosApi("/auth/me", { headers }).then(usuario => {
        document.getElementById("publicar-evento").hidden = !["admin", "instrutor"].includes(usuario.papel);
    }).catch(() => {});
    formularioEvento.addEventListener("submit", async evento => {
        evento.preventDefault();
        const botao = formularioEvento.querySelector('[type="submit"]');
        botao.disabled = true;
        feedbackEvento.textContent = "Publicando…";
        const body = new FormData(formularioEvento);
        if (!body.get("foto").size) body.delete("foto");
        try {
            const salvo = await eventosApi("/eventos", { method: "POST", headers, body });
            formularioEvento.reset();
            atualizarCamposEvento();
            feedbackEvento.textContent = "Publicado com sucesso.";
            void carregarEventos[salvo.tipo](true);
        } catch (erro) {
            feedbackEvento.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });
}
