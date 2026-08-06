const BASE_URL = 'https://ngrok-free.dev';
const HEADERS_PADRAO = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
};

document.getElementById('dataAtual').innerText = new Date().toLocaleString('pt-BR');

function limparFiltro() {
    document.getElementById('dataInicio').value = '';
    document.getElementById('dataFim').value = '';
    renderizarPlanta();
}

async function renderizarPlanta() {
    const container = document.getElementById('plantaLayout');
    const dataInicioVal = document.getElementById('dataInicio').value;
    const dataFimVal = document.getElementById('dataFim').value;

    try {
        const resposta = await fetch(`${BASE_URL}/camara-fria/layout`, {
            method: 'GET',
            headers: HEADERS_PADRAO
        });

        if (!resposta.ok) throw new Error(`Erro na requisição: ${resposta.status}`);

        let dados = await resposta.json();
        container.innerHTML = '';

        if (!Array.isArray(dados) || dados.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">Nenhuma estrutura cadastrada para exibição na planta.</div>';
            return;
        }

        if (dataInicioVal || dataFimVal) {
            const dataInicio = dataInicioVal ? new Date(dataInicioVal + "T00:00:00") : null;
            const dataFim = dataFimVal ? new Date(dataFimVal + "T23:59:59") : null;

            dados = dados.filter(item => {
                if (item.status !== 'ocupado' || !item.validade) return false;
                const dataItem = new Date(item.validade);
                if (dataInicio && dataItem < dataInicio) return false;
                if (dataFim && dataItem > dataFim) return false;
                return true;
            });
        }

        if (dados.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">Nenhum registro encontrado para o período selecionado.</div>';
            return;
        }

        const fileirasAgrupadas = {};
        dados.forEach(item => {
            const f = item.fileira || 'Sem Identificação';
            if (!fileirasAgrupadas[f]) { fileirasAgrupadas[f] = []; }
            fileirasAgrupadas[f].push(item);
        });

        for (const letra in fileirasAgrupadas) {
            const linhaFileira = document.createElement('div');
            linhaFileira.className = 'linha-fileira';

            const divLetra = document.createElement('div');
            divLetra.className = 'letra-fileira';
            divLetra.innerText = letra;

            const grupoEstantes = document.createElement('div');
            grupoEstantes.className = 'grupo-estantes';

            fileirasAgrupadas[letra].forEach(item => {
                const bloco = document.createElement('div');
                let classeStatus = 'bloco-vazio';
                let tagAlerta = '';

                if (item.status === 'ocupado') {
                    classeStatus = 'bloco-ocupado';
                    if (item.temperatura_ideal !== null && item.temperatura_disponivel !== null && (item.temperatura_ideal < item.temperatura_disponivel)) {
                        classeStatus = 'bloco-alerta-termico';
                        tagAlerta = '<span style="color:#d97706; font-weight:bold;">⚠️ INCOMPATÍVEL</span><br>';
                    }
                }

                bloco.className = `bloco-espaco ${classeStatus}`;

                if (item.status === 'ocupado') {
                    const dataSaidaFormatada = item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : 'N/A';
                    bloco.innerHTML = `
                        <div class="bloco-topo">
                            <span>Nº ${item.numero_espaco || item.id}</span>
                            <span>${item.temperatura_disponivel ?? '--'}°C</span>
                        </div>
                        <div class="bloco-info">
                            ${tagAlerta}
                            <strong>C:</strong> ${item.cliente_nome ? item.cliente_nome.substring(0, 12) : 'N/A'}<br>
                            <strong>P:</strong> ${item.nome_produto || 'N/I'}<br>
                            <strong>M²:</strong> ${item.espaco_ocupado_m2 || '0'} m²<br>
                            <strong>Alvo:</strong> ${item.temperatura_ideal ?? '--'}°C<br>
                            <strong>Saída:</strong> ${dataSaidaFormatada}
                        </div>
                    `;
                } else {
                    bloco.innerHTML = `
                        <div class="bloco-topo">
                            <span>Nº ${item.numero_espaco || item.id}</span>
                            <span>${item.temperatura_disponivel ?? '--'}°C</span>
                        </div>
                        <div class="bloco-info" style="color: #94a3b8; font-style: italic; text-align: center; margin-top: 15px;">
                            Disponível
                        </div>
                    `;
                }
                grupoEstantes.appendChild(bloco);
            });

            linhaFileira.appendChild(divLetra);
            linhaFileira.appendChild(grupoEstantes);
            container.appendChild(linhaFileira);
        }

    } catch (error) {
        console.error('Erro na planta:', error);
        container.innerHTML = `<div class="alerta-erro">⚠️ Erro ao carregar mapa da planta!<br><small>${error.message}</small></div>`;
    }
}

renderizarPlanta();
