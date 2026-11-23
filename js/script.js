/**
 * Behrend BJJ — Script Principal (Front-end Integrado à API REST /api/v1)
 * Responsável por:
 * 1. Menu responsivo mobile (corrigido sem ReferenceError)
 * 2. Integração ponta a ponta dos formulários de contato (POST /api/v1/contatos)
 * 3. Fluxo de Agendamento de Aula Experimental e Consulta de Protocolo (/api/v1/agendamentos)
 * 4. Painel de Gestão com Controle de Acesso por Papel - RBAC (/api/v1/auth/login)
 */

const API_BASE = window.location.origin === "http://127.0.0.1:5501"
    ? "http://127.0.0.1:8001/api/v1"
    : "/api/v1";

// Turmas padrão de fallback caso a página seja aberta via arquivo estático (Live Server) sem o FastAPI
const FALLBACK_TURMAS = [
    { id: 1, modalidade: "Jiu-Jitsu Adulto", publico: "Adulto", dias_semana: "Segunda a Sexta", horario: "19:30 - 21:00", instrutor: "Mestre Erick Behrend", capacidade_maxima: 25, vagas_disponiveis: 22 },
    { id: 2, modalidade: "Jiu-Jitsu Infantil", publico: "Infantil (5 a 14 anos)", dias_semana: "Terça e Quinta", horario: "18:00 - 19:00", instrutor: "Prof. Erick Behrend", capacidade_maxima: 20, vagas_disponiveis: 18 },
    { id: 3, modalidade: "Judô Adulto", publico: "Adulto", dias_semana: "Segunda, Quarta e Sexta", horario: "20:00 - 21:30", instrutor: "Sensei Behrend Team", capacidade_maxima: 20, vagas_disponiveis: 19 },
    { id: 4, modalidade: "Judô Infantil", publico: "Infantil (4 a 13 anos)", dias_semana: "Segunda, Quarta e Sexta", horario: "17:30 - 18:30", instrutor: "Sensei Behrend Team", capacidade_maxima: 18, vagas_disponiveis: 16 },
    { id: 5, modalidade: "Muay Thai", publico: "Adulto / Juvenil", dias_semana: "Terça, Quinta e Sábado", horario: "19:00 - 20:00", instrutor: "Kru Behrend Team", capacidade_maxima: 22, vagas_disponiveis: 20 },
    { id: 6, modalidade: "Submission / No-Gi", publico: "Adulto", dias_semana: "Quarta e Sexta", horario: "21:00 - 22:00", instrutor: "Mestre Erick Behrend", capacidade_maxima: 20, vagas_disponiveis: 20 }
];

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
    const contactForms = document.querySelectorAll(".contact form");
    contactForms.forEach(form => {
        if (form.dataset.bound === "true") return;
        form.dataset.bound = "true";

        // Adiciona campo de mensagem caso o formulário original só tenha nome, email e telefone
        const inputs = form.querySelectorAll("input");
        if (!form.querySelector("textarea") && !form.querySelector('input[name="mensagem"]')) {
            const msgBox = document.createElement("div");
            msgBox.className = "inputBox";
            msgBox.innerHTML = `
                <span class="fas fa-comment-dots"></span>
                <input type="text" name="mensagem" placeholder="Mensagem ou dúvida (ex: valores, horários)" required>
            `;
            const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
            if (submitBtn) {
                form.insertBefore(msgBox, submitBtn);
            }
        }

        const feedbackDiv = document.createElement("div");
        feedbackDiv.className = "api-feedback";
        feedbackDiv.style.marginTop = "1.5rem";
        feedbackDiv.style.fontSize = "1.5rem";
        form.appendChild(feedbackDiv);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const textInput = form.querySelector('input[type="text"]');
            const emailInput = form.querySelector('input[type="email"]');
            const phoneInput = form.querySelector('input[type="number"], input[type="tel"]');
            const msgInput = form.querySelector('input[name="mensagem"], textarea');

            const payload = {
                nome: textInput ? textInput.value.trim() : "",
                email: emailInput ? emailInput.value.trim() : "",
                telefone: phoneInput ? String(phoneInput.value).trim() : "",
                mensagem: msgInput && msgInput.value.trim()
                    ? msgInput.value.trim()
                    : "Solicitação de contato enviada pelo site institucional."
            };

            if (!payload.nome || !payload.email || !payload.telefone) {
                feedbackDiv.style.color = "#f87171";
                feedbackDiv.textContent = "Por favor, preencha nome, e-mail e telefone.";
                return;
            }

            feedbackDiv.style.color = "#93c5fd";
            feedbackDiv.textContent = "Enviando mensagem...";

            try {
                const resp = await fetch(`${API_BASE}/contatos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) {
                    const errData = await resp.json().catch(() => ({}));
                    throw new Error(errData.detail || "Falha ao registrar contato na API.");
                }
                const saved = await resp.json();
                feedbackDiv.style.color = "#4ade80";
                feedbackDiv.textContent = `✅ Mensagem #${saved.id} registrada com sucesso! Nossa equipe entrará em contato.`;
                form.reset();
            } catch (err) {
                // Fallback local caso aberto sem o servidor back-end
                const localContacts = JSON.parse(localStorage.getItem("behrend_contatos_fallback") || "[]");
                const novo = { id: localContacts.length + 1, ...payload, lida: false, criado_em: new Date().toISOString() };
                localContacts.push(novo);
                localStorage.setItem("behrend_contatos_fallback", JSON.stringify(localContacts));
                feedbackDiv.style.color = "#4ade80";
                feedbackDiv.textContent = `✅ Mensagem registrada com sucesso! (${err.message ? "Modo local/estático" : ""})`;
                form.reset();
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

    let turmas = FALLBACK_TURMAS;
    try {
        const resp = await fetch(`${API_BASE}/turmas`);
        if (resp.ok) {
            turmas = await resp.json();
        }
    } catch (_) {
        // Usa fallback se offline
    }

    if (turmaSelect) {
        turmaSelect.innerHTML = turmas.map(t =>
            `<option value="${t.id}">${t.modalidade} — ${t.dias_semana} (${t.horario}) [${t.vagas_disponiveis} vagas]</option>`
        ).join("");
    }

    if (turmasCardsContainer) {
        turmasCardsContainer.innerHTML = turmas.map(t => `
            <div class="turma-card">
                <h4>${t.modalidade}</h4>
                <p><strong>Público:</strong> ${t.publico}</p>
                <p><strong>Dias:</strong> ${t.dias_semana}</p>
                <p><strong>Horário:</strong> ${t.horario}</p>
                <p><strong>Instrutor:</strong> ${t.instrutor}</p>
                <span class="vaga-badge">${t.vagas_disponiveis} de ${t.capacidade_maxima} vagas disponíveis</span>
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
    const btnDemoAluno = document.getElementById("btn-demo-aluno");
    const btnLogout = document.getElementById("btn-logout");

function focarCampoEmail() {
    document.getElementById("login-email").focus();
}

if (btnDemoAdmin) btnDemoAdmin.onclick = focarCampoEmail;
if (btnDemoInstrutor) btnDemoInstrutor.onclick = focarCampoEmail;
if (btnDemoAluno) btnDemoAluno.onclick = focarCampoEmail;



    if (btnLogout) {
        btnLogout.onclick = () => {
            sessionStorage.removeItem("behrend_token");
            sessionStorage.removeItem("behrend_user");
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
    const formMinhaConta = document.getElementById("form-minha-conta");
if (formMinhaConta) formMinhaConta.hidden = !token || !userStr;
    const dashboardArea = document.getElementById("painel-dashboard");
    const userBanner = document.getElementById("painel-user-banner");
    const rbacAlert = document.getElementById("rbac-role-notice");
    const adminSection = document.getElementById("admin-only-section");

    if (!dashboardArea) return;

    if (!token || !userStr) {
        dashboardArea.style.display = "none";
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
    document.getElementById("cadastro-aluno").hidden = user.papel !== "admin";
    dashboardArea.style.display = "block";
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

        tbodyCt.innerHTML = contatos.length ? contatos.map(c => `
            <tr>
                <td>#${c.id}</td>
                <td>${c.nome}<br><small>${c.email} | ${c.telefone}</small></td>
                <td>${c.mensagem}</td>
                <td>${c.lida ? `<span class="status-pill status-confirmado">Lida por ${c.respondida_por || "Equipe"}</span>` : `<span class="status-pill status-pendente">Pendente</span>`}</td>
                <td>
                    ${!c.lida ? `<button class="btn-mini btn-confirm" onclick="marcarContatoLido(${c.id})">Marcar Lida</button>` : "—"}
                </td>
            </tr>
        `).join("") : `<tr><td colspan="5">Nenhuma mensagem de contato registrada.</td></tr>`;
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