# QA — AppImage (09:11 pack)

Function only. Pack: `release/MGRS-Viewer-0.1.0-linux.AppImage` (09:11). Window title MGRS Viewer. Tunnel http://localhost:18764.

Copy words live in [qa-expected-copy.md](qa-expected-copy.md). This file is launch, search, print, quit.

Prior FAIL shots are the fail look. Do not treat them as pass.

## 1. Window opens (APP-002)

Cold launch. One process. Port 18764 free. Quit leftover `linux-unpacked` too (it steals 18764).

Current known fail: no window, GPU process exits. Known bug until Infra lands a window.

| Check | Pass | Fail look |
|---|---|---|
| Window | Native MGRS Viewer, map + chrome | No window |
| GPU | Stays up | GPU process exits |
| 18764 | This pack holds it | leftover linux-unpacked (or another Viewer) holds it |

Fail shots: [app-00-prelaunch-nowindow.png](qa-shots/app-00-prelaunch-nowindow.png), [app-00-first-paint.png](qa-shots/app-00-first-paint.png), [app-00-first-paint-5s.png](qa-shots/app-00-first-paint-5s.png), [14-appimage-blank.webp](qa-shots/14-appimage-blank.webp).

Pass look (older painted window): [app-01-window.png](qa-shots/app-01-window.png).

APP-002.

## 2. Monument Enter shows Matches

Type `Washington Monument`. One Enter. Do not pick a row yet.

| Check | Pass | Fail look |
|---|---|---|
| Helper | Several matches for “Washington Monument”. Select one. | Field clears, no helper |
| List | Heading Matches, several rows, no auto-fly | Silent no-op, map stays put |

Pass shots (:5173): [31-monument-list.png](qa-shots/31-monument-list.png), [32-monument-matches.png](qa-shots/32-monument-matches.png), [15-matches-monument.webp](qa-shots/15-matches-monument.webp).

Fail shot (08:55/08:58 AppImage): [app-04-place.png](qa-shots/app-04-place.png).

APP-003. Do not score this from :5173.

## 3. Print title is place or MGRS, not lat/long

Pick a Monument row. Print. Read the sheet title (upper collar and Col A). Same string.

| Input | Pass | Fail |
|---|---|---|
| Place pick | Geocoder place (e.g. Washington Monument…) | Typed query, or `38.889, -77.035` |
| MGRS or lat/long search | Spaced MGRS square | Raw query or lat/long |
| No place and no MGRS | UNTITLED SHEET | Anything else |

Max 28 characters. Ellipsis. No wrap.

Function pass shots: [36-print-title.png](qa-shots/36-print-title.png) (place, not lat/long). Chairman judges [docs/images/print-sheet.png](images/print-sheet.png). Design target only: [design/mocks/usng-dc-letter.png](../design/mocks/usng-dc-letter.png).

BUG-PRINT-001.

## 4. Second launch still opens a window

Quit the first window. Quit leftover `linux-unpacked` if it is still on 18764. Double-click the same AppImage again.

| Check | Pass | Fail look |
|---|---|---|
| Second window | Map + chrome | No window, or GPU exits |

Same fail shots as §1.

APP-002 (second open).

## 5. Print → Cancel must not quit

Print. Cancel the system dialog. App stays up.

| Check | Pass | Fail |
|---|---|---|
| After Cancel | Window still open, map still painted | Process exits |

APP-004.

Raw `print.*` keys or WGS 84 on the sheet: pack is not reading strings.json.

Raw `print.legend` or garbled G–M (`0.4° 7' 93' W`) is a fail. Expect **Legend** and **G–M 9° 30′ W** / **convergence 1° 17′**.

## Out of scope

USNG collar look, tile color, RF vs zoom. Visual pass is Designer’s USNG spec after Frontend lands it. Copy words: [qa-expected-copy.md](qa-expected-copy.md).
