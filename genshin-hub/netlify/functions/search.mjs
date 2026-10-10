import { fetchAll, respond } from "./_shared/api.mjs";

export default async (req) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase();
  const updated = new Date().toISOString();
  try {
    if (!q) return respond({ results: [], updated });
    const { news, characters, events } = await fetchAll();
    const terms = q.split(/\s+/).filter(Boolean);
    const hit = (t) => terms.every((x) => (t || "").toLowerCase().includes(x));
    const results = [];

    for (const n of news) {
      if (hit(n.title + " " + (n.intro || "") + " " + n.kind)) {
        results.push({ type: "新闻", title: n.title, snippet: (n.intro || "").slice(0, 100), cover: n.cover, id: n.id });
      }
    }
    for (const c of characters) {
      if (hit(c.name + " " + c.region + " " + c.region_en + " " + (c.cv_cn || "") + " " + (c.cv_jp || "") + " " + (c.desc || ""))) {
        results.push({ type: "角色", title: c.name, snippet: c.region + " · " + (c.cv_cn || c.cv_jp || ""), cover: c.portrait || c.avatar, id: c.name });
      }
    }
    for (const e of events) {
      if (hit(e.title + " 活动")) {
        results.push({ type: "活动", title: e.title, snippet: e.date, cover: e.cover, id: e.id });
      }
    }
    return respond({ results, updated });
  } catch (err) {
    return respond({ results: [], updated });
  }
};

export const config = { path: "/api/search" };
