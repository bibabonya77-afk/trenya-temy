"use strict";
// Офлайн-режим «треня темы». Версия меняется автоматически при каждой сборке.
const CACHE = "trenya-a75a307a9c";
const PRECACHE = ["./", "app.js?v=a75a307a9c", "apple-touch-icon.png", "data.js?v=a75a307a9c", "img/armejskij-zhim-anim.svg", "img/armejskij-zhim-how.svg", "img/armejskij-zhim.svg", "img/favicon.svg", "img/francuzskij-zhim-anim.svg", "img/francuzskij-zhim-how.svg", "img/francuzskij-zhim.svg", "img/goblet-prised-anim.svg", "img/goblet-prised-how.svg", "img/goblet-prised.svg", "img/icon-192.png", "img/icon-512.png", "img/kikbek-anim.svg", "img/kikbek-how.svg", "img/kikbek.svg", "img/mahi-nogami-anim.svg", "img/mahi-nogami-how.svg", "img/mahi-nogami.svg", "img/mahi-v-storony-anim.svg", "img/mahi-v-storony-how.svg", "img/mahi-v-storony.svg", "img/molotki-anim.svg", "img/molotki-how.svg", "img/molotki.svg", "img/naklony-v-storony-anim.svg", "img/naklony-v-storony-how.svg", "img/naklony-v-storony.svg", "img/naklony-vpered-anim.svg", "img/naklony-vpered-how.svg", "img/naklony-vpered.svg", "img/podem-dlinnoj-na-biceps-anim.svg", "img/podem-dlinnoj-na-biceps-how.svg", "img/podem-dlinnoj-na-biceps.svg", "img/podem-na-biceps-anim.svg", "img/podem-na-biceps-how.svg", "img/podem-na-biceps.svg", "img/podem-na-noski-anim.svg", "img/podem-na-noski-how.svg", "img/podem-na-noski.svg", "img/podem-pered-soboj-anim.svg", "img/podem-pered-soboj-how.svg", "img/podem-pered-soboj.svg", "img/prised-bez-vesa-anim.svg", "img/prised-bez-vesa-how.svg", "img/prised-bez-vesa.svg", "img/prised-s-dlinnoj-anim.svg", "img/prised-s-dlinnoj-how.svg", "img/prised-s-dlinnoj.svg", "img/pullover-anim.svg", "img/pullover-how.svg", "img/pullover.svg", "img/rastyazhka-bedra-sidya-anim.svg", "img/rastyazhka-bedra-sidya-how.svg", "img/rastyazhka-bedra-sidya.svg", "img/rastyazhka-kvadricepsa-anim.svg", "img/rastyazhka-kvadricepsa-how.svg", "img/rastyazhka-kvadricepsa.svg", "img/rastyazhka-plecha-anim.svg", "img/rastyazhka-plecha-how.svg", "img/rastyazhka-plecha.svg", "img/rastyazhka-tricepsa-anim.svg", "img/rastyazhka-tricepsa-how.svg", "img/rastyazhka-tricepsa.svg", "img/razgibanie-iz-za-golovy-anim.svg", "img/razgibanie-iz-za-golovy-how.svg", "img/razgibanie-iz-za-golovy.svg", "img/razminka-ruki-anim.svg", "img/razminka-ruki-how.svg", "img/razminka-ruki.svg", "img/razvodka-lezha-anim.svg", "img/razvodka-lezha-how.svg", "img/razvodka-lezha.svg", "img/rumynskaya-tyaga-anim.svg", "img/rumynskaya-tyaga-how.svg", "img/rumynskaya-tyaga.svg", "img/shragi-anim.svg", "img/shragi-how.svg", "img/shragi.svg", "img/skruchivaniya-s-gantelej-anim.svg", "img/skruchivaniya-s-gantelej-how.svg", "img/skruchivaniya-s-gantelej.svg", "img/tyaga-dlinnoj-v-naklone-anim.svg", "img/tyaga-dlinnoj-v-naklone-how.svg", "img/tyaga-dlinnoj-v-naklone.svg", "img/tyaga-gantelej-v-naklone-anim.svg", "img/tyaga-gantelej-v-naklone-how.svg", "img/tyaga-gantelej-v-naklone.svg", "img/tyaga-k-podborodku-anim.svg", "img/tyaga-k-podborodku-how.svg", "img/tyaga-k-podborodku.svg", "img/vypady-anim.svg", "img/vypady-how.svg", "img/vypady.svg", "img/yagodichnyj-most-anim.svg", "img/yagodichnyj-most-how.svg", "img/yagodichnyj-most.svg", "img/zhim-dlinnoj-lezha-anim.svg", "img/zhim-dlinnoj-lezha-how.svg", "img/zhim-dlinnoj-lezha.svg", "img/zhim-gantelej-lezha-anim.svg", "img/zhim-gantelej-lezha-how.svg", "img/zhim-gantelej-lezha.svg", "img/zhim-gantelej-stoya-anim.svg", "img/zhim-gantelej-stoya-how.svg", "img/zhim-gantelej-stoya.svg", "manifest.webmanifest", "style.css?v=a75a307a9c"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("trenya-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // чужие запросы не трогаем

  if (req.mode === "navigate") {
    // Страница: сначала сеть (свежая версия), без сети — из кэша
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copy));
        }
        return res;
      }).catch(() => caches.match("./"))
    );
    return;
  }
  // Остальное: из кэша, иначе из сети
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
