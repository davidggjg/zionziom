# BLE Watch Explorer (`ble-watch-tool`)

אפליקציית Android גנרית לחקירת מכשירי BLE (כמו שעון ה-Heylink/Dinghefeng שלך).
**אין בה שום קוד ספציפי לשעון** — היא רק כלי:

1. **ScanActivity** — סורקת מכשירי BLE בקרבת מקום, מציגה שם/כתובת/RSSI.
2. **DeviceActivity** — מתחברת למכשיר שבחרת, מגלה את כל ה-Services וה-Characteristics
   (כולל תכונות READ/WRITE/NOTIFY של כל אחד), מאפשרת:
   - לשלוח בייטים גולמיים (hex) לכל Characteristic שתבחר
   - להירשם (Subscribe) ל-Notify/Indicate ולראות בלוג מה השעון שולח בחזרה

## איך מעלים את הפרויקט ל-GitHub (בלי IDE)

1. ב-GitHub, "Add file" → "Upload files", גוררים את כל תוכן ה-ZIP (שומרים על מבנה התיקיות).
2. יוצרים בנפרד את הקובץ `.github/workflows/build.yml` (התוכן נמסר לך בצ'אט) — חשוב ליצור אותו
   כקובץ נפרד דרך "Create new file" כדי שה-UI יבנה את התיקייה הנסתרת `.github` כמו שצריך.
3. עושים Commit. Actions ירוץ אוטומטית, ויעלה APK debug כ-Artifact בסוף הריצה.

## איך משתמשים באפליקציה בפועל

1. מתקינים את ה-APK, נותנים הרשאות Bluetooth שמתבקשות.
2. לוחצים Scan, מאתרים את השעון ברשימה (יופיע לפי שם השעון או "(unnamed device)" אם הוא לא משדר שם).
3. נכנסים למסך המכשיר — האפליקציה תתחבר ותגלה את כל ה-Services. כל השירותים/Characteristics
   יוצגו בטקסט עם ה-UUIDs המלאים ותכונותיהם (READ/WRITE/NOTIFY...).
4. כדי לנסות לשלוח פקודה (כמו Factory Reset), צריך:
   - את ה-Service UUID שמכיל את הפקודה (ברוב מכשירי ה-ODM הסיניים זה לרוב UUID קנייני,
     לא אחד מהשירותים הסטנדרטיים כמו Battery/Device Info).
   - את ה-Characteristic UUID של ערוץ ה-Write.
   - את הבייטים המדויקים שהאפליקציה הרשמית (Heylink) שולחת — את זה אפשר להשיג רק
     על ידי Packet Sniffing (HCI Snoop Log + Wireshark) בזמן שמשתמשים בפקודה דומה
     מתוך Heylink עצמה, או על ידי decompile ל-APK של Heylink עם JADX.
5. ללא הבייטים האלה, האפליקציה הזו תאפשר לך *לחקור* את השעון (לראות UUIDs, להאזין ל-Notify),
   אבל לא "לנחש" פקודת reset — שעוני RTOS סיניים חוסמים כתיבה לערוצים רגישים בלי handshake
   תקין מהיצרן.

## הצעד הבא המומלץ בפועל

לפני שממשיכים לפענח Opcodes ביד: מומלץ לעשות HCI Snoop Log על טלפון (Settings → Developer
options → Enable Bluetooth HCI snoop log), לחבר את Heylink לשעון (אם אפשר, גם על שעון אחר
מאותה סדרה), לשלוח כל פקודה אפשרית כולל כל מה שבתפריט Equipment Management, ואז לפתוח את
קובץ ה-`.cfa`/`.pcap` שנוצר ב-Wireshark כדי לזהות את ה-Opcode/Payload המדויקים. זה הדרך
היחידה לדעת בוודאות מה לשלוח דרך האפליקציה הזו.
