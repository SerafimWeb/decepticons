import * as THREE from 'three';
import { DIRECAO_DO_SOL } from './PraiaCeu';
import { GLSL_NORMAL_SEGURA } from './glslSeguro';
import { GLSL_RUIDO, GLSL_SOMBRA_DECLARA, glslSombraAplica } from './PraiaGlsl';
import type { UniformesDaPraia } from './PraiaUniformes';
import type { TipoDeBloco } from './PraiaLayout';

/**
 * Os MATERIAIS da PRAIA DOS CABOS (P127): cada tipo de bloco ganha a "textura" que o desenho precisa — janelas e lajes na fachada dos
 * prédios (com o vidro refletindo o sol poente do lado do mar), nervuras nos contêineres, a pedra portuguesa em ondas do calçadão,
 * lajes de concreto no pátio, listras de aviso na escotilha. **Nenhuma imagem**: tudo é feito no shader, em **coordenadas do
 * mundo** (a caixa é esticada, então UV esticaria o desenho — a grade do mundo vale em qualquer tamanho de bloco).
 *
 * **Custo:** zero geometria e zero textura; um desenho por material (11 para todos os blocos) e nada por quadro.
 */

/** O modo de material de cada tipo de bloco (os que não estão aqui são sem luz: marca, luz e cabo). */
export type ModoDeMaterial = 'generico' | 'predio' | 'tecnico' | 'muro' | 'deque' | 'conteiner' | 'asfalto' | 'calcada' | 'patio' | 'ciclovia' | 'escotilha';

export const MODO_DO_BLOCO: Readonly<Record<Exclude<TipoDeBloco, 'marca' | 'luz' | 'cabo'>, ModoDeMaterial>> = {
  predio: 'predio',
  tecnico: 'tecnico',
  deque: 'deque',
  muro: 'muro',
  conteiner: 'conteiner',
  asfalto: 'asfalto',
  calcada: 'calcada',
  patio: 'patio',
  ciclovia: 'ciclovia',
  escotilha: 'escotilha',
  concreto: 'generico',
  metal: 'generico',
  cais: 'generico',
  madeira: 'generico',
};

/** A cor de cada tipo (a instância pode sobrescrever com `cor`). */
export const COR_DO_BLOCO: Readonly<Record<TipoDeBloco, number>> = {
  predio: 0xf0e4cc,
  tecnico: 0x2a3540,
  deque: 0x7d8a93,
  concreto: 0xd9d2c3,
  muro: 0xe4ddce,
  metal: 0x8f9ca3,
  conteiner: 0xb8442f,
  cais: 0xb5b1a6,
  madeira: 0x9b7a55,
  asfalto: 0x4b525a,
  calcada: 0xffffff,
  patio: 0xaaa699,
  ciclovia: 0xb85a4a,
  marca: 0xffffff,
  luz: 0xffd9a0,
  escotilha: 0x3a454e,
  cabo: 0x46e8ff,
};

const VERTICE_DECLARA = /* glsl */ `
varying vec3 vMundo;
varying vec3 vCentro;
`;
const VERTICE_CORPO = /* glsl */ `
vec4 wp = vec4(transformed, 1.0);
vec4 wc = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  wc = instanceMatrix * wc;
#endif
vMundo = (modelMatrix * wp).xyz;
vCentro = (modelMatrix * wc).xyz;
`;

const FRAGMENTO_DECLARA = /* glsl */ `
varying vec3 vMundo;
varying vec3 vCentro;
uniform vec3 uSolDir;
uniform float uTempo;
uniform float uNucleo;
${GLSL_RUIDO}
${GLSL_NORMAL_SEGURA}
vec3 srgb(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
`;

