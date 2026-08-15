#!/bin/sh
# After each AppImage rebuild. No Nominatim / no Monument.
B=${1:-http://127.0.0.1:18764}
curl -sS -o /tmp/p-health.json -w "health %{http_code}\n" "$B/api/health"
curl -sS -o /tmp/p-empty.json -w "emptyq %{http_code}\n" "$B/api/search?q="
curl -sS -o /tmp/p-ws.json -w "whiteq %{http_code}\n" "$B/api/search?q=%20%20"
curl -sS -o /tmp/p-unrec.json -w "unrec %{http_code}\n" "$B/api/search?q=18SUJ23371"
curl -sS -o /tmp/p-badll.json -w "badll %{http_code}\n" "$B/api/search?q=91,0"
curl -sS -o /tmp/p-dms.json -w "dms %{http_code}\n" --get --data-urlencode "q=38°53'34\"N, 77°02'07\"W" "$B/api/search"
curl -sS -o /tmp/p-usng.json -w "usng %{http_code}\n" --get --data-urlencode "q=18S UJ 23371 06519" "$B/api/search"
curl -sS -o /tmp/p-mgrs.json -w "mgrs %{http_code}\n" "$B/api/search?q=18SUJ2337106519"
curl -sS -o /tmp/p-c0.json -w "prec0 %{http_code}\n" "$B/api/convert?lat=38.8895&lon=-77.0353&precision=0"
curl -sS -o /tmp/p-c3.json -w "prec3 %{http_code}\n" "$B/api/convert?lat=38.8895&lon=-77.0353&precision=3"
curl -sS -o /tmp/p-c4.json -w "prec4 %{http_code}\n" "$B/api/convert?lat=38.8895&lon=-77.0353&precision=4"
curl -sS -o /tmp/p-c6.json -w "prec6 %{http_code}\n" "$B/api/convert?lat=38.8895&lon=-77.0353&precision=6"
python3 - << 'PY'
import json
from pathlib import Path
def load(n):
    return json.loads(Path("/tmp/"+n).read_text())
e,w,u,b=load("p-empty.json"),load("p-ws.json"),load("p-unrec.json"),load("p-badll.json")
d,s,m=load("p-dms.json"),load("p-usng.json"),load("p-mgrs.json")
c0,c3,c4,c6=load("p-c0.json"),load("p-c3.json"),load("p-c4.json"),load("p-c6.json")
import re
ok = (
    e.get("ok") and e.get("results")==[] and
    w.get("ok") and w.get("results")==[] and
    u.get("error")=="unrecognized_query" and u.get("results")==[] and
    b.get("error")=="invalid_coordinates" and b.get("results")==[] and
    d.get("mgrs")=="18SUJ2348806846" and d.get("type")=="latlon" and
    s.get("mgrs")=="18SUJ2337106519" and s.get("type")=="usng" and
    (s.get("results") or [{}])[0].get("kind")=="usng" and
    m.get("mgrs")=="18SUJ2337106519" and m.get("type")=="mgrs" and
    (m.get("results") or [{}])[0].get("kind")=="mgrs" and
    c0.get("mgrs")=="18SUJ" and c3.get("mgrs")=="18SUJ234064" and
    c4.get("precision")==4 and c4.get("type")=="latlon" and
    bool(re.fullmatch(r"18SUJ\d{8}", str(c4.get("mgrs") or ""))) and
    c6.get("error")=="invalid_coordinates"
)
print("ok" if ok else "FAIL")
PY
