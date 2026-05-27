/**
 * CityAuncel maintainability notes
 * 檔案用途：啟動後端 HTTP 伺服器，並接上 app.js 建立好的 Express 應用程式。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
