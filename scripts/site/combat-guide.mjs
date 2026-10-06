import { esc } from './tema.mjs';

export const COMBAT_GUIDE_CSS = `
  .combat-nav{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
  .combat-nav a{border:1px solid var(--line);padding:10px 14px;color:var(--amber);text-decoration:none}
  .combat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  .combat-card{padding:20px;display:grid;align-content:start;gap:12px;min-width:0}
  .combat-card h3{font:400 1.5rem var(--fd);color:var(--amber)}
  .combat-card p{font-size:14px;line-height:1.6;color:var(--muted)}
  .combat-select{width:100%;max-width:420px;padding:12px;background:var(--bg);color:var(--text);border:1px solid var(--line);font:inherit;margin:12px 0}
  .combat-card a{color:var(--amber)} .combat-card[hidden]{display:none}
  .combat-table{width:100%;border-collapse:collapse;font-size:14px}
  .combat-table th,.combat-table td{padding:12px;text-align:left;border-bottom:1px solid var(--line)}
  @media(max-width:800px){.combat-grid{grid-template-columns:1fr}.combat-table th,.combat-table td{padding:8px;font-size:12px}}
`;

/** Compatibilidade e carga vêm do mesmo catálogo que valida a montagem no jogo. */
export function workshopGuide(game) {
  const { chassis, slots, weapons: W, hangar, shields } = game;
  const cards = Object.entries(chassis).map(([id,c]) => {
    const weapons = W.WEAPON_IDS.filter(w => Object.values(slots[id]).some(list => list.includes(w)));
    return `<article class="combat-card frame" data-workshop-chassis="${esc(id)}">
      <h3>${esc(c.name)}</h3><p>${c.weaponCapacity} t de carga · ${c.moveSpeed} m/s · ${c.maxModuleHealth.torso} HP no torso</p>
      <div class="scroll-x"><table class="combat-table"><thead><tr><th>Arma</th><th>Encaixe</th><th>MK I</th></tr></thead><tbody>${weapons.map(idW => {
        const w=W.weapon(idW);
        const mounts=Object.entries(slots[id]).filter(([,list])=>list.includes(idW)).map(([slot])=>({right:'D',left:'E',shoulders:'Ombros'}[slot]));
        return `<tr><td>${esc(w.name)}</td><td>${mounts.join(' / ')}</td><td>${w.mass} t</td></tr>`;
      }).join('')}</tbody></table></div>
      <p>D e E são os braços. Cada arma soma sua massa; dois ombros contam duas vezes. Os níveis mais altos pesam mais.</p>
      <a href="../jogar/?build=${encodeURIComponent(hangar.loadoutKey(hangar.factorySpec(id)))}">Pilotar ${esc(c.name)} →</a>
    </article>`;
  }).join('');
  const shieldCards=Object.entries(shields.SHIELDS).map(([id,s])=>`<article class="combat-card frame"><h3>${id==='sphere'?'Esfera de energia':'Barreira frontal'}</h3><p>${s.mass} t · ${s.capacity} de energia · ${s.drain}/s em uso</p><p>${id==='sphere'?'Proteção em todas as direções':'Cobre 120° à frente e acompanha a mira'}. Até ${(s.capacity/s.drain).toLocaleString('pt-BR')} s sem impactos. Dano recebido reduz a duração.</p><p>Ctrl liga/desliga. Recarrega ${s.regen}/s depois de ${s.recovery} s desligado. As duas armas continuam disponíveis.</p></article>`).join('');
  return `<nav class="combat-nav" aria-label="Explorar a Oficina"><a href="#montagens">Armas por robô</a><a href="#defesas">Escudos</a><a href="#equipe-offline">Equipe offline</a><a href="#dinamometro">Bancada de calor</a></nav>
  <section aria-labelledby="montagens"><span class="kicker">// escolha seu equipamento</span><h2 id="montagens">O que cabe no seu robô?</h2><p class="lede">Compare os encaixes antes de entrar no Hangar. A combinação final precisa caber na carga do chassi, incluindo o gerador de escudo.</p>
    <label for="workshop-chassis">Filtrar chassi</label><br><select class="combat-select" id="workshop-chassis"><option value="">Todos os chassis</option>${Object.entries(chassis).map(([id,c])=>`<option value="${esc(id)}">${esc(c.name)} · ${c.weaponCapacity} t</option>`).join('')}</select>
    <div class="combat-grid">${cards}</div>
  </section>
  <section aria-labelledby="defesas"><span class="kicker">// sobreviver também é estratégia</span><h2 id="defesas">Escolha a sua proteção</h2><div class="combat-grid">${shieldCards}<article class="combat-card frame"><h3>Escudo metálico</h3><p>Em desenvolvimento. O modelo do Lancer tem escudo visual; defesa física removível ainda não está disponível.</p><p>O plano é ocupar uma mão e substituir a arma, apenas nos chassis compatíveis.</p></article></div></section>
  <section aria-labelledby="equipe-offline"><span class="kicker">// você comanda</span><h2 id="equipe-offline">Uma equipe ao seu lado</h2><div class="combat-grid"><article class="combat-card frame"><h3>1 · Acompanhar</h3><p>Escolta com plasma e supressor com EMP acompanham o jogador, retomam a formação e respondem a ameaças.</p></article><article class="combat-card frame"><h3>2 · Concentrar fogo</h3><p>Mire em um inimigo e dê a ordem. Os aliados priorizam esse alvo, respeitando alcance, reação e linha de visão.</p></article><article class="combat-card frame"><h3>3 · Defender</h3><p>A equipe ocupa a região onde você deu a ordem. Volte para Acompanhar quando quiser avançar.</p></article></div><p class="lede">Ordens disponíveis na Arena offline, também por botões na tela. Navegação local e busca de cobertura ainda estão em evolução.</p></section>`;
}

