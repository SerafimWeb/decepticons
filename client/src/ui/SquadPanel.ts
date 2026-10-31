import { EXTRA_SLOTS, type ExtraSlot } from '../combat/encaixesExtras';
import { TIERS, weapon, type Tier, type WeaponId } from '../combat/weapons';
import { DEFAULT_SETTINGS, DIFFICULTY_LABELS, PERSONA_LABELS, type Difficulty, type EnemyNames, type Persona } from '../core/Settings';
import { withoutParam } from '../core/url';
import { armaDoBot, statsDoBot } from '../combat/titaBot';
import { ARM_SLOTS, CHASSIS, CHASSIS_PAPEL, ehTita, type ChassisId } from '../entities/chassis';
import type { MapId } from '../environment/Bunker';
import {
  armasDoBot,
  armasDoExtraDoBot,
  armasSecundariasDoBot,
  CHASSIS_DOS_BOTS,
  ESQUADRAO_VERSAO,
  type EsquadraoSpec,
  nomePadraoDoBot,
  PARAM_DO_ESQUADRAO,
  type PapelDoBot,
  PAPEIS_DO_LADO,
} from '../sim/esquadrao';
import { EsquadraoEditor, indicesNoPapel, LADOS, nomeDaArma, PREDEFINIDOS, PREDEFINIDOS_ONLINE, rotuloDoPapel, type Lado } from './esquadraoEditor';
import { criarSquadOnline, type ClienteDoEsquadrao, type SquadOnline, type SquadOnlineEstado } from './squadOnline';

const PERSONAS: readonly Persona[] = ['soldado', 'brabo', 'manso', 'fujao'];
const DIFICULDADES: readonly Difficulty[] = ['facil', 'normal', 'dificil'];
const NIVEIS: readonly Tier[] = [0, 1, 2];
/** Os encaixes extras como o Hangar os chama (`HangarMenu.SLOT_LABEL`), em letras de ficha. */
const EXTRA_ROTULO: Readonly<Record<ExtraSlot, string>> = { back: 'Costas', rightShoulder: 'Ombro direito', leftShoulder: 'Ombro esquerdo' };
/** Quantos atacam ao mesmo tempo (o Mech conta 1, o andróide ½); o valor de agora entra na lista se não for um destes (as regras do servidor andam de meio em meio). */
const PRESSOES = [1, 1.5, 2, 3, 4];
const LADO_ROTULO: Readonly<Record<Lado, string>> = { inimigo: 'INIMIGOS', aliado: 'ALIADOS' };
const NIVEL_ROTULO = { leve: 'LEVE', media: 'MÉDIA', alta: 'ALTA', extrema: 'EXTREMA' } as const;
const NIVEL_DICA: Readonly<Record<keyof typeof NIVEL_ROTULO, string>> = {
  leve: 'Como o jogo de sempre: roda em qualquer máquina.',
  media: 'Mais robôs no ar: roda bem numa placa de vídeo comum.',
  alta: 'Muitos robôs: pede uma placa de vídeo decente; a qualidade automática baixa a resolução se preciso.',
  extrema: 'O teto: o jogo vai baixar a resolução para aguentar em máquina fraca, e o tiroteio não para.',
};

/** O que a janela precisa do jogo (o `Game.ts` só liga: G3). */
export interface SquadPanelOptions {
  /** O esquadrão salvo: `current` (ou `null`), `save` e o texto do link. */
  store: { readonly current: EsquadraoSpec | null; save(spec: EsquadraoSpec | null): void };
  /** O esquadrão que as Configurações mandam agora (o preset PADRÃO e o que "salvar" devolve quando nada mudou do padrão). */
  padrao: () => EsquadraoSpec;
  nomes: () => EnemyNames;
  dificuldade: () => Difficulty;
  /** O mapa da partida (o Bunker comporta 11 robôs). */
  mapa: MapId;
  /** `null` = a janela abre; senão o motivo em palavras (online: o servidor manda; missões: o pool delas). */
  indisponivel: () => string | null;
  /** Abre as Configurações na aba do jogo (a dificuldade dos bots e o resto dos ajustes). */
  abrirAjustes: () => void;
  /** Quantos atacam ao mesmo tempo (a pressão): o valor de agora e como mudá-lo. Offline vale na hora (Configurações); online é gravado no servidor junto do esquadrão. */
  atacantes: { atual: () => number; mudar: (n: number) => void };
  /**
   * O esquadrão das **salas online** (P270): com isto a janela edita o que o servidor guarda, em vez do que fica neste aparelho. É o cliente do painel do servidor (a chave do dono é a da janela SERVIDOR); só o
   * Comandante o recebe. Ausente = o esquadrão deste aparelho, como sempre.
   */
  online?: ClienteDoEsquadrao;
  /** Recarrega a partida com o que acabou de ser salvo. */
  reiniciar: () => void;
}

