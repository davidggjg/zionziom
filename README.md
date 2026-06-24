# Watch Reset & Explorer

אפליקציית React Native (Bare, ללא Expo) לחיבור BLE לשעון חכם ושליחת פקודות איפוס.

## בנייה
האפליקציה נבנית אוטומטית ב-GitHub Actions (ראה .github/workflows/build-apk.yml).
לאחר push ל-main, ה-APK יהיה זמין כ-artifact בהרצת ה-workflow תחת השם
"WatchResetApp-release-apk".

## בנייה מקומית (אם יש Android Studio / SDK מותקן)
```
npm install
cd android
./gradlew assembleRelease
```
ה-APK ימצא ב: android/app/build/outputs/apk/release/app-release.apk
