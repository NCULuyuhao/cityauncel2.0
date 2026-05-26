from pathlib import Path
import json, zipfile, shutil
import geopandas as gpd

ROOT = Path('/mnt/data/work')
DATA_DIR = ROOT / 'frontend' / 'src' / 'data'
TMP = ROOT / '_shp_source'
TOWN_ZIP = Path('/mnt/data/鄉(鎮、市、區)界線1140318.zip')
RIVER_ZIP = Path('/mnt/data/RIVERPOLY.zip')
VIEW_W, VIEW_H = 380.0, 300.0
PAD = 12.0

RIVER_SPECS = [
    {'id': 'gis-zhonggang', 'label': '中港溪', 'source_names': ['中港溪'], 'kind': 'river', 'label_x': 72, 'label_y': 42, 'anchor': 'end', 'width': 76},
    {'id': 'gis-nangang-miaoli', 'label': '南港溪(苗)', 'source_names': ['南港溪', '南港溪上游'], 'kind': 'stream', 'label_x': 256, 'label_y': 46, 'anchor': 'start', 'width': 92},
    {'id': 'gis-xihu', 'label': '西湖溪', 'source_names': ['西湖溪'], 'kind': 'river', 'label_x': 42, 'label_y': 112, 'anchor': 'end', 'width': 76},
    {'id': 'gis-houlong', 'label': '後龍溪', 'source_names': ['後龍溪'], 'kind': 'river', 'label_x': 250, 'label_y': 160, 'anchor': 'start', 'width': 76},
    {'id': 'gis-laozhuang', 'label': '老庄溪', 'source_names': ['老莊溪'], 'kind': 'stream', 'label_x': 42, 'label_y': 250, 'anchor': 'end', 'width': 76},
    {'id': 'gis-daan', 'label': '大安溪', 'source_names': ['大安溪'], 'kind': 'river', 'label_x': 238, 'label_y': 278, 'anchor': 'start', 'width': 76},
]

def fmt(n: float) -> str:
    s = f"{n:.3f}".rstrip('0').rstrip('.')
    return '0' if s == '-0' else s

def extract_sources():
    if TMP.exists(): shutil.rmtree(TMP)
    TMP.mkdir()
    with zipfile.ZipFile(TOWN_ZIP) as z: z.extractall(TMP / 'town')
    with zipfile.ZipFile(RIVER_ZIP) as z: z.extractall(TMP / 'river')
    return TMP / 'town' / 'TOWN_MOI_1140318.shp', TMP / 'river' / 'riverpoly' / 'riverpoly.shp'

def read_prepare(town_shp, river_shp):
    town = gpd.read_file(town_shp)
    town = town[town['COUNTYNAME'] == '苗栗縣'].copy()
    town = town.to_crs(3826)
    town['geometry'] = town.geometry.make_valid()
    town = town[['TOWNNAME', 'geometry']].sort_values('TOWNNAME').reset_index(drop=True)
    miaoli_union = town.geometry.union_all().buffer(0)
    river = gpd.read_file(river_shp).to_crs(3826)
    river['geometry'] = river.geometry.make_valid()
    river = river[river.intersects(miaoli_union)].copy()
    river['geometry'] = river.geometry.intersection(miaoli_union).make_valid()
    river = river[~river.geometry.is_empty].copy()
    return town, river

def build_transform(bounds):
    minx, miny, maxx, maxy = bounds
    dx, dy = maxx - minx, maxy - miny
    scale = min((VIEW_W - 2*PAD)/dx, (VIEW_H - 2*PAD)/dy)
    content_w, content_h = dx*scale, dy*scale
    offx, offy = (VIEW_W-content_w)/2, (VIEW_H-content_h)/2
    def tr(pt):
        x,y = pt[0], pt[1]
        return offx + (x-minx)*scale, offy + (maxy-y)*scale
    return tr, dict(minx=minx,miny=miny,maxx=maxx,maxy=maxy,scale=scale,offsetX=offx,offsetY=offy)

def ring_path(coords, tr):
    pts = [tr(p) for p in coords]
    if len(pts) < 2: return ''
    out = [f"M{fmt(pts[0][0])},{fmt(pts[0][1])}"]
    out.extend(f"L{fmt(x)},{fmt(y)}" for x,y in pts[1:])
    out.append('Z')
    return ''.join(out)

def geom_to_paths(geom, tr):
    if geom is None or geom.is_empty: return []
    gt = geom.geom_type
    paths=[]
    if gt == 'Polygon':
        d = ring_path(list(geom.exterior.coords), tr)
        for interior in geom.interiors:
            d += ring_path(list(interior.coords), tr)
        if d: paths.append(d)
    elif gt == 'MultiPolygon':
        for part in geom.geoms: paths.extend(geom_to_paths(part, tr))
    elif gt == 'GeometryCollection':
        for part in geom.geoms: paths.extend(geom_to_paths(part, tr))
    return paths

def point_xy(geom, tr):
    p = geom.representative_point()
    x,y = tr((p.x,p.y))
    return round(x,3), round(y,3)

