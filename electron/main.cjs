const { app, BrowserWindow, shell, dialog } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 18764;
const searchApi = require("./search-api.cjs");
const ROOT = path.join(__dirname, "..", "dist");
const APP_URL = "http://127.0.0.1:" + PORT + "/";

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

function waitForLocalApp(tries, cb) {
  const req = http.get(APP_URL, (res) => {
    const ct = String(res.headers["content-type"] || "");
    let body = "";
    res.on("data", (chunk) => {
      if (body.length < 8000) body += chunk;
    });
    res.on("end", () => {
      const ok = res.statusCode === 200 && ct.indexOf("text/html") !== -1 && /MGRS Viewer|mgrs-map-viewer/i.test(body);
      if (ok) cb(true);
      else if (tries <= 1) cb(false);
      else setTimeout(() => waitForLocalApp(tries - 1, cb), 50);
    });
  });
  req.on("error", () => {
    if (tries <= 1) cb(false);
    else setTimeout(() => waitForLocalApp(tries - 1, cb), 50);
  });
  req.setTimeout(400, () => {
    req.destroy();
    if (tries <= 1) cb(false);
    else setTimeout(() => waitForLocalApp(tries - 1, cb), 50);
  });
}

function kickMapPaint(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const size = win.getSize();
    win.setSize(size[0], size[1] + 1);
    win.setSize(size[0], size[1]);
  } catch (e) {}
  win.webContents.executeJavaScript(
    "window.dispatchEvent(new Event('resize'));"
  ).catch(function () {});
}

function showWhenMapReady(win) {
  const js = [
    "new Promise(function (resolve) {",
    "  var start = Date.now();",
    "  var tick = function () {",
    "    var c = document.querySelector('#map canvas, .maplibregl-canvas');",
    "    if (c && c.width > 32 && c.height > 32) { resolve(true); return; }",
    "    if (Date.now() - start > 6000) { resolve(false); return; }",
    "    setTimeout(tick, 80);",
    "  };",
    "  tick();",
    "})",
  ].join("");
  win.webContents.executeJavaScript(js).catch(function () { return false; }).then(function () {
    if (win.isDestroyed()) return;
    kickMapPaint(win);
    if (!win.isVisible()) win.show();
    win.focus();
  });
}

function createWindow() {
  const ICON = path.join(__dirname, "app-icon-512.png");
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 540,
    title: "MGRS Viewer",
    icon: ICON,
    show: false,
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  win.removeMenu();
  win.setTitle("MGRS Viewer");
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  let tries = 0;
  const loadApp = function () {
    win.loadURL(APP_URL);
  };

  win.webContents.on("did-fail-load", function (_e, _code, _desc, _url, isMain) {
    if (!isMain) return;
    if (tries >= 8) return;
    tries += 1;
    setTimeout(loadApp, 120);
  });

  win.webContents.on("did-finish-load", function () {
    kickMapPaint(win);
    showWhenMapReady(win);
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  waitForLocalApp(40, function (ok) {
    if (!ok) {
      refuseBusyPort();
      return;
    }
    loadApp();
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
  waitForLocalApp(4, cb);
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
    if (!focusMain()) refuseBusyPort();
  });

  app.whenReady().then(() => {
    server.listen(PORT, "127.0.0.1", () => {
      createWindow();
    });
    server.on("error", (err) => {
      console.error(err);
      refuseBusyPort();
    });
  });
}

app.on("window-all-closed", () => {
  try { server.close(); } catch (e) {}
  app.quit();
});
