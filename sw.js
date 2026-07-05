/* ============================================================
 * らくがきランド Service Worker
 *
 * 役割:
 *   初回アクセス時にアプリの全ファイルをキャッシュに保存し、
 *   2回目以降は「キャッシュ優先」で応答する。
 *   → 一度開けば、機内モード・圏外でも完全に動作する。
 *
 * 更新時の運用ルール(重要):
 *   index.html 等を修正して再デプロイするときは、
 *   必ず下の CACHE_VERSION の数字を上げること。
 *   (例: v1 → v2)
 *   これを忘れると、利用者には古いキャッシュが配られ続ける。
 * ============================================================ */

const CACHE_VERSION = "rakugaki-land-v4";

/* オフラインで動くために必要なファイル一覧(プリキャッシュ対象) */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

/* --- インストール: 全アセットをキャッシュへ --- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // 新バージョンを待機させず即座に有効化
  );
});

/* --- 有効化: 古いバージョンのキャッシュを削除 --- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim()) // 開いているタブにも即座に適用
  );
});

/* --- フェッチ: キャッシュ優先、なければネットワーク --- */
self.addEventListener("fetch", (event) => {
  // GET以外(POST等)はService Workerでは扱わない
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // 同一オリジンの正常応答は次回のためにキャッシュへ追加
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // オフラインで未キャッシュのページ遷移が来た場合はトップへ
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
