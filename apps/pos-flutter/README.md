# Apex POS Flutter App

Flutter POS client for Windows and Android.

## Local Development

```powershell
flutter pub get
flutter run -d windows
```

## Android Release APK

1. Create a keystore:

```powershell
keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

2. Copy [key.properties.example](C:\Users\dexte\OneDrive\Desktop\PROKECY%20BACKUP\PROJECT%202026\POS%20SYSTEM\apps\pos-flutter\android\key.properties.example) to `android/key.properties` and replace the placeholder passwords.

3. Move `upload-keystore.jks` into the `android` folder so `storeFile=upload-keystore.jks` resolves correctly.

4. Build the release APK:

```powershell
flutter build apk --release
```

The signed APK will be written to `build/app/outputs/flutter-apk/app-release.apk`.
