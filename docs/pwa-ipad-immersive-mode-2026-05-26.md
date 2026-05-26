# iPad PWA 與沉浸模式調整紀錄

## 調整目的

iPad Safari 在使用 `document.documentElement.requestFullscreen()` 進入全螢幕後，如果學生點選文字輸入框並叫出系統鍵盤，瀏覽器可能會自動退出全螢幕。這不是單一元件錯誤，而是 iPadOS / Safari 對 Fullscreen API、虛擬鍵盤與輸入焦點的限制。

## 調整策略

- iPad / iPhone / iPadOS 偽裝成 Mac 的觸控裝置：不再呼叫瀏覽器 Fullscreen API。
- PWA / 加到主畫面 standalone 模式：不再呼叫瀏覽器 Fullscreen API。
- 以上裝置改用 CSS 的 `app-css-immersive-mode`，讓遊戲主容器固定鋪滿目前可用視窗。
- 非 Apple 觸控裝置與一般桌機：保留原本 `requestFullscreen()` 行為。

## 使用方式

學生使用 iPad 時建議：

1. 先用 Safari 開啟網站。
2. 點選分享。
3. 選擇「加入主畫面」。
4. 之後從主畫面圖示開啟。
5. 若再點「沉浸式體驗」，系統會啟用 CSS 沉浸模式，而不是瀏覽器全螢幕。

## 主要檔案

- `frontend/public/manifest.webmanifest`
- `frontend/index.html`
- `frontend/src/utils/displayMode.ts`
- `frontend/src/pages/AuthPage.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/styles/global.css`
