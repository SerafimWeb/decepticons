/**
 * O roteiro de gravação do rádio de campo (P316): gera `.decepticons/ROTEIRO_DE_GRAVACAO.md` a partir de `client/src/audio/radio.json`, para o Comandante ensaiar e gravar.
 * Função pura e **determinística** (sem data, sem aleatório): o teste compara o arquivo commitado com a saída desta função, então o documento nunca se afasta do catálogo.
 * O comando é `scripts/roteiro-voz.mjs` (`npm run roteiro`).
 */

/** Minutos por fala numa sessão real: duas ou três tomadas, a escolha da melhor e o ajuste do tratamento (estimativa, não medida). */
export const MINUTOS_POR_FALA = 1.2;

const ROTINA_DE_AQUECIMENTO = [
  '**Respire** (1 min): inspire contando até 4 pelo nariz, solte contando até 8 pela boca, sem forçar. Ombros baixos.',
  '**Sirene** (30 s): diga "uuuu" subindo do grave ao agudo e descendo, sem esforço. Acorda a voz sem machucar.',
  '**Trava-línguas** (1 min), devagar e depois rápido: "o rato roeu a roupa do rei de Roma"; "três pratos de trigo para três tigres tristes"; "o peito do pé de Pedro é preto".',
  '**Três falas de verdade** do canal de hoje, em voz alta, antes de apertar ● Gravar. A primeira tomada é sempre a mais dura: gaste-a no ensaio.',
];

const TECNICA = [
  '**Distância:** uns 15 cm do microfone para a voz normal e o grito; uns 5 cm para o sussurro. Sempre na mesma posição dentro de um canal (o volume fica igual entre as falas).',
  '**Uma frase por tomada, inteira.** Espere 1 s antes de falar e 1 s depois de terminar: o Estúdio apara o silêncio sozinho. Errou o final? Não conserte: grave de novo.',
  '**Três tomadas por fala**, e escolha a melhor na lista de tomadas. Quase sempre é a segunda: a primeira é tensa e a terceira, cansada.',
  '**Interprete a frase, não a leia.** Cada fala tem uma intenção (a tabela de estilos, abaixo): se você acredita no personagem, o efeito faz o resto.',
  '**Água em temperatura ambiente** ao lado, sem gelo. Nos gritos, pare a cada 5 falas e beba. Rouco? Pare: grave o resto outro dia.',
  '**O medidor** do Estúdio fica verde: se passar do vermelho, afaste-se do microfone. Se não mexer nada, clique em PROCURAR O QUE FUNCIONA.',
];

const FLUXO_NO_ESTUDIO = [
  'Abra o Estúdio (`npm run estudio`, ou dois cliques em `scripts\\ligar-estudio.cmd`) e vá para a aba **VOZES**; deixe o sotaque em **Brasileiro** (o rádio só existe em português).',
  'Clique na fala na lista. Ela aparece em letras grandes, com a intenção, o diálogo de que faz parte e o **tratamento sugerido** (o botão fica contornado de verde).',
  '**● Gravar**, fale, **■ Parar**. A tomada abre já aparada na onda.',
  'Clique no botão do tratamento sugerido, **▶ Prévia**, e ajuste os números ao seu ouvido (o Estúdio nunca decide o gosto por você).',
  '**Salvar como a fala do jogo**: o mp3 vai para o jogo e a fala fica protegida (o gerador pago nunca a refaz).',
  'Terminou? Diga ao Claude **"publica os sons"**: o Estúdio não faz commit, de propósito.',
];

/** Referência de timbre por canal: a técnica que inspira o tratamento (nunca uma amostra nem uma melodia de ninguém) e o que ouvir na prévia. */
const DIRECAO_SONORA = {
  controle: ['Grande Irmão: voz grave, comprimida e com salão, de máquina que supervisiona (o vocoder frio dos álbuns de máquina e computador dos anos 70 e 80, em vez da voz de general)', 'a frase soa como uma ordem de sistema, não de gente'],
  sistema: ['Robô retrô: modulação em anel e bitcrush leve, a voz de aviso de cabine dos arcades e simuladores dos anos 80', 'cada palavra com a mesma altura, como se fosse montada de sílabas gravadas'],
  piloto: ['Rádio de comando: faixa estreita (400 a 3400 Hz) e compressão pesada, o rádio tático de sempre', 'a voz presa no telefone, sem graves'],
  intercepto: ['Interceptação: rádio sujo com saturação, um pouco de bitcrush e um varrido de fase lento, como sinal pego no ar', 'o final das palavras se desfazendo, a cauda com chiado'],
  androide: ['Androide: modulação robótica de 70 Hz, bitcrush e um eco curtíssimo que dá o "metal"; o enxame sem emoção', 'todas as falas no mesmo tom: é o efeito que faz a máquina'],
  ia: ['Demônio: mais grave, saturação e eco longo, a calma que ameaça (a distorção sombria do rave dos anos 90)', 'grave e amplo, sem subir o volume'],
  grito: ['Arena: pouco efeito, eco de estádio e graves; o grito de um piloto, não de uma máquina', 'a energia vem de você; o tratamento só dá o salão'],
};

