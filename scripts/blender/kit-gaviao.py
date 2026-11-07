# -*- coding: utf-8 -*-
"""
A PROVA BLENDER (P329, 07/11): o peito, a ombreira e o capacete do Gavião-H3 feitos no Blender por script, para a aba MECHS 3D mostrar lado a lado com a versão em código.

  D:/blender/blender.exe -b --factory-startup -P scripts/blender/kit-gaviao.py -- --saida <pasta absoluta> [--parte ombreira|capacete|peito|todas] [--fotos <pasta absoluta>]
  (o jeito normal é `npm run mech:pecas`, que acha o Blender e põe os caminhos absolutos)

O que o Blender dá e o kit em código não dá (MODELADOR.md § 10): chanfro de verdade (Bevel com 2 segmentos), fresta por booleano, normais ponderadas por área (o brilho corre pelo
arco do chanfro e as faces grandes ficam planas), e a oclusão de ambiente e o desgaste das quinas gravados na COR DO VÉRTICE (zero textura, zero draw call a mais: o lote do jogo já
trabalha com cor por vértice). Cada peça sai como um .glb de até quatro materiais com os nomes do jogo (armor, frame, paint, visor) e a cor do vértice em cinza (1 = sem sombra): o jogo
põe a cor, o metal e a rugosidade dele; a peça só traz a forma e a sombra.

Coordenadas: o rig é Y para cima e -Z para a frente (three.js); o Blender é Z para cima e +Y para a frente, e o exportador glTF troca (x, y, z) do Blender por (x, z, -y). Logo
(x, y, z) do rig = (x, -z, y) do Blender: toda posição aqui é dada em coordenadas do RIG (`P`), e a origem de cada peça é a junta onde ela se encaixa (o pivô do rig).
Caminhos sempre absolutos (o Blender resolve caminho relativo a partir da raiz do drive: G15).
"""
import bmesh
import bpy
import math
import os
import sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


def argumentos():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    d = {}
    i = 0
    while i < len(a):
        if a[i].startswith('--'):
            if i + 1 < len(a) and not a[i + 1].startswith('--'):
                d[a[i][2:]] = a[i + 1]
                i += 2
            else:
                d[a[i][2:]] = True
                i += 1
        else:
            i += 1
    return d


ARGS = argumentos()
if 'saida' not in ARGS:
    raise SystemExit('falta --saida <pasta absoluta>')
SAIDA = os.path.abspath(ARGS['saida'])
FOTOS = os.path.abspath(ARGS['fotos']) if 'fotos' in ARGS else None
PARTE = ARGS.get('parte', 'todas')
os.makedirs(SAIDA, exist_ok=True)
if FOTOS:
    os.makedirs(FOTOS, exist_ok=True)

# ── Coordenadas: do rig para o Blender ────────────────────────────────────────────────────────────────────────────────
MAPA = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))  # rig -> Blender (uma rotação própria: determinante 1)


def P(x, y, z):
    return Vector((x, -z, y))


def rot_blender(rx, ry, rz):
    """A rotação do rig (three.js, ordem XYZ: R = Rx·Ry·Rz) escrita nos eixos do Blender."""
    r = Matrix.Rotation(rx, 3, 'X') @ Matrix.Rotation(ry, 3, 'Y') @ Matrix.Rotation(rz, 3, 'Z')
    return MAPA @ r @ MAPA.inverted()


def matriz(loc, rot):
    return Matrix.Translation(P(*loc)) @ rot_blender(*rot).to_4x4()


# ── Cena, materiais e peças ───────────────────────────────────────────────────────────────────────────────────────────
PECAS = []
CORTADORES = []

# nome: (metal, rugosidade, cor de visualização, emissão)
MATERIAIS = {
    'armor': (0.6, 0.36, (0.49, 0.51, 0.55), None),
    'frame': (0.72, 0.48, (0.12, 0.13, 0.14), None),
    'paint': (0.36, 0.44, (0.95, 0.55, 0.12), None),
    'visor': (0.0, 0.5, (1.0, 0.64, 0.23), (1.0, 0.64, 0.23)),
}


