# GeoHub Business Online / Nationwide Update Report

## Changed files
- `add-business.html`
- `add-business.js`
- `add-business.css`
- `geohub-social-redesign.js`
- `geohub-social-redesign.css`

## What changed

### 1. Business Type support
Add Business now supports two business modes:

- `physical` — physical location businesses such as cafes, hotels, restaurants, shops.
- `online` — online / nationwide businesses such as travel agencies without an office, web studios, online education, consulting, ecommerce, remote services.

### 2. Dynamic validation
Physical businesses still require city selection.
Online businesses do not require city, address, or Google Maps link.

### 3. Firestore fields
New business documents now include:

```js
businessType: "physical" | "online"
serviceArea: "georgia" | "worldwide" | "tbilisi" | "batumi" | "regions" | citySlug
serviceAreaText: readable label
isOnline: true | false
```

### 4. UI behavior
Online businesses show badges like:

- Available across Georgia
- Worldwide / Remote
- Tbilisi only
- Batumi only
- Selected Georgian regions

Physical businesses show normal city/location badges.

### 5. Business page behavior
Business detail page now adapts the About section:

- Physical businesses show location/address.
- Online businesses show online/nationwide service area and an online service note.

### 6. Discover and Businesses pages
Business cards and Discover cards now display correct online vs physical badges.
Added an `Online` filter chip on the Businesses page.

### 7. Edit mode
`add-business.html?edit=BUSINESS_ID` now loads the business document, pre-fills the form, supports business type/service area, and saves changes using Firestore update instead of creating a duplicate business.

## QA checks performed
- Non-module JavaScript syntax check: PASS
- Firebase module files skipped for Node syntax check because they use browser ESM imports.
- Missing local HTML references: 0 missing files
- Business city validation checked: only physical businesses require city
- Online business creation payload checked: address/city/mapsLink are intentionally blank for online businesses
- Business card/detail rendering checked at code level

## Manual test checklist
After deploy and Firestore rules publish, test:

1. Add Physical Business with city/address → should save and show city badge.
2. Add Online / Nationwide Business without city/address → should save successfully.
3. Online business should show in Businesses page.
4. Online business should show in Discover page.
5. Online business should not require Google Maps link.
6. Open business detail page → About should show online service area.
7. Click Manage/Edit → form should prefill and update same business.
8. Businesses page Online filter should show online businesses.