/** As três intenções das falas do narrador (as mesmas frases de `scripts/estudio/vozes.js`, `INTENCAO`: é o que a aba VOZES mostra ao gravar). */
const INTENCAO_DO_NARRADOR = {
  grave: 'Grave e firme, separando as sílabas, como quem anuncia o começo de algo importante.',
  grito: 'Grito curto e explosivo, com raiva boa: a voz sobe no fim. Chegue perto do microfone (uns 15 cm) e solte.',
  seco: 'Seco, tenso e baixo, sem enfeite: um aviso.',
};

const escapar = (t) => String(t).replace(/\|/g, '\\|');
const aspas = (t) => `«${t}»`;
/** Já existe, no jogo, o evento que dispara a fala: o gatilho é uma chamada do cérebro do time. */
const jaToca = (f) => f.gatilho.startsWith('cerebro:');

/** O roteiro inteiro em Markdown, a partir do catálogo do rádio e (opcional) do catálogo do narrador (`falas.json`). */
export function renderizarRoteiro(radio, narrador = null) {
  const canais = Object.entries(radio.canais);
  const falas = radio.falas;
  const porCanal = (c) => falas.filter((f) => f.canal === c);
  const minutos = Math.round(falas.length * MINUTOS_POR_FALA);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const prioritarias = falas.filter(jaToca).length;
  const estimativa = `${horas > 0 ? `${horas} h ` : ''}${resto} min`;
  const o = [];

  o.push('# ROTEIRO DE GRAVAÇÃO: o rádio de campo (P316)');
  o.push('');
  o.push('> **Gerado, não edite à mão.** A fonte é `client/src/audio/radio.json` (o Estúdio e o jogo leem o mesmo arquivo); para mudar uma fala, mude lá e rode `npm run roteiro`.');
  o.push('> Um teste (`server/roteiroVoz.test.ts`) reprova o `check` se este documento se afastar do catálogo.');
  o.push('');
  o.push(`**${falas.length} falas de rádio em ${canais.length} canais${narrador ? `, mais as ${narrador.falas.length} do narrador` : ''}** (uns ${estimativa} de estúdio, só as do rádio, em duas ou três tomadas por fala: **grave em duas sessões**). Só português, na sua voz. Nada aqui é gerado pelo ElevenLabs.`);
  o.push('');
  o.push(`**Se o tempo apertar, grave primeiro as ${prioritarias} falas marcadas com ★:** são as que já têm, no jogo, o evento que as dispara (as chamadas de rádio do cérebro do time). As outras ficam guardadas até haver o gancho. O jogo as toca assim que existirem, com o rádio de campo liberado no painel (VISIBILIDADE ▸ Rádio de campo).`);
  o.push('');
  o.push('## 1. Antes de gravar: aquecimento (3 minutos)');
  o.push('');
  ROTINA_DE_AQUECIMENTO.forEach((l, i) => o.push(`${i + 1}. ${l}`));
  o.push('');
  o.push('## 2. A técnica');
  o.push('');
  TECNICA.forEach((l) => o.push(`- ${l}`));
  o.push('');
  o.push('## 3. O fluxo no Estúdio');
  o.push('');
  FLUXO_NO_ESTUDIO.forEach((l, i) => o.push(`${i + 1}. ${l}`));
  o.push('');
  o.push('## 4. A ordem das gravações e a direção sonora');
  o.push('');
  o.push('A ordem da lista do Estúdio já é a sugerida: **do mais calmo ao mais gritado**, para a voz durar. Cada canal tem o seu tratamento (o botão sugerido); os números são ponto de partida, e quem decide é o seu ouvido.');
  o.push('');
  o.push('As referências de timbre são **técnicas** (sintetizadores e vozes de máquina dos anos 70 e 80, vocoder e filtros da pista de dança dos anos 90, distorção do rave dos anos 90, os canais de pulso, triângulo e ruído dos videogames de 8 bits). **Nunca amostras, melodias nem letras de ninguém.**');
  o.push('');
  o.push('| # | Canal | Falas | Quem fala | Tratamento sugerido | Timbre de referência | O que ouvir na prévia |');
  o.push('|---|---|---|---|---|---|---|');
  canais.forEach(([c, m], i) => {
    const [ref, ouvir] = DIRECAO_SONORA[c] ?? ['', ''];
    o.push(`| ${i + 1} | **${escapar(m.rotulo)}** | ${porCanal(c).length} | ${escapar(m.quem)} | ${escapar(m.efeito)} | ${escapar(ref)} | ${escapar(ouvir)} |`);
  });
  o.push('');
  o.push('### Como dizer cada estilo');
  o.push('');
  o.push('| Estilo | Intenção |');
  o.push('|---|---|');
  for (const [nome, e] of Object.entries(radio.estilos)) o.push(`| **${nome}** | ${escapar(e.intencao)} |`);
  o.push('');
  if (narrador) {
    o.push('## 5. O narrador: as falas de partida');
    o.push('');
    o.push(`Estas ${narrador.falas.length} falas (rodadas, abates, "Você morreu", missão) **já estão na lista do Estúdio**, no primeiro grupo (NARRADOR), nos quatro sotaques. Grave o **Brasileiro**. Só as que a lista marca com ◆ ou ● têm voz hoje; as marcadas com ○ não têm voz: as 9 rodadas caem na voz robótica do navegador e as outras 9 ficam mudas na partida até você gravar. São as que o jogador mais ouve: vale gravá-las antes do rádio.`);
    o.push('');
    o.push('| ☐ | Fala | Como dizer | Chave |');
    o.push('|---|---|---|---|');
    for (const f of narrador.falas) o.push(`| ☐ | «${escapar(f.texto.br)}» | ${f.estilo}: ${escapar(INTENCAO_DO_NARRADOR[f.estilo] ?? '')} | \`${f.chave}\` |`);
    o.push('');
  }
  o.push(`## ${narrador ? 6 : 5}. As falas do rádio, canal por canal`);
  o.push('');
  o.push('Marque ☐ ao gravar e salvar. **★** = já existe, no jogo, o evento que dispara esta fala: grave estas primeiro. A coluna **Chave** é o nome do arquivo no jogo.');
  canais.forEach(([c, m], i) => {
    o.push('');
    o.push(`### ${narrador ? 6 : 5}.${i + 1} ${m.rotulo} (${porCanal(c).length})`);
    o.push('');
    o.push(`*${m.quem}* Tratamento sugerido: **${m.efeito}**.`);
    o.push('');
    o.push('| ☐ | Fala | Estilo | Nota | Chave |');
    o.push('|---|---|---|---|---|');
    for (const f of porCanal(c)) o.push(`| ☐ | ${jaToca(f) ? '★ ' : ''}${aspas(escapar(f.texto))} | ${f.estilo} | ${escapar(f.nota ?? '')} | \`${f.chave}\` |`);
  });
  const cenas = new Map();
  for (const f of falas) {
    if (!f.cena) continue;
    if (!cenas.has(f.cena)) cenas.set(f.cena, []);
    cenas.get(f.cena).push(f);
  }
  o.push('');
  o.push(`## ${narrador ? 7 : 6}. Os diálogos (comando e resposta)`);
  o.push('');
  o.push('Ensaie **em voz alta, as duas partes**, como se fossem duas pessoas. No Estúdio cada fala é gravada à parte, mas a resposta só soa certa se você ouvir a pergunta na cabeça.');
  for (const [nome, linhas] of cenas) {
    o.push('');
    o.push(`**${nome}**`);
    o.push('');
    for (const f of [...linhas].sort((a, b) => a.turno - b.turno)) o.push(`${f.turno}. *${radio.canais[f.canal]?.rotulo ?? f.canal}:* ${aspas(f.texto)}`);
  }
  const gatilhos = new Map();
  for (const f of falas) gatilhos.set(f.gatilho, (gatilhos.get(f.gatilho) ?? 0) + 1);
  o.push('');
  o.push(`## ${narrador ? 8 : 7}. Quando cada fala toca no jogo`);
  o.push('');
  o.push('Cada fala tem um **gatilho** no catálogo: `cerebro:<chamada>` toca quando o cérebro do time faz aquela chamada de rádio (pinça, posição, vai, reagrupar), e `futuro` é gravada e guardada, ainda sem gancho no jogo. O que está ligado hoje está em `STATUS_REAL.md`.');
  o.push('');
  o.push('| Gatilho | Falas |');
  o.push('|---|---|');
  for (const [g, n] of [...gatilhos].sort((a, b) => a[0].localeCompare(b[0]))) o.push(`| \`${g}\` | ${n} |`);
  o.push('');
  o.push(`## ${narrador ? 9 : 8}. Cuidados com o texto`);
  o.push('');
  o.push('- **Nomes:** só os codinomes fictícios do jogo (SERAFIM, CLAWD, GEMINAI, CHAD-GPT, KUEN, DIPSIK, MISTRAU, ENTRÓPICO). Nunca o nome de uma pessoa real, de um partido ou de uma marca de franquia (`IDENTITY.md` § 2 e `UNIVERSO.md` § 2-A).');
  o.push('- **Vocabulário:** o glossário do Grande Irmão em `VOCABULARIO_COMANDO.md` (P244) e a camada de CTI do `UNIVERSO.md` § 4.');
  o.push('- **Originalidade:** nenhuma fala copia frase, letra ou bordão de música, filme ou jogo. Ao mudar um texto, mantenha assim.');
  o.push('');
  return o.join('\n');
}