def limpar():
    PECAS.clear()
    CORTADORES.clear()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for bloco in (bpy.data.meshes, bpy.data.materials):
        for b in list(bloco):
            bloco.remove(b)
    for nome, (metal, rug, cor, emissao) in MATERIAIS.items():
        m = bpy.data.materials.new(nome)
        m.use_nodes = True
        n = m.node_tree.nodes['Principled BSDF']
        n.inputs['Base Color'].default_value = (1, 1, 1, 1)
        n.inputs['Metallic'].default_value = metal
        n.inputs['Roughness'].default_value = rug
        if emissao:
            n.inputs['Emission Color'].default_value = (*emissao, 1)
            n.inputs['Emission Strength'].default_value = 4.0
        m.diffuse_color = (*cor, 1)  # só para a foto de conferência do Blender (a cor de verdade é a do jogo)


def objeto(nome, bm, loc, rot, mat):
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(o)
    o.matrix_world = matriz(loc, rot)
    me.materials.append(bpy.data.materials[mat])
    PECAS.append(o)
    return o


def cortador(o, off, tam):
    """Uma caixa de corte colada à peça `o`: `off` e `tam` nos eixos do rig, relativos a ela."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= tam[0]
        v.co.y *= tam[2]
        v.co.z *= tam[1]
    me = bpy.data.meshes.new('corte')
    bm.to_mesh(me)
    bm.free()
    c = bpy.data.objects.new('corte', me)
    bpy.context.scene.collection.objects.link(c)
    c.matrix_world = o.matrix_world @ Matrix.Translation(P(*off))
    c.display_type = 'WIRE'
    c.hide_render = True
    CORTADORES.append(c)
    return c


def cortar(o, off, tam):
    c = cortador(o, off, tam)
    m = o.modifiers.new('corte', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = c
    m.solver = 'EXACT'


def chanfrar(o, larg, seg=2, ang=35):
    m = o.modifiers.new('chanfro', 'BEVEL')
    m.width = larg
    m.segments = seg
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(ang)
    m.profile = 0.55


def caixa(nome, w, h, d, loc, rot=(0, 0, 0), mat='armor', topo=(1.0, 1.0), chanfro=0.02, seg=2, cortes=()):
    """Uma placa: w no X do rig, h no Y (para cima), d no Z. `topo` afunila a face de cima (x, z)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        k = topo if v.co.z > 0 else (1.0, 1.0)
        v.co.x *= w * k[0]
        v.co.y *= d * k[1]
        v.co.z *= h
    o = objeto(nome, bm, loc, rot, mat)
    for off, tam in cortes:
        cortar(o, off, tam)
    if chanfro > 0:
        chanfrar(o, chanfro, seg)
    return o