/** O corpo do fragmento de cada modo: mexe em `diffuseColor` (e, nas janelas, em `totalEmissiveRadiance`). */
const MODOS: Readonly<Record<ModoDeMaterial, string>> = {
  generico: /* glsl */ `
    float g = 0.94 + 0.10 * vn(vMundo.xz * 0.5 + vMundo.y * 0.3) + 0.05 * (vn(vMundo.xz * 3.1 + vMundo.y) - 0.5);
    float chao = 0.80 + 0.20 * smoothstep(0.0, 5.0, vMundo.y); // o pé da parede é mais sujo (oclusão falsa)
    diffuseColor.rgb *= g * chao;
  `,
  predio: /* glsl */ `
    vec3 nf = normalSegura(cross(dFdx(vMundo), dFdy(vMundo)));
    vec3 fa = abs(nf);
    float lateral = step(fa.y, 0.5);
    float alongX = step(fa.z, fa.x);
    float across = mix(vMundo.x, vMundo.z, alongX);
    float passo = 3.6;
    float andar = 3.4;
    vec2 cel = vec2(floor(across / passo), floor(vMundo.y / andar));
    vec2 dentro = vec2(fract(across / passo), fract(vMundo.y / andar));
    float jx = step(0.2, dentro.x) * step(dentro.x, 0.8);
    float jy = step(0.26, dentro.y) * step(dentro.y, 0.8);
    float janela = jx * jy * lateral;
    float laje = lateral * (1.0 - smoothstep(0.0, 0.1, dentro.y)); // a laje e a sacada, uma faixa escura em cada andar
    vec2 id = cel + vec2(alongX * 41.0, 0.0);
    float acesa = step(0.74, h21(id)) * lateral;
    float lado = clamp(dot(nf, uSolDir) * 1.6, 0.0, 1.0); // o quanto a fachada olha para o sol poente
    // A parede: o tom do prédio com um pouco de sujeira no pé e as lajes.
    float suja = 0.82 + 0.18 * smoothstep(0.0, 7.0, vMundo.y);
    vec3 parede = diffuseColor.rgb * suja * (0.94 + 0.1 * vn(vMundo.xz * 0.6 + vMundo.y * 0.4)) * (1.0 - 0.18 * laje);
    // O vidro: azul-petróleo, com o laranja do céu refletido no lado do sol.
    vec3 ceuNoVidro = mix(srgb(vec3(0.55, 0.68, 0.86)), srgb(vec3(1.0, 0.66, 0.42)), 0.5);
    vec3 vidro = mix(srgb(vec3(0.06, 0.16, 0.23)), ceuNoVidro, lado * (0.3 + 0.45 * h21(id + 3.7)));
    vidro *= 0.85 + 0.3 * dentro.y;
    // O telhado: cinza de laje, com manchas.
    vec3 teto = srgb(vec3(0.46, 0.44, 0.42)) * (0.85 + 0.3 * vn(vMundo.xz * 0.7));
    vec3 cor = mix(parede, vidro, janela);
    cor = mix(cor, teto, step(0.5, fa.y) * step(0.0, nf.y));
    diffuseColor.rgb = cor;
    // Janelas acesas (as da sombra, quentes): somem no sol.
    vec3 brilho = mix(srgb(vec3(1.0, 0.78, 0.45)), srgb(vec3(0.7, 0.9, 1.0)), step(0.9, h21(id + 9.1))) * (0.7 + 0.6 * h21(id + 5.3));
    totalEmissiveRadiance += brilho * janela * acesa * (1.0 - 0.8 * lado) * 1.5;
  `,
  tecnico: /* glsl */ `
    // A sala dos cabos: um centro de dados — parede de ardósia com janelas em fita acesas em ciano (o neon do jogo).
    vec3 nf = normalSegura(cross(dFdx(vMundo), dFdy(vMundo)));
    vec3 fa = abs(nf);
    float lateral = step(fa.y, 0.5);
    float alongX = step(fa.z, fa.x);
    float across = mix(vMundo.x, vMundo.z, alongX);
    vec2 cel = vec2(floor(across / 4.0), floor(vMundo.y / 4.0));
    vec2 dentro = vec2(fract(across / 4.0), fract(vMundo.y / 4.0));
    float faixa = step(0.3, dentro.y) * step(dentro.y, 0.78) * step(0.05, dentro.x) * step(dentro.x, 0.95) * lateral;
    vec2 id = cel + vec2(alongX * 41.0, 0.0);
    // O núcleo (a integridade da rede) manda: quanto mais cai, mais janelas apagam e o que resta vira alarme vermelho.
    float acesa = step(0.16 + (1.0 - uNucleo) * 0.84, h21(id));
    float lado = clamp(dot(nf, uSolDir) * 1.6, 0.0, 1.0);
    vec3 parede = diffuseColor.rgb * (0.9 + 0.2 * vn(vMundo.xz * 0.5 + vMundo.y * 0.4)) * (0.82 + 0.18 * smoothstep(0.0, 4.0, vMundo.y));
    vec3 vidro = mix(srgb(vec3(0.03, 0.09, 0.13)), srgb(vec3(0.55, 0.62, 0.7)), lado * 0.45);
    vec3 teto = srgb(vec3(0.34, 0.37, 0.4)) * (0.88 + 0.2 * vn(vMundo.xz * 0.6));
    vec3 cor = mix(parede, vidro, faixa);
    cor = mix(cor, teto, step(0.5, fa.y) * step(0.0, nf.y));
    diffuseColor.rgb = cor;
    vec3 luz = mix(srgb(vec3(0.15, 0.85, 1.0)), srgb(vec3(1.0, 0.92, 0.75)), step(0.86, h21(id + 4.0)));
    luz = mix(srgb(vec3(1.0, 0.12, 0.08)), luz, smoothstep(0.25, 0.65, uNucleo));
    totalEmissiveRadiance += luz * faixa * acesa * (1.0 - 0.7 * lado) * 1.25;
  `,
  muro: /* glsl */ `
    vec3 nf = normalSegura(cross(dFdx(vMundo), dFdy(vMundo)));
    vec3 fa = abs(nf);
    float lateral = step(fa.y, 0.5);
    float across = mix(vMundo.x, vMundo.z, step(fa.z, fa.x));
    float baixo = 0.74 + 0.26 * smoothstep(0.0, 1.6, vMundo.y);
    float g = 0.94 + 0.1 * vn(vMundo.xz * 0.4 + vMundo.y * 0.6);
    float pilar = step(0.94, fract(across / 10.0));
    // A fita de luz ciano no alto do muro: o perímetro da estação aceso (a marca do complexo).
    float fita = lateral * step(4.0, vMundo.y) * step(vMundo.y, 4.28);
    diffuseColor.rgb = mix(diffuseColor.rgb * baixo * g * (1.0 - 0.14 * pilar), srgb(vec3(0.05, 0.16, 0.2)), fita);
    vec3 corDaFita = mix(srgb(vec3(1.0, 0.15, 0.1)), srgb(vec3(0.12, 0.85, 1.0)), smoothstep(0.25, 0.65, uNucleo));
    totalEmissiveRadiance += corDaFita * fita * 1.3;
  `,
  deque: /* glsl */ `
    // O tabuleiro de ferro do píer: chapas com costura a cada 2,4 m, ferrugem em manchas.
    vec3 nf = normalSegura(cross(dFdx(vMundo), dFdy(vMundo)));
    float topo = step(0.5, abs(nf.y)) * step(0.0, nf.y);
    float c = abs(fract(vMundo.z / 2.4) - 0.5);
    float costura = smoothstep(0.465, 0.5, c);
    float ferrugem = vn(vMundo.xz * 0.8 + 11.0);
    vec3 ferro = mix(diffuseColor.rgb, srgb(vec3(0.5, 0.33, 0.24)), 0.28 * smoothstep(0.5, 0.85, ferrugem));
    diffuseColor.rgb = ferro * (1.0 - 0.32 * costura * topo) * (0.9 + 0.14 * vn(vMundo.xz * 1.6));
  `,
  conteiner: /* glsl */ `
    vec3 nf = normalSegura(cross(dFdx(vMundo), dFdy(vMundo)));
    vec3 fa = abs(nf);
    float lateral = step(fa.y, 0.5);
    float alongX = step(fa.z, fa.x);
    float across = mix(vMundo.x, vMundo.z, alongX);
    float nerv = 0.86 + 0.14 * cos(across * 24.2);
    float ferrugem = 0.88 + 0.2 * vn(vMundo.xz * 1.3 + vMundo.y * 2.0);
    diffuseColor.rgb *= mix(1.0, nerv, lateral) * ferrugem * mix(1.0, 1.18, step(0.5, fa.y) * step(0.0, nf.y));
  `,
  asfalto: /* glsl */ `
    float g = 0.9 + 0.12 * vn(vMundo.xz * 0.7) + 0.08 * (vn(vMundo.xz * 4.2) - 0.5);
    float faixa = 0.97 + 0.05 * vn(vec2(vMundo.x * 0.15, vMundo.z * 1.6)); // as marcas de roda
    diffuseColor.rgb *= g * faixa;
  `,
  calcada: /* glsl */ `
    // A pedra portuguesa do calçadão: ondas pretas e brancas, e as juntas das pedras miúdas.
    vec2 w = vMundo.xz;
    float onda = sin(w.x * 0.95 + 2.1 * sin(w.y * 0.8)) * 0.5 + sin(w.y * 1.3 + 1.7 * sin(w.x * 0.45)) * 0.5;
    float faixa = smoothstep(-0.06, 0.06, onda);
    vec3 pedra = mix(srgb(vec3(0.15, 0.15, 0.17)), srgb(vec3(0.93, 0.89, 0.82)), faixa);
    vec2 junta = abs(fract(w * 2.6) - 0.5);
    float rejunte = smoothstep(0.43, 0.5, max(junta.x, junta.y));
    pedra *= 1.0 - 0.16 * rejunte;
    pedra *= 0.92 + 0.14 * vn(w * 1.9);
    diffuseColor.rgb = pedra;
  `,
  patio: /* glsl */ `
    // Lajes de concreto de 6 m com junta, manchas largas de uso e óleo.
    vec2 w = vMundo.xz;
    vec2 lj = abs(fract(w / 6.0) - 0.5);
    float junta = smoothstep(0.485, 0.5, max(lj.x, lj.y));
    float mancha = 0.88 + 0.22 * fbm(w * 0.08);
    diffuseColor.rgb *= mancha * (1.0 - 0.3 * junta) * (0.96 + 0.08 * vn(w * 2.4));
  `,
  ciclovia: /* glsl */ `
    float g = 0.9 + 0.14 * vn(vMundo.xz * 1.1);
    float tracejado = step(0.5, fract(vMundo.x / 9.0)) * step(abs(fract(vMundo.z / 3.0) - 0.5), 0.03);
    diffuseColor.rgb = diffuseColor.rgb * g + vec3(0.8) * tracejado * 0.0;
  `,
  escotilha: /* glsl */ `
    // A placa da escotilha: aço escuro com a moldura de listras de aviso, amarelo e preto.
    vec2 d = abs(vMundo.xz - vCentro.xz);
    float borda = step(4.0, max(d.x, d.y));
    float listra = step(0.5, fract((vMundo.x + vMundo.z) * 0.32));
    vec3 aviso = mix(srgb(vec3(0.12, 0.12, 0.13)), srgb(vec3(0.95, 0.72, 0.12)), listra);
    float placa = 0.9 + 0.15 * vn(vMundo.xz * 2.0);
    diffuseColor.rgb = mix(diffuseColor.rgb * placa, aviso, borda);
  `,
};