/** Cria um elemento com classe e texto (nada de `innerHTML`: o apelido do robô é texto do jogador). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function botao(texto: string, className: string, dados: Record<string, string>, extra: { titulo?: string; desligado?: boolean } = {}): HTMLButtonElement {
  const b = el('button', className, texto);
  b.type = 'button';
  for (const [k, v] of Object.entries(dados)) b.dataset[k] = v;
  if (extra.titulo) b.title = extra.titulo;
  if (extra.desligado) {
    b.setAttribute('aria-disabled', 'true');
    b.classList.add('off');
  }
  return b;
}

/**
 * A janela do esquadrão (P91, fase 1C): a partir do console (PILOTOS → ESQUADRÃO, ou COMANDO → FICHA DE CADA BOT), o Comandante monta a
 * partida robô por robô: quantos inimigos e aliados, e o chassi, a arma, a personalidade, a dificuldade e o apelido de cada um. O que
 * vale está em `EsquadraoEditor` (o contrato, os limites, os prontos); aqui só se desenha e se liga os botões.
 *
 * Custo: zero no jogo (a janela só existe com a pausa à vista; cada ação refaz um punhado de elementos, no máximo 32 linhas).
 * Nada vale na hora: o esquadrão é montado uma vez, então SALVAR E REINICIAR guarda no aparelho e recarrega a partida.
 */
export class SquadPanel {
  private readonly root: HTMLElement;
  private editor: EsquadraoEditor;
  private sel: { lado: Lado; i: number } | null = null;
  private aberta = false;
  private msg = '';
  private readonly lista: Record<Lado, HTMLElement> = { inimigo: el('div'), aliado: el('div') };
  private readonly contagem: Record<Lado, HTMLElement> = { inimigo: el('b'), aliado: el('b') };
  private readonly adicionar: Record<Lado, HTMLElement> = { inimigo: el('div'), aliado: el('div') };
  private presets = el('nav', 'squad-presets');
  private ficha = el('section', 'squad-ficha');
  private carga = el('div', 'squad-carga');
  private aviso = el('p', 'squad-msg');
  private acoes = el('div', 'squad-acoes');
  private pressao = el('label', 'squad-pressao');
  private titulo = el('h2', '', 'ESQUADRÃO');
  private sub = el('span', 'squad-sub', 'quem luta contra você e quem luta ao seu lado');
  private readonly secoes: Record<Lado, HTMLElement> = { inimigo: el('section'), aliado: el('section') };
  /** As salas online (P270): o que o servidor disse, e o que a janela está fazendo com ele. */
  private readonly servidor: SquadOnline | null;
  private estadoOnline: SquadOnlineEstado | null = null;
  private pressaoOnline = 1;
  private ocupado = false;
  private salvouAgora = false;

  constructor(private readonly o: SquadPanelOptions, root: HTMLElement | null = document.getElementById('squad-modal')) {
    this.servidor = o.online ? criarSquadOnline(o.online) : null;
    this.editor = this.novoEditor();
    if (!root) {
      this.root = el('div');
      return;
    }
    this.root = root;
    this.montar();
    root.addEventListener('click', (e) => this.clique(e));
    root.addEventListener('input', (e) => this.entrada(e));
    root.addEventListener('change', (e) => this.mudanca(e));
    root.addEventListener('keydown', (e) => this.tecla(e));
  }

  get isOpen(): boolean {
    return this.aberta;
  }

  private get online(): boolean {
    return this.servidor !== null;
  }

  /** Os apelidos de fábrica que o servidor usa nas salas online são os de fábrica do jogo, não os deste aparelho. */
  private nomes(): EnemyNames {
    return this.online ? DEFAULT_SETTINGS.names : this.o.nomes();
  }

  private dificuldade(): Difficulty {
    return this.estadoOnline?.dificuldade ?? this.o.dificuldade();
  }

  private novoEditor(): EsquadraoEditor {
    if (this.online) {
      const vazio: EsquadraoSpec = { v: ESQUADRAO_VERSAO, inimigos: [], aliados: [] };
      return new EsquadraoEditor(this.estadoOnline?.esquadrao ?? vazio, this.o.mapa, () => this.estadoOnline?.padrao ?? vazio, true);
    }
    return new EsquadraoEditor(this.o.store.current ?? this.o.padrao(), this.o.mapa, this.o.padrao);
  }

  /**
   * Abre a janela com o esquadrão que vale agora (ou com o rascunho que ficou aberto: fechar sem salvar não perde o que foi montado; DESFAZER
   * volta ao salvo). Devolve `false` (e não abre) se a partida não aceita esquadrão.
   */
  abrir(): boolean {
    if (!this.root.id || this.o.indisponivel() !== null) return false;
    if (this.online) {
      void this.abrirOnline();
      return true;
    }
    if (!this.editor.mudou) {
      this.editor = this.novoEditor();
      this.sel = this.primeiro();
    }
    this.msg = '';
    this.aberta = true;
    this.root.classList.remove('hidden');
    this.desenhar();
    this.root.querySelector<HTMLElement>('.squad-fechar')?.focus();
    return true;
  }

  /**
   * A janela das salas online: abre já, diz que está conferindo, e só então mostra o que o servidor guarda (com o rascunho que ficou aberto, se a pessoa mexeu e fechou sem salvar). Sem a chave
   * do dono, ou com o servidor fora do ar, a janela fica aberta com o motivo e sem o botão de gravar: nada é inventado.
   */
  private async abrirOnline(): Promise<void> {
    this.salvouAgora = false;
    this.aberta = true;
    this.root.classList.remove('hidden');
    const rascunho = this.estadoOnline !== null && this.mudouOnline();
    if (!rascunho) this.msg = 'Conferindo o servidor…';
    this.desenhar();
    this.root.querySelector<HTMLElement>('.squad-fechar')?.focus();
    if (rascunho) return;
    this.ocupado = true;
    const r = await this.servidor!.carregar();
    this.ocupado = false;
    if (r.ok) this.usarEstado(r.estado, '');
    else {
      this.estadoOnline = null;
      this.editor = this.novoEditor();
      this.sel = null;
      this.msg = r.motivo;
    }
    if (this.aberta) this.desenhar();
  }

