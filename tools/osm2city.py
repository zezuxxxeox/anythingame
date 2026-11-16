#!/usr/bin/env python3
"""오픈스트리트맵(.xml) → 게임 좌표의 도시 데이터(island/osm/<id>.js).
실제 도로 선형과 건물 윤곽을 1:1 축척 그대로 옮긴다. (c) OpenStreetMap contributors, ODbL"""
import xml.etree.ElementTree as ET, json, math, sys, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'island', 'osm')
# anchor: 실제 좌표 ↔ 게임 좌표, toward: 이 실제 지점 방향이 게임의 dir 방향이 되도록 회전, clip: 게임 좌표 사각형
CFG = {
  'reyk':   dict(anchor=(64.14170, -21.92655), game=(40, -395), toward=(64.14564, -21.93202), dir=(0, 1), clip=(-95, -432, 175, -150), levels=2),
  'kyoto':  dict(anchor=(34.99852, 135.77917), game=(222, 498), toward=(34.99852, 135.77700), dir=(0, 1), clip=(110, 440, 330, 640), levels=2, avoid=[(352, 528, 48), (280, 392, 52)]),
  'lisbon': dict(anchor=(38.71200, -9.13000), game=(-330, 412), toward=None, dir=(0, 1), clip=(-440, 340, -240, 480), levels=4, avoid=[(-255, 335, 64)]),
  'paris':  dict(anchor=(48.85837, 2.29448), game=(-150, 150), toward=(48.86050, 2.29900), dir=(-1, 0), clip=(-500, -40, -236, 330), levels=6),
  'firenze':dict(anchor=(43.77310, 11.25600), game=(0, 0), toward=None, dir=(0, 1), clip=(-400, -400, 400, 400), levels=4),
}
ROADW = {'primary': 7, 'secondary': 6.5, 'tertiary': 5.5, 'residential': 4.6, 'unclassified': 4.6, 'living_street': 4.2, 'pedestrian': 4.2, 'service': 3, 'footway': 1.8, 'path': 1.5, 'steps': 2, 'cycleway': 1.6}
def conv(id):
    c = CFG[id]; r = ET.parse(os.path.join(ROOT, id + '.xml')).getroot()
    la0, lo0 = c['anchor']; kx = 111320 * math.cos(math.radians(la0)); kz = 110540
    raw = lambda la, lo: ((lo - lo0) * kx, -(la - la0) * kz)
    th = 0
    if c['toward']:
        vx, vz = raw(*c['toward']); th = math.atan2(c['dir'][1], c['dir'][0]) - math.atan2(vz, vx)
    cs, sn = math.cos(th), math.sin(th); gx, gz = c['game']
    def P(la, lo):
        x, z = raw(la, lo); return (round(gx + x * cs - z * sn, 1), round(gz + x * sn + z * cs, 1))
    N = {n.get('id'): P(float(n.get('lat')), float(n.get('lon'))) for n in r.findall('node')}
    x0, z0, x1, z1 = c['clip']; av = c.get('avoid', []); inside = lambda p: x0 <= p[0] <= x1 and z0 <= p[1] <= z1 and not any(math.hypot(p[0] - a[0], p[1] - a[1]) < a[2] for a in av)
    tags = lambda e: {t.get('k'): t.get('v') for t in e.findall('tag')}
    ways = {w.get('id'): w for w in r.findall('way')}
    pts = lambda w: [N[n.get('ref')] for n in w.findall('nd') if n.get('ref') in N]
    out = dict(b=[], r=[], w=[], g=[], t=[], n=[], th=round(th, 4))
    relb = {}
    for rel in r.findall('relation'):
        t = tags(rel)
        if 'building' in t or t.get('natural') == 'water' or t.get('leisure') in ('park', 'garden'):
            for m in rel.findall('member'):
                if m.get('type') == 'way' and m.get('role') in ('outer', '') and m.get('ref') in ways: relb[m.get('ref')] = t
    def num(v, d):
        try: return float(str(v).split(';')[0].replace('m', '').strip())
        except Exception: return d
    for wid, w in ways.items():
        t = tags(w); p = pts(w)
        if len(p) < 2: continue
        t2 = relb.get(wid, {})
        if 'building' in t or 'building' in t2:
            tt = dict(t2); tt.update(t)
            if tt.get('building') in ('roof',) or tt.get('location') == 'underground' or len(p) < 4: continue
            if p[0] == p[-1]: p = p[:-1]
            cx = sum(q[0] for q in p) / len(p); cz = sum(q[1] for q in p) / len(p)
            if not inside((cx, cz)): continue
            area = abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))) / 2
            if area < 12: continue
            lv = num(tt.get('building:levels'), 0); ht = num(tt.get('height'), 0)
            out['b'].append([lv, round(ht, 1), tt.get('name', '') if tt.get('name') else 0, tt.get('amenity') or tt.get('tourism') or tt.get('shop') or tt.get('building') if tt.get('building') in ('church', 'cathedral', 'temple', 'shrine', 'pagoda', 'chapel') or tt.get('amenity') or tt.get('tourism') else 0] + [v for q in p for v in q])
        elif 'highway' in t and t['highway'] in ROADW and t.get('tunnel') != 'yes' and t.get('area') != 'yes':
            seg = []
            for q in p:
                if inside(q): seg.append(q)
                else:
                    if len(seg) > 1: out['r'].append([t['highway'], num(t.get('width'), ROADW[t['highway']]), t.get('name', 0) or 0, t.get('surface', 0) or 0] + [v for s in seg for v in s])
                    seg = []
            if len(seg) > 1: out['r'].append([t['highway'], num(t.get('width'), ROADW[t['highway']]), t.get('name', 0) or 0, t.get('surface', 0) or 0] + [v for s in seg for v in s])
        elif (t.get('highway') == 'pedestrian' and t.get('area') == 'yes') or t.get('place') == 'square':
            if any(inside(q) for q in p): out['g'].append(['plaza'] + [v for q in p for v in q])
        elif t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t2.get('natural') == 'water':
            if any(inside(q) for q in p): out['w'].append([v for q in p for v in q])
        elif t.get('leisure') in ('park', 'garden') or t.get('landuse') in ('grass', 'cemetery') or t2.get('leisure') in ('park', 'garden'):
            if any(inside(q) for q in p): out['g'].append(['park'] + [v for q in p for v in q])
        elif t.get('barrier') in ('wall', 'fence', 'retaining_wall', 'hedge') and len(p) >= 2:
            seg = [q for q in p if inside(q)]
            if len(seg) > 1: out['n'].append([t['barrier']] + [v for s in seg for v in s])
    for n in r.findall('node'):
        t = tags(n)
        if not t: continue
        p = N[n.get('id')]
        if not inside(p): continue
        k = 'tree' if t.get('natural') == 'tree' else t.get('amenity') if t.get('amenity') in ('bench', 'waste_basket', 'fountain', 'vending_machine', 'post_box') else 'lamp' if t.get('highway') == 'street_lamp' else 'statue' if t.get('historic') in ('memorial', 'monument') or t.get('tourism') == 'artwork' else None
        if k: out['t'].append([k, p[0], p[1]])
    js = 'window.ISL = window.ISL || {}; ISL.OSM = ISL.OSM || {}; ISL.OSM.%s = %s;\n' % (id, json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    open(os.path.join(ROOT, id + '.js'), 'w').write('// 지도 데이터 (c) OpenStreetMap contributors, ODbL 1.0 — tools/osm2city.py 로 변환\n' + js)
    print(id, 'buildings', len(out['b']), 'roads', len(out['r']), 'areas', len(out['g']), 'water', len(out['w']), 'props', len(out['t']), 'walls', len(out['n']), 'bytes', len(js))
for id in sys.argv[1:] or ['reyk']: conv(id)
