/**
 * A faixa AO VIVO (P310): uma linha no canto de cima, com a marca, o código da sala e o COPIAR LINK do streamer. O texto entra pelo
 * `textContent` e a tradução vem do `traduzirDOM` (o observador do idioma), como o aviso do clipe. Com o mouse preso no jogo, o botão não
 * responde: solte o mouse (Esc) para copiar.
 */
export interface FaixaAoVivo {
  /** Tira a faixa da tela. */
  remover(): void;
}

/** Monta a faixa e a põe na tela. `link` é o que o botão COPIAR LINK leva para a área de transferência. */
export function montarFaixaAoVivo(sala: string, link: string): FaixaAoVivo {
  const faixa = document.createElement('div');
  faixa.id = 'stream-faixa';
  faixa.className = 'stream-faixa';
  faixa.setAttribute('data-func', 'modo:streamer');
  const marca = document.createElement('span');
  marca.className = 'stream-faixa-marca';
  marca.textContent = '● AO VIVO';
  const codigo = document.createElement('span');
  codigo.textContent = sala;
  const copiar = document.createElement('button');
  copiar.type = 'button';
  copiar.className = 'stream-faixa-copiar';
  copiar.textContent = 'COPIAR LINK';
  let volta: ReturnType<typeof setTimeout> | null = null;
  copiar.addEventListener('click', () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(link).then(
      () => {
        copiar.textContent = 'LINK COPIADO';
        if (volta !== null) clearTimeout(volta);
        volta = setTimeout(() => {
          copiar.textContent = 'COPIAR LINK';
          volta = null;
        }, 2000);
      },
      () => undefined,
    );
  });
  faixa.append(marca, codigo, copiar);
  document.body.appendChild(faixa);
  return {
    remover: () => {
      if (volta !== null) clearTimeout(volta);
      faixa.remove();
    },
  };
}
