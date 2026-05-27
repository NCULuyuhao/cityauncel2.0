# CityAuncel maintainability notes
# 檔案用途：輔助更新測站座標資料的 Python 腳本。
# 維護重點：此腳本用於輔助資料整理，執行前請先確認輸入/輸出路徑。

from pathlib import Path
import zipfile, shutil, csv, io
import geopandas as gpd
ROOT=Path('/mnt/data/work')
TMP=ROOT/'_station_shp'
TOWN_ZIP=Path('/mnt/data/鄉(鎮、市、區)界線1140318.zip')
CSV=ROOT/'frontend/public/data/water_quality_station_status_2025.csv'
VIEW_W, VIEW_H=380.0,300.0
PAD=12.0
if TMP.exists(): shutil.rmtree(TMP)
TMP.mkdir()
with zipfile.ZipFile(TOWN_ZIP) as z: z.extractall(TMP/'town')
town=gpd.read_file(TMP/'town'/'TOWN_MOI_1140318.shp')
town=town[town['COUNTYNAME']=='苗栗縣'].copy().to_crs(3826)
minx,miny,maxx,maxy=town.total_bounds
dx,dy=maxx-minx,maxy-miny
scale=min((VIEW_W-2*PAD)/dx,(VIEW_H-2*PAD)/dy)
content_w, content_h=dx*scale,dy*scale
offx,offy=(VIEW_W-content_w)/2,(VIEW_H-content_h)/2

def tr(x,y):
    return offx+(x-minx)*scale, offy+(maxy-y)*scale
text=CSV.read_text(encoding='utf-8-sig')
reader=csv.DictReader(io.StringIO(text))
rows=[]
for row in reader:
    try:
        x=float(row.get('twd97tm2x') or '')
        y=float(row.get('twd97tm2y') or '')
        sx,sy=tr(x,y)
        row['map_x']=f'{sx:.2f}'
        row['map_y']=f'{sy:.2f}'
    except Exception as e:
        print('skip', row.get('site_name'), e)
    rows.append(row)
out=io.StringIO()
writer=csv.DictWriter(out, fieldnames=reader.fieldnames)
writer.writeheader(); writer.writerows(rows)
CSV.write_text('\ufeff'+out.getvalue(), encoding='utf-8')
print('updated', len(rows), 'scale', scale, 'off', offx, offy)
print(rows[:3])