/** Quem se desenha por cima do chão (pista, calçada, marcas...): precisa de um empurrão de profundidade para não brigar com o terreno. */
export const E_PISO = new Set<TipoDeBloco>(['asfalto', 'calcada', 'patio', 'ciclovia', 'escotilha', 'marca', 'luz', 'cabo']);

/** Um material padrão da praia para o `modo`; o shader recebe o sol, o tempo, a vida do núcleo e — se `piso` — a sombra assada do chão. */
export function materialDoModo(modo: ModoDeMaterial, u: UniformesDaPraia, piso: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: modo === 'conteiner' ? 0.6 : modo === 'predio' ? 0.78 : 0.93, metalness: modo === 'conteiner' ? 0.25 : 0.03 });
  if (piso) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
  }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSolDir = { value: DIRECAO_DO_SOL };
    shader.uniforms.uTempo = u.tempo;
    shader.uniforms.uNucleo = u.nucleo;
    if (piso) {
      shader.uniforms.uSombra = u.sombra;
      shader.uniforms.uSombraArea = u.sombraArea;
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTICE_DECLARA}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTICE_CORPO}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENTO_DECLARA}${piso ? GLSL_SOMBRA_DECLARA : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n{ ${MODOS[modo]} }`);
    // A sombra do sol assada no chão: depois da luz (e da oclusão do material), antes de somar o que o piso reflete.
    if (piso) shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${glslSombraAplica('vMundo')}`);
  };
  m.customProgramCacheKey = () => `cybermech-praia-${modo}${piso ? '-piso' : ''}`;
  return m;
}

