const BASE_URL = 'https://ngrok-free.dev';
const HEADERS_PADRAO = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
};

// Canal para atualizar as telas em tempo real
const canalComunicacao = new BroadcastChannel('painel_camara_fria');

canalComunicacao.onmessage = (event) => {
    if (event.data && event.data.acao === 'ATUALIZAR') {
        renderizarPlanta();
    }
};

function notificarOutrasPaginas() {
    canalComunicacao.postMessage({ acao: 'ATUALIZAR' });
}

// Inicialização da tela
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('dataAtual').textContent = new Date().toLocaleDateString('pt-BR');
    renderizarPlanta();
});

async function renderizarPlanta() {
    const plantaLayout = document.getElementById('plantaLayout');
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    try {
        const response = await fetch(`${BASE_URL}/camara-fria/layout`, {
            method: 'GET',
            headers: HEADERS_PADRAO
        });

        if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

        let dados = await response.json();
        plantaLayout.innerHTML = '';

        if (!Array.isArray(dados) || dados.length === 0) {
            plantaLayout.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#666;">Nenhum espaço encontrado no sistema.</p>';
            return;
        }

        // Aplica o Filtro por Período de Saída (Validade ou Data de Saída Prevista)
        if (dataInicio || dataFim) {
            dados = dados.filter(item => {
                // Considera o campo de data de saída, validade ou data_saida retornado pela API
                const dataSaidaItem = item.data_saida || item.validade;
                if (!dataSaidaItem) return false;

                const dataItem = new Date(dataSaidaItem).toISOString().split('T')[0];

                if (dataInicio && dataItem < dataInicio) return false;
                if (dataFim && dataItem > dataFim) return false;

                return true;
            });
        }

        if (dados.length === 0) {
            plantaLayout.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#666;">Nenhum registro encontrado para o período selecionado.</p>';
            return;
        }

        // Agrupa os espaços por Fileira
        const fileirasAgrupadas = {};
        dados.forEach(item => {
            const f = item.fileira || 'Geral';
            if (!fileirasAgrupadas[f]) fileirasAgrupadas[f] = [];
            fileirasAgrupadas[f].push(item);
        });

        // Renderiza cada grupo de fileiras
        Object.keys(fileirasAgrupadas).sort().forEach(letra => {
            const bloco = document.createElement('div');
            bloco.className = 'fileira-bloco';

            let htmlEstantes = '';
            fileirasAgrupadas[letra].forEach(item => {
                const isOcupado = item.status === 'ocupado';
                
                // Validação de Alerta Térmico
                let alertaClasse = '';
                if (isOcupado && item.temperatura_ideal !== undefined && item.temperatura_disponivel !== undefined) {
                    if (parseFloat(item.temperatura_ideal) < parseFloat(item.temperatura_disponivel)) {
                        alertaClasse = 'alerta-termico';
                    }
                }

                const statusClasse = isOcupado ? (alertaClasse || 'ocupado') : 'disponivel';
                const idReal = item.espaco_id || item.id || item.numero_espaco;
                
                // Trata a Data de Saída / Validade
                const rawSaida = item.data_saida || item.validade;
                const dataSaidaFormatada = rawSaida ? new Date(rawSaida).toLocaleDateString('pt-BR') : 'N/A';

                let conteudoInfo = isOcupado ? `
                    <div class="info-produto"><strong>Prod:</strong> ${item.nome_produto || 'N/I'}</div>
                    <div class="info-cliente"><strong>Cli:</strong> ${item.cliente_nome || item.cliente_id || 'N/I'}</div>
                    <div class="info-saida"><strong>Saída/Val:</strong> ${dataSaidaFormatada}</div>
                ` : `<div class="info-livre">Livre</div>`;

                htmlEstantes += `
                    <div class="celula-estante ${statusClasse}">
                        <div class="celula-id">E-${idReal}</div>
                        <div class="celula-temp">${item.temperatura_disponivel || 0}°C</div>
                        ${conteudoInfo}
                    </div>
                `;
            });

            bloco.innerHTML = `
                <div class="fileira-titulo">Fileira ${letra}</div>
                <div class="estantes-grid">${htmlEstantes}</div>
            `;
            plantaLayout.appendChild(bloco);
        });

    } catch (error) {
        console.error('Erro ao carregar a planta:', error);
        plantaLayout.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#dc3545;">⚠️ Erro de comunicação com o servidor: ${error.message}</p>`;
    }
}

function limparFiltro() {
    document.getElementById('dataInicio').value = '';
    document.getElementById('dataFim').value = '';
    renderizarPlanta();
}