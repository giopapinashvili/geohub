# Run this ONCE after: npx wrangler login
# It uploads all VITE_FIREBASE_* vars to Cloudflare Pages (production + preview)

$project = "geohub-main"

$secrets = @{
  VITE_FIREBASE_API_KEY             = "AIzaSyBFjplTgrv7SGLagXzppoUXmSp60PMO_HI"
  VITE_FIREBASE_AUTH_DOMAIN         = "geohub-main.firebaseapp.com"
  VITE_FIREBASE_PROJECT_ID          = "geohub-main"
  VITE_FIREBASE_MESSAGING_SENDER_ID = "18115935679"
  VITE_FIREBASE_APP_ID              = "1:18115935679:web:b17b3f3814256cd97e750a"
  VITE_FIREBASE_MEASUREMENT_ID      = "G-NCBVQ4J9VF"
}

$json = $secrets | ConvertTo-Json -Compress

# Production environment
Write-Host "Uploading to production..."
$json | npx wrangler pages secret bulk --project-name $project

# Preview environment
Write-Host "Uploading to preview..."
$json | npx wrangler pages secret bulk --project-name $project --env preview

Write-Host "Done! All secrets uploaded."