def main():
    town_shp, river_shp = extract_sources()
    town, river = read_prepare(town_shp, river_shp)
    tr, meta = build_transform(town.total_bounds)
    towns=[]
    for _, row in town.iterrows():
        paths = geom_to_paths(row.geometry, tr)
        if not paths: continue
        x,y = point_xy(row.geometry, tr)
        towns.append({'name': row.TOWNNAME, 'd': ''.join(paths), 'cx': x, 'cy': y})
    rivers=[]
    for spec in RIVER_SPECS:
        sel = river[river['RIVER_NAME'].isin(spec['source_names'])].copy()
        if sel.empty:
            print('WARNING missing river', spec['label']); continue
        geom = sel.geometry.union_all().buffer(0)
        paths = geom_to_paths(geom, tr)
        if not paths: continue
        x,y = point_xy(geom, tr)
        label_dx = round(spec['label_x'] - x, 3)
        label_dy = round(spec['label_y'] - y, 3)
        rivers.append({
            'id': spec['id'], 'label': spec['label'], 'kind': spec['kind'], 'sourceNames': spec['source_names'],
            'paths': paths, 'x': x, 'y': y, 'labelDx': label_dx, 'labelDy': label_dy,
            'labelAnchor': spec['anchor'], 'labelWidth': spec['width']
        })
    dedicated_ts = '''export type WaterRpiMiaoliTownRegion = {\n  name: string;\n  d: string;\n  cx: number;\n  cy: number;\n};\n\nexport const WATER_RPI_DEDICATED_VIEW_BOX = "0 0 380 300";\n\n// 由「鄉(鎮、市、區)界線1140318.zip」的 TOWN_MOI_1140318.shp 重新產生。\n// 處理流程：篩選 COUNTYNAME=苗栗縣，轉成 EPSG:3826，並與 RIVERPOLY 使用同一組 bounds / scale / offset 輸出 SVG。\nexport const WATER_RPI_MIAOLI_TOWN_REGIONS = %s satisfies WaterRpiMiaoliTownRegion[];\n''' % json.dumps(towns, ensure_ascii=False, separators=(',', ':'))
    river_ts = '''// 由 RIVERPOLY.zip / riverpoly.shp 轉換而來，並與 RPI 專用苗栗鄉鎮 SHP 使用同一組 SVG 座標基準。\n// 處理流程：鄉鎮 SHP 與河川 SHP 先統一到 EPSG:3826，再以苗栗縣鄉鎮總邊界 bounds 作為唯一基準。\n// 前端只負責顯示，不再額外修正河川座標。\n\nexport type WaterRpiGisRiverShape = {\n  id: string;\n  label: string;\n  kind: "river" | "stream";\n  sourceNames: string[];\n  paths: string[];\n  x: number;\n  y: number;\n  labelDx: number;\n  labelDy: number;\n  labelAnchor: "start" | "middle" | "end";\n  labelWidth: number;\n};\n\nexport const WATER_RPI_GIS_RIVER_SHAPES = %s satisfies WaterRpiGisRiverShape[];\n''' % json.dumps(rivers, ensure_ascii=False, separators=(',', ':'))
    common_ts = '''export type MiaoliPreciseTownRegion = {\n  name: string;\n  d: string;\n  cx: number;\n  cy: number;\n};\n\n// 共用苗栗互動地圖資料。\n// 由「鄉(鎮、市、區)界線1140318.zip」的 TOWN_MOI_1140318.shp 重新產生，\n// 並改用與河川水質 RPI 專用地圖完全相同的 EPSG:3826 / bounds / scale / offset。\nexport const MIAOLI_WATER_BASEMAP_SRC = "/images/miaoli-shp-basemap.svg";\n\nexport const MIAOLI_PRECISE_TOWN_REGIONS = %s satisfies MiaoliPreciseTownRegion[];\n\nconst MIAOLI_WATER_GEO_TRANSFORM = {\n  minX: %.12f,\n  maxY: %.12f,\n  scale: %.15f,\n  offsetX: %.12f,\n  offsetY: %.12f,\n};\n\n// 共用地圖現在使用 EPSG:3826 SVG 座標；此函式保留給舊呼叫點，但目前專案未使用。\nexport function projectMiaoliLonLatToSelectorMap(longitude: number, latitude: number) {\n  return {\n    x: longitude,\n    y: latitude,\n  };\n}\n''' % (json.dumps(towns, ensure_ascii=False, separators=(',', ':')), meta['minx'], meta['maxy'], meta['scale'], meta['offsetX'], meta['offsetY'])
    (DATA_DIR / 'waterRpiDedicatedMapData.ts').write_text(dedicated_ts, encoding='utf-8')
    (DATA_DIR / 'waterRpiGisRiverShapes.ts').write_text(river_ts, encoding='utf-8')
    (DATA_DIR / 'miaoliPreciseWaterMap.ts').write_text(common_ts, encoding='utf-8')
    print('Generated', len(towns), 'towns', len(rivers), 'rivers')
    print(meta)
    for r in rivers: print(r['label'], 'anchor', r['x'], r['y'], 'label dxdy', r['labelDx'], r['labelDy'])

if __name__ == '__main__':
    main()
