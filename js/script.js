/**
 * Behrend BJJ — Script Principal (Front-end Integrado à API REST /api/v1)
 * Responsável por:
 * 1. Menu responsivo mobile (corrigido sem ReferenceError)
 * 2. Integração ponta a ponta dos formulários de contato (POST /api/v1/contatos)
 * 3. Fluxo de Agendamento de Aula Experimental e Consulta de Protocolo (/api/v1/agendamentos)
 * 4. Painel de Gestão com Controle de Acesso por Papel - RBAC (/api/v1/auth/login)
 */

const { hostname, port } = window.location;
const servidorLocal = ["localhost", "127.0.0.1"].includes(hostname) && ["5500", "5501"].includes(port);
const API_BASE = servidorLocal ? `http://${hostname}:8000/api/v1` : "/api/v1";

// 1. MENU RESPONSIVO (Sem ReferenceError de variáveis não declaradas)
const navbar = document.querySelector(".navbar");
const searchForm = document.querySelector(".search-form");
const cartItem = document.querySelector(".cart-items-container");
const menuBtn = document.querySelector("#menu-btn");

if (menuBtn && navbar) {
    menuBtn.onclick = () => {
        navbar.classList.toggle("active");
        if (searchForm) searchForm.classList.remove("active");
        if (cartItem) cartItem.classList.remove("active");
    };
}

if (navbar) {
    const menuCompacto = window.matchMedia("(max-width: 991px)");
    for (const submenu of navbar.querySelectorAll(".dropdown-menu")) {
        const link = submenu.previousElementSibling;
        if (!link || !link.matches("a")) continue;

        function ajustarSubmenu() {
            submenu.classList.remove("submenu-aberto");
            if (menuCompacto.matches) link.setAttribute("aria-expanded", "false");
            else link.removeAttribute("aria-expanded");
        }

        ajustarSubmenu();
        menuCompacto.addEventListener("change", ajustarSubmenu);
        link.addEventListener("click", evento => {
            if (!menuCompacto.matches || !navbar.classList.contains("active")) return;
            evento.preventDefault();
            const aberto = submenu.classList.toggle("submenu-aberto");
            link.setAttribute("aria-expanded", String(aberto));
        });
    }
}

window.onscroll = () => {
    if (navbar) navbar.classList.remove("active");
    if (searchForm) searchForm.classList.remove("active");
    if (cartItem) cartItem.classList.remove("active");
};

// Injeta links de "Agende sua aula experimental" e "Painel" junto com os demais itens do menu e atualiza o botão "Começar agora"
function enrichNavigation() {
    if (!navbar) return;
    const links = Array.from(navbar.querySelectorAll("a")).map(a => a.getAttribute("href"));
    if (!links.includes("agendamento.html")) {
        const agLink = document.createElement("a");
        agLink.href = "agendamento.html";
        agLink.textContent = "Agende sua aula experimental";
        navbar.appendChild(agLink);
    }
    if (!links.includes("painel.html")) {
        const painelLink = document.createElement("a");
        painelLink.href = "painel.html";
        painelLink.textContent = "Painel";
        navbar.appendChild(painelLink);
    }

    if (!links.includes("eventos.html")) {
        const eventos = document.createElement("a");
        eventos.href = "eventos.html";
        eventos.textContent = "Eventos";
        navbar.appendChild(eventos);
    }

    // Garante que todos os botões "Comece agora" / "Começar agora" do cabeçalho levem para a inscrição (agendamento.html)
    document.querySelectorAll("header .btn1").forEach(btn => {
        btn.textContent = "Começar agora";
        if (!window.location.pathname.endsWith("agendamento.html")) {
            btn.setAttribute("href", "agendamento.html");
        }
    });
}

