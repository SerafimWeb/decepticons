# RIG DO DRAGA-01 (o "heavy industrial walker 3d model" do Comandante, P180): constrói o esqueleto de 18 ossos, a pele RÍGIDA POR PARTE e a cor nos vértices,
# e exporta o .glb que o jogo carrega. NÃO toca no arquivo do dono: lê a cópia e escreve onde mandarem. Reproduzível (rode de novo e sai o mesmo arquivo).
#
#   blender -b -P scripts/blender/rig-walker.py -- <entrada.glb> <saida.glb> [--fotos <pasta>] [--listar <classes>] [--so-classificar]
#
# Por que pele rígida por parte: o arquivo é UMA malha de 537 peças soltas (ilhas de vértices), todas peças de máquina. Cada peça vai INTEIRA a um osso (peso 1): a junta não amassa e o
# custo é o de um desenho só. A classificação das peças (qual osso leva cada uma) é por posição, e foi conferida em foto (`--fotos`: uma imagem por classe).
#
# Convenção de eixos (a do arquivo, depois do import do Blender, que gira Y-up para Z-up): frente = -Y, altura = +Z, o lado ESQUERDO do robô = +X. O arquivo sai em Y-up (glTF), frente +Z.
# Os ossos das pernas ficam todos no plano YZ (mesmo x nas três juntas): o giro de passada é em torno do eixo X do mundo, o que o jogo assume (`entities/WalkerRig.ts`).
#
# Ossos (18): raiz > casco > deck (o disco giratório e tudo em cima: gira) > guindaste_esq, guindaste_dir, radar;  casco > {fl,fr,rl,rr}_coxa > _canela > _pe.
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
ENTRADA = os.path.abspath(argv[0])
SAIDA = os.path.abspath(argv[1])
PASTA_FOTOS = os.path.abspath(argv[argv.index('--fotos') + 1]) if '--fotos' in argv else None
SO_CLASSIFICAR = '--so-classificar' in argv

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 1. Entrada e ilhas
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ENTRADA)
malha = next(o for o in bpy.data.objects if o.type == 'MESH')
me = malha.data
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()

visto = set()
ilhas = []  # cada ilha: dict(verts=[índices], c=centro, mn, mx, n)
for v in bm.verts:
    if v.index in visto:
        continue
    pilha = [v]
    visto.add(v.index)
    idx = []
    while pilha:
        a = pilha.pop()
        idx.append(a.index)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in visto:
                visto.add(b.index)
                pilha.append(b)
    ps = [bm.verts[i].co for i in idx]
    c = sum(ps, Vector()) / len(ps)
    mn = Vector((min(p.x for p in ps), min(p.y for p in ps), min(p.z for p in ps)))
    mx = Vector((max(p.x for p in ps), max(p.y for p in ps), max(p.z for p in ps)))
    ilhas.append({'verts': idx, 'c': c, 'mn': mn, 'mx': mx, 'n': len(idx)})
bm.free()

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 2. Classificação: qual osso leva cada ilha (medidas do arquivo, em unidades dele: 0,98 de altura)
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
Z_DISCO = 0.40        # acima disto é o convés (o disco giratório começa em 0,396); abaixo é o casco
Z_QUADRIL = 0.27      # a ferragem do quadril (acima disto, perto do casco) fica no casco
Z_COXA = 0.15         # a coxa vai de Z_COXA a Z_QUADRIL; a canela de Z_CANELA a Z_COXA; o pé abaixo
Z_CANELA = 0.07
Y_FRENTE = -0.10      # as pernas da frente têm o centro em y < -0,10; as de trás, em y > 0,20 (o meio é casco)
Y_TRAS = 0.20
X_PERNA = 0.10

PERNAS = {  # sigla: (sinal de x, sinal de y)   esquerda = +x, frente = -y
    'fl': (+1, -1),
    'fr': (-1, -1),
    'rl': (+1, +1),
    'rr': (-1, +1),
}

def perna_da_ilha(c):
    if abs(c.x) < X_PERNA:
        return None
    sx = +1 if c.x > 0 else -1
    if c.y < Y_FRENTE:
        sy = -1
    elif c.y > Y_TRAS:
        sy = +1
    else:
        return None
    for sigla, (px, py) in PERNAS.items():
        if px == sx and py == sy:
            return sigla
    return None

