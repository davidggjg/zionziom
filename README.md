# ⌚ Watch Reset & BLE Explorer

אפליקציית Expo / React Native להתחברות לשעון LIGE (ודומיו) דרך BLE, חקירת ה-GATT Profile ושליחת פקודות איפוס.

---

## 📦 התקנה

### דרישות מוקדמות
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- אנדרואיד עם Developer Mode מופעל

```bash
cd watch-reset-app
npm install
npx expo start --android
```

---

## 🏗️ מבנה הפרויקט

```
watch-reset-app/
├── App.js                          # ניווט ראשי
├── app.json                        # הגדרות Expo
├── package.json
├── babel.config.js
└── src/
    ├── screens/
    │   ├── ScanScreen.js           # סריקת מכשירי BLE
    │   └── DeviceScreen.js         # התחברות, GATT Map, Reset
    └── utils/
        ├── bleManager.js           # BleManager singleton + permissions
        └── bleProtocol.js          # פרוטוקול, UUIDs, פקודות איפוס
```

---

## 🔧 איך זה עובד

### 1. סריקה
האפליקציה מבצעת BLE Scan ומציגה את כל המכשירים הקרובים.  
מכשירים עם שם שמכיל `LIGE`, `watch`, `smart`, `GT` וכו' — מסומנים בצבע ירוק.

### 2. התחברות וחקירת GATT
לחיצה על מכשיר → מתחברים → `discoverAllServicesAndCharacteristics()` → מציגים את כל:
- Services (שירותים)
- Characteristics (מאפיינים)
- Properties (READ / WRITE / NOTIFY / INDICATE)

### 3. פקודות איפוס
האפליקציה שולחת **5 פקודות איפוס שונות** בזו אחר זו, כל אחת בפורמט שונה:

| # | שם | Header | CMD |
|---|---|---|---|
| 1 | ODM Factory Reset | `AB 00` | `0x08` |
| 2 | Jieli Reset | `55 AA` | `0x01` |
| 3 | Da Fit / Heylink | `01 08` | - |
| 4 | Short CMD | `FF FF` | `0x01` |
| 5 | Soft Reboot | `AB 00` | `0x09` |

### 4. Sync Time
שולח פקודת סנכרון זמן עם השעה הנוכחית של הטלפון.

---

## ⚠️ הערות חשובות

1. **האפליקציה מנסה** לשלוח פקודות איפוס — אין ערובה שהשעון יגיב אם ה-Firmware שלו חוסם פקודות ממכשיר לא מזוגג.
2. לניתוח מעמיק יותר — השתמש ב-**nRF Connect** (Nordic Semiconductor) כדי לקרוא ערכים ידנית.
3. להקלטת תעבורה מלאה — הפעל **Bluetooth HCI Snoop Log** בהגדרות מפתח אנדרואיד ופתח בWireshark.

---

## 🔑 הרשאות נדרשות (Android)

```xml
BLUETOOTH
BLUETOOTH_ADMIN
BLUETOOTH_SCAN        (API 31+)
BLUETOOTH_CONNECT     (API 31+)
ACCESS_FINE_LOCATION
```

---

## 📡 UUID ידועים לשעוני ODM סינים

| UUID | תפקיד |
|---|---|
| `0000FEE7-...` | Proprietary Service (Jieli) |
| `0000FEE0-...` | Proprietary Service (alt) |
| `0000FFE0-...` | Serial-like Service |
| `6E400001-...` | Nordic UART Service (NUS) |
| `0000180A-...` | Device Information |
| `0000180F-...` | Battery Service |
