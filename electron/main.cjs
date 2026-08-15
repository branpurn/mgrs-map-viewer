const { app, BrowserWindow, shell, dialog } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 18764;
const searchApi = require("./search-api.cjs");
const ROOT = path.join(__dirname, "..", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function send(res, code, body, headers) {
  res.writeHead(code, headers || { "Content-Type": "text/plain" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (searchApi.maybeHandle(req, res)) return;
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let rel = url === "/" ? "/index.html" : url;
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return send(res, 403, "forbidden");
  fs.readFile(file, (err, data) => {
    if (err) {
      if (rel !== "/index.html") {
        return fs.readFile(path.join(ROOT, "index.html"), (e2, html) => {
          if (e2) return send(res, 404, "not found");
          send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
        });
      }
      return send(res, 404, "not found");
    }
    const ext = path.extname(file);
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
});

let mainWindow = null;

function createWindow() {
  const ICON = path.join(__dirname, "app-icon-512.png");
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 540,
    title: "MGRS Viewer",
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  win.removeMenu();
  win.setTitle("MGRS Viewer");
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL("http://127.0.0.1:" + PORT + "/");
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
}

function focusMain() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return true;
  }
  return false;
}

function existingAppIsOurs(cb) {
  const req = http.get("http://127.0.0.1:" + PORT + "/", (res) => {
    const ct = String(res.headers["content-type"] || "");
    let body = "";
    res.on("data", (chunk) => {
      if (body.length < 8000) body += chunk;
    });
    res.on("end", () => {
      cb(ct.indexOf("text/html") !== -1 && /MGRS Viewer|mgrs-map-viewer/i.test(body));
    });
  });
  req.on("error", () => cb(false));
  req.setTimeout(1000, () => {
    req.destroy();
    cb(false);
  });
}

function refuseBusyPort() {
  dialog.showErrorBox(
    "MGRS Viewer",
    "Port 18764 is already in use by another program, so the map cannot load.\n\nClose that program and double-click MGRS Viewer again."
  );
  app.quit();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!focusMain()) createWindow();
  });

  app.whenReady().then(() => {
    server.listen(PORT, "127.0.0.1", () => {
      createWindow();
    });
    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        existingAppIsOurs((ok) => {
          if (ok) createWindow();
          else refuseBusyPort();
        });
        return;
      }
      console.error(err);
      refuseBusyPort();
    });
  });
}

app.on("window-all-closed", () => {
  try { server.close(); } catch (e) {}
  app.quit();
});
