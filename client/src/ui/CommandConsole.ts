import type { MapId } from '../environment/Bunker';
import type { MechPart } from '../entities/MechBase';
import type { Difficulty } from '../core/Settings';
import { PERSONA_LABELS } from '../core/Settings';
import type { LoadoutSpec } from '../hangar/loadout';
import { MAPA_NOME } from '../sim/campanha';
import type { GameMode } from '../sim/gameMode';
import {
  acaoDaTecla,
  COMANDANTE_KEY,
  contagemInimigos,
  fichaDoMech,
  lerModoComandante,
  MESA_COMANDO,
  MESA_URL,
  nivelDeAmeaca,
  pilotosVisiveis,
  sondarMesa,
  type PilotoNaPartida,
} from './consoleData';
import { TacticalRadar, type RadarQuadro } from './TacticalRadar';
import { WorldMap } from './WorldMap';

const PARTES: readonly MechPart[] = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const PARTE_NOME: Readonly<Record<MechPart, string>> = {
  torso: 'Tronco',
  head: 'Cabeça',
  leftArm: 'Braço esquerdo',
  rightArm: 'Braço direito',
  leftLeg: 'Perna esquerda',
  rightLeg: 'Perna direita',
};
const TIPO_ROTULO: Readonly<Record<PilotoNaPartida['tipo'], string>> = {
  mech: 'MECH',
  android: 'ANDRÓIDE',
  tecnico: 'TÉCNICO',
  chefe: 'CHEFE',
  aliado: 'ALIADO',
};
/** O radar redesenha a esta cadência com o console à vista (online o mundo continua andando). */
const RADAR_MS = 1000;
/**
 * Quanto tempo o botão tem que ficar com "... jogar" para o console ligar. O `HUD.setReady` roda no construtor do Game e diz "clique para jogar"
 * **antes** do aquecimento dos shaders, que logo depois troca o texto por "preparando gráficos" e só o restaura no fim: ligar no primeiro "jogar"
 * mostraria o console completo durante o aquecimento (medido: +5 s de boot em CPU fraca ou software). Qualquer troca de texto zera a espera.
 */
const ASSENTA_MS = 250;

/** O que o console lê do jogo. O `Game.ts` só liga (G3): nada aqui conhece a simulação. */
export interface ConsoleHooks {
  mapa: MapId;
  modo: GameMode;
  online: boolean;
  /** A montagem salva no Hangar (a que vale no próximo renascimento). */
  montagem: () => LoadoutSpec;
  /** Vida de cada parte do seu Mech agora, de 0 a 1. */
  partes: () => Readonly<Record<MechPart, number>>;
  /** Quem está na partida aberta (inimigos e aliados), na ordem em que entraram. */
  escalacao: () => readonly PilotoNaPartida[];
  dificuldade: () => Difficulty;
  /** Quantas potências estão fora do padrão (Configurações > Avançado). */
  potencias: () => number;
  radar: () => RadarQuadro;
  /** O som curto de quando o console leva a outra missão (o `AudioSystem` já tem o da troca de tela). */
  som?: () => void;
  /**
   * A janela do esquadrão (P91, `ui/SquadPanel.ts`): `abrir` a mostra; `indisponivel` diz por que não abre (online: o servidor manda os
   * inimigos; missões: o pool delas), ou `null`; `personalizado` marca o botão quando há um esquadrão salvo.
   */
  esquadrao?: { abrir: () => void; indisponivel: () => string | null; personalizado: () => boolean };
  /** A janela ARSENAL (fase 4C, `ui/ArsenalPanel.ts`): as fichas das armas e dos chassis. Só leitura, abre sempre. */
  arsenal?: { abrir: () => void };
  /** A janela Campanha (fase 4B, `ui/CampaignPanel.ts`): `abrir` a mostra; `indisponivel` diz por que não abre (online: o servidor manda os inimigos), ou `null`. */
  campanha?: { abrir: () => void; indisponivel: () => string | null };
  /** A janela do servidor (P93, `ui/ServerPanel.ts`): `abrir` a mostra; `indisponivel` diz por que não abre (build sem servidor), ou `null`. */
  servidor?: { abrir: () => void; indisponivel: () => string | null };
  /** A janela de câmeras ao vivo (P88, `ui/CameraWall.ts`): `abrir` a mostra; `indisponivel` diz por que não abre (build sem servidor), ou `null`. */
  cameras?: { abrir: () => void; indisponivel: () => string | null };
}