def classificar(il):
    c = il['c']
    sig = perna_da_ilha(c)
    if sig and c.z < Z_QUADRIL:
        if c.z >= Z_COXA:
            return f'{sig}_coxa'
        if c.z >= Z_CANELA:
            return f'{sig}_canela'
        return f'{sig}_pe'
    if c.z < Z_DISCO:
        return 'casco'
    # o convés
    if 0.015 <= c.x <= 0.045 and -0.315 <= c.y <= -0.26 and 0.675 <= c.z <= 0.73:
        return 'radar'  # o prato do radar da cabine e o suporte dele (medido na lista de ilhas do convés)
    if abs(c.x) >= 0.17 and c.y >= 0.26 and c.z >= 0.58:
        return 'guindaste_esq' if c.x > 0 else 'guindaste_dir'
    return 'deck'

for il in ilhas:
    il['osso'] = classificar(il)

contagem = {}
for il in ilhas:
    k = il['osso']
    contagem.setdefault(k, [0, 0])
    contagem[k][0] += 1
    contagem[k][1] += il['n']
print('\n===== CLASSIFICAÇÃO =====')
for k in sorted(contagem):
    print(f'  {k:16s} {contagem[k][0]:4d} ilhas {contagem[k][1]:6d} vértices')

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 3. Fotos por classe (conferência) e listagem
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
CORES_DEBUG = {
    'casco': (0.55, 0.55, 0.60), 'deck': (0.85, 0.80, 0.35), 'radar': (1.0, 0.1, 0.8), 'guindaste_esq': (0.1, 0.9, 1.0), 'guindaste_dir': (1.0, 0.5, 0.1),
    'fl': (0.9, 0.2, 0.2), 'fr': (0.2, 0.9, 0.2), 'rl': (0.3, 0.3, 1.0), 'rr': (0.9, 0.9, 0.2),
}

def cor_debug(osso):
    if osso in CORES_DEBUG:
        return CORES_DEBUG[osso]
    base = CORES_DEBUG[osso[:2]]
    f = {'coxa': 1.0, 'canela': 0.65, 'pe': 0.35}[osso[3:]]
    return tuple(min(1.0, b * f + (1 - f) * 0.15) for b in base)

