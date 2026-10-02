# Checkout

Personal expense, payment and budget tracker. It's an offline Android app (React + Capacitor)
that stores everything in SQLite on the device. There is no server and no account.

## Develop

```sh
npm install
npm run dev     # runs in the browser; data is kept in IndexedDB
npm test
```

## Build the Android app

Requires Android Studio (or the Android SDK command-line tools) and JDK 21.

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

`npm run android` builds, syncs and opens the project in Android Studio.

## Moving data from the old Go server

Copy the old server's `sqlite3.db` to the phone, then open **Backup → Import from the old server** and pick
the file. If the database contains several users, you'll be asked which user's data to import.
The import replaces everything in the app.

Use **Backup → Export backup** to save a JSON backup, and **Import backup** to restore one.
