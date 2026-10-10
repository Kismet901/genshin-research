# -*- coding: utf-8 -*-
"""提瓦特纪行 · 本地服务器
- 托管静态站点
- /api/live 实时抓取原神官网数据（服务端代理，避免跨域），带 5 分钟缓存
运行: python server.py [端口]
"""
import gzip
import json
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000

API_BASE = "https://act-api-takumi-static.mihoyo.com/content_v2_user/app/16471662a82d418a"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

NEWS_CHANNELS = [("news_latest", 719, "资讯"), ("news_notice", 721, "公告")]
EVENT_CHANNEL = 716
CHAR_REGIONS = [
    ("蒙德", "Mondstadt", 727), ("璃月", "Liyue", 728), ("稻妻", "Inazuma", 729),
    ("须弥", "Sumeru", 730), ("枫丹", "Fontaine", 731), ("纳塔", "Natlan", 936),
    ("至冬", "Snezhnaya", 1219),
]

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
}


def _ctx():
    c = ssl.create_default_context()
    c.check_hostname = False
    c.verify_mode = ssl.CERT_NONE
    return c


def http_get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://ys.mihoyo.com/"})
    with urllib.request.urlopen(req, timeout=timeout, context=_ctx()) as r:
        data = r.read()
        if r.headers.get("Content-Encoding", "") == "gzip":
            data = gzip.decompress(data)
        return data


def fetch_list(chan):
    q = urllib.parse.urlencode({"iAppId": 43, "iChanId": chan, "iPageSize": 100, "iPage": 1, "sLangKey": "zh-cn"})
    return json.loads(http_get(f"{API_BASE}/getContentList?{q}"))


def _ext(item):
    try:
        return json.loads(item.get("sExt") or "{}")
    except Exception:
        return {}


def _first(x):
    if isinstance(x, list) and x:
        return x[0]
    return x


def _url(x):
    x = _first(x)
    return x.get("url", "") if isinstance(x, dict) else (x if isinstance(x, str) else "")


def _strip(h):
    if not h:
        return ""
    import re
    h = re.sub(r"<img[^>]*>", "", h)
    h = re.sub(r"<[^>]+>", "", h)
    h = h.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
    return re.sub(r"\s+", " ", h).strip()


def _cover(html):
    import re
    m = re.search(r'<img[^>]+src="([^"]+)"', html or "")
    return m.group(1) if m else ""


def load_json(name):
    p = os.path.join(ROOT, "data", name)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def search_live(q):
    import re
    data = get_live()
    ql = (q or "").lower().strip()
    if not ql:
        return {"results": [], "updated": data.get("updated", "")}
    terms = [t for t in re.split(r"\s+", ql) if t]
    results = []
    def hit(text):
        t = (text or "").lower()
        return all(x in t for x in terms)
    for n in data.get("news", []):
        if hit((n.get("title") or "") + " " + (n.get("intro") or "") + " " + (n.get("kind") or "")):
            results.append({"type": "新闻", "title": n.get("title"), "snippet": (n.get("intro") or "")[:100], "cover": n.get("cover") or "", "id": n.get("id")})
    for c in data.get("characters", []):
        if hit((c.get("name") or "") + " " + (c.get("region") or "") + " " + (c.get("region_en") or "") + " " + (c.get("cv_cn") or "") + " " + (c.get("cv_jp") or "") + " " + (c.get("desc") or "")):
            results.append({"type": "角色", "title": c.get("name"), "snippet": (c.get("region") or "") + " · " + ((c.get("cv_cn") or c.get("cv_jp")) or ""), "cover": (c.get("portrait") or c.get("avatar") or ""), "id": c.get("name")})
    for e in data.get("events", []):
        if hit((e.get("title") or "") + " 活动"):
            results.append({"type": "活动", "title": e.get("title"), "snippet": e.get("date") or "", "cover": e.get("cover") or "", "id": e.get("id")})
    story = load_json("story.json")
    for n in story.get("nations", []) or []:
        if hit((n.get("name") or "") + " " + (n.get("en") or "") + " " + (n.get("element") or "") + " " + (n.get("archon") or "") + " " + (n.get("summary") or "")):
            results.append({"type": "故事", "title": n.get("name"), "snippet": (n.get("en") or "") + " · " + (n.get("element") or "") + " · " + (n.get("archon") or ""), "cover": "", "target": "n_" + n.get("name", "")})
    for f in story.get("factions", []) or []:
        if hit((f.get("name") or "") + " " + (f.get("text") or "")):
            results.append({"type": "故事", "title": f.get("name"), "snippet": f.get("text") or "", "cover": "", "target": "f_" + f.get("name", "")})
    reviews = load_json("reviews.json")
    for r in reviews.get("reviews", []) or []:
        if hit((r.get("title") or "") + " " + (r.get("theme") or "") + " " + (r.get("text") or "")):
            results.append({"type": "评价", "title": r.get("title"), "snippet": (r.get("theme") or "") + " · " + (r.get("text") or ""), "cover": "", "id": r.get("title")})
    return {"results": results, "updated": data.get("updated", "")}


