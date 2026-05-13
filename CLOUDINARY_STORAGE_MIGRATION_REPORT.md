# Cloudinary Storage Migration

GeoHub media uploads were moved away from Firebase Storage because Firebase Storage requires a Firebase pricing upgrade for this project.

## Active media storage

- Provider: Cloudinary unsigned upload
- Cloud name: `dw5dqk2w7`
- Upload preset: `geohub_unsigned`
- Root folder: `geohub`

## Changed file

- `firestore-social.js`
  - `uploadImageDataUrl()` now uploads images to Cloudinary.
  - Firestore stores only the returned `secure_url`.
  - Firebase Storage is no longer required for post/story media uploads through GeoSocial.

## What this fixes

- Photo posts can upload without Firebase Storage.
- Story photos can upload without Firebase Storage.
- Any module using `GeoSocial.uploadImageDataUrl()` now stores media through Cloudinary.

## Cloudinary requirement

Cloudinary must have an unsigned upload preset named:

`geohub_unsigned`

The preset should allow unsigned uploads and can use the folder `geohub`.

No API secret should be placed in frontend code.
