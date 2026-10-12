import { TIERS, weapon, type Tier, type WeaponId } from '../combat/weapons';
import { DIFFICULTY_LABELS, PERSONA_LABELS, type Difficulty, type EnemyNames, type Persona } from '../core/Settings';
import { withoutParam } from '../core/url';
import { CHASSIS, CHASSIS_PAPEL, type ChassisId } from '../entities/chassis';
import type { MapId } from '../environment/Bunker';
import {
  armasDoBot,
  CHASSIS_DOS_BOTS,
  type EsquadraoSpec,
  nomePadraoDoBot,
  PARAM_DO_ESQUADRAO,
  type PapelDoBot,
  PAPEIS_DO_LADO,
} from '../sim/esquadrao';
import { EsquadraoEditor, indicesNoPapel, LADOS, nomeDaArma, PREDEFINIDOS, rotuloDoPapel, type Lado } from './esquadraoEditor';

const PERSONAS: readonly Persona[] = ['soldado', 'brabo', 'manso', 'fujao'];
const DIFICULDADES: readonly Difficulty[] = ['facil', 'normal', 'dificil'];
const NIVEIS: readonly Tier[] = [0, 1, 2];
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
  /** Abre as Configurações na aba do jogo (dificuldade, quantos atacam ao mesmo tempo). */
  abrirAjustes: () => void;
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

  constructor(private readonly o: SquadPanelOptions, root: HTMLElement | null = document.getElementById('squad-modal')) {
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

  private novoEditor(): EsquadraoEditor {
    return new EsquadraoEditor(this.o.store.current ?? this.o.padrao(), this.o.mapa, this.o.padrao);
  }

  /**
   * Abre a janela com o esquadrão que vale agora (ou com o rascunho que ficou aberto: fechar sem salvar não perde o que foi montado; DESFAZER
   * volta ao salvo). Devolve `false` (e não abre) se a partida não aceita esquadrão.
   */
  abrir(): boolean {
    if (!this.root.id || this.o.indisponivel() !== null) return false;
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
    const titulo = el('h2', '', 'ESQUADRÃO');
    titulo.id = 'squad-titulo';
    cab.append(titulo, el('span', 'squad-sub', 'quem luta contra você e quem luta ao seu lado'), botao('[X]', 'btn-close squad-fechar', { acao: 'fechar' }, { titulo: 'Fechar (Esc)' }));
    box.append(cab, this.presets);

    const corpo = el('div', 'squad-corpo');
    for (const lado of LADOS) {
      const sec = el('section', `squad-lado squad-${lado}s`);
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
    pe.append(this.carga, this.aviso, this.acoes);
    box.append(pe);
    this.root.replaceChildren(box);
  }

  // ─── Desenho ─────────────────────────────────────────────────────────────────────────────────────────────────────

  private desenhar(): void {
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
      ...PREDEFINIDOS.map((p) => botao(p.nome, 'squad-preset', { acao: 'preset', id: p.id }, { titulo: p.descricao })),
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
    const nomes = this.editor.descricoes(lado, this.o.nomes());
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
    const nomes = this.editor.descricoes(s.lado, this.o.nomes());
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
    apelido.placeholder = nomePadraoDoBot(s.lado, bot.papel, indicesNoPapel(this.editor.lista(s.lado))[s.i]!, this.o.nomes());

    const topo = el('div', 'squad-ficha-topo');
    topo.append(el('h3', '', 'FICHA DO ROBÔ'), el('span', `squad-ficha-quem squad-${s.lado}`, `${s.lado === 'inimigo' ? 'INIMIGO' : 'ALIADO'} · ${rotuloDoPapel(bot.papel)}`));
    const campos: HTMLElement[] = [campo('Apelido', apelido, 'Aparece sobre o robô e no placar; vazio usa o da lista (Configurações → Nomes na tela).')];

    if (bot.papel === 'mech') {
      const persona = bot.persona ?? 'soldado';
      campos.push(
        campo('Personalidade', selecao('squad-campo-persona', 'persona', PERSONAS.map((p) => opcao(p, PERSONA_LABELS[p].label, persona))), PERSONA_LABELS[persona].about),
      );
      const chassi: ChassisId = bot.chassi ?? 'vector09';
      campos.push(
        campo('Chassi', selecao('squad-campo-chassi', 'chassi', CHASSIS_DOS_BOTS.map((c) => opcao(c, CHASSIS[c].name, chassi))), `${CHASSIS_PAPEL[chassi]} Vida ${CHASSIS[chassi].maxModuleHealth.torso}, ${CHASSIS[chassi].moveSpeed} m/s.`),
      );
      const fabrica = CHASSIS[chassi].loadout.primary;
      const armas: readonly WeaponId[] = armasDoBot(chassi);
      const arma = bot.arma?.id ?? '';
      const nivel = String(bot.arma?.tier ?? fabrica.tier);
      const w = bot.arma ? weapon(bot.arma.id, bot.arma.tier) : fabrica;
      const linhaArma = el('div', 'squad-par');
      linhaArma.append(
        selecao('squad-campo-arma', 'arma', [opcao('', `De fábrica: ${fabrica.name}`, arma), ...armas.map((a) => opcao(a, weapon(a).name, arma))]),
        selecao('squad-campo-nivel', 'nivel', NIVEIS.map((t) => opcao(String(t), TIERS[t]?.label ?? '', nivel)), !bot.arma),
      );
      campos.push(campo('Arma principal', linhaArma, `${nomeDaArma(w.id, w.tier)}: dano ${w.damage}, ótimo a ${w.optimalRange} m, ${(1 / w.fireInterval).toFixed(1).replace('.', ',')} tiros/s. O robô ataca de onde a arma rende.`));
    }
    if (bot.papel !== 'technician') {
      const dif = bot.dificuldade ?? '';
      campos.push(
        campo('Dificuldade', selecao('squad-campo-dificuldade', 'dificuldade', [opcao('', `Da partida (${DIFFICULTY_LABELS[this.o.dificuldade()]})`, dif), ...DIFICULDADES.map((x) => opcao(x, DIFFICULTY_LABELS[x], dif))]), 'Reação, mira e rajada. Vale só para este robô; as outras seguem a da partida.'),
      );
    } else {
      campos.push(el('p', 'squad-dica', 'O técnico conserta os Mechs rebeldes e não atira: fica perto de quem está avariado.'));
    }
    if (bot.papel === 'android') campos.push(el('p', 'squad-dica', 'Andróide: pequeno, muito rápido e frágil. Ataca de perto, com motosserra, e desvia com dash.'));

    const duplicar = botao('[ DUPLICAR ]', 'btn-terminal squad-dup', { acao: 'dup' }, { titulo: this.editor.podeAdicionar(s.lado, bot.papel) ?? 'Copia este robô (sem o apelido) logo depois dele', desligado: this.editor.podeAdicionar(s.lado, bot.papel) !== null });
    this.ficha.replaceChildren(topo, el('p', 'squad-quem', d.nome), ...campos, duplicar);
  }

  private desenharPe(): void {
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
      botao('[ AJUSTES DO JOGO ]', 'btn-terminal', { acao: 'ajustes' }, { titulo: 'Dificuldade e quantos atacam ao mesmo tempo' }),
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
    const s = this.sel;
    if (!s || !(t instanceof HTMLSelectElement)) return;
    const v = t.value;
    switch (t.dataset.campo) {
      case 'persona':
        this.editor.editar(s.lado, s.i, { persona: v as Persona });
        break;
      case 'chassi':
        this.editor.editar(s.lado, s.i, { chassi: v as ChassisId });
        break;
      case 'arma': {
        const atual = this.editor.lista(s.lado)[s.i]?.arma;
        this.editor.editar(s.lado, s.i, { arma: v ? { id: v as WeaponId, tier: atual?.tier ?? 0 } : undefined });
        break;
      }
      case 'nivel':
        this.editor.editarNivel(s.lado, s.i, Number(v) as Tier);
        break;
      case 'dificuldade':
        this.editor.editar(s.lado, s.i, { dificuldade: (v || undefined) as Difficulty | undefined });
        break;
      default:
        return;
    }
    this.msg = '';
    this.desenhar();
    // O seletor que acabou de mudar volta a ter o foco (desenhar refez a ficha).
    this.root.querySelector<HTMLElement>(`#squad-campo-${t.dataset.campo}`)?.focus();
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
    if (!this.editor.mudou) return;
    // O que as Configurações já mandam não precisa de esquadrão à parte: guardar `null` deixa a contagem e as personalidades das Configurações valerem.
    this.o.store.save(this.editor.ehOPadrao ? null : this.editor.esquadrao);
    this.msg = 'Salvo. Reiniciando a partida…';
    this.desenharPe();
    this.o.reiniciar();
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
