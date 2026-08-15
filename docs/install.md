# Install MGRS Viewer

For someone who does not write software. No Node. No make.

## Linux

1. Download [MGRS-Viewer-0.1.0-linux.AppImage](https://github.com/branpurn/mgrs-map-viewer/releases/tag/v0.1.0).
2. If double-click does nothing: right-click the file, open Properties, then Permissions, and turn on Allow executing file as program. (Some computers ask this the first time.)
3. Double-click the file.
4. A window named MGRS Viewer should open, with the grid icon. No web address bar.

## Windows

1. Download [MGRS-Viewer-0.1.0-win.zip](https://github.com/branpurn/mgrs-map-viewer/releases/tag/v0.1.0).
2. Unzip it.
3. Double-click `MGRS Viewer.exe`.

## Mac

1. Download the file for your Mac from the [release page](https://github.com/branpurn/mgrs-map-viewer/releases/tag/v0.1.0):
   - `MGRS-Viewer-0.1.0-mac-arm64.zip` — Macs from 2020 or newer (Apple chip). Apple menu → About This Mac says "Chip: Apple …".
   - `MGRS-Viewer-0.1.0-mac-x64.zip` — older Intel Macs. About This Mac says "Processor: Intel …".
   - Neither needs Rosetta.
2. Unzip it. Drag `MGRS Viewer` into Applications (or keep it anywhere).
3. Double-click `MGRS Viewer`. The first time, the computer says it cannot verify the app. Click Done (or OK), then open System Settings → Privacy & Security, scroll down, and click Open Anyway next to MGRS Viewer. Confirm. This happens once.
4. If the computer instead says the app is damaged: open Terminal (Cmd-Space, type Terminal), paste `xattr -cr "/Applications/MGRS Viewer.app"` (change the path if you put it elsewhere), press Return, and double-click the app again.

If you are using a tunnel, the app is at http://localhost:18764

If the Linux app still does not open: double-click MGRS-Viewer-0.1.0-linux.AppImage again. Allow execute if the OS asks.

Not an official USGS or military product. Verify in the field.
