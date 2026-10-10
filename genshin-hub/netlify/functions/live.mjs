import { fetchAll, respond } from "./_shared/api.mjs";

export default async () => {
  try {
    const { news, characters, events } = await fetchAll();
    return respond({
      version: { version: "7.1", title: "往冥府的安魂歌", updated: new Date().toISOString().slice(0, 10) },
      news, characters, events,
      updated: new Date().toISOString()
    });
  } catch (err) {
    return respond({ error: String(err), news: [], characters: [], events: [], updated: new Date().toISOString() });
  }
};

export const config = { path: "/api/live" };
