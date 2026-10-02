# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Offline, single-user personal finance app (expenses, payments, budgets): React 18 + Vite + Ionic React 9 + Chart.js,
packaged as an Android app with Capacitor 8. All data lives in on-device SQLite via `@capacitor-community/sqlite`;
there is no backend or auth. This repo used to be a Go/chi + SQLite server (see git history before the
`capacitor-app` branch). The UI came from `../checkout-nest/frontend`.

## Commands

```sh
npm run dev                 # browser dev server (SQLite via jeep-sqlite + IndexedDB)
npm run build               # tsc typecheck + vite build to dist/
npm test                    # vitest (API layer against node:sqlite)
npx vitest run src/api/backup.test.ts -t "legacy"   # single file / test
npx cap sync android        # copy dist/ + plugins into android/ (run after every build and plugin install)
cd android && ./gradlew assembleDebug                # needs Android SDK + JDK 21
npm run android             # build + sync + open in Android Studio
```

CI (`.github/workflows/android.yml`) runs only on pushes to `capacitor-app`: tests, build, `assembleDebug`, and
the APK as an artifact. It signs with a fixed debug keystore from the `ANDROID_DEBUG_KEYSTORE_BASE64` secret when
set. Without a stable key, each APK needs an uninstall to install, which wipes the on-device database. The git
remote uses the SSH host alias `github-personal`.

## Architecture

- `src/db/`: `Db` interface (`query`, `run`, `transaction`). `capacitor.ts` implements it with the SQLite plugin.
  On web it mounts the `jeep-sqlite` element and calls `saveToStore` after writes. `schema.ts` holds the
  `CREATE TABLE IF NOT EXISTS` statements, which run on open. There is no migration system yet, so schema
  changes need explicit migration code. `getDb()` is a lazy singleton. Tests swap it with `setDb(createNodeDb())`
  from `src/test/nodeDb.ts`.
- `src/api/`: the former Go services, ported to plain async functions with hand-written SQL.
  `transactions.ts` and `budgets.ts` hold the domain logic. `stats.ts` backs the Stats screen: every query
  takes a `StatsFilter` (inclusive day range, text search, required tags) and returns positive amounts spent. `backup.ts` handles JSON export/validate/restore,
  where restore replaces all data atomically and keeps ids. `legacy.ts` opens an old Go backend `sqlite3.db`
  in memory with sql.js and turns one user's rows into a `Backup`. `index.ts` has the `useAsync` hook that
  components use for loading data.
- Components call `src/api/*` directly. There's no global state store. Tab pages stay mounted (`IonTabs`), so after
  any write call `notifyChanged()` from `src/api/index.ts`; pages read `useDataVersion()` and pass it as a `useAsync`
  dep or `usePagedList` key to reload.
- UI shell (Ionic, `md` mode everywhere): `App.tsx` has `IonReactRouter` (React Router 6) > `IonTabs` with one
  `IonRouterOutlet` holding all routes. Each tab keeps its own stack; `/expenses/search` is pushed inside the Expenses
  tab. Every screen renders `<Page>` (`IonPage` + toolbar + `IonContent`), pass the FAB via its `fab` prop so it
  sits directly in `IonContent`. Add/edit forms are `<Sheet>` (`IonModal` sheet sized to content via
  `--height: auto`); use `useLastValue` so contents don't change while it animates closed. Lists page with
  `usePagedList` + `<LoadMore>` (`IonInfiniteScroll`). Confirms, errors and toasts go through `useDialogs()`.
- Android back (`useAndroidBack` in `App.tsx`): overlays close first (Ionic priority 100), then a pushed screen pops,
  another tab returns to Expenses, and Expenses exits. Capacitor only forwards back presses to the page while an
  `App` `backButton` listener exists, so the hook registers a no-op one.
- Theme follows the system via Ionic's `palettes/dark.system.css`; app colours are CSS variables in `styles.css`.
  Ionic's core.css maps Capacitor's injected `--safe-area-inset-*` (`SystemBars.insetsHandling: "css"`) to
  `--ion-safe-area-*`.

