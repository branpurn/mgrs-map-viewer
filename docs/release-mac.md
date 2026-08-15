# Mac release build

Builds run on Linux. No Mac needed. Output: two zips, one per chip.

```
npm run build:desktop:mac
```

That runs, in order:

1. `vite build --base=./` — web bundle into `dist/`.
2. `electron-builder --mac --arm64 --x64` — packs `release/mac-arm64/MGRS Viewer.app`
   (Apple Silicon) and `release/mac/MGRS Viewer.app` (Intel). The `dir` target is
   deliberate; the zip is made later. `beforePack` still runs the search-api tests.
3. `infra/package-mac.sh` — signs, zips, verifies:
   - **Ad-hoc code signing** with [`rcodesign`](https://github.com/indygreg/apple-platform-rs)
     0.29.0 (auto-downloaded to `release/.tools/`, sha256-pinned). macOS refuses to
     run an *unsigned* arm64 binary at all, and electron-builder cannot sign from
     Linux. Ad-hoc is the floor: the app launches after a one-time
     Privacy & Security → Open Anyway.
   - **Zip with `zip -ry`** so the 14 `.framework` symlinks survive. A zip without
     them (plain `zip -r`) flattens `Electron Framework.framework`, triples the
     size, and makes macOS report the app as damaged. This is what was wrong with
     the original `MGRS-Viewer-0.1.0-mac.zip`.
   - **Checks that fail the build**: main binary arch (arm64/x86_64), presence of
     `LC_CODE_SIGNATURE` + `_CodeSignature/CodeResources`, CodeDirectory has the
     ADHOC flag and identifier `dev.purnell.mgrs-viewer`, `ElectronAsarIntegrity`
     in Info.plist matches the real `app.asar` header hash, zip symlink count
     equals on-disk count, size within 60–200 MB.

Artifacts land in `release/`:

```
MGRS-Viewer-<version>-mac-arm64.zip
MGRS-Viewer-<version>-mac-x64.zip
SHA256SUMS-mac.txt
```

Upload both to the release (replaces the old single mac zip):

```
gh release upload v0.1.0 release/MGRS-Viewer-0.1.0-mac-arm64.zip release/MGRS-Viewer-0.1.0-mac-x64.zip --clobber
gh release delete-asset v0.1.0 MGRS-Viewer-0.1.0-mac.zip -y
```

## Smoke test on a Mac (3 steps)

1. Unzip, double-click `MGRS Viewer`. Expect the "cannot verify" dialog — NOT
   "damaged", and NOT a Rosetta install prompt on Apple Silicon.
2. System Settings → Privacy & Security → Open Anyway. App opens, map paints.
3. Activity Monitor → MGRS Viewer → Kind column says "Apple" on Apple Silicon.

## Removing the Gatekeeper prompt entirely (not done)

Needs a paid Apple Developer ID Application certificate plus an App Store Connect
API key. `rcodesign` supports both from Linux: sign with
`--p12-file … --code-signature-flags runtime`, then
`rcodesign notary-submit --staple`. Wire the credentials into
`infra/package-mac.sh` if/when they exist.
