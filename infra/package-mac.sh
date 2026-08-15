#!/usr/bin/env bash
# Sign (ad-hoc) and zip the Mac .app bundles produced by `electron-builder --mac dir`.
#
# Why this exists (see docs/release-mac.md):
# - electron-builder cannot codesign from Linux (no `codesign`); an UNSIGNED arm64
#   app will not launch at all on Apple Silicon, so we ad-hoc sign with rcodesign.
# - electron-builder's own zip target from Linux drops symlinks, which flattens
#   Electron Framework.framework, triples the artifact size, and makes macOS call
#   the app "damaged". We zip ourselves with `zip -ry` (preserves symlinks).
#
# Inputs : release/mac-arm64/MGRS Viewer.app  and  release/mac/MGRS Viewer.app (x64)
# Outputs: release/MGRS-Viewer-<version>-mac-arm64.zip
#          release/MGRS-Viewer-<version>-mac-x64.zip
#          release/SHA256SUMS-mac.txt
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE="$ROOT/release"
APP_NAME="MGRS Viewer.app"
VERSION="$(node -p "require('$ROOT/package.json').version")"
BUNDLE_ID="$(node -p "require('$ROOT/package.json').build.appId")"

RCS_VERSION="0.29.0"
TOOLS_DIR="$RELEASE/.tools"

fail() { echo "package-mac: ERROR: $*" >&2; exit 1; }
note() { echo "package-mac: $*"; }

# --- rcodesign: use PATH, else fetch pinned prebuilt musl binary, else cargo ---
ensure_rcodesign() {
  if command -v rcodesign >/dev/null 2>&1; then
    RCODESIGN="$(command -v rcodesign)"
    return
  fi
  RCODESIGN="$TOOLS_DIR/rcodesign"
  if [ -x "$RCODESIGN" ]; then return; fi
  mkdir -p "$TOOLS_DIR"
  local arch sha tarball url
  case "$(uname -m)" in
    x86_64)  arch="x86_64";  sha="dbe85cedd8ee4217b64e9a0e4c2aef92ab8bcaaa41f20bde99781ff02e600002" ;;
    aarch64) arch="aarch64"; sha="4af92c87ddf52f5f2d1258a3b4e56c7dcb8f1b2468df744976c5f139e031961f" ;;
    *) arch="" ;;
  esac
  if [ -n "$arch" ]; then
    tarball="apple-codesign-$RCS_VERSION-$arch-unknown-linux-musl.tar.gz"
    url="https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign%2F$RCS_VERSION/$tarball"
    note "downloading $tarball"
    curl -fsSL -o "$TOOLS_DIR/$tarball" "$url"
    echo "$sha  $TOOLS_DIR/$tarball" | sha256sum -c - >/dev/null || fail "sha256 mismatch for $tarball"
    tar -xzf "$TOOLS_DIR/$tarball" -C "$TOOLS_DIR" --strip-components=1 \
      "apple-codesign-$RCS_VERSION-$arch-unknown-linux-musl/rcodesign"
    rm -f "$TOOLS_DIR/$tarball"
    chmod +x "$RCODESIGN"
    return
  fi
  if command -v cargo >/dev/null 2>&1; then
    note "no prebuilt rcodesign for $(uname -m); building with cargo (slow, one-time)"
    cargo install apple-codesign --version "$RCS_VERSION" --root "$TOOLS_DIR/cargo"
    RCODESIGN="$TOOLS_DIR/cargo/bin/rcodesign"
    return
  fi
  fail "rcodesign not found and no way to install it"
}

command -v zip >/dev/null 2>&1 || fail "Info-ZIP 'zip' is required (apt-get install zip)"
ensure_rcodesign
note "using rcodesign: $("$RCODESIGN" --version)"

# --- verification helpers (all run on Linux; no Mac needed) -------------------
mach_arch() { # print cputype of a Mach-O file: arm64 | x86_64 | unknown
  python3 - "$1" <<'EOF'
import struct, sys
with open(sys.argv[1], "rb") as f:
    magic, cputype = struct.unpack("<II", f.read(8))
print({0x0100000C: "arm64", 0x01000007: "x86_64"}.get(cputype, "unknown") if magic == 0xFEEDFACF else "unknown")
EOF
}

has_code_signature() { # exit 0 iff Mach-O has an LC_CODE_SIGNATURE load command
  python3 - "$1" <<'EOF'
import struct, sys
with open(sys.argv[1], "rb") as f:
    head = f.read(32)
    ncmds = struct.unpack("<I", head[16:20])[0]
    data = f.read(struct.unpack("<I", head[20:24])[0])
off = 0
for _ in range(ncmds):
    cmd, size = struct.unpack("<II", data[off:off + 8])
    if cmd == 0x1D:  # LC_CODE_SIGNATURE
        sys.exit(0)
    off += size
sys.exit(1)
EOF
}

