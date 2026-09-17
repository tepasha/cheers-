# Fastlane CI/CD Setup for Будьмо!

Ця директорія містить конфігурацію Fastlane для автоматизованої збірки та деплою мобільного додатку в Apple App Store (TestFlight) та Google Play Store.

## Доступні команди (Lanes)

### iOS
- `bundle exec fastlane ios beta` — збірка IPA, підписання сертифікатами та завантаження в Apple TestFlight.
- `bundle exec fastlane ios release` — відправка збірки на ревʼю в App Store.

### Android
- `bundle exec fastlane android beta` — збірка Android App Bundle (`.aab`) та завантаження у Google Play Internal Testing.
- `bundle exec fastlane android release` — реліз у Google Play Production Track (із підтримкою phased rollout).

### Спільний реліз
- `bundle exec fastlane release_all` — запуск збірки та релізу для обох платформ одночасно.

## Необхідні змінні оточення (GitHub Secrets)

1. **Apple Developer**:
   - `APP_STORE_CONNECT_KEY_ID`: ID ключа App Store Connect API
   - `APP_STORE_CONNECT_ISSUER_ID`: Issuer ID з App Store Connect
   - `APP_STORE_CONNECT_API_KEY_BASE64`: Приватний ключ `.p8` у форматі Base64
   - `MATCH_PASSWORD`: Пароль шифрування сховища сертифікатів (Fastlane Match)

2. **Google Play Console**:
   - `GOOGLE_SERVICE_ACCOUNT_BASE64`: Сервісний акаунт Google Cloud / Google Play у форматі Base64 JSON
   - `ANDROID_KEYSTORE_BASE64`: Keystore для релізного підпису Android