  /** O estado que o servidor devolveu vira o esquadrão da janela (sem mudança pendente). */
  private usarEstado(estado: SquadOnlineEstado, msg: string): void {
    this.estadoOnline = estado;
    this.pressaoOnline = estado.atacantes;
    this.editor = this.novoEditor();
    this.sel = this.primeiro();
    this.msg = msg;
  }

  /** Online: há algo que o servidor ainda não tem (o esquadrão ou a pressão)? */
  private mudouOnline(): boolean {
    return this.editor.mudou || (this.estadoOnline !== null && this.pressaoOnline !== this.estadoOnline.atacantes);
  }

  /** O primeiro robô da lista (inimigos antes), ou nenhum: de onde a ficha parte quando a janela abre. */
  private primeiro(): { lado: Lado; i: number } | null {
    return this.editor.lista('inimigo').length ? { lado: 'inimigo', i: 0 } : this.editor.lista('aliado').length ? { lado: 'aliado', i: 0 } : null;
  }

  fechar(): void {
    this.aberta = false;
    this.root.classList.add('hidden');
  }

  // ─── Montagem do esqueleto (uma vez) ─────────────────────────────────────────────────────────────────────────────

  private montar(): void {
    const box = el('div', 'squad-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'squad-titulo');
    const cab = el('header', 'squad-head');
    this.titulo.id = 'squad-titulo';
    cab.append(this.titulo, this.sub, botao('[X]', 'btn-close squad-fechar', { acao: 'fechar' }, { titulo: 'Fechar (Esc)' }));
    box.append(cab, this.presets);

    const corpo = el('div', 'squad-corpo');
    for (const lado of LADOS) {
      const sec = this.secoes[lado];
      sec.className = `squad-lado squad-${lado}s`;
      sec.setAttribute('aria-label', LADO_ROTULO[lado]);
      const topo = el('header', 'squad-lado-topo');
      const h = el('h3', '', LADO_ROTULO[lado] + ' ');
      h.append(this.contagem[lado]);
      topo.append(h, this.adicionar[lado]);
      this.lista[lado] = el('ol', 'squad-lista');
      this.lista[lado].setAttribute('aria-label', `Robôs: ${LADO_ROTULO[lado].toLowerCase()}`);
      sec.append(topo, this.lista[lado]);
      corpo.append(sec);
    }
    corpo.append(this.ficha);
    box.append(corpo);

    const pe = el('footer', 'squad-pe');
    this.aviso.setAttribute('role', 'status');
    pe.append(this.carga, this.pressao, this.aviso, this.acoes);
    box.append(pe);
    this.root.replaceChildren(box);
  }

  // ─── Desenho ─────────────────────────────────────────────────────────────────────────────────────────────────────

  private desenhar(): void {
    // Online o título muda e não há aliados (a sala não os descreve na rede): a seção deles sai.
    this.titulo.textContent = this.online ? 'ESQUADRÃO DAS SALAS ONLINE' : 'ESQUADRÃO';
    this.sub.textContent = this.online ? 'quem enfrenta todos os jogadores, em cada sala nova' : 'quem luta contra você e quem luta ao seu lado';
    this.secoes.aliado.style.display = this.online ? 'none' : '';
    this.root.classList.toggle('squad-online', this.online);
    this.desenharPresets();
    for (const lado of LADOS) {
      this.desenharAdicionar(lado);
      this.desenharLista(lado);
    }
    this.desenharFicha();
    this.desenharPe();
  }

  /** Só o que a digitação do apelido muda: as linhas das listas e o pé (a ficha fica, para o foco não sair do campo). */
  private desenharSemFicha(): void {
    for (const lado of LADOS) this.desenharLista(lado);
    this.desenharPe();
  }

  private desenharPresets(): void {
    this.presets.setAttribute('aria-label', 'Esquadrões prontos');
    this.presets.replaceChildren(
      el('span', 'squad-presets-rot', 'PRONTOS'),
      ...PREDEFINIDOS.filter((p) => !this.online || PREDEFINIDOS_ONLINE.includes(p.id)).map((p) => botao(p.nome, 'squad-preset', { acao: 'preset', id: p.id }, { titulo: p.descricao })),
    );
  }

  private desenharAdicionar(lado: Lado): void {
    this.adicionar[lado].className = 'squad-add';
    const rotulo: Record<PapelDoBot, string> = { mech: '+ MECH', android: '+ ANDRÓIDE', technician: '+ TÉCNICO' };
    this.adicionar[lado].replaceChildren(
      ...PAPEIS_DO_LADO[lado].map((papel) => {
        const motivo = this.editor.podeAdicionar(lado, papel);
        return botao(rotulo[papel], 'squad-mais', { acao: 'add', lado, papel }, { titulo: motivo ?? `Põe mais um ${rotuloDoPapel(papel).toLowerCase()} do lado dos ${LADO_ROTULO[lado].toLowerCase()}`, desligado: motivo !== null });
      }),
    );
  }

  private desenharLista(lado: Lado): void {
    const l = this.editor.lista(lado);
    const nomes = this.editor.descricoes(lado, this.nomes());
    this.contagem[lado].textContent = `${l.length}`;
    const itens = l.map((b, i) => {
      const li = el('li', `squad-bot squad-papel-${b.papel}${this.sel?.lado === lado && this.sel.i === i ? ' sel' : ''}`);
      const linha = botao('', 'squad-linha', { acao: 'sel', lado, i: String(i) });
      linha.setAttribute('aria-pressed', String(this.sel?.lado === lado && this.sel.i === i));
      const d = nomes[i]!;
      linha.append(el('i', 'squad-ico'), el('b', '', d.nome), el('small', '', d.linha));
      li.append(linha, botao('×', 'squad-x', { acao: 'del', lado, i: String(i) }, { titulo: `Tirar ${d.nome}` }));
      li.lastElementChild!.setAttribute('aria-label', `Tirar ${d.nome}`);
      return li;
    });
    this.lista[lado].replaceChildren(...(itens.length ? itens : [el('li', 'squad-vazio', lado === 'inimigo' ? 'Sem inimigos: só você na arena.' : 'Sem aliados: você luta sozinho.')]));
  }

  private desenharFicha(): void {
    this.ficha.setAttribute('aria-label', 'Ficha do robô');
    const s = this.sel;
    const bot = s ? this.editor.lista(s.lado)[s.i] : undefined;
    if (!s || !bot) {
      this.ficha.replaceChildren(el('h3', '', 'FICHA DO ROBÔ'), el('p', 'squad-dica', 'Escolha um robô nas listas para ver e mudar o chassi, a arma, a personalidade e o apelido dele, ou ponha um novo com os botões + de cada lado.'));
      return;
    }
    const nomes = this.editor.descricoes(s.lado, this.nomes());
    const d = nomes[s.i]!;
    const campo = (rotulo: string, controle: HTMLElement, ajuda?: string): HTMLElement => {
      const linha = el('div', 'squad-campo');
      const lab = el('label', '', rotulo);
      if (controle.id) lab.htmlFor = controle.id;
      linha.append(lab, controle);
      if (ajuda) linha.append(el('small', 'squad-ajuda', ajuda));
      return linha;
    };
    const opcao = (valor: string, texto: string, atual: string): HTMLOptionElement => {
      const op = el('option', '', texto);
      op.value = valor;
      op.selected = valor === atual;
      return op;
    };
    const selecao = (id: string, campoNome: string, opcoes: readonly HTMLOptionElement[], desligado = false): HTMLSelectElement => {
      const x = el('select');
      x.id = id;
      x.dataset.campo = campoNome;
      x.disabled = desligado;
      x.append(...opcoes);
      return x;
    };

    const apelido = el('input');
    apelido.type = 'text';
    apelido.id = 'squad-campo-nome';
    apelido.dataset.campo = 'nome';
    apelido.maxLength = 16;
    apelido.autocomplete = 'off';
    apelido.spellcheck = false;
    apelido.value = bot.nome ?? '';
    // O nome que ele teria sem apelido próprio (o da lista de Configurações): aparece apagado dentro do campo.
    apelido.placeholder = nomePadraoDoBot(s.lado, bot.papel, indicesNoPapel(this.editor.lista(s.lado))[s.i]!, this.nomes());

    const topo = el('div', 'squad-ficha-topo');
    topo.append(el('h3', '', 'FICHA DO ROBÔ'), el('span', `squad-ficha-quem squad-${s.lado}`, `${s.lado === 'inimigo' ? 'INIMIGO' : 'ALIADO'} · ${rotuloDoPapel(bot.papel)}`));
    const campos: HTMLElement[] = [campo('Apelido', apelido, 'Aparece sobre o robô e no placar; vazio usa o nome de fábrica.')];

    // O chassi na mesma lista do Hangar (P288): os Mechs na ordem dele, o andróide e (só nos inimigos) o técnico. Trocar de um para o outro refaz o robô; o apelido e a dificuldade ficam.
    const corpoAtual: string = bot.papel === 'mech' ? (bot.chassi ?? 'vector09') : bot.papel;
    const chassi: ChassisId = bot.chassi ?? 'vector09';
    const opcoesDoCorpo: HTMLOptionElement[] = [
      // Os titãs (P108) só do lado dos inimigos e onde o mapa os comporta (a Cidade Neon); o que o robô já é continua na lista.
      ...CHASSIS_DOS_BOTS.filter((c) => !ehTita(c) || c === bot.chassi || (s.lado === 'inimigo' && this.editor.limites.titas > 0)).map((c) => opcao(c, CHASSIS[c].name, corpoAtual)),
      ...PAPEIS_DO_LADO[s.lado].filter((p) => p !== 'mech').map((p) => opcao(p, rotuloDoPapel(p), corpoAtual)),
    ];
    const ajudaDoCorpo =
      bot.papel === 'mech'
        ? `${CHASSIS_PAPEL[chassi]} Vida ${CHASSIS[chassi].maxModuleHealth.torso}, ${CHASSIS[chassi].moveSpeed} m/s.`
        : bot.papel === 'android'
          ? 'Andróide: pequeno, muito rápido e frágil. Ataca de perto, com motosserra, e desvia com dash.'
          : 'O técnico conserta os Mechs rebeldes e não atira: fica perto de quem está avariado.';
    if (bot.papel === 'mech') {
      const persona = bot.persona ?? 'soldado';
      campos.push(
        campo('Personalidade', selecao('squad-campo-persona', 'persona', PERSONAS.map((p) => opcao(p, PERSONA_LABELS[p].label, persona))), PERSONA_LABELS[persona].about),
      );
    }
    campos.push(campo('Chassi', selecao('squad-campo-chassi', 'chassi', opcoesDoCorpo), ajudaDoCorpo));
    if (bot.papel === 'mech') {
      // A arma de fábrica do ROBÔ (não a do Hangar): o Colossus-01 bot usa o plasma do chefe e o canhão de cerco do V4 sai com o dano limitado (combat/titaBot.ts).
      const fabrica = statsDoBot(chassi).loadout.primary;
      const armas: readonly WeaponId[] = armasDoBot(chassi);
      const arma = bot.arma?.id ?? '';
      const nivel = String(bot.arma?.tier ?? fabrica.tier);
      const w = bot.arma ? armaDoBot(bot.arma.id, bot.arma.tier, chassi) : fabrica;
      const linhaArma = el('div', 'squad-par');
      linhaArma.append(
        selecao('squad-campo-arma', 'arma', [opcao('', `De fábrica: ${fabrica.name}`, arma), ...armas.map((a) => opcao(a, weapon(a).name, arma))]),
        selecao('squad-campo-nivel', 'nivel', NIVEIS.map((t) => opcao(String(t), TIERS[t]?.label ?? '', nivel)), !bot.arma),
      );
      campos.push(campo('Braço direito', linhaArma, `${nomeDaArma(w.id, w.tier)}: dano ${w.damage}, ótimo a ${w.optimalRange} m, ${(1 / w.fireInterval).toFixed(1).replace('.', ',')} tiros/s. O robô ataca de onde a arma rende.`));
      // A mão esquerda (P108 b): como no Hangar, uma segunda arma que atira junto, com a cadência dela. Só o que o encaixe esquerdo do chassi aceita e o bot sabe atirar.
      const esquerdas = armasSecundariasDoBot(chassi);
      if (esquerdas.length) {
        const sec = bot.secundaria?.id ?? '';
        const nivel2 = String(bot.secundaria?.tier ?? 0);
        const w2 = bot.secundaria ? armaDoBot(bot.secundaria.id, bot.secundaria.tier, chassi) : null;
        const linhaEsq = el('div', 'squad-par');
        linhaEsq.append(
          selecao('squad-campo-secundaria', 'secundaria', [opcao('', 'Nenhuma (só a principal)', sec), ...esquerdas.map((a) => opcao(a, weapon(a).name, sec))]),
          selecao('squad-campo-nivel2', 'nivel2', NIVEIS.map((t) => opcao(String(t), TIERS[t]?.label ?? '', nivel2)), !bot.secundaria),
        );
        campos.push(
          campo('Braço esquerdo', linhaEsq, w2 ? `${nomeDaArma(w2.id, w2.tier)}: dano ${w2.damage}, alcance ${w2.maxRange} m, ${(1 / w2.fireInterval).toFixed(1).replace('.', ',')} tiros/s. Atira junto com a principal, no próprio ritmo; quem soma armas esquenta mais.` : 'Sem arma na esquerda: o robô atira só a principal.'),
        );
      }
      // Os encaixes extras (P288), os mesmos do Hangar: costas e ombros, cada um com a sua arma e o seu nível, só nos chassis que os têm.
      for (const slot of EXTRA_SLOTS) {
        const opcoes = armasDoExtraDoBot(chassi, slot);
        if (!opcoes.length) continue;
        const atual = bot.extras?.[slot];
        const linha = el('div', 'squad-par');
        linha.append(
          selecao(`squad-campo-extra-${slot}`, `extra:${slot}`, [opcao('', 'Vazio', atual?.id ?? ''), ...opcoes.map((a) => opcao(a, weapon(a).name, atual?.id ?? ''))]),
          selecao(`squad-campo-extra-nivel-${slot}`, `extra-nivel:${slot}`, NIVEIS.map((t) => opcao(String(t), TIERS[t]?.label ?? '', String(atual?.tier ?? 0))), !atual),
        );
        const w3 = atual ? armaDoBot(atual.id, atual.tier, chassi) : null;
        campos.push(campo(EXTRA_ROTULO[slot], linha, w3 ? `${nomeDaArma(w3.id, w3.tier)}: dano ${w3.damage}, alcance ${w3.maxRange} m, ${(1 / w3.fireInterval).toFixed(1).replace('.', ',')} tiros/s. Atira junto com as outras, no próprio ritmo.` : undefined));
      }
      // O titã luta com a arma de fábrica, como chefe: os encaixes extras dele (costas e ombros) são só do Hangar.
      if (ehTita(chassi) && EXTRA_SLOTS.some((slot) => ARM_SLOTS[chassi][slot] !== undefined)) campos.push(el('p', 'squad-dica', 'O titã luta com a arma de fábrica, como chefe: costas e ombros são só do Hangar.'));
    }
    if (bot.papel !== 'technician') {
      const dif = bot.dificuldade ?? '';
      campos.push(
        campo('Dificuldade', selecao('squad-campo-dificuldade', 'dificuldade', [opcao('', `Da ${this.online ? 'sala' : 'partida'} (${DIFFICULTY_LABELS[this.dificuldade()]})`, dif), ...DIFICULDADES.map((x) => opcao(x, DIFFICULTY_LABELS[x], dif))]), 'Reação, mira e rajada. Vale só para este robô; as outras seguem a da partida.'),
      );
    }

    const duplicar = botao('[ DUPLICAR ]', 'btn-terminal squad-dup', { acao: 'dup' }, { titulo: this.editor.podeAdicionar(s.lado, bot.papel) ?? 'Copia este robô (sem o apelido) logo depois dele', desligado: this.editor.podeAdicionar(s.lado, bot.papel) !== null });
    this.ficha.replaceChildren(topo, el('p', 'squad-quem', d.nome), ...campos, duplicar);
  }

  private desenharPe(): void {
    this.desenharPressao();
    if (this.online) return this.desenharPeOnline();
    const r = this.editor.resumo;
    const c = this.editor.carga;
    const lim = this.editor.limites;
    const barra = el('i', 'squad-barra');
    const enche = el('b', `n-${c.nivel}`);
    enche.style.transform = `scaleX(${Math.max(0.02, Math.min(1, c.peso / Math.max(1, c.teto))).toFixed(3)})`;
    barra.append(enche);
    this.carga.replaceChildren(
      el('span', 'squad-carga-rot', 'CARGA'),
      barra,
      el('strong', `n-${c.nivel}`, NIVEL_ROTULO[c.nivel]),
      el('small', '', `${r.total} de ${lim.total} robôs · ${r.inimigos} contra você, ${r.aliados} com você`),
    );
    this.carga.title = NIVEL_DICA[c.nivel];

    const excesso = this.editor.excessos;
    this.aviso.textContent = this.msg || (excesso.length ? `Neste mapa não cabe: ${excesso.join('; ')}. O que passar fica de fora.` : this.editor.mudou ? 'Vale ao reiniciar a partida.' : '');
    this.aviso.classList.toggle('aviso', excesso.length > 0);

    const salvar = botao('[ SALVAR E REINICIAR ]', 'btn-terminal squad-salvar', { acao: 'salvar' }, { titulo: this.editor.mudou ? 'Guarda no aparelho e recarrega a partida com este esquadrão' : 'Nada mudou', desligado: !this.editor.mudou });
    this.acoes.replaceChildren(
      ...(this.editor.mudou ? [botao('[ DESFAZER ]', 'btn-terminal', { acao: 'desfazer' }, { titulo: 'Joga fora as mudanças e volta ao esquadrão salvo' })] : []),
      botao('[ AJUSTES DO JOGO ]', 'btn-terminal', { acao: 'ajustes' }, { titulo: 'Dificuldade dos bots' }),
      botao('[ COPIAR LINK ]', 'btn-terminal', { acao: 'link' }, { titulo: 'O link leva este esquadrão a outro aparelho' }),
      salvar,
    );
  }

  // ─── Ações ───────────────────────────────────────────────────────────────────────────────────────────────────────

  private clique(e: Event): void {
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-acao]');
    if (e.target === this.root) return this.fechar();
    if (!alvo || alvo.getAttribute('aria-disabled') === 'true') return;
    const d = alvo.dataset;
    const lado = d.lado as Lado | undefined;
    const i = Number(d.i);
    switch (d.acao) {
      case 'fechar':
        return this.fechar();
      case 'preset': {
        const cortados = this.editor.usarPredefinido(d.id!);
        const p = PREDEFINIDOS.find((x) => x.id === d.id);
        this.sel = this.primeiro();
        this.msg = p && cortados !== null ? `${p.nome}: ${p.descricao}.${cortados > 0 ? ` Neste mapa só cabem ${this.editor.limites.total}: ${cortados} ficaram de fora.` : ''}` : '';
        break;
      }
      case 'add': {
        const novo = this.editor.adicionar(lado!, d.papel as PapelDoBot);
        if (novo >= 0) this.sel = { lado: lado!, i: novo };
        this.msg = '';
        break;
      }
      case 'sel':
        this.sel = { lado: lado!, i };
        this.msg = '';
        break;
      case 'del':
        this.editor.remover(lado!, i);
        this.sel = this.depoisDeTirar(lado!, i);
        this.msg = '';
        break;
      case 'dup': {
        if (!this.sel) return;
        const copia = this.editor.duplicar(this.sel.lado, this.sel.i);
        if (copia >= 0) this.sel = { lado: this.sel.lado, i: copia };
        this.msg = '';
        break;
      }
      case 'desfazer':
        if (this.estadoOnline) this.pressaoOnline = this.estadoOnline.atacantes;
        this.editor = this.novoEditor();
        this.sel = this.primeiro();
        this.msg = 'Voltou ao esquadrão salvo.';
        break;
      case 'ajustes':
        this.fechar();
        this.o.abrirAjustes();
        return;
      case 'link':
        void this.copiarLink();
        return;
      case 'salvar':
        this.salvar();
        return;
      case 'regras':
        void this.salvarOnline(true);
        return;
      case 'entrar':
        this.o.reiniciar();
        return;
      default:
        return;
    }
    this.desenhar();
    // O foco volta para onde a pessoa estava (a linha escolhida), para o teclado seguir de onde parou.
    if (d.acao === 'sel' || d.acao === 'add' || d.acao === 'dup') this.root.querySelector<HTMLElement>('.squad-bot.sel .squad-linha')?.focus();
  }

