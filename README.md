# 今天喝什麼｜飲料推薦

飲料推薦網站目前部署在 Cloudflare Workers，網址：<https://drink-recommendation-relgt.rtx941031.workers.dev>。使用者可註冊、登入、依偏好取得推薦並保存收藏；推薦資料來自專案中的 Excel 匯出目錄與預先計算的圖及向量特徵。

## 本機開發

需要 Node.js 22.13 或更新版本。

```sh
npm install
npm run dev
```

## Cloudflare 部署

先登入具備此 Worker 和 D1 權限的 Cloudflare 帳號，再執行：

```sh
npx wrangler login
npm run deploy:cloudflare
```

Worker 與 D1 資料庫設定位於 `wrangler.jsonc`。首次設定管理後台密碼：

```sh
npm run admin:password
```

完整管理及資料備份說明請看 [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md)。

## 功能概覽

- 路徑 A：先套用結構化偏好限制，再以 TF-IDF 向量餘弦相似度進行檢索排序。
- 路徑 B：使用收藏歷史、預訓練 RelGT 向量及異質圖特徵排序。
- 異質圖頁面、整份推薦榜單換批、註冊登入、收藏與管理後台。
- 收藏和帳號驗證資料保存在 Cloudflare D1；密碼使用雜湊驗證，不儲存明文。

不要將 `.env*` 檔案、資料庫備份、Cloudflare API Token 或 Worker Secret 加入 Git。
