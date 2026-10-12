/* =============================================================================
 * O PROCESSO — vídeo #1 do canal (roteiro do Qwen, 12/10/2026 · ordem P47)
 *
 * A história: um estúdio que faz um jogo com quatro agentes de IA e um protocolo.
 * Publicável HOJE: não depende de take gravado (F9) nem de código novo — só da mesa.
 *
 * Regras que este roteiro segue (e o `validar.mjs` cobra):
 *   · Número do vídeo = número do jogo (nada digitado à mão que envelheça);
 *   · Nenhum byte/KB por segundo: isso é engenharia interna (política das páginas
 *     públicas, 27/09). Aqui se mostra o RITMO (60 Hz, 20 Hz) e a contagem de testes;
 *   · Nada de feature que o STATUS_REAL marca PARCIAL/DEMO/AUSENTE (R13);
 *   · Imagem só de /arte, /brand, /loading, /capturas, /rascunho.
 *
 * Para render: `npm run mesa` → escolher "o-processo" no menu do topo → validar → exportar.
 * ========================================================================== */

window.ROTEIRO = {
  formato: 'paisagem',

  marca: {
    estudio: 'SERAFIM WEB',
    jogo: 'CYBERMECH',
    site: 'www.selvamkt.com.br/cybermech',
    rodape: 'CYBERMECH · COMO ESTE JOGO É FEITO',
  },

  cenas: [
    {
      modelo: 'boot',
      segundos: 3.0,
      linhas: [
        ['> PROTOCOLO SERAFIM UM v4.2', '[ATIVO]', 0.42],
        ['> 1455 TESTES DE SIMULAÇÃO', '[VERDE]', 0.98],
        ['> 245 PRs MERGEADOS', '[NO AR]', 1.56],
      ],
      emblema: 'SW',
      assinatura: 'APRESENTA',
    },

    {
      modelo: 'letreiro',
      segundos: 3.0,
      titulo: 'CYBERMECH',
      subtitulo: 'SHOOTER DE MECHS NO NAVEGADOR',
      fichas: ['VITE 8', 'TYPESCRIPT 7', 'THREE.JS', 'RAPIER3D'],
      rodape: 'TICK FIXO 60 Hz · SEM INSTALAR · SEM PAY-TO-WIN',
    },

    {
      modelo: 'esteira',
      segundos: 5.4,
      etapa: '01',
      titulo: 'DO PEDIDO AO AR',
      sub: 'o dono fala; o registro guarda; o CI decide',
      citacao: '«precisamos de fases com missões de escolta, ataque e defesa de base»',
      autor: '— O DONO, 12/10 · virou a ordem P99 e o mapa de missão com rota',
      passos: [
        ['PEDIDO', 'na conversa'],
        ['ORDEM', 'P99 no registro'],
        ['CONTRATO', 'o que já existe'],
        ['PR', '#258'],
        ['CI VERDE', 'check completo'],
        ['NO AR', 'merge na main'],
      ],
      rodape: 'DO PEDIDO AO SITE EM MINUTOS, NÃO EM SEMANAS',
    },

    {
      modelo: 'equipe',
      segundos: 5.2,
      etapa: '02',
      titulo: 'QUATRO AGENTES, UM PROTOCOLO',
      sub: 'territórios separados; o dono decide',
      chefe: ['DAN', 'PEDE, DECIDE E JOGA'],
      agentes: [
        ['CLAUDE', 'SIMULAÇÃO · REDE · SERVIDOR', '#ff9a6b'],
        ['CODEX', 'RENDER · EFEITOS · DESEMPENHO', '#5fd8a8'],
        ['GEMINI', 'INTERFACE · MENUS · SOM', '#f2e6cf'],
        ['QWEN', 'TESTES · DOCUMENTAÇÃO · AUDITORIA', '#8fb8ff'],
      ],
      contadores: [
        ['1455', 'TESTES DE SIMULAÇÃO'],
        ['245', 'PRs MERGEADOS'],
        ['20 / 89', 'MÓDULOS / DEPENDÊNCIAS'],
      ],
      rodape: 'UMA TAREFA = UM BRANCH = UM PR · NADA ENTRA SEM O CHECK VERDE',
    },

    {
      modelo: 'ritmo',
      segundos: 4.8,
      etapa: '03',
      titulo: 'UMA SIMULAÇÃO SÓ',
      sub: 'o cliente e o servidor rodam o mesmo código',
      legenda: 'A MESMA PARTIDA, TICK A TICK, EM QUALQUER MÁQUINA',
      leituras: [
        ['60', 'Hz', 'FIXOS, SEM DEPENDER DO QUADRO'],
        ['0,74', 'ms', 'POR TICK COM A SALA CHEIA'],
        ['20', 'Hz', 'ESTADO NA REDE'],
      ],
      proibido: ['Math.random', 'Date.now', 'DOM na simulação'],
      ficha: 'VECTOR-09 · 5,3 m · 9 m/s · DASH 34 m/s',
    },

    {
      modelo: 'galeria',
      segundos: 6.4,
      etapa: '04',
      titulo: 'O MUNDO SAI DESSE PROTOCOLO',
      sub: 'os robôs nascem de números; a ficha vem antes do código',
      imagens: [
        ['/arte/mech-blueprints.png', 'OS ROBÔS NASCEM DE NÚMEROS', 'inverter'],
        ['/arte/fichas-modos.png', 'A FICHA ANTES DO CÓDIGO'],
        ['/arte/esquadrao-acao-claude.jpg', 'UM ESQUADRÃO INTEIRO NA MESMA PARTIDA'],
        ['/arte/console-comando-claude.jpg', 'A SALA DE COMANDO É O MENU'],
      ],
    },

    {
      modelo: 'esteira',
      segundos: 5.4,
      etapa: '05',
      titulo: 'FEEDBACK VIRA NÚMERO',
      sub: 'o dono sente; o teste mede; o número decide',
      citacao: '«o gelo está indo muito longe, o fogo está fraco e curto»',
      autor: '— O DONO, 11/10 · virou alcance e cone medidos no teste',
      passos: [
        ['QUEIXA', 'jogando'],
        ['MEDIÇÃO', 'alcance e dano'],
        ['AJUSTE', 'no número'],
        ['TESTE', 'no mesmo PR'],
        ['PLAYTEST', 'no ar'],
      ],
      rodape: 'BALANÇO SE DECIDE COM MEDIDA, NÃO COM ACHISMO',
    },

    {
      modelo: 'galeria',
      segundos: 5.6,
      etapa: '06',
      titulo: 'CENÁRIOS QUE PEDEM JOGADA',
      sub: 'arena, bunker de quatro níveis, bandeira, ondas',
      imagens: [
        ['/arte/render-c3-arena-codex.png', 'A ARENA'],
        ['/arte/bunker-atrio-codex.png', 'O BUNKER, POR DENTRO'],
        ['/arte/ctf-mode.png', 'CAPTURA DE BANDEIRA'],
        ['/arte/survival-waves.png', 'SOBREVIVÊNCIA EM ONDAS'],
      ],
    },

    {
      modelo: 'ritmo',
      segundos: 3.8,
      etapa: '07',
      titulo: 'O QUE ESTE JOGO NÃO É',
      sub: 'as regras que não mudam, por decisão do dono',
      legenda: 'FAIR-PLAY É REGRA DURA, NÃO DESEJO',
      leituras: [
        ['0', '', 'VANTAGEM COMPRADA EM COMBATE'],
        ['0', '', 'INSTALAÇÃO PARA JOGAR'],
        ['0', '', 'ANÚNCIO NO MEIO DO COMBATE'],
      ],
      proibido: ['PAY-TO-WIN'],
      rodape: 'O QUE SE VENDE, UM DIA, SERÁ APARÊNCIA — NUNCA DANO OU VIDA',
    },

    {
      modelo: 'galeria',
      segundos: 5.2,
      etapa: '08',
      titulo: 'O ARSENAL CRESCE TODA SEMANA',
      sub: 'cada arma nova entra com balanço medido e contra-jogo',
      imagens: [
        ['/arte/armas-modulos.png', 'ARMAS POR ENCAIXE'],
        ['/arte/anel-de-fogo-claude.png', 'O ANEL DE FOGO, MÓDULO DE ESCUDO'],
        ['/arte/canhao-sonico-claude.png', 'A ONDA SÔNICA'],
        ['/arte/missil-teleguiado-claude.png', 'MÍSSIL QUE CURVA'],
      ],
    },

    {
      // Quando o dono gravar um take (F9) e ele estiver na mesa, tire o `pular` e
      // troque `arquivo` pelo nome real em .tmp/video/clipes/ — é a ordem P97.
      pular: true,
      modelo: 'clipe',
      segundos: 5,
      etapa: '09',
      titulo: 'E AÍ O JOGO APARECE',
      sub: 'gameplay sem corte escondido',
      arquivo: 'cybermech-2026-10-12_20-00-00.webm',
      inicio: 8,
      legenda: 'UM TAKE GRAVADO NO PRÓPRIO JOGO (TECLA F9)',
    },

    {
      pular: true,
      modelo: 'veredito',
      segundos: 3.2,
      etapa: '—',
      titulo: 'O QUE DIZEM DE FORA',
      sub: 'análises independentes',
      citacoes: [['Rigor de engenharia muito superior ao padrão da web.', 'ANÁLISE INDEPENDENTE']],
      selo: 'MUITO BOM',
    },

    {
      modelo: 'final',
      segundos: 4.2,
      titulo: 'JOGUE AGORA',
      endereco: 'www.selvamkt.com.br/cybermech',
      linha: 'ABRE NO NAVEGADOR, SEM INSTALAR · ENTRADA LIVRE, SEM CADASTRO',
      assinatura: 'UM JOGO SERAFIM WEB',
    },
  ],
};
