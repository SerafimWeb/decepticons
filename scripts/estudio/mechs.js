'use strict';
/**
 * A aba MECHS 3D do Estúdio (P321, ESTUDIO.md § 3.3): abre a prévia (uma página montada pelo Vite com o código do jogo, servida pelo módulo em
 * `/api/mechs/app/`) dentro de um quadro. A montagem só roda na primeira vez e quando algum fonte mudou. Abre quando a aba fica visível, seja
 * por clique, seja porque o núcleo reabriu a última aba usada (`localStorage`). Texto só entra na tela por `textContent`.
 */
(() => {
  const painel = document.getElementById('aba-mechs');
  const quadro = document.getElementById('mechs-quadro');
  const estado = document.getElementById('mechs-estado');
  if (!painel || !quadro || !estado) return;
  let aberta = false;
  let montando = false;

  async function abrir() {
    if (aberta || montando) return;
    montando = true;
    estado.textContent = 'Montando a prévia com o código do jogo (a primeira vez leva alguns segundos)…';
    try {
      const r = await fetch('/api/mechs/montar', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || r.status);
      quadro.src = '/api/mechs/app/index.html';
      estado.textContent = '';
      aberta = true;
    } catch (e) {
      estado.textContent = 'Não consegui montar a prévia: ' + e.message;
    }
    montando = false;
  }

  new MutationObserver(() => {
    if (!painel.hidden) void abrir();
  }).observe(painel, { attributes: true, attributeFilter: ['hidden'] });
  if (!painel.hidden) void abrir();
})();
