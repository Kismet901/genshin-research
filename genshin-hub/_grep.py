import io, sys
sys.stdout.reconfigure(encoding="utf-8")
s = open(r"D:\文件\genshin-hub\js\app.js", encoding="utf-8").read().split("\n")
keys = ["function openNewsModal", "function openCharModal", "function openEventModal",
        "function openSearchResult", "function scrollToStory", "function switchView",
        "function closeModal", "function openModal", 'data-open="event"',
        "openNewsModal(", "openCharModal(", "openEventModal(", 'switchView("search")',
        "openModal()", "openEventModalById"]
for i, l in enumerate(s, 1):
    if any(k in l for k in keys):
        print(i, l.rstrip())
