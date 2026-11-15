r"""
Umaira Florist Atelier — Blender 5.x headless Python script
Creates a realistic red rose based on the reference image:
  image/flower_content/Red_Rose_3D_Modeling_Reference.png

Reference observations:
  - Bloom ~1/3 of total height; tight spiral centre, 5 layers of petals (~31 total)
  - Long straight stem with gentle S-lean; 6 reddish-brown thorns
  - 3 paired leaf sets (upper/mid/lower), each leaf serrated ovate shape
  - 5 narrow pointed sepals; compact green receptacle cup

Mesh-name convention expected by js/site-update.js applyRoseMaterials():
  rose_petal_0_N … rose_petal_4_N
  sepal_N         (N = 0..4)
  receptacle
  stem
  leaf_N          (N = 0..5)

Outputs:
  assets/models/Red_Rose_3D_Model.blend
  assets/models/Red_Rose_3D_Model.glb   ← website loads this

Run (PowerShell or Command Prompt):
  & "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python "C:\Users\baldo\Documents\MY SYSTEM\flower-shop\assets\models\create_rose.py"
"""

import bpy
import math
import os

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
BLEND_OUT   = os.path.join(SCRIPT_DIR, "Red_Rose_3D_Model.blend")
GLB_OUT     = os.path.join(SCRIPT_DIR, "Red_Rose_3D_Model.glb")

# ── scene helpers ─────────────────────────────────────────────────────────────
def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for c in list(bpy.data.curves):
        bpy.data.curves.remove(c, do_unlink=True)

def col():
    return bpy.context.scene.collection

def link(obj):
    col().objects.link(obj)
    return obj

def new_obj(name, verts, faces):
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.update()
    for p in m.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, m)
    link(obj)
    return obj

def subsurf(obj, v=2, r=3):
    mod = obj.modifiers.new('S', 'SUBSURF')
    mod.levels = v
    mod.render_levels = r
    mod.subdivision_type = 'CATMULL_CLARK'