def build_live():
    news = []
    seen = set()
    for _name, chan, kind in NEWS_CHANNELS:
        d = fetch_list(chan)
        for it in (d.get("data") or {}).get("list") or []:
            iid = it.get("iInfoId")
            if iid in seen:
                continue
            seen.add(iid)
            e = _ext(it)
            news.append({
                "id": iid,
                "title": it.get("sTitle", ""),
                "cover": _url(e.get("720_1")) or _url(e.get("720_0")) or _cover(it.get("sContent")),
                "date": (it.get("dtCreateTime") or it.get("dtStartTime") or "")[:10],
                "kind": kind,
                "intro": _strip(it.get("sContent") or it.get("sIntro"))[:140],
                "content": it.get("sContent", ""),
            })
    news.sort(key=lambda x: x["date"], reverse=True)

    characters = []
    for cn, en, chan in CHAR_REGIONS:
        d = fetch_list(chan)
        for it in (d.get("data") or {}).get("list") or []:
            e = _ext(it)
            characters.append({
                "name": it.get("sTitle", ""),
                "region": cn, "region_en": en,
                "portrait": _url(e.get("732_1")) or _url(e.get("732_15")),
                "avatar": _url(e.get("732_0")),
                "nameart": _url(e.get("732_2")) or _url(e.get("732_8")),
                "cv_cn": _first(e.get("732_5")) or "",
                "cv_jp": _first(e.get("732_6")) or "",
                "desc": _strip(_first(e.get("732_7"))),
                "id": it.get("iInfoId"),
            })

    events = []
    d = fetch_list(EVENT_CHANNEL)
    for it in (d.get("data") or {}).get("list") or []:
        e = _ext(it)
        events.append({
            "id": it.get("iInfoId"),
            "title": it.get("sTitle", ""),
            "cover": _url(e.get("716_0")) or _cover(it.get("sContent")),
            "date": (it.get("dtCreateTime") or it.get("dtStartTime") or "")[:10],
        })

    version = {"updated": time.strftime("%Y-%m-%d")}
    vp = os.path.join(ROOT, "data", "version.json")
    if os.path.exists(vp):
        try:
            with open(vp, encoding="utf-8") as f:
                version = json.load(f)
        except Exception:
            pass

    return {"updated": time.strftime("%Y-%m-%d %H:%M:%S"), "version": version, "news": news, "characters": characters, "events": events}


_CACHE = {"data": None, "ts": 0}
CACHE_TTL = 300  # 5 分钟


def get_live():
    now = time.time()
    if _CACHE["data"] and now - _CACHE["ts"] < CACHE_TTL:
        return _CACHE["data"]
    try:
        data = build_live()
        _CACHE["data"] = data
        _CACHE["ts"] = now
    except Exception as e:
        if not _CACHE["data"]:
            return {"error": str(e), "updated": time.strftime("%Y-%m-%d %H:%M:%S")}
    return _CACHE["data"]


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/live":
            body = json.dumps(get_live(), ensure_ascii=False).encode("utf-8")
            self._send(200, body, "application/json; charset=utf-8")
            return

        if path == "/api/search":
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            q = qs.get("q", [""])[0]
            body = json.dumps(search_live(q), ensure_ascii=False).encode("utf-8")
            self._send(200, body, "application/json; charset=utf-8")
            return

        # static

        # static
        rel = "index.html" if path in ("/", "/index.html") else path.lstrip("/")
        rel = urllib.parse.unquote(rel)
        fp = os.path.normpath(os.path.join(ROOT, rel))
        if not fp.startswith(ROOT) or not os.path.isfile(fp):
            self._send(404, b"Not Found", "text/plain; charset=utf-8")
            return
        ext = os.path.splitext(fp)[1].lower()
        with open(fp, "rb") as f:
            self._send(200, f.read(), MIME.get(ext, "application/octet-stream"))

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    global PORT
    if len(sys.argv) > 1:
        PORT = int(sys.argv[1])
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print("提瓦特纪行已启动：", url)
    print("按 Ctrl+C 停止服务")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