/**
 * Console de comando (dono, 11/10, P86): a tela de início e de pausa vira uma sala de comando, com todos os botões e ajustes num
 * só lugar. Cada monitor mostra um assunto e abre a tela que já existia (Hangar, Configurações, Online); nada foi refeito. Com o
 * modo Comandante ligado (`?comandante=1`), acende o monitor COMANDO, com as telas de ajuste do jogo (`PAINEL_ADMIN.md`).
 *
 * **O clique.** A pausa inteira sempre foi o botão de jogar (`Game.ts`); num console cheio de monitores isso viraria armadilha.
 * Então os monitores e a mesa de operação barram o clique, e o resto (a parede, o título, o botão verde) continua pondo em combate.
 *
 * **Custo:** zero no laço do jogo. Os monitores se atualizam quando o console aparece (um `MutationObserver` na classe da pausa)
 * e quando a montagem ou os ajustes mudam; com ele à vista, só o radar se redesenha, uma vez por segundo.
 */
export class CommandConsole {
  private readonly radar: TacticalRadar;
  private readonly mundo: WorldMap;
  private timer: ReturnType<typeof setInterval> | null = null;
  private comandante: boolean;
  /** O jogo já ficou pronto e as telas acenderam (a tela de carregamento saiu). */
  private ligado = false;
  /** A espera de assentamento do botão pronto (`ASSENTA_MS`). */
  private assenta: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly hooks: ConsoleHooks,
    private readonly root: HTMLElement = document.getElementById('overlay')!,
  ) {
    const lembrado = ler(COMANDANTE_KEY);
    const modo = lerModoComandante(location.search, lembrado);
    if (modo.gravar === '1') gravar(COMANDANTE_KEY, '1');
    else if (modo.gravar === 'apagar') gravar(COMANDANTE_KEY, null);
    this.comandante = modo.ligado;

    for (const el of root.querySelectorAll<HTMLElement>('.mon, .cc-ops, .cc-flags')) {
      el.addEventListener('click', (e) => e.stopPropagation());
    }
    document.addEventListener('keydown', (e) => this.tecla(e));
    root.querySelector('#cc-chip-comandante')?.addEventListener('click', () => {
      gravar(COMANDANTE_KEY, null);
      this.comandante = false;
      this.pintarComandante();
    });
    root.querySelector('#cmd-mesa a')?.addEventListener('click', (e) => {
      // Sem Ctrl, Shift ou botão do meio: um clique comum verifica a mesa antes de abrir (o link continua valendo para quem abre em outra aba).
      const me = e as MouseEvent;
      if (me.button !== 0 || me.ctrlKey || me.metaKey || me.shiftKey || me.altKey) return;
      e.preventDefault();
      void this.mesa();
    });
    root.querySelector('#cmd-mesa-ajuda')?.addEventListener('click', (e) => this.ajudaDaMesa(e));
    for (const botao of root.querySelectorAll<HTMLElement>('[data-servidor-open]')) {
      botao.addEventListener('click', () => {
        if (!this.hooks.servidor?.indisponivel()) this.hooks.servidor?.abrir();
      });
    }
    for (const botao of root.querySelectorAll<HTMLElement>('[data-cameras-open]')) {
      botao.addEventListener('click', () => {
        if (!this.hooks.cameras?.indisponivel()) this.hooks.cameras?.abrir();
      });
    }
    for (const botao of root.querySelectorAll<HTMLElement>('[data-arsenal-open]')) {
      botao.addEventListener('click', () => this.hooks.arsenal?.abrir());
    }
    for (const botao of root.querySelectorAll<HTMLElement>('[data-campanha-open]')) {
      botao.addEventListener('click', () => {
        if (!this.hooks.campanha?.indisponivel()) this.hooks.campanha?.abrir();
      });
    }
    for (const botao of root.querySelectorAll<HTMLElement>('[data-esquadrao-open]')) {
      botao.addEventListener('click', () => {
        if (!this.hooks.esquadrao?.indisponivel()) this.hooks.esquadrao?.abrir();
      });
    }
    // A Sala de Controle e a Oficina só existem no site (`/cybermech/sala-de-controle/`, `/oficina/`): no `npm run dev` o link daria em nada.
    if (!location.pathname.includes('/jogar')) for (const id of ['#cmd-sala', '#cmd-oficina']) root.querySelector<HTMLElement>(id)!.hidden = true;

    this.mundo = new WorldMap(root.querySelector('#mon-teatro')!, {
      mapa: hooks.mapa,
      modo: hooks.modo,
      online: hooks.online,
      ameaca: () => nivelDeAmeaca(hooks.escalacao(), hooks.dificuldade()),
      implantar: (href) => this.implantar(href),
    });
    this.radar = new TacticalRadar(root.querySelector('#mon-radar')!, hooks.radar);
    const mapaNome = root.querySelector('#radar-mapa');
    if (mapaNome) mapaNome.textContent = MAPA_NOME[hooks.mapa];

    // Os atalhos aparecem desenhados nos botões (o CSS escreve o `data-tecla` como uma tecla); no toque não há teclado.
    const online = root.querySelector<HTMLElement>('#btn-online');
    if (online) online.dataset.tecla = 'O';

    this.pintarComandante();
    new MutationObserver(() => this.visibilidade()).observe(root, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', () => this.visibilidade());
    this.atualizar();
    // Por último: se o jogo já estiver pronto, `ligar` usa o mapa e o radar, que a esta altura já existem.
    this.vigiarBotao();
  }

  /** Refaz o que muda entre uma pausa e outra: a ficha e a vida do Mech, a escalação, a rede e as potências. */
  atualizar(): void {
    this.pintarMech();
    this.pintarOponentes();
    const status = this.root.querySelector('#menu-status');
    const offline = this.root.querySelector<HTMLElement>('#rede-offline');
    // Sem servidor no build, o `ServerStatus` não desenha nada: o monitor diz que o jogo é offline em vez de ficar vazio.
    if (offline) offline.hidden = !!status?.childElementCount;
    const pot = this.root.querySelector('#cmd-potencias');
    if (pot) {
      const n = this.hooks.potencias();
      pot.textContent = n ? `${n} ajuste${n === 1 ? '' : 's'} fora do padrão` : 'armas e clãs no padrão';
    }
    this.pintarEsquadrao();
    this.pintarCampanha();
    this.pintarServidor();
    this.pintarCameras();
    this.mundo.atualizar();
    this.radar.desenhar();
  }

  /** O item CAMPANHA do monitor COMANDO: apagado, com o motivo, quando a partida não aceita campanha. */
  private pintarCampanha(): void {
    const motivo = this.hooks.campanha ? this.hooks.campanha.indisponivel() : 'Este build não tem campanhas.';
    for (const botao of this.root.querySelectorAll<HTMLElement>('[data-campanha-open]')) {
      botao.classList.toggle('off', motivo !== null);
      botao.setAttribute('aria-disabled', String(motivo !== null));
      if (motivo !== null) botao.title = motivo;
    }
  }

  /** O item CÂMERAS AO VIVO do monitor COMANDO: apagado, com o motivo, num build sem servidor de jogo. */
  private pintarCameras(): void {
    const motivo = this.hooks.cameras ? this.hooks.cameras.indisponivel() : 'Este build não sabe onde está o servidor de jogo.';
    for (const botao of this.root.querySelectorAll<HTMLElement>('[data-cameras-open]')) {
      botao.classList.toggle('off', motivo !== null);
      botao.setAttribute('aria-disabled', String(motivo !== null));
      if (motivo !== null) botao.title = motivo;
    }
  }

  /** O item SERVIDOR do monitor COMANDO: apagado, com o motivo, num build sem servidor de jogo. */
  private pintarServidor(): void {
    const motivo = this.hooks.servidor ? this.hooks.servidor.indisponivel() : 'Este build não sabe onde está o servidor de jogo.';
    for (const botao of this.root.querySelectorAll<HTMLElement>('[data-servidor-open]')) {
      botao.classList.toggle('off', motivo !== null);
      botao.setAttribute('aria-disabled', String(motivo !== null));
      if (motivo !== null) botao.title = motivo;
    }
  }

  /** O botão ESQUADRÃO (e a ficha do Comandante): apagado, com o motivo, quando a partida não aceita esquadrão; com um ponto quando há um salvo. */
  private pintarEsquadrao(): void {
    const e = this.hooks.esquadrao;
    const motivo = e?.indisponivel() ?? null;
    for (const botao of this.root.querySelectorAll<HTMLElement>('[data-esquadrao-open]')) {
      botao.classList.toggle('off', motivo !== null);
      botao.setAttribute('aria-disabled', String(motivo !== null));
      if (motivo !== null) botao.title = motivo;
    }
    const principal = this.root.querySelector<HTMLElement>('#btn-esquadrao');
    if (principal) principal.dataset.custom = e?.personalizado() ? '1' : '0';
  }

  private get visivel(): boolean {
    return !this.root.classList.contains('hidden') && document.visibilityState !== 'hidden';
  }

  private visibilidade(): void {
    if (this.visivel && this.ligado) {
      if (this.timer === null) {
        this.atualizar();
        this.relogio();
        this.timer = setInterval(() => {
          this.radar.desenhar();
          this.relogio();
        }, RADAR_MS);
      }
    } else if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Os atalhos de teclado do console (`acaoDaTecla`). Só valem com a pausa à vista, sem janela por cima (Configurações, sala online,
   * calibração do mouse, briefing) e sem foco num campo ou botão; Ctrl, Alt e Meta ficam com o navegador.
   */
  private tecla(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || !this.visivel || algoPorCima()) return;
    const acao = acaoDaTecla(e.key);
    if (!acao) return;
    // Quem digita num campo, ou navega os botões pelo teclado (Tab: `:focus-visible`), fica com as teclas. O foco que sobrou de um
    // clique do mouse (o botão do Hangar, o "×" que já sumiu) não pode engolir o Enter: o botão verde diz "↵ ENTER".
    const foco = (e.target as HTMLElement | null)?.closest<HTMLElement>('input, select, textarea, button, a');
    if (foco && foco.getClientRects().length > 0 && (foco.matches('input, select, textarea') || foco.matches(':focus-visible'))) return;
    const clicar = (seletor: string) => {
      e.preventDefault();
      this.root.querySelector<HTMLElement>(seletor)?.click();
    };
    if (acao === 'combate') {
      // O Enter também espera o jogo ficar pronto (a pausa não aceita clique enquanto compila os gráficos: `Game.precompileShaders`).
      if (!this.root.classList.contains('cc-carregando') && this.root.style.pointerEvents !== 'none') clicar('#cta');
    } else if (acao === 'hangar') clicar('#btn-hangar');
    else if (acao === 'online') clicar('#btn-online');
    else {
      e.preventDefault();
      this.mundo.alternarZoom();
    }
  }

  /**
   * O botão verde diz quando o jogo está pronto: enquanto o texto não for "... para jogar" (carregando a física, preparando os
   * gráficos), a placa fica apagada e o console fica na **tela de carregamento** (só o título e o botão: os monitores em `display: none`; o
   * compositor por software disputa a CPU com a compilação dos shaders, e o console completo somava ~5 s ao boot); quando o botão fica pronto
   * e assim se mantém por `ASSENTA_MS`, as telas ligam (`ligar`). Só reage quando o texto muda (poucas vezes no carregamento).
   */
  private vigiarBotao(): void {
    const cta = this.root.querySelector('#cta');
    if (!cta) return;
    const sincronizar = () => {
      const pronto = /jogar/i.test(cta.textContent ?? '');
      this.root.classList.toggle('cc-carregando', !pronto);
      if (this.assenta !== null) clearTimeout(this.assenta);
      this.assenta = null;
      if (!pronto || this.ligado) return;
      this.assenta = setTimeout(() => {
        this.assenta = null;
        this.ligar();
      }, ASSENTA_MS);
    };
    new MutationObserver(sincronizar).observe(cta, { childList: true, characterData: true, subtree: true });
    sincronizar();
  }

  /**
   * MESA DE VÍDEO: verifica se ela está ligada nesta máquina; se estiver, abre; se não, mostra como ligar (o comando, o botão de copiar e o atalho de
   * duplo clique). A mesa é local (`scripts/mesa.mjs`, G15): o servidor de jogo e o site não conseguem ligá-la.
   */
  private async mesa(): Promise<void> {
    const ajuda = this.root.querySelector<HTMLElement>('#cmd-mesa-ajuda');
    const estado = this.root.querySelector<HTMLElement>('#cmd-mesa-estado');
    if (!ajuda || !estado) return;
    ajuda.hidden = false;
    ajuda.dataset.estado = 'verificando';
    estado.textContent = 'VERIFICANDO A MESA…';
    if (await sondarMesa()) {
      ajuda.hidden = true;
      window.open(MESA_URL, '_blank', 'noopener');
      return;
    }
    ajuda.dataset.estado = 'desligada';
    estado.textContent = 'A MESA ESTÁ DESLIGADA';
  }

  private ajudaDaMesa(e: Event): void {
    const botao = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-acao]');
    const ajuda = this.root.querySelector<HTMLElement>('#cmd-mesa-ajuda');
    if (!botao || !ajuda) return;
    const acao = botao.dataset.acao;
    if (acao === 'fechar') ajuda.hidden = true;
    else if (acao === 'abrir') window.open(MESA_URL, '_blank', 'noopener');
    else if (acao === 'copiar') {
      const estado = this.root.querySelector<HTMLElement>('#cmd-mesa-estado');
      const feito = (ok: boolean) => {
        if (estado) estado.textContent = ok ? 'COMANDO COPIADO' : 'COPIE O COMANDO ABAIXO';
      };
      if (navigator.clipboard) navigator.clipboard.writeText(MESA_COMANDO).then(() => feito(true), () => feito(false));
      else feito(false);
    }
  }

  /** IMPLANTAR: som, a tela escurece com o brilho da missão e, no fim, o link abre (o jogo recarrega no mapa novo). */
  private implantar(href: string): void {
    this.hooks.som?.();
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      location.assign(href);
      return;
    }
    this.root.classList.add('cc-implantando');
    setTimeout(() => location.assign(href), 420);
  }

  /**
   * As telas acendem em cascata, como um monitor de tubo ligando, **quando o jogo fica pronto** (uma vez só). Até lá o HTML fica em
   * "sem sinal" e em modo econômico (`cc-espera`). Só CSS; quem pediu menos movimento vê as telas já acesas.
   */
  private ligar(): void {
    if (this.ligado) return;
    this.ligado = true;
    this.root.classList.remove('cc-espera');
    // Só agora os canvas desenham e o radar passa a atualizar (durante o carregamento eles custariam a CPU dos shaders).
    this.mundo.acender();
    this.radar.acender();
    this.visibilidade();
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // A placa do botão acende de uma vez, junto com a cascata das telas.
    this.root.classList.add('cc-acende');
    setTimeout(() => this.root.classList.remove('cc-acende'), 1100);
    this.root.querySelectorAll<HTMLElement>('.mon').forEach((m, i) => m.style.setProperty('--i', String(i)));
    this.root.classList.add('cc-ligando');
    setTimeout(() => this.root.classList.remove('cc-ligando'), 2600);
  }

  /** Hora local na barra do topo (muda a cada minuto; o texto só é trocado quando muda). */
  private relogio(): void {
    const el = this.root.querySelector('#cc-relogio');
    if (!el) return;
    const agora = new Date();
    const texto = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    if (el.textContent !== texto) el.textContent = texto;
  }

  private pintarComandante(): void {
    this.root.classList.toggle('comandante', this.comandante);
    const mon = this.root.querySelector<HTMLElement>('#mon-comando');
    const chip = this.root.querySelector<HTMLElement>('#cc-chip-comandante');
    if (mon) mon.hidden = !this.comandante;
    if (chip) chip.hidden = !this.comandante;
  }

  private pintarMech(): void {
    const ficha = fichaDoMech(this.hooks.montagem());
    const partes = this.hooks.partes();
    let soma = 0;
    for (const p of PARTES) {
      const v = Math.max(0, Math.min(1, partes[p] ?? 1));
      soma += v;
      const estado = v <= 0 ? 'mp-perdida' : v < 0.35 ? 'mp-critica' : v < 0.7 ? 'mp-avariada' : 'mp-ok';
      const pct = this.root.querySelector<SVGTextElement>(`.mp-pct[data-pct="${p}"]`);
      if (pct) {
        pct.textContent = v <= 0 ? 'PERDIDA' : `${Math.round(v * 100)}%`;
        pct.setAttribute('class', `mp-pct ${estado}`);
      }
      const g = this.root.querySelector<SVGGElement>(`.mp[data-part="${p}"]`);
      if (!g) continue;
      g.setAttribute('class', `mp ${estado}`);
      let t = g.querySelector<SVGTitleElement>('title');
      if (!t) {
        t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        g.prepend(t);
      }
      t.textContent = `${PARTE_NOME[p]}: ${Math.round(v * 100)}%`;
    }
    const integ = this.root.querySelector('#mech-integridade');
    if (integ) integ.textContent = `INTEGRIDADE ${Math.round((soma / PARTES.length) * 100)}%`;
    const sub = this.root.querySelector<HTMLElement>('#pilot-sub');
    if (sub) sub.title = ficha.papel;

    const barras = this.root.querySelector('#mech-barras');
    if (barras) {
      barras.replaceChildren(
        ...barra('VIDA', `${ficha.vida.valor}`, ficha.vida.valor / ficha.vida.ref),
        ...barra('VELOC.', `${fmt(ficha.velocidade.valor)} m/s`, ficha.velocidade.valor / ficha.velocidade.ref),
        ...barra('CARGA', `${fmt(ficha.carga.usada)} / ${fmt(ficha.carga.limite)} t`, ficha.carga.usada / ficha.carga.limite, ficha.carga.usada > ficha.carga.limite),
      );
    }
    const armas = this.root.querySelector('#mech-armas');
    if (armas) {
      armas.replaceChildren(
        ...ficha.armas.map((a) => {
          const li = document.createElement('li');
          const b = document.createElement('b');
          b.textContent = a.encaixe;
          li.append(b, ` ${a.nome}`);
          return li;
        }),
      );
    }
  }

  private pintarOponentes(): void {
    const lista = this.hooks.escalacao();
    const inimigos = lista.filter((p) => p.tipo !== 'aliado');
    const aliados = lista.filter((p) => p.tipo === 'aliado');
    const contagem = this.root.querySelector('#op-contagem');
    if (contagem) {
      contagem.textContent = this.hooks.online
        ? 'SALA ONLINE · os inimigos vêm do servidor'
        : `${contagemInimigos(inimigos)}${aliados.length ? ` · ${aliados.length} ALIADO${aliados.length === 1 ? '' : 'S'}` : ''}`;
    }
    const ameaca = this.root.querySelector('#op-ameaca');
    if (ameaca) {
      const n = nivelDeAmeaca(lista, this.hooks.dificuldade());
      ameaca.textContent = this.hooks.online ? '' : `AMEAÇA ${'▮'.repeat(n)}${'▯'.repeat(5 - n)}`;
    }
    const ul = this.root.querySelector('#op-lista');
    if (!ul) return;
    const { mostrados, ocultos } = pilotosVisiveis(lista);
    const mais = document.createElement('li');
    mais.className = 'op-mais';
    mais.textContent = `+ ${ocultos} PILOTOS`;
    ul.replaceChildren(
      ...mostrados.map((p) => {
        const li = document.createElement('li');
        li.className = `op-${p.tipo}`;
        const nome = document.createElement('b');
        nome.textContent = p.nome;
        const tipo = document.createElement('span');
        tipo.textContent = p.persona ? `${TIPO_ROTULO[p.tipo]} · ${PERSONA_LABELS[p.persona].label.toLowerCase()}` : TIPO_ROTULO[p.tipo];
        if (p.persona) li.title = PERSONA_LABELS[p.persona].about;
        li.append(nome, tipo);
        return li;
      }),
      ...(ocultos > 0 ? [mais] : []),
    );
  }
}

/** Uma janela por cima do console (Configurações, sala online, calibração do mouse): o Enter é dela, não do console. */
function algoPorCima(): boolean {
  return !!document.querySelector('#settings-modal:not(.hidden), #online-lobby:not(.hidden), .calib:not([hidden]), #mission-briefing:not(.hidden), #mission-summary:not(.hidden), #hangar-modal:not(.hidden), #squad-modal:not(.hidden), #campanha-modal:not(.hidden), #campanha-fim, #arsenal-modal:not(.hidden), #server-modal:not(.hidden), #cameras-modal:not(.hidden)');
}

function barra(rotulo: string, valor: string, fracao: number, alerta = false): HTMLElement[] {
  const dt = document.createElement('dt');
  dt.textContent = rotulo;
  const dd = document.createElement('dd');
  if (alerta) dd.className = 'alerta';
  const trilho = document.createElement('i');
  const fill = document.createElement('i');
  fill.style.transform = `scaleX(${Math.max(0.02, Math.min(1, fracao)).toFixed(3)})`;
  trilho.append(fill);
  const num = document.createElement('span');
  num.textContent = valor;
  dd.append(trilho, num);
  return [dt, dd];
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: o modo Comandante vale só nesta página */
  }
}