def cilindro(nome, r, comp, loc, rot=(0, 0, 0), mat='frame', lados=10, chanfro=0.0):
    """Um cilindro com o eixo no Y do rig (para o lado, gire com `rot`)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados, radius1=r, radius2=r, depth=comp)
    o = objeto(nome, bm, loc, rot, mat)
    if chanfro > 0:
        chanfrar(o, chanfro, 1)
    return o


def esfera(nome, r, loc, esc=(1, 1, 1), mat='frame', lados=14, aneis=9):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=lados, v_segments=aneis, radius=r)
    for v in bm.verts:
        v.co.x *= esc[0]
        v.co.y *= esc[2]
        v.co.z *= esc[1]
    return objeto(nome, bm, loc, (0, 0, 0), mat)


def casca(nome, secoes, loc, mat='armor', chanfro=0.03, seg=2, cortes=()):
    """Uma casca por seções (y, largura, profundidade, deslocamento z): a mesma ideia do `casca` do kit em código, num octógono de cantos chanfrados."""
    bm = bmesh.new()
    aneis = []
    for (y, w, d, oz) in secoes:
        hw, hd = w / 2, d / 2
        k = min(0.18 * w, 0.18 * d)
        pts = [(hw - k, -hd), (hw, -hd + k), (hw, hd - k), (hw - k, hd), (-hw + k, hd), (-hw, hd - k), (-hw, -hd + k), (-hw + k, -hd)]
        aneis.append([bm.verts.new((x, d_ + 0.0, y)) for (x, d_) in [(px, pz + oz) for (px, pz) in pts]])
    for a, b in zip(aneis, aneis[1:]):
        for j in range(8):
            k2 = (j + 1) % 8
            bm.faces.new((a[j], a[k2], b[k2], b[j]))
    bm.faces.new(aneis[0][::-1])
    bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = objeto(nome, bm, loc, (0, 0, 0), mat)
    for off, tam in cortes:
        cortar(o, off, tam)
    if chanfro > 0:
        chanfrar(o, chanfro, seg)
    return o


def riscos(nome, loc, rot, n=3, escala=1.0, mat='paint'):
    """Os riscos de perigo (o acento pequeno do print 4): n traços inclinados numa face; `rot` é a orientação da face (a inclinação já vem no rot z)."""
    out = []
    for i in range(n):
        passo = (i - (n - 1) / 2) * 0.034 * escala
        dx = passo * math.cos(rot[1])
        dz = -passo * math.sin(rot[1])
        out.append(caixa(f'{nome}{i}', 0.018 * escala, 0.1 * escala, 0.012, (loc[0] + dx, loc[1], loc[2] + dz), rot, mat, chanfro=0.0))
    return out


# ── As três peças, nas coordenadas do rig ─────────────────────────────────────────────────────────────────────────────
def ranhura_em_volta(o, y, w, d, prof=0.010, esp=0.012):
    """Uma ranhura SÓ NA PELE, em volta de um bloco de `w` × `d` (eixos do rig), na altura `y` relativa ao centro dele: quatro cortadores rasos (um por face). Um cortador que atravessa o bloco
    de lado a lado o fatiaria em dois (foi o erro do primeiro capacete: duas almofadas empilhadas)."""
    cortar(o, (0, y, -d / 2), (w, esp, prof * 2))
    cortar(o, (0, y, d / 2), (w, esp, prof * 2))
    cortar(o, (-w / 2, y, 0), (prof * 2, esp, d))
    cortar(o, (w / 2, y, 0), (prof * 2, esp, d))


def ombreira():
    """A ombreira direita (+x é para fora), com a origem na junta do ombro. A esquerda é a mesma peça espelhada em x no jogo."""
    tilt = -0.16  # a tampa cai para fora
    caixa('sub', 0.52, 0.05, 0.62, (0.06, -0.03, 0), (0, 0, tilt), 'frame', chanfro=0.01, seg=1)
    # A tampa: placa de cantos arredondados, a face de cima menor, uma ranhura no meio, a quilha por cima e quatro parafusos.
    caixa('tampa', 0.60, 0.18, 0.70, (0.06, 0.12, 0), (0, 0, tilt), 'armor', topo=(0.62, 0.72), chanfro=0.05, seg=3,
          cortes=[((0, 0.09, 0), (0.014, 0.016, 0.46))])
    caixa('quilha', 0.10, 0.06, 0.48, (0.06, 0.225, 0), (0, 0, tilt), 'armor', topo=(0.6, 0.9), chanfro=0.02, seg=2)
    for sx in (-1, 1):
        for sz in (-1, 1):
            cilindro(f'parafuso{sx}{sz}', 0.022, 0.018, (0.06 + sx * 0.17, 0.2 + sx * 0.0, sz * 0.22), (0, 0, tilt), 'frame', 8)
    # As lâminas que caem junto do braço, grossas, cada uma mais inclinada.
    for i in range(2):
        caixa(f'lamina{i}', 0.36 - 0.04 * i, 0.16, 0.62 - 0.04 * i, (0.30 + 0.06 * i, -0.06 - 0.14 * i, 0), (0, 0, tilt - (0.55 + 0.45 * i)), 'armor', chanfro=0.03, seg=2)
    guarda = caixa('guarda', 0.28, 0.18, 0.07, (0.10, 0.05, -0.355), (0, 0, tilt), 'armor', chanfro=0.025, seg=2)
    riscos('risco', (0.10, 0.05, -0.395), (0, 0, 0.62), 3, 0.8)
    esfera('junta', 0.14, (0, -0.06, 0))
    return guarda


def capacete():
    """O capacete, com a origem no pivô da cabeça (a base do crânio fica 0,25 abaixo dela)."""
    hw, hh, hd, y0 = 0.56, 0.62, 0.62, -0.25
    # O crânio: uma caixa afunilada de cantos bem arredondados (o bevel largo), com uma ranhura só na pele em volta e outra atrás.
    cw, ch, cd = hw * 0.96, hh * 0.80, hd * 0.98
    cranio = caixa('cranio', cw, ch, cd, (0, y0 + hh * 0.48, 0.015), (0, 0, 0), 'armor', topo=(0.82, 0.86), chanfro=0.09, seg=4)
    ranhura_em_volta(cranio, 0.02, cw * 0.91, cd * 0.93)
    cortar(cranio, (0, 0.10, cd * 0.43), (0.012, 0.3, 0.024))
    # A máscara escura, a sobrancelha, a fresta do visor (a luz) e o queixo.
    caixa('mascara', hw * 0.84, hh * 0.44, 0.08, (0, y0 + hh * 0.46, -hd * 0.5), (0, 0, 0), 'frame', chanfro=0.025, seg=2)
    caixa('sobrancelha', hw * 0.92, 0.05, 0.13, (0, y0 + hh * 0.64, -hd * 0.49), (0.25, 0, 0), 'armor', chanfro=0.02, seg=2)
    caixa('visor', hw * 0.5, hh * 0.055, 0.03, (0, y0 + hh * 0.5, -hd * 0.55 - 0.012), (0, 0, 0), 'visor', chanfro=0.0)
    caixa('queixo', hw * 0.56, hh * 0.20, hd * 0.34, (0, y0 + hh * 0.10, -hd * 0.30), (-0.15, 0, 0), 'armor', topo=(0.8, 0.8), chanfro=0.03, seg=2)
    for lado in (-1, 1):
        caixa(f'bochecha{lado}', 0.09, hh * 0.46, hd * 0.56, (lado * hw * 0.5, y0 + hh * 0.42, 0.04), (0, 0, 0), 'armor', chanfro=0.03, seg=2,
              cortes=[((lado * 0.045, 0.0, -0.1), (0.02, 0.012, 0.16))])
        cilindro(f'orelha{lado}', 0.07, 0.04, (lado * (hw * 0.5 + 0.06), y0 + hh * 0.42, 0.04), (0, 0, math.pi / 2), 'frame', 12)
    caixa('crista', hw * 0.16, 0.06, hd * 0.8, (0, y0 + hh * 0.48 + ch / 2 + 0.005, 0), (0, 0, 0), 'frame', chanfro=0.015, seg=2)
    cilindro('pescoco', 0.19, 0.08, (0, y0 + 0.0, 0), (0, 0, 0), 'frame', 14)
    return None


def peito():
    """O peito, com a origem no pivô do tronco (o topo do cinto): do diafragma ao pescoço, as costas e a gola."""
    tw, td, topo = 1.16, 0.78, 1.386
    # O núcleo escuro e o casco do peito (a cintura estreita que alarga para o ombro).
    caixa('nucleo', tw * 0.66, 0.70, td * 0.62, (0, 1.0, 0), (0, 0, 0), 'frame', chanfro=0.02, seg=1)
    casca('casco', [(0.60, tw * 0.74, td * 0.72, 0.0), (0.98, tw * 1.0, td * 0.92, 0.0), (topo, tw * 1.02, td * 0.78, 0.0)], (0, 0, 0), 'armor', chanfro=0.04, seg=2)
    caixa('diafragma', tw * 0.80, 0.17, td * 0.70, (0, 0.535, -td * 0.02), (0, 0, 0), 'armor', chanfro=0.03, seg=2,
          cortes=[((0, 0.03, -td * 0.35), (tw * 0.7, 0.012, 0.02)), ((0, -0.04, -td * 0.35), (tw * 0.7, 0.012, 0.02))])
    for lado in (-1, 1):
        # As placas peitorais, abertas em V, com os respiros (três frestas que mostram o escuro por dentro) e uma ranhura na borda de cima.
        caixa(f'peitoral{lado}', tw * 0.40, 0.42, 0.12, (lado * tw * 0.22, 1.02, -td * 0.47), (0.2, -lado * 0.22, 0), 'armor', chanfro=0.03, seg=2,
              cortes=[((lado * 0.12, -0.12 + 0.07 * k, 0), (0.17, 0.012, 0.2)) for k in range(3)] + [((0, 0.19, 0), (tw * 0.34, 0.012, 0.02))])
        riscos(f'riscoP{lado}', (lado * tw * 0.3, 0.86, -td * 0.47 - 0.07), (0, 0, 0.62 * lado), 3, 0.8)
        caixa(f'gola{lado}', 0.22, 0.13, 0.24, (lado * 0.34, topo - 0.05, 0), (0, 0, -lado * 0.3), 'armor', chanfro=0.03, seg=2)
    caixa('esterno', 0.10, 0.62, 0.05, (0, 0.98, -td * 0.47 - 0.065), (0, 0, 0), 'frame', chanfro=0.015, seg=2)
    for k in range(3):
        cilindro(f'rebite{k}', 0.018, 0.016, (0, 0.78 + 0.18 * k, -td * 0.47 - 0.095), (math.pi / 2, 0, 0), 'frame', 8)
    cilindro('pescoco', 0.17, 0.30, (0, topo + 0.06, -0.03), (0, 0, 0), 'frame', 14)
    caixa('costas', tw * 0.82, 0.80, 0.08, (0, 0.98, td * 0.5), (0, 0, 0), 'armor', chanfro=0.03, seg=2,
          cortes=[((0, 0.1, 0.04), (tw * 0.6, 0.012, 0.016)), ((0, -0.15, 0.04), (tw * 0.6, 0.012, 0.016))])
    return None


# ── O acabamento: aplicar os modificadores, sombrear, juntar por material, sombra de ambiente e desgaste no vértice ────
def aplicar(o):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
    me.transform(o.matrix_world)
    o.modifiers.clear()
    antigo = o.data
    mats = [m for m in antigo.materials]
    o.data = me
    o.matrix_world = Matrix.Identity(4)
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    bpy.data.meshes.remove(antigo)


def sombrear(o, angulo=60):
    """Faces lisas, arestas duras só onde o ângulo passa de `angulo` (o arco do chanfro, de 45° por passo, fica liso)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for e in bm.edges:
        e.smooth = True
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(angulo):
            e.smooth = False
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(o.data)
    bm.free()