# ── Principled BSDF materials ─────────────────────────────────────────────────
def make_mat(name, r, g, b, roughness=0.42, metallic=0.0, transmission=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out  = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value      = (r, g, b, 1.0)
    bsdf.inputs['Roughness'].default_value       = roughness
    bsdf.inputs['Metallic'].default_value        = metallic
    if 'Transmission' in bsdf.inputs:
        bsdf.inputs['Transmission'].default_value = transmission
    if alpha < 1.0:
        mat.blend_method = 'BLEND'
        bsdf.inputs['Alpha'].default_value = alpha
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

def assign(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

# ── petal builder ─────────────────────────────────────────────────────────────
# u runs across the petal width (-0.5 .. +0.5)
# v runs from base (0) to tip (1)
def petal_verts(
    width, height,
    ru=10, rv=14,          # grid resolution
    cup=0.0,               # cup: sides lift (+)
    top_curl=-0.15,        # top edge curls backward (<0 = forward/inward)
    base_pinch=0.55,       # how sharply the base narrows (0=none, 1=full)
    tip_taper=0.65,        # how much the tip tapers
    arch=0.06,             # forward bow of whole petal (positive = toward viewer)
    ruffle=0.0,            # edge waviness amplitude
    side_lean=0.0,         # whole petal leans left/right
):
    verts = []
    for iv in range(rv + 1):
        tv = iv / rv
        for iu in range(ru + 1):
            tu = iu / ru - 0.5   # -0.5 .. +0.5

            # Width envelope: narrow at base and tip, full in middle
            w_base  = math.sin(tv * math.pi) ** base_pinch
            w_tip   = 1.0 - tip_taper * (tv ** 3)
            w       = w_base * w_tip

            x = tu * width * w

            # Height
            y = tv * height

            # Cup: lateral edges rise
            z_cup  = cup * (abs(tu) * 2) ** 1.6 * (tv ** 0.5)

            # Top curl: tip bends backward/forward
            z_curl = top_curl * (tv ** 2.8)

            # Forward arch: petal bows toward viewer at middle
            z_arch = arch * math.sin(tv * math.pi)

            # Ruffle: small edge waviness (more at tip)
            z_ruf  = ruffle * math.sin(tu * math.pi * 7) * (tv ** 0.8)

            # Side lean
            z_lean = side_lean * tu * tv

            z = z_cup + z_curl + z_arch + z_ruf + z_lean
            verts.append((x, y, z))
    return verts

def petal_faces(ru, rv):
    f = []
    for iv in range(rv):
        for iu in range(ru):
            i0 = iv * (ru + 1) + iu
            i1 = i0 + 1
            i2 = i0 + ru + 1
            i3 = i2 + 1
            f.append((i0, i1, i3, i2))
    return f

def make_petal(name, **kw):
    ru = kw.pop('ru', 10)
    rv = kw.pop('rv', 14)
    verts = petal_verts(ru=ru, rv=rv, **kw)
    faces = petal_faces(ru, rv)
    obj = new_obj(name, verts, faces)
    subsurf(obj, 2, 3)
    return obj

def place(obj, center_z, az_deg, tilt_x_deg, tilt_y_deg, radius, scale=1.0, rot_base_z=0.0):
    obj.scale    = (scale, scale, scale)
    obj.rotation_euler = (
        math.radians(tilt_x_deg),
        math.radians(tilt_y_deg),
        math.radians(az_deg + rot_base_z)
    )
    az = math.radians(az_deg)
    obj.location = (radius * math.sin(az), -radius * math.cos(az), center_z)

# ── rose bloom ────────────────────────────────────────────────────────────────
# From the reference close-up:
#   Layer 0 (core):  5 petals, very narrow, tall, strong inward curl, almost closed
#   Layer 1 (inner): 5 petals, still tightly cupped, slight opening
#   Layer 2 (mid):   7 petals, clearly open cup shape
#   Layer 3 (outer): 8 petals, wide open, slight back-curl on edges
#   Layer 4 (guard): 6 petals, largest, fully open, edges curl back significantly
#
# Deterministic per-petal variation seed: sin(n*phi + layer) * amplitude
def _v(n, layer, amp):
    return math.sin(n * 2.618 + layer * 1.414) * amp

def build_bloom():
    golden = 137.508   # golden angle
    mats = {
        'inner':  make_mat('mat_petal_inner',  0.52, 0.04, 0.08, roughness=0.38),
        'mid':    make_mat('mat_petal_mid',    0.70, 0.07, 0.10, roughness=0.40),
        'outer':  make_mat('mat_petal_outer',  0.80, 0.10, 0.12, roughness=0.42),
    }

    # (name_prefix, count, width, height, cup, top_curl, base_pinch, tip_taper, arch, ruffle, radius, center_z, tilt_x, scale, mat_key)
    layers = [
        # 0 — core spiral (very tight, tall, inward curl)
        ('rose_petal_0', 5,  0.24, 0.72, 0.18, -0.32, 0.65, 0.55, 0.04, 0.005, 0.03, 0.70, -44, 0.68, 'inner'),
        # 1 — inner cup
        ('rose_petal_1', 6,  0.34, 0.80, 0.22, -0.22, 0.60, 0.50, 0.05, 0.008, 0.10, 0.56, -36, 0.78, 'inner'),
        # 2 — mid cup
        ('rose_petal_2', 7,  0.48, 0.88, 0.26, -0.10, 0.55, 0.45, 0.06, 0.012, 0.19, 0.42, -26, 0.88, 'mid'),
        # 3 — outer open
        ('rose_petal_3', 8,  0.64, 0.96, 0.28,  0.05, 0.50, 0.42, 0.08, 0.016, 0.30, 0.26, -16, 0.98, 'outer'),
        # 4 — guard petals (largest, fully open, back-curl)
        ('rose_petal_4', 6,  0.78, 1.04, 0.24,  0.14, 0.48, 0.38, 0.09, 0.020, 0.40, 0.08, -7,  1.08, 'outer'),
    ]

    all_petals = []
    for li, (prefix, count, pw, ph, cup, curl, bpinch, ttaper, arch, ruf, rad, cz, tilt, sc, mkey) in enumerate(layers):
        angle_offset = li * golden * 0.6
        for n in range(count):
            az = angle_offset + n * (360.0 / count)
            vv = _v(n, li, 1.0)
            obj = make_petal(
                '{0}_{1}'.format(prefix, n),
                width=pw * (1 + vv * 0.04),
                height=ph * (1 + vv * 0.03),
                cup=cup + vv * 0.02,
                top_curl=curl + vv * 0.015,
                base_pinch=bpinch,
                tip_taper=ttaper,
                arch=arch + vv * 0.01,
                ruffle=ruf,
                side_lean=vv * 0.025,
                ru=10, rv=14,
            )
            place(obj, cz, az, tilt + vv * 4.5, vv * 2.0, rad * (1 + vv * 0.06), sc)
            assign(obj, mats[mkey])
            all_petals.append(obj)

    return all_petals

# ── receptacle (calyx cup) ────────────────────────────────────────────────────
def build_receptacle():
    segs = 16
    # Profile: (z_offset_down, radius) — top to bottom
    profile = [
        (0.00, 0.26),
        (0.04, 0.24),
        (0.10, 0.28),
        (0.18, 0.26),
        (0.28, 0.22),
        (0.36, 0.17),   # transitions to stem
    ]
    verts, faces = [], []
    for zi, (zoff, r) in enumerate(profile):
        for si in range(segs):
            a = 2 * math.pi * si / segs
            verts.append((r * math.cos(a), r * math.sin(a), -zoff))

    for zi in range(len(profile) - 1):
        for si in range(segs):
            i0 = zi * segs + si
            i1 = zi * segs + (si + 1) % segs
            i2 = (zi + 1) * segs + (si + 1) % segs
            i3 = (zi + 1) * segs + si
            faces.append((i0, i1, i2, i3))

    # Bottom cap
    bc = len(verts)
    last_z = -profile[-1][0]
    verts.append((0, 0, last_z))
    bs = (len(profile) - 1) * segs
    for si in range(segs):
        faces.append((bs + si, bc, bs + (si + 1) % segs))

    obj = new_obj('receptacle', verts, faces)
    subsurf(obj, 2, 2)
    mat = make_mat('mat_receptacle', 0.17, 0.35, 0.09, roughness=0.52)
    assign(obj, mat)
    return obj

# ── sepals ────────────────────────────────────────────────────────────────────
def build_sepals():
    mat = make_mat('mat_sepal', 0.14, 0.32, 0.08, roughness=0.50)
    objs = []
    count = 5
    for n in range(count):
        az = n * (360.0 / count) + 18   # stagger vs petals
        obj = make_petal(
            'sepal_{0}'.format(n),
            width=0.11,
            height=0.52,
            cup=0.06,
            top_curl=0.04,
            base_pinch=0.70,
            tip_taper=0.70,
            arch=0.03,
            ruffle=0.004,
            side_lean=0.0,
            ru=6, rv=10,
        )
        place(obj, -0.08, az, -58, 0.0, 0.22, 0.88)
        assign(obj, mat)
        objs.append(obj)
    return objs

# ── stem ─────────────────────────────────────────────────────────────────────
# From the side view: nearly straight, very slight forward lean toward the viewer
# Height: ~5.6 units; radius tapers from 0.07 (top) to 0.085 (base)
def build_stem():
    segs   = 14
    n_rings = 28
    top_z  = -0.38
    bot_z  = -6.0

    verts, faces = [], []
    for ri in range(n_rings + 1):
        t = ri / n_rings
        z = top_z + (bot_z - top_z) * t
        # Gentle S-curve: slight offset in X (front-view no lean) and Y (side-view slight forward lean)
        bx = 0.06 * math.sin(t * math.pi) * 0.8
        by = 0.10 * math.sin(t * math.pi * 1.3) * t   # forward lean increases toward base
        r  = 0.062 + 0.022 * t                          # thickens toward base

        for si in range(segs):
            a = 2 * math.pi * si / segs
            verts.append((bx + r * math.cos(a), by + r * math.sin(a), z))

    for ri in range(n_rings):
        for si in range(segs):
            i0 = ri * segs + si
            i1 = ri * segs + (si + 1) % segs
            i2 = (ri + 1) * segs + (si + 1) % segs
            i3 = (ri + 1) * segs + si
            faces.append((i0, i1, i2, i3))

    # Bottom cap
    bc = len(verts)
    verts.append((0.04, 0.05, bot_z))
    bs = n_rings * segs
    for si in range(segs):
        faces.append((bs + si, bc, bs + (si + 1) % segs))

    obj = new_obj('stem', verts, faces)
    mat = make_mat('mat_stem', 0.17, 0.38, 0.09, roughness=0.55)
    assign(obj, mat)
    return obj

# ── thorn ─────────────────────────────────────────────────────────────────────
def make_thorn(name, r=0.032, h=0.16, segs=5):
    verts, faces = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        verts.append((r * math.cos(a), r * math.sin(a), 0.0))
    apex = len(verts)
    verts.append((0.0, 0.0, h))
    for i in range(segs):
        faces.append((i, (i + 1) % segs, apex))
    # base cap
    bc = len(verts)
    verts.append((0.0, 0.0, 0.0))
    for i in range(segs):
        faces.append((bc, (i + 1) % segs, i))
    obj = new_obj(name, verts, faces)
    mat = make_mat('mat_thorn', 0.30, 0.18, 0.08, roughness=0.60)
    assign(obj, mat)
    return obj

def build_thorns():
    # (stem_z, azimuth_deg, tilt outward from stem)
    thorn_data = [
        (-1.3, 45,  -42),
        (-1.9, 165, -42),
        (-2.5, 300, -42),
        (-3.1, 90,  -40),
        (-3.8, 215, -40),
        (-4.5, 330, -40),
    ]
    stem_r = 0.075
    objs = []
    for idx, (tz, az_deg, tilt) in enumerate(thorn_data):
        t = make_thorn('thorn_{0}'.format(idx))
        az = math.radians(az_deg)
        # Place on stem surface
        t.location = (stem_r * math.cos(az), stem_r * math.sin(az), tz)
        t.rotation_euler = (
            math.radians(tilt),
            0.0,
            az + math.radians(90)
        )
        objs.append(t)
    return objs

# ── leaves ────────────────────────────────────────────────────────────────────
# From reference: ovate leaves with serrated edges; 3 pairs (6 total)
# Each pair: two leaves at same height, opposite azimuths, fanning outward
def build_leaf(name, length=0.80, width=0.44, z=0.0, az_deg=0.0, droop=0.18, serr=True):
    ru, rv = 12, 16
    verts, faces = [], []

    for iv in range(rv + 1):
        tv = iv / rv       # 0=base, 1=tip
        for iu in range(ru + 1):
            tu = iu / ru - 0.5   # -0.5 .. +0.5

            # Ovate outline: widest at tv≈0.35, narrows to point at tip
            blade = math.sin(tv * math.pi) ** 0.55 * (1 - tv * 0.35)
            x = tu * width * blade

            y = tv * length

            # Midrib arch (leaf bows slightly upward in middle)
            z_arch = droop * math.sin(tv * math.pi) * (1 - abs(tu) * 1.6)
            z_arch = max(z_arch, 0.0)

            # Lateral droop: leaf droops on the sides
            z_cup = droop * 0.35 * (abs(tu) * 2) ** 1.4 * (tv ** 0.6)

            # Serration: small waviness along the edge (more at sides)
            z_serr = 0.0
            if serr:
                edge_prox = abs(tu) * 2  # 0 at midrib, 1 at edge
                z_serr = 0.014 * edge_prox * math.sin(tv * 18.0 + tu * 10.0)

            verts.append((x, y, z_arch - z_cup + z_serr))

    for iv in range(rv):
        for iu in range(ru):
            i0 = iv * (ru + 1) + iu
            i1, i2, i3 = i0 + 1, i0 + ru + 1, i0 + ru + 2
            faces.append((i0, i1, i3, i2))

    obj = new_obj(name, verts, faces)
    az = math.radians(az_deg)
    # Offset from stem
    r = 0.09
    obj.location = (r * math.cos(az), r * math.sin(az), z)
    obj.rotation_euler = (math.radians(-55), 0.0, math.radians(az_deg))
    subsurf(obj, 1, 2)
    mat = make_mat('mat_leaf', 0.12, 0.33, 0.07, roughness=0.46)
    assign(obj, mat)
    return obj

def build_leaves():
    # (leaf_index, length, width, z_on_stem, az_deg)
    leaf_data = [
        (0, 0.72, 0.42, -1.5,  40),   # upper pair – right
        (1, 0.72, 0.42, -1.5, 220),   # upper pair – left
        (2, 0.84, 0.48, -2.9,  30),   # mid pair – right
        (3, 0.84, 0.48, -2.9, 210),   # mid pair – left
        (4, 0.90, 0.52, -4.3,  50),   # lower pair – right
        (5, 0.90, 0.52, -4.3, 230),   # lower pair – left
    ]
    return [build_leaf('leaf_{0}'.format(idx), length=l, width=w, z=z, az_deg=az)
            for idx, l, w, z, az in leaf_data]

# ── main ─────────────────────────────────────────────────────────────────────
def main():
    print("=== Umaira Florist — Building Red Rose from Reference ===")
    print("Reference: image/flower_content/Red_Rose_3D_Modeling_Reference.png")

    clear()

    petals     = build_bloom()
    receptacle = build_receptacle()
    sepals     = build_sepals()
    stem       = build_stem()
    thorns     = build_thorns()
    leaves     = build_leaves()

    total = len(petals) + 1 + len(sepals) + 1 + len(thorns) + len(leaves)
    print("Objects created: {0}  (petals={1}, sepals={2}, leaves={3}, thorns={4})".format(
        total, len(petals), len(sepals), len(leaves), len(thorns)))

    # ── Export GLB ──
    try:
        bpy.ops.export_scene.gltf(
            filepath=GLB_OUT,
            export_format='GLB',
            export_apply=True,
            export_animations=False,
            use_selection=False,
            export_yup=True,
        )
        print("GLB exported →", GLB_OUT)
    except Exception as e:
        print("Export error (try 1):", e)
        try:
            bpy.ops.export_scene.gltf(
                filepath=GLB_OUT,
                export_format='GLB',
                use_selection=False,
            )
            print("GLB exported (fallback) →", GLB_OUT)
        except Exception as e2:
            print("Export error (try 2):", e2)

    # ── Save .blend ──
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    print("Blend saved →", BLEND_OUT)
    print("=== Done ===")

main()