// 2. INTEGRAÇÃO DOS FORMULÁRIOS DE CONTATO EM TODAS AS PÁGINAS
function setupContactForms() {
    document.querySelectorAll(".contact form").forEach(form => {
        const nome = form.querySelector('input[type="text"]');
        const email = form.querySelector('input[type="email"]');
        const telefone = form.querySelector('input[type="number"], input[type="tel"]');
        const enviar = form.querySelector('[type="submit"]');
        if (!nome || !email || !telefone || !enviar || form.dataset.bound === "true") return;
        form.dataset.bound = "true";

        telefone.type = "tel";
        const campos = [
            [nome, "Nome", 2, 120, "name"],
            [email, "E-mail", 5, 150, "email"],
            [telefone, "Telefone com DDD", 8, 25, "tel"]
        ];
        for (const [campo, rotulo, min, max, autocomplete] of campos) {
            campo.placeholder = rotulo;
            campo.setAttribute("aria-label", rotulo);
            campo.autocomplete = autocomplete;
            campo.minLength = min;
            campo.maxLength = max;
            campo.required = true;
        }

        const caixaMensagem = document.createElement("div");
        caixaMensagem.className = "inputBox";
        caixaMensagem.innerHTML = `
            <span class="fas fa-comment-dots" aria-hidden="true"></span>
            <input type="text" name="mensagem" aria-label="Mensagem" placeholder="Mensagem ou dúvida" minlength="3" maxlength="1000" required>
        `;
        form.insertBefore(caixaMensagem, enviar);
        const mensagem = caixaMensagem.querySelector("input");

        const feedback = document.createElement("div");
        feedback.className = "api-feedback";
        feedback.setAttribute("role", "status");
        feedback.style.marginTop = "1.5rem";
        feedback.style.fontSize = "1.5rem";
        form.appendChild(feedback);

        form.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            if (enviar.disabled) return;
            enviar.disabled = true;
            feedback.style.color = "#93c5fd";
            feedback.textContent = "Enviando mensagem…";

            try {
                const resposta = await fetch(`${API_BASE}/contatos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nome: nome.value.trim(),
                        email: email.value.trim(),
                        telefone: telefone.value.trim(),
                        mensagem: mensagem.value.trim()
                    })
                });
                if (!resposta.ok) {
                    const { detail } = await resposta.json().catch(() => ({}));
                    throw new Error(resposta.status === 422
                        ? "Confira o nome, o e-mail, o telefone e a mensagem."
                        : typeof detail === "string" ? detail : "");
                }
                feedback.style.color = "#4ade80";
                feedback.textContent = "Mensagem enviada. Nossa equipe entrará em contato.";
                form.reset();
            } catch (erro) {
                feedback.style.color = "#f87171";
                feedback.textContent = erro.message && !(erro instanceof TypeError)
                    ? erro.message
                    : "Não foi possível enviar a mensagem. Tente novamente.";
            } finally {
                enviar.disabled = false;
            }
        });
    });
}

// 3. PÁGINA DE AGENDAMENTO DE AULA EXPERIMENTAL (agendamento.html)
async function setupAgendamentoPage() {
    const turmaSelect = document.getElementById("turma-select");
    const turmasCardsContainer = document.getElementById("turmas-cards-grid");
    const formAgendamento = document.getElementById("form-agendamento");
    const formConsulta = document.getElementById("form-consulta-protocolo");

    if (!turmaSelect && !formAgendamento) return;

    // Define data mínima padrão como hoje
    const dataInput = document.getElementById("ag-data");
    if (dataInput && !dataInput.value) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
        dataInput.value = tomorrow;
    }

    let turmas = [];
    let aviso = "Nenhuma turma está disponível no momento.";
    try {
        const resp = await fetch(`${API_BASE}/turmas`);
        if (!resp.ok) throw new Error();
        turmas = await resp.json();
    } catch (_) {
        aviso = "Não foi possível carregar os horários. Recarregue a página para tentar novamente.";
    }

    if (turmaSelect) {
        turmaSelect.replaceChildren(new Option("Escolha uma turma", ""));
        for (const turma of turmas) {
            turmaSelect.add(new Option(
                `${turma.modalidade} · ${turma.dias_semana} · ${turma.horario}`, turma.id
            ));
        }
        if (formAgendamento) formAgendamento.querySelector('[type="submit"]').disabled = !turmas.length;
    }

    if (turmasCardsContainer) {
        if (!turmas.length) turmasCardsContainer.textContent = aviso;
        else turmasCardsContainer.innerHTML = turmas.map(t => `
            <div class="turma-card">
                <h4>${t.modalidade}</h4>
                <p><strong>Público:</strong> ${t.publico}</p>
                <p><strong>Dias:</strong> ${t.dias_semana}</p>
                <p><strong>Horário:</strong> ${t.horario}</p>
                <p><strong>Instrutor:</strong> ${t.instrutor}</p>
            </div>
        `).join("");
    }

    if (formAgendamento) {
        formAgendamento.addEventListener("submit", async (e) => {
            e.preventDefault();
            const resultBox = document.getElementById("agendamento-resultado");
            const payload = {
                nome_aluno: document.getElementById("ag-nome").value.trim(),
                email: document.getElementById("ag-email").value.trim(),
                telefone: document.getElementById("ag-telefone").value.trim(),
                turma_id: Number(document.getElementById("turma-select").value),
                data_aula: document.getElementById("ag-data").value,
                nivel_experiencia: document.getElementById("ag-nivel").value,
                observacoes: document.getElementById("ag-obs").value.trim() || null
            };

            resultBox.style.display = "block";
            resultBox.className = "alert-box info";
            resultBox.textContent = "Processando agendamento...";

            try {
                const resp = await fetch(`${API_BASE}/agendamentos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const body = await resp.json();
                if (!resp.ok) {
                    throw new Error(typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail));
                }
                resultBox.className = "alert-box success";
                resultBox.innerHTML = `
                    <h4>🎉 Aula Experimental Agendada com Sucesso!</h4>
                    <p><strong>Protocolo:</strong> <code style="font-size:1.8rem;color:#60a5fa;">${body.protocolo}</code></p>
                    <p><strong>Modalidade:</strong> ${body.modalidade_turma || "Selecionada"} (${body.data_aula})</p>
                    <p><strong>Status Atual:</strong> <span class="status-pill status-${body.status}">${body.status.toUpperCase()}</span></p>
                    <p>Guarde seu protocolo ou consulte abaixo com seu e-mail.</p>
                `;
                formAgendamento.reset();
                if (dataInput) {
                    dataInput.value = new Date(Date.now() + 86400000).toISOString().split("T")[0];
                }
            } catch (err) {
                resultBox.className = "alert-box error";
                resultBox.innerHTML = `<strong>Não foi possível concluir o agendamento:</strong> ${err.message}`;
            }
        });
    }

    if (formConsulta) {
        formConsulta.addEventListener("submit", async (e) => {
            e.preventDefault();
            const termo = document.getElementById("consulta-termo").value.trim();
            const outBox = document.getElementById("consulta-resultado");
            if (!termo) return;

            outBox.innerHTML = "<p style='color:#93c5fd;font-size:1.5rem;'>Consultando...</p>";
            const queryParam = termo.includes("@")
                ? `email=${encodeURIComponent(termo)}`
                : `protocolo=${encodeURIComponent(termo)}`;

            try {
                const resp = await fetch(`${API_BASE}/agendamentos/consulta?${queryParam}`);
                const lista = await resp.json();
                if (!resp.ok) {
                    throw new Error(lista.detail || "Erro na consulta.");
                }
                if (!lista.length) {
                    outBox.innerHTML = "<p style='color:#fca5a5;font-size:1.5rem;'>Nenhum agendamento encontrado para o protocolo/e-mail informado.</p>";
                    return;
                }
                outBox.innerHTML = lista.map(item => `
                    <div class="consulta-card">
                        <div>
                            <strong>Protocolo: ${item.protocolo}</strong> — ${item.nome_aluno}<br>
                            <span>Turma: ${item.modalidade_turma || item.turma_id} | Data: ${item.data_aula}</span>
                        </div>
                        <span class="status-pill status-${item.status}">${item.status.toUpperCase()}</span>
                    </div>
                `).join("");
            } catch (err) {
                outBox.innerHTML = `<p style="color:#fca5a5;font-size:1.5rem;">Erro: ${err.message}</p>`;
            }
        });
    }
}