  /** Quem fica escolhido depois de tirar o robô `i`: o que ocupou o lugar dele, ou o anterior, ou ninguém. */
  private depoisDeTirar(lado: Lado, i: number): { lado: Lado; i: number } | null {
    const n = this.editor.lista(lado).length;
    if (n > 0) return { lado, i: Math.min(i, n - 1) };
    const outro: Lado = lado === 'inimigo' ? 'aliado' : 'inimigo';
    return this.editor.lista(outro).length ? { lado: outro, i: 0 } : null;
  }

  /** O apelido muda a cada tecla; o resto, ao escolher (`change`). */
  private entrada(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.dataset.campo !== 'nome' || !this.sel) return;
    this.editor.editar(this.sel.lado, this.sel.i, { nome: t.value || undefined });
    this.msg = '';
    this.desenharSemFicha();
  }

  private mudanca(e: Event): void {
    const t = e.target as HTMLSelectElement;
    if (t instanceof HTMLSelectElement && t.dataset.campo === 'pressao') {
      const n = Number(t.value);
      if (this.online) this.pressaoOnline = n;
      else this.o.atacantes.mudar(n);
      this.msg = '';
      this.desenharPe();
      this.root.querySelector<HTMLElement>('#squad-campo-pressao')?.focus();
      return;
    }
    const s = this.sel;
    if (!s || !(t instanceof HTMLSelectElement)) return;
    const v = t.value;
    switch (t.dataset.campo) {
      case 'persona':
        this.editor.editar(s.lado, s.i, { persona: v as Persona });
        break;
      case 'chassi': {
        const recusa = this.editor.trocarCorpo(s.lado, s.i, v as ChassisId | 'android' | 'technician');
        if (recusa) {
          this.msg = recusa;
          this.aviso.classList.add('aviso');
        }
        break;
      }
      case 'arma': {
        const atual = this.editor.lista(s.lado)[s.i]?.arma;
        this.editor.editar(s.lado, s.i, { arma: v ? { id: v as WeaponId, tier: atual?.tier ?? 0 } : undefined });
        break;
      }
      case 'nivel':
        this.editor.editarNivel(s.lado, s.i, Number(v) as Tier);
        break;
      case 'secundaria': {
        const atual = this.editor.lista(s.lado)[s.i]?.secundaria;
        this.editor.editar(s.lado, s.i, { secundaria: v ? { id: v as WeaponId, tier: atual?.tier ?? 0 } : undefined });
        break;
      }
      case 'nivel2':
        this.editor.editarNivelSecundaria(s.lado, s.i, Number(v) as Tier);
        break;
      case 'dificuldade':
        this.editor.editar(s.lado, s.i, { dificuldade: (v || undefined) as Difficulty | undefined });
        break;
      default: {
        // Os encaixes extras (P288): `extra:<encaixe>` troca a arma, `extra-nivel:<encaixe>` o nível.
        const [campoExtra, encaixe] = (t.dataset.campo ?? '').split(':');
        if (!encaixe || !(EXTRA_SLOTS as readonly string[]).includes(encaixe)) return;
        if (campoExtra === 'extra') this.editor.editarExtra(s.lado, s.i, encaixe as ExtraSlot, (v || null) as WeaponId | null);
        else if (campoExtra === 'extra-nivel') this.editor.editarNivelExtra(s.lado, s.i, encaixe as ExtraSlot, Number(v) as Tier);
        else return;
      }
    }
    this.msg = '';
    this.desenhar();
    // O seletor que acabou de mudar volta a ter o foco (desenhar refez a ficha).
    this.root.querySelector<HTMLElement>(`#${t.id}`)?.focus();
  }

  private tecla(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      this.fechar();
      return;
    }
    const linha = (e.target as HTMLElement).closest<HTMLElement>('.squad-linha');
    if (!linha) return;
    const lado = linha.dataset.lado as Lado;
    const i = Number(linha.dataset.i);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const n = this.editor.lista(lado).length;
      const j = Math.max(0, Math.min(n - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      this.sel = { lado, i: j };
      e.preventDefault();
      this.desenhar();
      this.root.querySelector<HTMLElement>('.squad-bot.sel .squad-linha')?.focus();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.editor.remover(lado, i);
      this.sel = this.depoisDeTirar(lado, i);
      this.desenhar();
      this.root.querySelector<HTMLElement>('.squad-bot.sel .squad-linha')?.focus();
    }
  }

  private salvar(): void {
    if (this.online) return void this.salvarOnline(false);
    if (!this.editor.mudou) return;
    // O que as Configurações já mandam não precisa de esquadrão à parte: guardar `null` deixa a contagem e as personalidades das Configurações valerem.
    this.o.store.save(this.editor.ehOPadrao ? null : this.editor.esquadrao);
    this.msg = 'Salvo. Reiniciando a partida…';
    this.desenharPe();
    this.o.reiniciar();
  }

  /** "Atacam ao mesmo tempo": a pressão que o jogo faz sobre quem joga (o Mech conta 1, o andróide ½). Offline vale na hora; online vai ao servidor junto do esquadrão. */
  private desenharPressao(): void {
    const atual = this.online ? this.pressaoOnline : this.o.atacantes.atual();
    const seletor = el('select');
    seletor.id = 'squad-campo-pressao';
    seletor.dataset.campo = 'pressao';
    seletor.disabled = this.online && this.estadoOnline === null;
    for (const n of [...new Set([...PRESSOES, atual])].sort((a, b) => a - b)) {
      const op = el('option', '', n < 1 ? '½' : n % 1 ? `${Math.floor(n)} e ½` : String(n));
      op.value = String(n);
      op.selected = n === atual;
      seletor.append(op);
    }
    this.pressao.replaceChildren(el('span', 'squad-pressao-rot', 'Atacam ao mesmo tempo'), seletor, el('small', 'squad-ajuda', 'Mech conta 1, andróide ½; os outros esperam a vez, afastados'));
  }

  /** O pé da janela das salas online (P270): a carga da sala, o que vale, e gravar para todos. */
  private desenharPeOnline(): void {
    const r = this.editor.resumo;
    const c = this.editor.carga;
    const lim = this.editor.limites;
    const barra = el('i', 'squad-barra');
    const enche = el('b', `n-${c.nivel}`);
    enche.style.transform = `scaleX(${Math.max(0.02, Math.min(1, c.peso / Math.max(1, c.teto))).toFixed(3)})`;
    barra.append(enche);
    this.carga.replaceChildren(
      el('span', 'squad-carga-rot', 'CARGA'),
      barra,
      el('strong', `n-${c.nivel}`, NIVEL_ROTULO[c.nivel]),
      el('small', '', `${r.inimigos} de ${lim.inimigos} robôs por sala · no máximo ${lim.porPapel?.mech ?? 0} Mechs, ${lim.porPapel?.android ?? 0} andróides e ${lim.tecnicos} técnico`),
    );
    this.carga.title = NIVEL_DICA[c.nivel];

    const pronto = this.estadoOnline !== null;
    const mudou = pronto && this.mudouOnline();
    this.aviso.textContent =
      this.msg ||
      (!pronto ? '' : mudou ? 'Vale nas salas que abrirem depois de salvar.' : this.estadoOnline!.salvo ? 'Este é o esquadrão salvo: toda sala nova nasce com ele.' : 'Nenhum esquadrão salvo: valem as regras do servidor (REGRAS DAS SALAS).');
    this.aviso.classList.toggle('aviso', !pronto && !this.ocupado && this.msg !== '');

    const salvar = botao('[ SALVAR PARA TODOS ]', 'btn-terminal squad-salvar', { acao: 'salvar' }, { titulo: mudou ? 'Grava no servidor: toda sala que abrir depois nasce com este esquadrão' : 'Nada mudou', desligado: !mudou || this.ocupado });
    this.acoes.replaceChildren(
      ...(mudou ? [botao('[ DESFAZER ]', 'btn-terminal', { acao: 'desfazer' }, { titulo: 'Joga fora as mudanças e volta ao que o servidor guarda' })] : []),
      ...(pronto && this.estadoOnline!.salvo ? [botao('[ VOLTAR ÀS REGRAS ]', 'btn-terminal', { acao: 'regras' }, { titulo: 'Apaga o esquadrão salvo: as salas novas voltam às regras do servidor', desligado: this.ocupado })] : []),
      ...(this.salvouAgora ? [botao('[ ENTRAR NUMA SALA NOVA ]', 'btn-terminal squad-salvar', { acao: 'entrar' }, { titulo: 'Recarrega o jogo: a sala de agora fecha quando esvazia e você cai numa nova, com este esquadrão' })] : []),
      salvar,
    );
  }

  /** Grava para todas as salas novas (ou, com `voltarAsRegras`, apaga o salvo). O servidor corta no teto da sala; a janela mostra o que ficou. */
  private async salvarOnline(voltarAsRegras: boolean): Promise<void> {
    if (this.ocupado || !this.estadoOnline || (!voltarAsRegras && !this.mudouOnline())) return;
    this.ocupado = true;
    this.msg = 'Gravando no servidor…';
    this.desenharPe();
    const r = await this.servidor!.gravar(voltarAsRegras ? null : this.editor.esquadrao, this.pressaoOnline);
    this.ocupado = false;
    if (!r.ok) {
      this.msg = r.motivo;
      this.desenhar();
      this.aviso.classList.add('aviso');
      return;
    }
    this.salvouAgora = true;
    this.usarEstado(r.estado, `${voltarAsRegras ? 'Voltaram as regras do servidor.' : 'Salvo para todos.'} Vale nas salas que abrirem depois: entre numa sala nova para ver.`);
    this.desenhar();
  }

  private async copiarLink(): Promise<void> {
    // A chave só tem letras, números e . , : - _ (legais numa busca): vai como está, sem o %3A e o %2C que o URLSearchParams poria.
    const base = new URL(withoutParam(location.href, PARAM_DO_ESQUADRAO));
    const texto = `${base.origin}${base.pathname}${base.search}${base.search ? '&' : '?'}${PARAM_DO_ESQUADRAO}=${this.editor.chave()}${base.hash}`;
    const feito = (ok: boolean) => {
      this.msg = ok ? 'Link copiado.' : `Copie o link: ${texto}`;
      this.desenharPe();
    };
    try {
      await navigator.clipboard.writeText(texto);
      feito(true);
    } catch {
      feito(false);
    }
  }
}
