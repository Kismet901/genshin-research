const API_BASE = "https://act-api-takumi-static.mihoyo.com/content_v2_user/app/16471662a82d418a";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";

const NEWS = [[719, "资讯"], [721, "公告"]];
const EVENT = 716;
const REGIONS = [
  ["蒙德", "Mondstadt", 727], ["璃月", "Liyue", 728], ["稻妻", "Inazuma", 729],
  ["须弥", "Sumeru", 730], ["枫丹", "Fontaine", 731], ["纳塔", "Natlan", 936],
  ["至冬", "Snezhnaya", 1219]
];

const extOf = (i) => { try { return JSON.parse(i.sExt || "{}"); } catch { return {}; } };
const first = (x) => (Array.isArray(x) && x.length ? x[0] : x);
const urlOf = (x) => { x = first(x); return x && typeof x === "object" ? (x.url || "") : (typeof x === "string" ? x : ""); };
const strip = (h) => (h ? h.replace(/<img[^>]*>/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() : "");

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Referer": "https://ys.mihoyo.com/" } });
  if (!r.ok) throw new Error("upstream " + r.status);
  return r.json();
}

async function fetchList(chan) {
  const q = new URLSearchParams({ iAppId: 43, iChanId: chan, iPageSize: 100, iPage: 1, sLangKey: "zh-cn" });
  return getJSON(`${API_BASE}/getContentList?${q}`);
}

export const respond = (o) => new Response(JSON.stringify(o), {
  headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }
});

export async function fetchAll() {
  const news = []; const seen = new Set();
  for (const [chan, kind] of NEWS) {
    const d = await fetchList(chan);
    for (const it of (d.data && d.data.list) || []) {
      if (seen.has(it.iInfoId)) continue; seen.add(it.iInfoId);
      const e = extOf(it);
      news.push({ id: it.iInfoId, title: it.sTitle || "", cover: urlOf(e["720_1"]) || urlOf(e["720_0"]), date: (it.dtCreateTime || it.dtStartTime || "").slice(0, 10), kind, intro: strip(it.sContent || it.sIntro).slice(0, 140), content: it.sContent || "" });
    }
  }
  news.sort((a, b) => (a.date < b.date ? 1 : -1));

  const characters = [];
  for (const [cn, en, chan] of REGIONS) {
    const d = await fetchList(chan);
    for (const it of (d.data && d.data.list) || []) {
      const e = extOf(it);
      characters.push({ name: it.sTitle || "", region: cn, region_en: en, portrait: urlOf(e["732_1"]) || urlOf(e["732_15"]), avatar: urlOf(e["732_0"]), nameart: urlOf(e["732_2"]) || urlOf(e["732_8"]), cv_cn: first(e["732_5"]) || "", cv_jp: first(e["732_6"]) || "", desc: strip(first(e["732_7"])), id: it.iInfoId });
    }
  }

  const events = [];
  const ed = await fetchList(EVENT);
  for (const it of (ed.data && ed.data.list) || []) {
    const e = extOf(it);
    events.push({ id: it.iInfoId, title: it.sTitle || "", cover: urlOf(e["716_0"]), date: (it.dtCreateTime || it.dtStartTime || "").slice(0, 10) });
  }

  return { news, characters, events };
}