/** O material dos desenhos sem luz (marcas de pista, luzes, cabos): cor chapada (acima de 1 acende no bloom), com os cabos pulsando. */
export function materialSemLuz(kind: 'marca' | 'luz' | 'cabo', u: UniformesDaPraia): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  m.polygonOffset = true;
  m.polygonOffsetFactor = kind === 'marca' ? -3 : -4;
  m.polygonOffsetUnits = kind === 'marca' ? -3 : -4;
  if (kind === 'cabo') {
    // O dado que corre pelo cabo: pulsos de luz que andam do mar para a estação (o `x` do mundo não conta: o cabo corre em z).
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTempo = u.tempo;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTICE_CORPO.replace('vCentro = (modelMatrix * wc).xyz;', '')}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform float uTempo;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.55 + 0.65 * pow(clamp(0.5 + 0.5 * sin(vMundo.z * 0.22 - uTempo * 5.0), 0.0, 1.0), 3.0);');
    };
    m.customProgramCacheKey = () => 'cybermech-praia-cabo';
  } else if (kind === 'marca') {
    // A tinta da pista também fica na sombra: o mesmo mapa assado, só escurecendo a cor (sem luz para apagar).
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSombra = u.sombra;
      shader.uniforms.uSombraArea = u.sombraArea;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTICE_CORPO.replace('vCentro = (modelMatrix * wc).xyz;', '')}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vMundo;\n${GLSL_SOMBRA_DECLARA}`)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - 0.55 * sombraEm(vMundo.xz).r;');
    };
    m.customProgramCacheKey = () => 'cybermech-praia-marca';
  }
  return m;
}
