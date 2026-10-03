# 今天喝什麼 — 固定網址雲端版

源自 drink_rec Python 專案；雲端推論部署於 Sites / Cloudflare Workers，收藏保存於 D1。

- 原 Excel 1178 飲料、18 品牌，原始特徵、價格、營養欄位與來源列。
- A 使用匯出的相同 TF-IDF 索引；B 使用 40 輪訓練的 RelGT 向量、相同收藏平均向量與圖規則；A/B 前十候選與動態 min-max 融合。
- 本部署不執行 PyTorch 重訓。要更新模型，需在原 Python 專案重訓、匯出向量並重新部署。
- C 路徑停用；保留整份榜單換批與異質圖。
- Cookie 為高熵匿名恢復碼，D1 僅存 SHA-256；API 依 Cookie 取資料，不相信客戶端 user_id。
- 舊 32 筆收藏以識別碼雜湊保存於 server-only 資料，第一次讀取收藏時以 idempotent transaction 匯入 D1。舊 web_UUID 可用恢復功能接回，無法自動跨網域讀取舊瀏覽器資料。
- 新收藏永久存在 D1，瀏覽器 Cookie 有效期一年，保存恢復碼可跨瀏覽器恢復。
- lib/data 僅被伺服器匯入，未放入 public。原 SQLite 與 Excel 不受部署影響。

本地驗證：TypeScript、正式 build、API 預算篩選、全榜換批、收藏去重、使用者隔離、圖互動邊、恢復碼；並與 Python 原版比對排序。
