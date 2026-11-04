# Sawaba Grooming Studio — Updated Media, Screenshots & Promotional Video

All screenshots and footage were captured from the **running application after the image
replacement**. No mock-ups or invented UI.

## Image replacement (applied)

| Section | What changed | Result |
| --- | --- | --- |
| **Gallery** | All previous entries removed; replaced with the supplied 26 “galary” photos + the MOV clip (converted to MP4 + poster) | 27 live entries |
| **Barber profiles** | All 7 barbers re-imaged from the supplied gallery set | 7 images |
| **Salon services** | All 13 services re-imaged from the supplied gallery set | 13 images |
| **Marketplace** | 3 new active products created from the 16 supplied product photos (7 + 4 + 5 images) | new product IDs 26–28 |
| **Payments** | Payment shop logo set from the supplied “payment” images | 1 logo |
| **Old media removed** | 5 QA test products archived with their images deleted, the old official “Shampoo” product archived with its images deleted, 22 local files and 10 Cloudinary assets deleted | no old images visible |
| **Preserved** | Real vendor uploads (Brainstorm IT Solution: “Soft Care” images and “Hair Dyes” videos) and all receipts/customer uploads | untouched |

A full backup of the previous records and `backend/uploads` is in
`backup/media-20261104-150355/`.

**Assumptions (please review):**
- Product names/prices for the 3 new products are derived from the file names and use placeholder
  prices; edit them in Admin → Marketplace.
- Barber/service photos are reused from the “galary” set (as requested, since no dedicated folders
  existed).
- The app has a single “payment shop logo” field, so one payment image was used there; the other
  three remain in the source folder.

## Deliverables

| Asset | Spec | Path |
| --- | --- | --- |
| Master promo (rebuilt) | 1920×1080, H.264 + AAC, 30 fps, **1:56** | `sawaba-promo-16x9.mp4` (4.3 MB) |
| Vertical social cut | 1080×1920, H.264 + AAC, **1:56** | `sawaba-promo-9x16.mp4` (3.6 MB) |
| Live screen recording | 1920×1080 storefront + shop + product flow | `clips/storefront.mp4` |
| Branded promo cards | 1080×1080 PNG ×6 | `marketing/cards/` |
| Curated screenshots | Full-resolution PNG ×22 (desktop + mobile) | `marketing/screens/` |
| Full-page screenshots | Entire page, nothing cut off, ×12 | `marketing/screens-full/` |
| Video-ready captures | 1920×1080 PNG ×35 | `shots/` |
| Captions | SRT | `subs.srt` |

## Video content (rebuilt from the new screens)

- **Opening (10s) and closing (9s) website cards** display **https://sawabagroomingstudio.com.ng/**
  in large gold type with a spoken call-to-action encouraging viewers to visit the official site.

1. Brand intro
2. Customer experience — services, barbers, booking, dashboard, payment history
3. Admin dashboard — appointments, payments, marketplace
4. Barber dashboard
5. Vendor marketplace — dashboard, products, orders, wallet
6. Online shopping — shop, product details, cart, checkout (delivery or pickup)
7. Order management — order number, tracking, pickup verification
8. Mobile experience
9. Outro tagline

Every scene is scaled to fit the 1920×1080 frame (letterboxed on the brand background) with only a
3% motion drift, so no interface content is cropped.

## Verification performed
- New gallery/services/barbers/product/payment URLs return HTTP 200.
- Shop API returns the 3 new products with images; archived/QA products expose none.
- 22 local files + 10 Cloudinary assets deleted; backup verified (69 files, 12.9 MB).
- New master and vertical streams verified (H.264 1920×1080 / 1080×1920, AAC stereo, 1:37).
- Frame brightness sampled at 5/25/45/70/95 s — all non-blank.

## Reproduce
```bash
node scripts/media/convert.mjs
cd backend && npx tsx src/scripts/applyMediaUpdate.ts
cd .. && node scripts/promo/capture.mjs && node scripts/promo/recapture.mjs
node scripts/promo/build-video.mjs && node scripts/promo/extras.mjs
```

**Sawaba Grooming Studio – Your Grooming, Your Shopping, All in One Place.**