def fotografar(pasta, por_cor, prefixo):
    os.makedirs(pasta, exist_ok=True)
    attr = me.color_attributes.new('debug', 'FLOAT_COLOR', 'POINT')
    for il in ilhas:
        r, g, b = por_cor(il)
        for i in il['verts']:
            attr.data[i].color = (r, g, b, 1.0)
    cena = bpy.context.scene
    cena.render.engine = 'BLENDER_WORKBENCH'
    sh = cena.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'VERTEX'
    cena.render.resolution_x = 900
    cena.render.resolution_y = 900
    cena.world = bpy.data.worlds.new('w')
    cena.world.color = (0.1, 0.11, 0.13)
    pts = [malha.matrix_world @ v.co for v in me.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centro = (mn + mx) / 2
    raio = (mx - mn).length
    cd = bpy.data.cameras.new('c')
    cd.type = 'ORTHO'
    cd.ortho_scale = raio * 1.0
    cam = bpy.data.objects.new('c', cd)
    cena.collection.objects.link(cam)
    cena.camera = cam
    for nome, d in [(prefixo + '_3q', (1, -1, 0.7)), (prefixo + '_lado', (1, 0, 0.05)), (prefixo + '_tras3q', (-1, 1, 0.7)), (prefixo + '_cima', (0, 0.001, 1))]:
        dv = Vector(d).normalized()
        cam.location = centro + dv * raio * 2
        cam.rotation_euler = (centro - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cena.render.filepath = os.path.join(pasta, nome + '.png')
        bpy.ops.render.render(write_still=True)
    me.color_attributes.remove(attr)
    bpy.data.objects.remove(cam)
    print('fotos em', pasta)

if PASTA_FOTOS and SO_CLASSIFICAR:
    fotografar(PASTA_FOTOS, lambda il: cor_debug(il['osso']), 'classes')

if '--listar' in argv:  # depuração: imprime as peças das classes pedidas (separadas por vírgula), com centro e caixa
    pedidas = argv[argv.index('--listar') + 1].split(',')
    for i, il in enumerate(ilhas):
        if il['osso'] in pedidas:
            c, mn, mx = il['c'], il['mn'], il['mx']
            print(f"  #{i:3d} {il['osso']:14s} {il['n']:4d}v c({c.x:+.3f},{c.y:+.3f},{c.z:+.3f}) x[{mn.x:+.3f},{mx.x:+.3f}] y[{mn.y:+.3f},{mx.y:+.3f}] z[{mn.z:+.3f},{mx.z:+.3f}]")

if SO_CLASSIFICAR:
    print('só classificar: fim')
    sys.exit(0)

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 4. Centro de apoio na origem: o centro do polígono dos quatro pés vai para (0, 0) no chão
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
pes_principais = []
for sig in PERNAS:
    ps = [il for il in ilhas if il['osso'] == f'{sig}_pe']
    pes_principais.append(max(ps, key=lambda il: il['n']))
cx = sum(il['c'].x for il in pes_principais) / 4
cy = sum(il['c'].y for il in pes_principais) / 4
me.transform(Matrix.Translation((-cx, -cy, 0)))
me.update()
print(f'\ncentro de apoio dos pés: x {cx:+.4f}, y {cy:+.4f} (levado para a origem)')

def pontos(lista):
    return [me.vertices[i].co.copy() for il in lista for i in il['verts']]

def fatia(lista, topo, frac=0.12):
    pts = pontos(lista)
    zs = [p.z for p in pts]
    zmin, zmax = min(zs), max(zs)
    h = zmax - zmin
    sel = [p for p in pts if (p.z >= zmax - frac * h if topo else p.z <= zmin + frac * h)]
    return sum(sel, Vector()) / len(sel)

def da_classe(osso):
    return [il for il in ilhas if il['osso'] == osso]

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 5. Juntas das pernas, medidas nas próprias peças
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
juntas = {}
for sig in PERNAS:
    coxa = da_classe(f'{sig}_coxa')
    canela = da_classe(f'{sig}_canela')
    pe = da_classe(f'{sig}_pe')
    pe_principal = [max(pe, key=lambda il: il['n'])]
    quadril = fatia(coxa, True)
    joelho = (fatia(coxa, False) + fatia(canela, True)) / 2
    tornozelo = (fatia(canela, False) + fatia(pe_principal, True)) / 2
    x = (quadril.x + joelho.x + tornozelo.x) / 3
    pts_pe = pontos(pe_principal)
    ponta = Vector((x, sum(p.y for p in pts_pe) / len(pts_pe), min(p.z for p in pts_pe) + 0.01))
    juntas[sig] = [Vector((x, p.y, p.z)) for p in (quadril, joelho, tornozelo, ponta)]
    q, j, t, pt = juntas[sig]
    print(f'  perna {sig}: quadril ({q.x:+.3f},{q.y:+.3f},{q.z:.3f})  joelho ({j.y:+.3f},{j.z:.3f})  tornozelo ({t.y:+.3f},{t.z:.3f})  ponta ({pt.y:+.3f},{pt.z:.3f})')

# o disco giratório (a ilha grande do convés mais baixa e redonda) e a base dos guindastes e do radar
disco = max([il for il in ilhas if il['osso'] == 'deck' and il['mn'].z > 0.38 and il['mx'].z < 0.5 and il['n'] > 150], key=lambda il: il['n'])
pivo_deck = Vector((0, sum(me.vertices[i].co.y for i in disco['verts']) / disco['n'], (disco['mn'].z + disco['mx'].z) / 2))
print(f"  disco giratório: {disco['n']} vértices, pivô ({pivo_deck.x:+.3f},{pivo_deck.y:+.3f},{pivo_deck.z:.3f})")
base_guindaste = {'esq': Vector((0.185 - cx, 0.305 - cy, 0.635)), 'dir': Vector((-0.185 - cx, 0.305 - cy, 0.635))}
pivo_radar = Vector((0.026 - cx, -0.285 - cy, 0.69))
altura = max(me.vertices[i].co.z for i in range(len(me.vertices)))
print(f'  altura do modelo: {altura:.4f}')

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 6. Esqueleto
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
arm_data = bpy.data.armatures.new('Draga')
arm = bpy.data.objects.new('Draga', arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones

def osso(nome, cabeca, cauda, pai=None):
    b = eb.new(nome)
    b.head = cabeca
    cauda = Vector(cauda)
    if (cauda - cabeca).length < 0.01:
        cauda = cabeca + Vector((0, 0, 0.02))
    b.tail = cauda
    if pai:
        b.parent = eb[pai]
        b.use_connect = False
    return b

osso('raiz', Vector((0, 0, 0)), Vector((0, 0, 0.05)))
osso('casco', Vector((0, 0, 0.30)), Vector((0, 0, 0.38)), 'raiz')
osso('deck', pivo_deck, pivo_deck + Vector((0, 0, 0.12)), 'casco')
osso('guindaste_esq', base_guindaste['esq'], base_guindaste['esq'] + Vector((0.03, 0.12, 0.08)), 'deck')
osso('guindaste_dir', base_guindaste['dir'], base_guindaste['dir'] + Vector((-0.03, 0.12, 0.08)), 'deck')
osso('radar', pivo_radar, pivo_radar + Vector((0, 0, 0.05)), 'deck')
for sig, (q, j, t, pt) in juntas.items():
    osso(f'{sig}_coxa', q, j, 'casco')
    osso(f'{sig}_canela', j, t, f'{sig}_coxa')
    osso(f'{sig}_pe', t, pt, f'{sig}_canela')
bpy.ops.object.mode_set(mode='OBJECT')
print('\nossos:', len(arm_data.bones))

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 7. Pele rígida: cada ilha inteira, peso 1, no osso da classe
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
OSSO_DA_CLASSE = {'casco': 'casco', 'deck': 'deck', 'radar': 'radar', 'guindaste_esq': 'guindaste_esq', 'guindaste_dir': 'guindaste_dir'}
grupos = {}
for il in ilhas:
    nome = OSSO_DA_CLASSE.get(il['osso'], il['osso'])
    grupos.setdefault(nome, []).extend(il['verts'])
for nome in arm_data.bones.keys():
    malha.vertex_groups.new(name=nome)
for nome, vs in grupos.items():
    malha.vertex_groups[nome].add(vs, 1.0, 'REPLACE')
malha.parent = arm
mod = malha.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
sem_peso = [v.index for v in me.vertices if not v.groups]
print('vértices sem osso:', len(sem_peso))

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 8. Cor nos vértices (um material, um desenho): amarelo de segurança no casco das pernas, aço escuro nas juntas, creme no convés, laranja nos guindastes;
#    peça pequena (trilho, tubo, cabo) em aço escuro para dar contraste; sujeira que cresce para baixo e some nas faces de cima; variação leve por peça.
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
def linear(c):  # cor sRGB do desenho -> linear (o glTF guarda linear)
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def hexa(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))

PALETA = {
    'casco': hexa('#6f747a'),
    'deck': hexa('#d9d2b4'),
    'radar': hexa('#e8e8e8'),
    'guindaste': hexa('#d4542a'),
    'coxa': hexa('#e0a81f'),
    'canela': hexa('#3d4248'),
    'pe': hexa('#2b2f33'),
}
ACO_ESCURO = hexa('#3a3e43')

def base_da_ilha(il):
    o = il['osso']
    if o.startswith('guindaste'):
        return PALETA['guindaste']
    if '_' in o and o[:2] in PERNAS:
        return PALETA[o[3:]]
    return PALETA[o]

def varia(i):  # variação estável por peça (sem aleatório do sistema)
    h = (i * 2654435761) % 4294967296 / 4294967296
    return 0.92 + 0.16 * h

attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
me.color_attributes.active_color = attr
me.color_attributes.render_color_index = me.color_attributes.find('Col')
me.calc_loop_triangles()
normais = [v.normal for v in me.vertices]
for k, il in enumerate(ilhas):
    base = base_da_ilha(il)
    if il['n'] < 60 and il['osso'] in ('deck', 'casco'):
        base = tuple(0.55 * b + 0.45 * a for b, a in zip(base, ACO_ESCURO))
    v = varia(k)
    for i in il['verts']:
        z = me.vertices[i].co.z
        subida = max(0.0, min(1.0, z / max(altura, 1e-6)))
        sujeira = 0.62 + 0.38 * (subida ** 0.7)
        luz = 0.82 + 0.18 * max(0.0, normais[i].z)
        f = sujeira * luz * v
        r, g, b = linear(tuple(min(1.0, c * f) for c in base))
        attr.data[i].color = (r, g, b, 1.0)
print('cor nos vértices: pronta')

if PASTA_FOTOS:
    pass  # as fotos do resultado final saem da bancada do jogo (o render do jogo é o que importa)

# ------------------------------------------------------------------------------------------------------------------------------------------------------------
# 9. Exportação
# ------------------------------------------------------------------------------------------------------------------------------------------------------------
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
malha.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=SAIDA,
    export_format='GLB',
    export_yup=True,
    export_skins=True,
    export_animations=False,
    export_apply=False,
    export_morph=False,
    export_texcoords=False,
    export_vertex_color='ACTIVE',
    export_vertex_color_name='Col',
    export_all_vertex_colors=False,
    use_selection=True,
)
print('\nexportado:', SAIDA, f'({os.path.getsize(SAIDA) / 1024:.0f} KB)')
