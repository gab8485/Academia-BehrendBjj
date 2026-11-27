const painelMidias = document.getElementById("gestao-midias");
const formularioMidia = document.getElementById("form-midia-site");
const seletorMidia = document.getElementById("midia-site-item");
const arquivoMidia = document.getElementById("midia-site-arquivo");
const rotuloArquivoMidia = document.getElementById("midia-site-arquivo-label");
const previaMidia = document.getElementById("midia-site-previa");
const feedbackMidia = document.getElementById("midia-site-feedback");
const salvarMidia = formularioMidia.querySelector('[type="submit"]');
const restaurarMidia = document.getElementById("midia-site-restaurar");
let catalogoMidias = [];
let sessaoMidias;
let operacaoMidia = false;

function atualizarPreviaMidia() {
    const item = catalogoMidias.find(midia => midia.nome === seletorMidia.value);
    previaMidia.replaceChildren();
    arquivoMidia.value = "";
    arquivoMidia.disabled = !item;
    salvarMidia.disabled = !item;
    restaurarMidia.disabled = !item?.personalizada;
    if (!item) return;

    const origem = servidorLocal ? `http://${hostname}:8000` : "";
    const previa = document.createElement(item.video ? "video" : "img");
    previa.src = `${origem}/img/${encodeURIComponent(item.nome)}?previa=${Date.now()}`;
    if (item.video) {
        previa.controls = true;
        previa.playsInline = true;
        previa.preload = "metadata";
    } else {
        previa.alt = item.rotulo;
    }
    previaMidia.append(previa);
    arquivoMidia.accept = item.video ? "video/mp4,.mp4" : "image/jpeg,image/png,image/webp";
    const formatos = item.video ? "MP4" : "JPEG, PNG ou WebP";
    rotuloArquivoMidia.textContent = `Novo arquivo (${formatos}, até ${item.limite_mb} MB)`;
}

async function requisitarMidia(caminho, token, opcoes = {}) {
    const resposta = await fetch(`${API_BASE}/midias${caminho}`, {
        ...opcoes,
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) {
        const erro = await resposta.json().catch(() => null);
        throw new Error(typeof erro?.detail === "string" ? erro.detail : "Não foi possível concluir a operação.");
    }
    return resposta;
}

async function carregarMidias(token) {
    feedbackMidia.textContent = "Carregando mídias…";
    try {
        const resposta = await requisitarMidia("", token);
        const dados = await resposta.json();
        if (token !== sessaoMidias) return;
        catalogoMidias = dados;
        seletorMidia.replaceChildren(new Option("Selecione uma foto ou vídeo", ""));
        for (const midia of catalogoMidias) seletorMidia.add(new Option(midia.rotulo, midia.nome));
        atualizarPreviaMidia();
        feedbackMidia.textContent = "";
    } catch (erro) {
        if (token === sessaoMidias) feedbackMidia.textContent = erro.message;
    }
}

function atualizarSessaoMidias() {
    const usuario = JSON.parse(sessionStorage.getItem("behrend_user"));
    const token = usuario?.papel === "admin" ? sessionStorage.getItem("behrend_token") : null;
    if (token === sessaoMidias) return;
    sessaoMidias = token;
    painelMidias.hidden = !token;
    painelMidias.open = false;
    seletorMidia.replaceChildren();
    catalogoMidias = [];
    feedbackMidia.textContent = "";
    atualizarPreviaMidia();
}

async function salvarAlteracaoMidia(restaurar) {
    const item = catalogoMidias.find(midia => midia.nome === seletorMidia.value);
    const token = sessaoMidias;
    if (!item || !token || operacaoMidia) return;
    if (restaurar && !window.confirm(`Restaurar a mídia original de “${item.rotulo}”?`)) return;
    const arquivo = arquivoMidia.files[0];
    if (!restaurar && (!arquivo || arquivo.size > item.limite_mb * 1024 * 1024)) {
        feedbackMidia.textContent = `Escolha um arquivo de até ${item.limite_mb} MB.`;
        return;
    }
    const opcoes = { method: restaurar ? "DELETE" : "PUT" };
    if (!restaurar) opcoes.body = new FormData(formularioMidia);

    operacaoMidia = true;
    seletorMidia.disabled = arquivoMidia.disabled = salvarMidia.disabled = restaurarMidia.disabled = true;
    feedbackMidia.textContent = "Salvando…";
    try {
        await requisitarMidia(`/${encodeURIComponent(item.nome)}`, token, opcoes);
        if (token !== sessaoMidias) return;
        item.personalizada = !restaurar;
        atualizarPreviaMidia();
        feedbackMidia.textContent = restaurar ? "Mídia original restaurada." : "Mídia atualizada.";
    } catch (erro) {
        if (token === sessaoMidias) feedbackMidia.textContent = erro.message;
    } finally {
        operacaoMidia = false;
        seletorMidia.disabled = false;
        salvarMidia.disabled = arquivoMidia.disabled = !seletorMidia.value;
        restaurarMidia.disabled = !catalogoMidias.find(midia => midia.nome === seletorMidia.value)?.personalizada;
    }
}

painelMidias.addEventListener("toggle", () => {
    if (painelMidias.open && sessaoMidias && !catalogoMidias.length) void carregarMidias(sessaoMidias);
});
seletorMidia.addEventListener("change", () => {
    feedbackMidia.textContent = "";
    atualizarPreviaMidia();
});
formularioMidia.addEventListener("submit", evento => {
    evento.preventDefault();
    void salvarAlteracaoMidia(false);
});
restaurarMidia.addEventListener("click", () => salvarAlteracaoMidia(true));
document.addEventListener("painel-sessao", atualizarSessaoMidias);
atualizarSessaoMidias();