export const WORKSHOP_SCRIPT = `const chassisFilter=document.getElementById('workshop-chassis');chassisFilter?.addEventListener('change',()=>{for(const card of document.querySelectorAll('[data-workshop-chassis]'))card.hidden=!!chassisFilter.value&&card.dataset.workshopChassis!==chassisFilter.value;});`;

export function operationGuide(base) {
  return `<nav class="combat-nav" aria-label="Navegar pela operação"><a href="#validar-build">Testar esta versão</a><a href="#proximas-decisoes">Próximas decisões</a><a href="#novidades">Entregas</a><a href="${base}oficina/#montagens">Arsenal por chassi</a></nav>
  <section aria-labelledby="validar-build"><span class="kicker">// qualidade percebida em partida</span><h2 id="validar-build">O que observar ao jogar</h2><div class="combat-grid"><article class="combat-card frame"><h3>Controle e defesa</h3><p>Equipe um gerador no Hangar. Toque Ctrl, solte e continue atirando. Confira cobertura, gasto de energia e clareza da mira.</p><a href="${base}oficina/#defesas">Comparar escudos →</a></article><article class="combat-card frame"><h3>Decisões dos aliados</h3><p>Na Arena offline, avance, marque um alvo com 2 e mande defender com 3. Observe se a equipe chega, ajuda e retoma a formação com 1.</p><a href="${base}jogar/">Entrar na Arena →</a></article><article class="combat-card frame"><h3>Qualidade comprovada</h3><p>Testes automáticos verificam regras e regressões. Playtest verifica ritmo, legibilidade e diversão. Os dois são necessários; contar testes não certifica a experiência.</p><a href="${base}oficina/#metodo">Entender a bancada →</a></article></div></section>
  <section aria-labelledby="proximas-decisoes"><span class="kicker">// propostas · ainda não equipáveis</span><h2 id="proximas-decisoes">Novas armas, novos papéis</h2><div class="combat-grid"><article class="combat-card frame"><h3>Feixe térmico</h3><p>Pressão contínua de curto alcance. Exige manter a mira; o calor limita a duração. Próximo protótipo sugerido para diferenciar armas de rajada.</p></article><article class="combat-card frame"><h3>Arpão magnético</h3><p>Controle de posição com cabo visível e alcance curto. A diferença de massa e a possibilidade de romper o cabo devem impedir aprisionamento sem resposta.</p></article><article class="combat-card frame"><h3>Antes de ampliar</h3><p>Validar a escolta em rotas com vários obstáculos, revisar cobertura e flanqueamento e transformar os escudos metálicos em equipamento real.</p></article></div><p class="lede">Capacidade multiplayer depende de homologação prolongada em produção. Ensaios locais com clientes sintéticos não garantem 10, 50 ou 100 pessoas simultâneas.</p></section>`;
}
