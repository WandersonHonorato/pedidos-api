// Painel de pedidos: consome a própria API (mesma origem) e organiza os pedidos
// em 3 colunas pelo status. Sem framework e sem build — JS puro + Bootstrap (CSS).
//
// Segurança: dados vindos da API (nome do cliente, produto) são inseridos com
// textContent, nunca com innerHTML, para não abrir brecha de XSS.

const COLUNAS = {
  CRIADO: { vazio: 'Nenhum pedido aguardando pagamento.', acao: { rotulo: 'Confirmar pagamento', rota: 'pagamento', classe: 'btn-outline-primary' } },
  PAGO: { vazio: 'Nada em preparação.', acao: { rotulo: 'Finalizar', rota: 'finalizacao', classe: 'btn-outline-success' } },
  FINALIZADO: { vazio: 'Nenhum pedido finalizado.', acao: null },
};
const INTERVALO_ATUALIZACAO_MS = 5000;
const LIMITE_POR_COLUNA = 100; // mesmo limite da API (LIMITE_LISTAGEM)

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const hora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Cria um elemento com classes e texto (sempre via textContent). */
function el(tag, { classe, texto } = {}, filhos = []) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  node.append(...filhos);
  return node;
}

async function api(caminho, opcoes = {}) {
  const res = await fetch(caminho, { headers: { 'Content-Type': 'application/json' }, ...opcoes });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(corpo.erro ?? `Erro HTTP ${res.status}`);
  return corpo;
}

function mostrarAlerta(mensagem, tipo = 'danger') {
  const alerta = el('div', { classe: `alert alert-${tipo} alert-dismissible fade show`, texto: mensagem });
  alerta.setAttribute('role', 'alert');
  const fechar = el('button', { classe: 'btn-close' });
  fechar.type = 'button';
  fechar.setAttribute('aria-label', 'Fechar');
  fechar.addEventListener('click', () => alerta.remove());
  alerta.append(fechar);
  document.getElementById('alertas').replaceChildren(alerta);
  if (tipo === 'success') setTimeout(() => alerta.remove(), 3000);
}

function cartaoPedido(pedido) {
  const itens = el(
    'ul',
    { classe: 'list-unstyled small mb-2' },
    pedido.itens.map((i) =>
      el('li', { classe: 'd-flex justify-content-between' }, [
        el('span', { texto: `${i.quantidade}× ${i.produto}` }),
        el('span', { classe: 'text-body-secondary', texto: moeda.format((i.quantidade * i.precoUnitarioCentavos) / 100) }),
      ]),
    ),
  );

  const corpo = el('div', { classe: 'card-body p-3' }, [
    el('div', { classe: 'd-flex justify-content-between align-items-start mb-1' }, [
      el('strong', { texto: pedido.cliente }),
      el('span', { classe: 'fw-semibold', texto: moeda.format(pedido.totalCentavos / 100) }),
    ]),
    el('div', { classe: 'text-body-secondary small mb-2' }, [
      el('span', { classe: 'pedido-id', texto: `#${pedido.id.slice(0, 8)}` }),
      el('span', { texto: ` · ${hora.format(new Date(pedido.criadoEm))}` }),
    ]),
    itens,
  ]);

  const acao = COLUNAS[pedido.status]?.acao;
  if (acao) {
    const botao = el('button', { classe: `btn btn-sm ${acao.classe} w-100`, texto: acao.rotulo });
    botao.type = 'button';
    botao.addEventListener('click', () => executarAcao(pedido.id, acao.rota, botao));
    corpo.append(botao);
  }

  return el('article', { classe: 'card pedido' }, [corpo]);
}

function renderizar(pedidos) {
  for (const [status, { vazio }] of Object.entries(COLUNAS)) {
    const doStatus = pedidos.filter((p) => p.status === status);
    const coluna = document.getElementById(`coluna-${status}`);
    coluna.replaceChildren(
      ...(doStatus.length ? doStatus.map(cartaoPedido) : [el('p', { classe: 'text-body-secondary small text-center my-4', texto: vazio })]),
    );
    document.getElementById(`contador-${status}`).textContent =
      doStatus.length >= LIMITE_POR_COLUNA ? `${LIMITE_POR_COLUNA}+` : String(doStatus.length);
  }
  document.getElementById('atualizado-em').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
}

async function carregar() {
  try {
    // Uma consulta por coluna: cada uma traz até 100 pedidos do seu status,
    // então um pedido antigo ainda pendente nunca some do painel.
    const porStatus = await Promise.all(Object.keys(COLUNAS).map((s) => api(`/pedidos?status=${s}`)));
    renderizar(porStatus.flat());
  } catch (erro) {
    mostrarAlerta(`Não foi possível carregar os pedidos: ${erro.message}`);
  }
}

async function executarAcao(id, rota, botao) {
  botao.disabled = true;
  try {
    await api(`/pedidos/${encodeURIComponent(id)}/${rota}`, { method: 'POST' });
    await carregar();
  } catch (erro) {
    mostrarAlerta(erro.message);
    botao.disabled = false;
  }
}

document.getElementById('form-pedido').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.currentTarget;
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  const dados = new FormData(form);
  const botao = form.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    await api('/pedidos', {
      method: 'POST',
      body: JSON.stringify({
        cliente: dados.get('cliente'),
        itens: [
          {
            produto: dados.get('produto'),
            quantidade: Number(dados.get('quantidade')),
            // A API trabalha em centavos inteiros (evita erro de ponto flutuante)
            precoUnitarioCentavos: Math.round(Number(dados.get('preco')) * 100),
          },
        ],
      }),
    });
    form.reset();
    form.classList.remove('was-validated');
    mostrarAlerta('Pedido criado.', 'success');
    await carregar();
  } catch (erro) {
    mostrarAlerta(erro.message);
  } finally {
    botao.disabled = false;
  }
});

carregar();
setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