def juntar_por_material():
    grupos = {}
    for o in PECAS:
        grupos.setdefault(o.data.materials[0].name, []).append(o)
    finais = []
    for nome, lista in grupos.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in lista:
            o.select_set(True)
        bpy.context.view_layer.objects.active = lista[0]
        if len(lista) > 1:
            bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = nome
        o.data.name = nome
        finais.append(o)
    return finais


def hemisfera(n):
    """n direções no hemisfério (z para cima), espalhadas pela espiral de Fibonacci: as mesmas sempre (nada aleatório)."""
    out = []
    for i in range(n):
        z = (i + 0.5) / n
        r = math.sqrt(max(0.0, 1 - z * z))
        a = i * 2.399963229728653
        out.append((r * math.cos(a), r * math.sin(a), z))
    return out


AMOSTRAS = 40
DISTANCIA = 0.45


def sombra_e_desgaste(finais):
    """A cor do vértice em cinza: 1 é sem sombra. Sombra de ambiente por raios (a fração do hemisfério que bate em outra parte da peça, mais pesada de perto) e o desgaste
    das quinas (o vértice convexo clareia: a tinta que saiu na borda)."""
    verts, polys, desloc = [], [], 0
    for o in finais:
        me = o.data
        verts += [v.co.copy() for v in me.vertices]
        polys += [tuple(i + desloc for i in p.vertices) for p in me.polygons]
        desloc += len(me.vertices)
    bvh = BVHTree.FromPolygons(verts, polys)
    dirs = hemisfera(AMOSTRAS)
    for o in finais:
        me = o.data
        me.update()
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.normal_update()
        bm.verts.ensure_lookup_table()
        valores = []
        for v in bm.verts:
            n = v.normal.copy()
            if n.length < 1e-6:
                n = Vector((0, 0, 1))
            n.normalize()
            t = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0)))
            t.normalize()
            b = n.cross(t)
            origem = v.co + n * 0.003
            oclusao = 0.0
            for (dx, dy, dz) in dirs:
                d = (t * dx + b * dy + n * dz)
                d.normalize()
                achou = bvh.ray_cast(origem, d, DISTANCIA)
                if achou[0] is not None:
                    oclusao += 1.0 - achou[3] / DISTANCIA
            ao = 1.0 - oclusao / len(dirs)
            conv = [e.calc_face_angle_signed(0.0) for e in v.link_edges if len(e.link_faces) == 2]
            convexidade = sum(conv) / len(conv) if conv else 0.0
            desgaste = max(0.0, min(1.0, (convexidade - 0.12) / 0.45)) * 0.22
            g = 0.52 + 0.48 * (max(0.0, min(1.0, ao)) ** 1.5) + desgaste
            valores.append(max(0.0, min(1.0, g)))
        bm.free()
        for nome in list(me.color_attributes.keys()):
            me.color_attributes.remove(me.color_attributes[nome])
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for i, g in enumerate(valores):
            attr.data[i].color = (g, g, g, 1.0)
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = 0