## Data conventions

- Expenses and payments share the `transactions` table. **Expenses have a negative `price`, payments a positive one.**
  `createExpense` negates the positive amount you pass, and the UI shows stored values.
- `tags` is a JSON array string, queried with `json_each`.
- Dates are stored as **local wall-clock `YYYY-MM-DDTHH:MM:SS` with no zone** (`src/dates.ts`). All month/day
  grouping uses `strftime` on that string. "Current month" is computed in JS and passed as a parameter, so never use
  `date('now')` in SQL. `parseDate` deliberately drops timezone suffixes, because legacy rows were mostly
  date-only inputs saved as UTC midnight.

## Gotchas

- jeep-sqlite bundles an old sql.js and loads `/assets/sql-wasm.wasm`, which must match that build (sql.js ≥ 1.13
  fails with a LinkError). `postinstall` (`scripts/copy-sql-wasm.mjs`) copies it from the exactly pinned `sql.js-jeep`
  alias into `public/assets/` (gitignored). The legacy importer uses the regular `sql.js` package with its own wasm,
  imported via `?url`.
- `android/` is generated by `cap add android` but committed. `android/app/src/main/assets/public` is build output.
  `AndroidManifest.xml` has hand edits: `windowSoftInputMode="adjustResize"`.
  `MainActivity` calls `EdgeToEdge.enable`: below Android 15 the window isn't edge-to-edge by default, but
  `SystemBars` still injects the bar insets, so the tab bar got a nav-bar-high gap on top of the system's own.
- Android's file picker can report a stale 0-byte size for files copied in by adb or USB (MediaStore not
  re-indexed), and the WebView then reads 0 bytes. sql.js opens empty bytes as an empty database, so the legacy
  import fails with "no transactions table". The workaround is to pick the file via the device-storage root in the
  picker, or rename/re-copy it.
- Recent Chromium returns a Promise from `window.scrollTo`. Never write `useEffect(() => window.scrollTo(...))`,
  because React calls the returned value as a cleanup and the app crashes on the next navigation.
- The browser dev server can't exercise native behaviour (back button, system bars, keyboard insets, file picker,
  share sheet). Treat those as unverified until they're tested on a device.

## Possible improvements (not done yet)

Ideas for making the app more mobile-native. "Device" means it needs a test on a phone, because the browser can't
exercise it. "Decision" means it needs input from the owner first.

- App icon and splash screen via `@capacitor/assets`. Still the Capacitor default. Decision: source image.
- System bar icon colour following the light/dark theme (`SystemBars.setStyle` on theme change). Device.
- Haptics on save, delete and tab switch (`@capacitor/haptics`). Device.
- Undo snackbar for deletes instead of `window.confirm`.
- Remove unused deps (`d3`, `zod`, `@faker-js/faker`, `lodash.debounce`) and code-split per route. The main
  chunk is about 1.2 MB, mostly Ionic. `vite.config.ts` already drops unused `@ionic/core` component modules,
  which `@ionic/core` doesn't mark side-effect free.
- Swipe-to-delete rows (`IonItemSliding`) and swiping between tabs.
- Budget notifications at 80% and 100% (`@capacitor/local-notifications`). Device. Decision: which alerts.
- Biometric app lock on open or resume. Device. Decision: lock policy.
- Android app shortcut "Add expense" on long-press of the icon. Device.
- Currency and number-format setting. `$` is hard-coded in `src/format.ts`.
- Keyboard handling in sheets (`@capacitor/keyboard`, scroll the focused field into view). Ionic's scroll assist
  may already cover it. Device.
- Home-screen widget with this month's spend or remaining budget. Needs native Kotlin. Device.
- Automatic backups: verify that Android Auto Backup (`allowBackup="true"`) includes the database, and/or add a
  scheduled JSON export. Device.
