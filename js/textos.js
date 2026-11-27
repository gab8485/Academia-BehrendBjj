(() => {
    const arquivo = decodeURIComponent(location.pathname.split("/").pop()) || "index.html";
    const paginaAtual = arquivo === "endereco.html" ? "endereço.html" : arquivo;
    const chaveAdicional = "texto-adicional";

    function catalogar(documento) {
        const trechos = new Map();
        for (const elemento of documento.querySelectorAll("[data-texto]")) {
            const chave = elemento.dataset.texto;
            const placeholder = elemento.getAttribute("placeholder");
            if (placeholder) trechos.set(`${chave}:placeholder`, { original: placeholder, elemento });
            const nos = [...elemento.childNodes].filter(no => no.nodeType === Node.TEXT_NODE && no.data.trim());
            nos.forEach((no, indice) => {
                trechos.set(`${chave}:${indice}`, { original: no.data, no, elemento });
            });
        }
        return trechos;
    }

    let trechosPagina;
    const secaoAdicional = document.querySelector("[data-texto-extra]");

    function aplicarTexto(chave, texto) {
        if (chave === chaveAdicional) {
            const paragrafos = (texto ?? "").split(/\n\s*\n/).filter(paragrafo => paragrafo.trim());
            secaoAdicional.replaceChildren(...paragrafos.map(conteudo => {
                const paragrafo = document.createElement("p");
                paragrafo.textContent = conteudo;
                return paragrafo;
            }));
            secaoAdicional.hidden = !paragrafos.length;
            return;
        }

        const trecho = trechosPagina.get(chave);
        if (!trecho) return;
        if (trecho.no) {
            const [, inicio, fim] = trecho.original.match(/^(\s*)[\s\S]*?(\s*)$/);
            trecho.no.data = texto === null ? trecho.original : `${inicio}${texto}${fim}`;
            if (texto?.includes("\n")) trecho.elemento.classList.add("texto-com-quebras");
        } else {
            trecho.elemento.setAttribute("placeholder", texto ?? trecho.original);
        }
    }

    async function apiTextos(caminho, opcoes = {}) {
        const resposta = await fetch(`${API_BASE}/textos${caminho}`, { cache: "no-store", ...opcoes });
        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => null);
            throw new Error(typeof erro?.detail === "string" ? erro.detail : "Não foi possível carregar ou salvar o texto.");
        }
        return resposta;
    }

    document.addEventListener("DOMContentLoaded", async () => {
        trechosPagina = catalogar(document);
        try {
            const resposta = await apiTextos(`/${encodeURIComponent(paginaAtual)}`);
            const alteracoes = await resposta.json();
            for (const [chave, texto] of Object.entries(alteracoes)) aplicarTexto(chave, texto);
        } catch {
            // O conteúdo original continua disponível se a API estiver fora do ar.
        }
    });

    const painel = document.getElementById("gestao-textos");
    if (!painel) return;
    const formulario = document.getElementById("form-textos-site");
    const pagina = document.getElementById("textos-site-pagina");
    const busca = document.getElementById("textos-site-busca");
    const seletor = document.getElementById("textos-site-trecho");
    const valor = document.getElementById("textos-site-valor");
    const feedback = document.getElementById("textos-site-feedback");
    const botaoSalvar = formulario.querySelector('[type="submit"]');
    const restaurar = document.getElementById("textos-site-restaurar");
    let originais = new Map();
    let alteracoes = new Map();
    let tokenAdmin;
    let consulta = 0;
    let salvando = false;

    function autorizar(token) {
        return { Authorization: `Bearer ${token}` };
    }

    function atualizarCampo() {
        const chave = seletor.value;
        valor.value = alteracoes.get(chave) ?? originais.get(chave) ?? "";
        valor.disabled = botaoSalvar.disabled = !chave || salvando;
        restaurar.disabled = !alteracoes.has(chave) || salvando;
    }

    function atualizarSeletor() {
        const selecionado = seletor.value;
        const termo = busca.value.trim().toLocaleLowerCase("pt-BR");
        seletor.replaceChildren(new Option("Selecione um trecho", ""));
        for (const [chave, original] of originais) {
            const atual = alteracoes.get(chave) ?? original;
            const nome = chave === chaveAdicional ? "Adicionar texto à página" : (atual.trim() || original);
            if (termo && !`${nome} ${original}`.toLocaleLowerCase("pt-BR").includes(termo)) continue;
            seletor.add(new Option(nome.replace(/\s+/g, " ").slice(0, 120), chave));
        }
        seletor.value = selecionado;
        seletor.disabled = !originais.size;
        if (seletor.selectedIndex < 0) seletor.selectedIndex = 0;
        atualizarCampo();
    }

    function sincronizarSessao() {
        const usuario = JSON.parse(sessionStorage.getItem("behrend_user"));
        const token = usuario?.papel === "admin" ? sessionStorage.getItem("behrend_token") : null;
        if (token === tokenAdmin) return;
        tokenAdmin = token;
        consulta++;
        painel.hidden = !token;
        painel.open = false;
        pagina.replaceChildren();
        originais.clear();
        alteracoes.clear();
        busca.value = "";
        busca.disabled = true;
        feedback.textContent = "";
        atualizarSeletor();
    }

    painel.addEventListener("toggle", async () => {
        if (!painel.open || !tokenAdmin || pagina.options.length) return;
        const token = tokenAdmin;
        feedback.textContent = "Carregando páginas…";
        try {
            const resposta = await apiTextos("", { headers: autorizar(token) });
            const dados = await resposta.json();
            if (token !== tokenAdmin) return;
            pagina.replaceChildren(new Option("Selecione uma página", ""));
            for (const [arquivo, nome] of Object.entries(dados)) pagina.add(new Option(nome, arquivo));
            feedback.textContent = "";
        } catch (erro) {
            if (token === tokenAdmin) feedback.textContent = erro.message;
        }
    });

    pagina.addEventListener("change", async () => {
        const atual = ++consulta;
        const caminho = `/${encodeURIComponent(pagina.value)}`;
        originais.clear();
        alteracoes.clear();
        busca.value = "";
        busca.disabled = true;
        atualizarSeletor();
        feedback.textContent = "";
        if (!pagina.value) return;
        feedback.textContent = "Carregando trechos…";
        try {
            const [original, salvos] = await Promise.all([
                apiTextos(`${caminho}/original`, { headers: autorizar(tokenAdmin) }).then(r => r.text()),
                apiTextos(caminho).then(r => r.json()),
            ]);
            if (atual !== consulta) return;
            const documento = new DOMParser().parseFromString(original, "text/html");
            originais = new Map([[chaveAdicional, ""]]);
            for (const [chave, trecho] of catalogar(documento)) originais.set(chave, trecho.original.trim());
            alteracoes = new Map(Object.entries(salvos));
            busca.disabled = false;
            atualizarSeletor();
            feedback.textContent = "";
        } catch (erro) {
            if (atual === consulta) feedback.textContent = erro.message;
        }
    });

    async function salvarTexto(texto) {
        const chave = seletor.value;
        const alvo = pagina.value;
        const token = tokenAdmin;
        if (!chave || !token || salvando) return;
        salvando = true;
        for (const campo of [pagina, busca, seletor, valor, botaoSalvar, restaurar]) campo.disabled = true;
        feedback.textContent = "Salvando…";
        try {
            await apiTextos(`/${encodeURIComponent(alvo)}`, {
                method: "PUT",
                headers: { ...autorizar(token), "Content-Type": "application/json" },
                body: JSON.stringify({ chave, texto }),
            });
            if (token !== tokenAdmin) return;
            if (texto === null) alteracoes.delete(chave);
            else alteracoes.set(chave, texto);
            if (alvo === paginaAtual) aplicarTexto(chave, texto);
            busca.value = "";
            atualizarSeletor();
            feedback.textContent = texto === null ? "Texto original restaurado." : "Texto salvo.";
        } catch (erro) {
            if (token === tokenAdmin) feedback.textContent = erro.message;
        } finally {
            salvando = false;
            pagina.disabled = false;
            busca.disabled = seletor.disabled = !originais.size;
            valor.disabled = botaoSalvar.disabled = !seletor.value;
            restaurar.disabled = !alteracoes.has(seletor.value);
        }
    }

    busca.addEventListener("input", atualizarSeletor);
    seletor.addEventListener("change", atualizarCampo);
    formulario.addEventListener("submit", evento => {
        evento.preventDefault();
        void salvarTexto(valor.value.trim());
    });
    restaurar.addEventListener("click", () => salvarTexto(null));
    document.addEventListener("painel-sessao", sincronizarSessao);
    sincronizarSessao();
})();