zip_symlink_count() {
  python3 - "$1" <<'EOF'
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
print(sum(1 for i in z.infolist() if (i.external_attr >> 16) & 0o170000 == 0o120000))
EOF
}

verify_asar_integrity() { # Info.plist ElectronAsarIntegrity hash must match app.asar header
  python3 - "$1" <<'EOF'
import hashlib, plistlib, struct, sys
app = sys.argv[1]
with open(f"{app}/Contents/Info.plist", "rb") as f:
    plist = plistlib.load(f)
entry = plist.get("ElectronAsarIntegrity", {}).get("Resources/app.asar")
if not entry:
    sys.exit("no ElectronAsarIntegrity entry for Resources/app.asar in Info.plist")
with open(f"{app}/Contents/Resources/app.asar", "rb") as f:
    # asar pickle layout: [0:4]=4, [4:8]=header pickle size,
    # [8:12]=pickle payload size, [12:16]=JSON string length, [16:...]=JSON
    f.seek(12)
    str_len = struct.unpack("<I", f.read(4))[0]
    header = f.read(str_len)
    # ElectronAsarIntegrity is the SHA256 of the JSON header string
    actual = hashlib.sha256(header).hexdigest()
if entry.get("algorithm") != "SHA256" or entry.get("hash") != actual:
    sys.exit(f"asar integrity mismatch: plist={entry.get('hash')} actual={actual}")
print("asar integrity OK")
EOF
}

# --- sign + package one arch ---------------------------------------------------
package_arch() {
  local dir="$1" arch="$2"
  local app="$RELEASE/$dir/$APP_NAME"
  local zipname="MGRS-Viewer-$VERSION-mac-$arch.zip"
  local mainbin="$app/Contents/MacOS/MGRS Viewer"

  [ -d "$app" ] || fail "missing $app (run electron-builder --mac first)"

  local got want="$arch"
  [ "$arch" = "x64" ] && want="x86_64"
  got="$(mach_arch "$mainbin")"
  [ "$got" = "$want" ] || fail "$dir: main binary is $got, expected $want"

  note "[$arch] ad-hoc signing $APP_NAME (recursive)"
  "$RCODESIGN" sign "$app" >/dev/null

  has_code_signature "$mainbin" || fail "$dir: main binary has no LC_CODE_SIGNATURE after signing"
  [ -f "$app/Contents/_CodeSignature/CodeResources" ] || fail "$dir: bundle seal (_CodeSignature/CodeResources) missing"
  "$RCODESIGN" verify "$mainbin" >/dev/null 2>&1 || fail "$dir: rcodesign verify failed on main binary"
  local plist_id
  plist_id="$(python3 -c "import plistlib;print(plistlib.load(open('$app/Contents/Info.plist','rb'))['CFBundleIdentifier'])")"
  [ "$plist_id" = "$BUNDLE_ID" ] || fail "$dir: CFBundleIdentifier is $plist_id, expected $BUNDLE_ID"
  verify_asar_integrity "$app" >/dev/null || fail "$dir: asar integrity check failed"
  [ -L "$app/Contents/Frameworks/Electron Framework.framework/Versions/Current" ] \
    || fail "$dir: framework Versions/Current is not a symlink"

  note "[$arch] zipping (symlinks preserved) -> $zipname"
  rm -f "$RELEASE/$zipname"
  (cd "$RELEASE/$dir" && zip -qry "$RELEASE/$zipname" "$APP_NAME")

  local links size
  links="$(zip_symlink_count "$RELEASE/$zipname")"
  [ "$links" -gt 20 ] || fail "$zipname: only $links symlinks in zip; framework structure lost"
  size="$(stat -c %s "$RELEASE/$zipname")"
  [ "$size" -gt 60000000 ] && [ "$size" -lt 200000000 ] || fail "$zipname: size $size bytes out of sane range"
  note "[$arch] OK: $zipname ($((size / 1024 / 1024)) MB, $links symlinks)"
}

package_arch "mac-arm64" "arm64"
package_arch "mac" "x64"

(cd "$RELEASE" && sha256sum "MGRS-Viewer-$VERSION-mac-arm64.zip" "MGRS-Viewer-$VERSION-mac-x64.zip" > SHA256SUMS-mac.txt)
note "wrote release/SHA256SUMS-mac.txt:"
cat "$RELEASE/SHA256SUMS-mac.txt"
note "done"
