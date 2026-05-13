# Cloudinary Upload Fix Applied

Date: 2026-05-13

## What changed

GeoHub now treats Cloudinary as the active media upload provider and no longer initializes Firebase Storage in the frontend.

### Changed files

- `firebase-config.js`
  - Removed Firebase Storage import and initialization.
  - Removed `storage` and `storageFns` from `window.GeoFirebase` so blocked Firebase Storage cannot break uploads on Spark/free plan.

- `firestore-social.js`
  - Confirmed `uploadImageDataUrl()` uses Cloudinary unsigned uploads.
  - Added configurable Cloudinary settings through `window.GEOHUB_CLOUDINARY_CONFIG` or `GeoConfig.CLOUDINARY`.
  - Added 30-second upload timeout to prevent infinite hanging.
  - Added clean error handling when Cloudinary is missing/misconfigured.
  - Kept image validation/compression before upload.

- `geohub-social-redesign.js`
  - Post and story submit buttons now show Uploading/Posting state.
  - Buttons are always restored after success or failure.
  - Upload errors are logged and shown as clear Cloudinary configuration errors.

- `config.js`
  - Added `CLOUDINARY` config block.
  - Enabled the media upload feature flag for Cloudinary unsigned uploads.

## Current Cloudinary config

```js
cloudName: 'dw5dqk2w7'
uploadPreset: 'geohub_unsigned'
rootFolder: 'geohub'
```

Cloudinary must have an unsigned upload preset named `geohub_unsigned`.
Never put Cloudinary API secret in frontend code.

## Verified

- `node --check firebase-config.js`
- `node --check firestore-social.js`
- `node --check geohub-social-redesign.js`
- `node --check config.js`