// 4. PÁGINA DO PAINEL DE GESTÃO RBAC (painel.html)
function setupPainelPage() {
    const formMinhaConta = document.getElementById("form-minha-conta");

if (formMinhaConta) {
    formMinhaConta.addEventListener("submit", async (event) => {
        event.preventDefault();

        const feedback = document.getElementById("conta-feedback");
        const botao = formMinhaConta.querySelector('button[type="submit"]');
        const token = sessionStorage.getItem("behrend_token");
        const email = document.getElementById("conta-email").value.trim();
        const senhaNova = document.getElementById("conta-senha-nova").value;

        const dados = {
            senha_atual: document.getElementById("conta-senha-atual").value
        };

        if (email) dados.novo_email = email;
        if (senhaNova) dados.nova_senha = senhaNova;

        botao.disabled = true;
        feedback.textContent = "Salvando...";

        try {
            const resposta = await fetch(`${API_BASE}/auth/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(dados)
            });

            const resultado = await resposta.json().catch(() => ({}));
            if (!resposta.ok) {
                throw new Error(
                    typeof resultado.detail === "string"
                        ? resultado.detail
                        : "Confira os dados e tente novamente."
                );
            }

            formMinhaConta.reset();
            sessionStorage.removeItem("behrend_token");
            sessionStorage.removeItem("behrend_user");
            loginForm.reset();
            renderPainelState();
            feedback.textContent = resultado.mensagem;
        } catch (erro) {
            feedback.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });
}
    const loginForm = document.getElementById("form-login-rbac");
    if (!loginForm) return;

    const btnDemoAdmin = document.getElementById("btn-demo-admin");
    const btnDemoInstrutor = document.getElementById("btn-demo-instrutor");
    const btnLogout = document.getElementById("btn-logout");

function focarCampoEmail() {
    document.getElementById("login-email").focus();
}

if (btnDemoAdmin) btnDemoAdmin.onclick = focarCampoEmail;
if (btnDemoInstrutor) btnDemoInstrutor.onclick = focarCampoEmail;



    if (btnLogout) {
        btnLogout.onclick = () => {
            sessionStorage.removeItem("behrend_token");
            sessionStorage.removeItem("behrend_user");
            loginForm.reset();
            formMinhaConta?.reset();
            renderPainelState();
        };
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const senha = document.getElementById("login-senha").value;
        const msg = document.getElementById("login-feedback");
        msg.textContent = "Autenticando...";
        msg.style.color = "#93c5fd";

        try {
            const resp = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha })
            });
            const body = await resp.json();
            if (!resp.ok) {
                throw new Error(body.detail || "Falha na autenticação.");
            }
            if (body.usuario.papel === "aluno") {
                sessionStorage.removeItem("behrend_token");
                sessionStorage.removeItem("behrend_user");
                sessionStorage.setItem("behrend_token_aluno", body.access_token);
                window.location.assign("/confirmar-aula.html");
                return;
            }
            sessionStorage.setItem("behrend_token", body.access_token);
            sessionStorage.setItem("behrend_user", JSON.stringify(body.usuario));
            msg.textContent = "";
            renderPainelState();
        } catch (err) {
            msg.style.color = "#f87171";
            msg.textContent = `❌ ${err.message}`;
        }
    });

    const formExcluirTurma = document.getElementById("form-excluir-turma");
    const turmaCadastrada = document.getElementById("turma-cadastrada");
    const feedbackExclusao = document.getElementById("turma-exclusao-feedback");
    const excluirTurma = formExcluirTurma.querySelector('[type="submit"]');
    let consultaTurmas = 0;
    let excluindoTurma = false;

    async function carregarTurmasCadastradas() {
        const consulta = ++consultaTurmas;
        turmaCadastrada.replaceChildren(new Option("Selecione uma turma", ""));
        excluirTurma.disabled = true;
        feedbackExclusao.textContent = "";
        try {
            const resposta = await fetch(`${API_BASE}/turmas`, { cache: "no-store" });
            if (!resposta.ok) throw new Error("Não foi possível carregar as turmas.");
            const turmas = await resposta.json();
            if (consulta !== consultaTurmas) return;
            for (const turma of turmas) {
                const rotulo = `${turma.modalidade} · ${turma.dias_semana} · ${turma.horario} · ${turma.instrutor} (#${turma.id})`;
                turmaCadastrada.add(new Option(rotulo, turma.id));
            }
            if (!turmas.length) feedbackExclusao.textContent = "Nenhuma turma ativa cadastrada.";
        } catch (erro) {
            if (consulta === consultaTurmas) feedbackExclusao.textContent = erro.message;
        }
    }

    formExcluirTurma.closest("details").addEventListener("toggle", evento => {
        if (evento.currentTarget.open) void carregarTurmasCadastradas();
    });
    turmaCadastrada.addEventListener("change", () => {
        excluirTurma.disabled = !turmaCadastrada.value || excluindoTurma;
    });
    formExcluirTurma.addEventListener("submit", async evento => {
        evento.preventDefault();
        const id = turmaCadastrada.value;
        if (!id || excluindoTurma) return;
        const nome = turmaCadastrada.selectedOptions[0].textContent;
        if (!window.confirm(`Excluir a turma ${nome}? Os agendamentos existentes serão mantidos.`)) return;
        const token = sessionStorage.getItem("behrend_token");
        excluindoTurma = true;
        excluirTurma.disabled = true;
        try {
            const resposta = await fetch(`${API_BASE}/turmas/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!resposta.ok) {
                const dados = await resposta.json().catch(() => null);
                throw new Error(dados?.detail || "Não foi possível excluir a turma.");
            }
            await carregarTurmasCadastradas();
            if (!feedbackExclusao.textContent) feedbackExclusao.textContent = "Turma excluída.";
        } catch (erro) {
            feedbackExclusao.textContent = erro.message;
        } finally {
            excluindoTurma = false;
            excluirTurma.disabled = !turmaCadastrada.value;
        }
    });

    const formNovaTurma = document.getElementById("form-nova-turma");
    if (formNovaTurma) {
        formNovaTurma.addEventListener("submit", async (e) => {
            e.preventDefault();
            const token = sessionStorage.getItem("behrend_token");
            const fb = document.getElementById("turma-admin-feedback");
            const payload = {
                modalidade: document.getElementById("nt-modalidade").value.trim(),
                publico: document.getElementById("nt-publico").value.trim(),
                dias_semana: document.getElementById("nt-dias").value.trim(),
                horario: document.getElementById("nt-horario").value.trim(),
                instrutor: document.getElementById("nt-instrutor").value.trim(),
                capacidade_maxima: Number(document.getElementById("nt-capacidade").value)
            };
            try {
                const resp = await fetch(`${API_BASE}/turmas`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const body = await resp.json();
                if (!resp.ok) throw new Error(body.detail || "Erro ao criar turma.");
                fb.style.color = "#4ade80";
                fb.textContent = `✅ Turma '${body.modalidade}' criada com sucesso (ID #${body.id})!`;
                formNovaTurma.reset();
                void carregarTurmasCadastradas();
            } catch (err) {
                fb.style.color = "#f87171";
                fb.textContent = `🚫 ${err.message}`;
            }
        });
    }

    renderPainelState();
}

async function renderPainelState() {
    const token = sessionStorage.getItem("behrend_token");
    const userStr = sessionStorage.getItem("behrend_user");
    const minhaConta = document.getElementById("minha-conta");
    if (minhaConta) {
        minhaConta.hidden = !token || !userStr;
        if (minhaConta.hidden) minhaConta.open = false;
    }
    const dashboardArea = document.getElementById("painel-dashboard");
    const userBanner = document.getElementById("painel-user-banner");
    const rbacAlert = document.getElementById("rbac-role-notice");
    const adminSection = document.getElementById("admin-only-section");

    if (!dashboardArea) return;

    if (!token || !userStr) {
        dashboardArea.style.display = "none";
        document.dispatchEvent(new Event("painel-sessao"));
        if (userBanner) userBanner.style.display = "none";
        return;
    }

    const user = JSON.parse(userStr);
    if (user.papel === "aluno") {
        sessionStorage.removeItem("behrend_token");
        sessionStorage.removeItem("behrend_user");
        sessionStorage.setItem("behrend_token_aluno", token);
        window.location.assign("/confirmar-aula.html");
        return;
    }
    for (const id of ["cadastro-aluno", "gestao-alunos", "gestao-instrutores"]) {
        document.getElementById(id).hidden = user.papel !== "admin";
    }
    dashboardArea.style.display = "block";
    document.dispatchEvent(new Event("painel-sessao"));
    userBanner.style.display = "flex";
    document.getElementById("logged-user-name").textContent = user.nome;
    document.getElementById("logged-user-role").textContent = user.papel.toUpperCase();

    if (adminSection) {
        adminSection.style.display = user.papel === "admin" ? "block" : "none";
    }

    // Tenta buscar agendamentos e contatos com o token do papel logado
    const tbodyAg = document.getElementById("tabela-agendamentos-body");
    const tbodyCt = document.getElementById("tabela-contatos-body");

    try {
        const [respAg, respCt] = await Promise.all([
            fetch(`${API_BASE}/agendamentos`, { headers: { "Authorization": `Bearer ${token}` } }),
            fetch(`${API_BASE}/contatos`, { headers: { "Authorization": `Bearer ${token}` } })
        ]);

        if (respAg.status === 403) {
            const errBody = await respAg.json();
            rbacAlert.style.display = "block";
            rbacAlert.className = "alert-box error";
            rbacAlert.innerHTML = `<strong>🔒 Demonstração RBAC (HTTP 403 Forbidden):</strong> ${errBody.detail}`;
            tbodyAg.innerHTML = `<tr><td colspan="7">Acesso restrito a Instrutores e Administradores.</td></tr>`;
            tbodyCt.innerHTML = `<tr><td colspan="6">Acesso restrito a Instrutores e Administradores.</td></tr>`;
            return;
        }

        rbacAlert.style.display = "block";
        rbacAlert.className = "alert-box success";
        rbacAlert.innerHTML = user.papel === "admin"
            ? "<strong>🛡️ Papel ADMIN ativo:</strong> Permissão total (aprovar/cancelar agendamentos, excluir registros e cadastrar novas turmas)."
            : "<strong>🥋 Papel INSTRUTOR ativo:</strong> Permissão operacional (confirmar/realizar agendamentos e responder contatos). Ações de exclusão (DELETE) e criação de turmas retornam HTTP 403.";

        const agendamentos = await respAg.json();
        if (!respCt.ok) throw new Error("Não foi possível carregar as mensagens de contato.");
        const contatos = await respCt.json();

        document.getElementById("kpi-agendamentos").textContent = agendamentos.length;
        document.getElementById("kpi-pendentes").textContent = agendamentos.filter(a => a.status === "pendente").length;
        document.getElementById("kpi-contatos").textContent = contatos.length;

        tbodyAg.innerHTML = agendamentos.length ? agendamentos.map(ag => `
            <tr>
                <td><code>${ag.protocolo}</code></td>
                <td>${ag.nome_aluno}<br><small>${ag.email} | ${ag.telefone}</small></td>
                <td>${ag.modalidade_turma || ag.turma_id}</td>
                <td>${ag.data_aula}</td>
                <td><span class="status-pill status-${ag.status}">${ag.status.toUpperCase()}</span></td>
                <td>
                    <button class="btn-mini btn-confirm" onclick="alterarStatusAgendamento(${ag.id}, 'confirmado')">Confirmar</button>
                    <button class="btn-mini btn-done" onclick="alterarStatusAgendamento(${ag.id}, 'realizado')">Realizado</button>
                    <button class="btn-mini btn-cancel" onclick="alterarStatusAgendamento(${ag.id}, 'cancelado')">Cancelar</button>
                    <button class="btn-mini btn-delete" onclick="excluirAgendamento(${ag.id})" title="Exclusivo Admin">Excluir</button>
                </td>
            </tr>
        `).join("") : `<tr><td colspan="6">Nenhum agendamento registrado até o momento.</td></tr>`;

        tbodyCt.replaceChildren();
        if (!contatos.length) {
            const celula = tbodyCt.insertRow().insertCell();
            celula.colSpan = 5;
            celula.textContent = "Nenhuma mensagem de contato registrada.";
        }
        // A API armazena nome e mensagem com entidades HTML escapadas.
        const caracteres = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'" };
        const textoContato = valor => valor.replace(/&(amp|lt|gt|quot|#x27);/g, (_, entidade) => caracteres[entidade]);
        for (const contato of contatos) {
            const linha = tbodyCt.insertRow();
            linha.insertCell().textContent = `#${contato.id}`;
            const visitante = linha.insertCell();
            visitante.append(
                textoContato(contato.nome), document.createElement("br"),
                `Telefone: ${contato.telefone}`, document.createElement("br"), contato.email
            );
            linha.insertCell().textContent = textoContato(contato.mensagem);
            const situacao = document.createElement("span");
            situacao.className = `status-pill status-${contato.lida ? "confirmado" : "pendente"}`;
            situacao.textContent = contato.lida ? `Lida por ${contato.respondida_por || "Equipe"}` : "Pendente";
            linha.insertCell().append(situacao);
            const acao = linha.insertCell();
            if (contato.lida) {
                acao.textContent = "—";
            } else {
                const botao = document.createElement("button");
                botao.type = "button";
                botao.className = "btn-mini btn-confirm";
                botao.textContent = "Marcar lida";
                botao.addEventListener("click", () => marcarContatoLido(contato.id));
                acao.append(botao);
            }
        }
    } catch (err) {
        rbacAlert.style.display = "block";
        rbacAlert.className = "alert-box error";
        rbacAlert.textContent = `Erro ao carregar dados da API: ${err.message}`;
    }
}

window.alterarStatusAgendamento = async function (id, novoStatus) {
    const token = sessionStorage.getItem("behrend_token");
    const resp = await fetch(`${API_BASE}/agendamentos/${id}/status`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: novoStatus })
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert(`Erro (${resp.status}): ${err.detail || "Não autorizado"}`);
        return;
    }
    renderPainelState();
};

window.excluirAgendamento = async function (id) {
    const token = sessionStorage.getItem("behrend_token");
    const resp = await fetch(`${API_BASE}/agendamentos/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert(`Bloqueio RBAC (HTTP ${resp.status}): ${err.detail || "Permissão negada."}`);
        return;
    }
    renderPainelState();
};

window.marcarContatoLido = async function (id) {
    const token = sessionStorage.getItem("behrend_token");
    const resp = await fetch(`${API_BASE}/contatos/${id}/lida`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert(`Erro (${resp.status}): ${err.detail || "Não autorizado"}`);
        return;
    }
    renderPainelState();
};

document.addEventListener("DOMContentLoaded", () => {
    enrichNavigation();
    setupContactForms();
    setupAgendamentoPage();
    setupPainelPage();
});