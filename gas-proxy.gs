/* ============================================================
 * らくがきランド AIへんしんプロキシ (Google Apps Script)
 *
 * 役割:
 *   タブレット(PWA)から送られてきた落書き画像を受け取り、
 *   Claude API (Haiku) に渡して「名前・種類・動き方・コメント」を
 *   判定させ、JSONで返す。
 *
 *   APIキーはScript Propertiesに保管するため、公開されている
 *   PWA側のコードには一切露出しない(献立帖・栞と同じ構成)。
 *
 * ─────────────────────────────────────────────
 * セットアップ手順:
 *   1. script.google.com で新規プロジェクトを作成し、
 *      このコードを貼り付ける
 *   2. プロジェクトの設定(歯車アイコン) → スクリプト プロパティ →
 *      プロパティ「ANTHROPIC_API_KEY」に APIキーを設定
 *   3. デプロイ → 新しいデプロイ → 種類: ウェブアプリ
 *        - 実行ユーザー: 自分
 *        - アクセスできるユーザー: 全員
 *   4. 発行されたURL(https://script.google.com/macros/s/～/exec)を
 *      index.html の GAS_ENDPOINT に貼り付ける
 *   5. sw.js の CACHE_VERSION を1つ上げて、index.html と一緒に
 *      GitHubへ再アップロード
 * ============================================================ */

const MODEL = "claude-haiku-4-5"; // 画像対応の軽量モデル(低コスト)

const PROMPT = [
  "あなたは子供向けゲームのキャラクター判定AIです。",
  "添付画像は小さな子供がタブレットに描いた落書きです。",
  "以下のJSONオブジェクトだけを返してください。説明文やコードブロック記号は一切不要です。",
  "",
  '{"name": "ひらがな6文字以内のかわいい名前(絵の見た目に合わせる)",',
  ' "kind": "何の絵に見えるか(ひらがなで短く。例: いぬ、おばけ、くるま)",',
  ' "move": "hop / run / fly のどれか1つ。鳥・ちょうちょ・ロケットなど空を飛びそうならfly、車や足の速そうな動物ならrun、それ以外はhop",',
  ' "comment": "描いた子供に話しかける25文字以内のセリフ。ひらがな中心で、絵の具体的な特徴を1つ褒めること"}'
].join("\n");

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (!req.image) throw new Error("no image");

    const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");

    const payload = {
      model: MODEL,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: req.image } },
          { type: "text", text: PROMPT }
        ]
      }]
    };

    const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const data = JSON.parse(res.getContentText());
    if (data.error) throw new Error(data.error.message || "API error");

    // Claudeの返答テキストからJSONを取り出す(コードブロック混入対策)
    const txt = data.content[0].text.replace(/```json|```/g, "").trim();
    const out = JSON.parse(txt);

    // 念のためのバリデーション(想定外の値はデフォルトに寄せる)
    const result = {
      name: String(out.name || "").slice(0, 8),
      kind: String(out.kind || "").slice(0, 12),
      move: ["hop", "run", "fly"].indexOf(out.move) >= 0 ? out.move : "hop",
      comment: String(out.comment || "").slice(0, 40)
    };

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* 動作確認用: ブラウザでWebアプリURLを直接開くとこれが返る */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "らくがきランド AIプロキシは動作中です" }))
    .setMimeType(ContentService.MimeType.JSON);
}