def normais_ponderadas(o):
    m = o.modifiers.new('normais', 'WEIGHTED_NORMAL')
    m.mode = 'FACE_AREA'
    m.keep_sharp = True
    m.weight = 50


def triangulos(finais):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in finais)


def exportar(finais, caminho):
    bpy.ops.object.select_all(action='DESELECT')
    for o in finais:
        o.select_set(True)
    bpy.context.view_layer.objects.active = finais[0]
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = dict(filepath=caminho, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    for k, v in (('export_cameras', False), ('export_lights', False), ('export_texcoords', False), ('export_normals', True), ('export_materials', 'EXPORT'),
                 ('export_vertex_color', 'ACTIVE'), ('export_animations', False), ('export_extras', False)):
        if k in props:
            kw[k] = v
    if 'export_vertex_color' not in props and 'export_colors' in props:
        kw['export_colors'] = True
    bpy.ops.export_scene.gltf(**kw)


def foto(finais, nome):
    """Fotos de conferência no Workbench (sem placa de vídeo): a peça de quatro lados numa tira, uma com as cores dos materiais e outra com a cor do vértice (a sombra de ambiente)."""
    if not FOTOS:
        return
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x, sc.render.resolution_y = 1800, 600
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.show_cavity = False
    xs_ = [v.co.x for o in finais for v in o.data.vertices]
    zs_ = [v.co.z for o in finais for v in o.data.vertices]
    esp = max(max(xs_) - min(xs_), 0.5) * 1.5
    copias = []
    for i, ang in enumerate((0, 60, 120, 180)):
        for o in finais:
            c = o.copy()
            bpy.context.scene.collection.objects.link(c)
            c.location = Vector((i * esp, 0, 0))
            c.rotation_euler = (0, 0, math.radians(ang))
            copias.append(c)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.scene.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = esp * 4.0
    cam.location = Vector((1.5 * esp, 8, (min(zs_) + max(zs_)) / 2))
    cam.rotation_euler = (math.radians(90), 0, math.radians(180))
    for tipos, sufixo in ((('MATERIAL',), 'mat'), (('VERTEX', 'ATTRIBUTE'), 'ao')):
        for tipo in tipos:
            try:
                sh.color_type = tipo
                break
            except TypeError:
                continue  # o nome do tipo mudou de uma versão do Blender para outra
        else:
            continue
        sc.render.filepath = os.path.join(FOTOS, f'{nome}-{sufixo}.png')
        bpy.ops.render.render(write_still=True)
    for c in copias:
        bpy.data.objects.remove(c)
    bpy.data.objects.remove(cam)


def construir(nome, fabrica):
    limpar()
    fabrica()
    for o in list(PECAS):
        aplicar(o)
    for o in PECAS:
        sombrear(o)
    finais = juntar_por_material()
    for c in CORTADORES:
        bpy.data.objects.remove(c)
    sombra_e_desgaste(finais)
    for o in finais:
        normais_ponderadas(o)
    caminho = os.path.join(SAIDA, nome + '.glb')
    exportar(finais, caminho)
    foto(finais, nome)
    print(f'PARTE {nome}: {triangulos(finais)} triângulos, {len(finais)} materiais, {os.path.getsize(caminho)} bytes -> {caminho}')


ESTAS = {
    'ombreira': ('gaviao-ombreira', ombreira),
    'capacete': ('gaviao-capacete', capacete),
    'peito': ('gaviao-peito', peito),
}
for chave, (nome, fabrica) in ESTAS.items():
    if PARTE in ('todas', chave):
        construir(nome, fabrica)
