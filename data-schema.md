# GeoHub — Data Schema Reference

This document describes all major data models used in GeoHub.
Fields marked `*required` must be present. All timestamps are Unix ms (epoch).

---

## User

Core identity record. Created on sign-up.

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | `u_<timestamp>` (placeholder) / UUID (prod) |
| `fullName` * | string | Display name |
| `username` * | string | Unique, 3–32 chars, lowercase |
| `email` * | string | Unique, verified in prod |
| `password` | string | Hashed (bcrypt) in prod — never stored plain |
| `avatar` | string | URL to profile image |
| `coverImage` | string | URL to profile cover |
| `bio` | string | Max 200 chars |
| `city` | string | Selected from city list |
| `accountType` | enum | `Explorer \| Creator \| Business Owner \| Student \| Teacher \| Patriot` |
| `explorerLevel` | enum | `Bronze \| Silver \| Gold \| Platinum Explorer` |
| `xp` | number | Total experience points |
| `rank` | number | Leaderboard rank (lower = better) |
| `badges` | string[] | Badge identifiers earned |
| `interests` | string[] | e.g. `["cafes","hiking","events"]` |
| `followers` | number | Follower count (denormalized) |
| `following` | number | Following count (denormalized) |
| `postsCount` | number | Denormalized post count |
| `visitedPlaces` | number | Denormalized check-in count |
| `trustScore` | number | 0–100, computed by trust engine |
| `isNew` | boolean | First-session flag, cleared after onboarding |
| `createdAt` * | timestamp | Account creation time |
| `lastActiveAt` | timestamp | Last seen |

---

## Profile (extended)

Extends User with social graph data. Fetched on profile page.

| Field | Type | Notes |
|-------|------|-------|
| `userId` * | string | Foreign key → User.id |
| `followerIds` | string[] | Full list (lazy-loaded) |
| `followingIds` | string[] | Full list |
| `featuredBadge` | string | Pinned badge for display |
| `verifiedCreator` | boolean | Platform-verified flag |
| `onboardingData` | object | Result of onboarding flow |

---

## Post

A feed item. Polymorphic: type defines which extra fields are present.

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `type` * | enum | `checkin \| review \| photo \| event \| group \| deal \| challenge \| patriot \| course \| business \| new_user \| hiking` |
| `userId` * | string | Author |
| `place` | string | Place name (display) |
| `placeId` | string | FK → Place.id |
| `category` | string | Place category label |
| `image` | string | Cover image URL |
| `caption` | string | User text, max 500 chars |
| `mood` | string | Emoji or text mood tag |
| `withUsers` | string[] | Tagged user IDs |
| `xp` | number | XP value of this post type |
| `likes` | number | Denormalized |
| `comments` | Comment[] | Embedded (first 3 preloaded) |
| `going` | string[] | User IDs (for event posts) |
| `title` | string | For events/groups |
| `time` | string | Human-readable time ago |
| `createdAt` * | timestamp | |

### Comment (embedded)

| Field | Type |
|-------|------|
| `userId` | string |
| `text` | string |
| `createdAt` | timestamp |

---

## CheckIn

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `placeId` * | string | FK → Place.id |
| `userId` * | string | FK → User.id |
| `note` | string | Optional text |
| `mood` | string | Mood tag |
| `xpEarned` | number | XP awarded |
| `photos` | string[] | Optional image URLs |
| `createdAt` * | timestamp | |

---

## Place

A discoverable location (business, attraction, route, park, etc.).

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string/number | |
| `slug` | string | URL-friendly name |
| `name` * | string | |
| `category` * | string | `hotels \| cafes \| restaurants \| tours \| hiking \| attractions \| beauty …` |
| `categoryLabel` | string | Display label |
| `city` * | string | |
| `region` | string | Georgian region |
| `lat` | number | WGS84 latitude |
| `lng` | number | WGS84 longitude |
| `address` | string | |
| `rating` | number | 0–5, computed |
| `reviewCount` | number | |
| `price` | string | `$ \| $$ \| $$$ \| $$$$` |
| `priceFrom` | number | Starting price |
| `currency` | string | `GEL \| USD \| EUR` |
| `description` | string | |
| `tags` | string[] | Searchable tags |
| `phone` | string | |
| `whatsapp` | string | |
| `email` | string | |
| `instagram` | string | |
| `website` | string | |
| `hours` | object | `{ "Mon-Fri": "09:00–22:00" }` |
| `image` | string | Cover URL |
| `images` | string[] | Gallery URLs |
| `services` | string[] | Offered services |
| `featured` | boolean | Pinned in listings |
| `verified` | boolean | GeoHub-verified |
| `premium` | boolean | Premium listing tier |
| `createdAt` | timestamp | |

---

## Business

Extends Place with owner relationship and platform settings.

| Field | Type | Notes |
|-------|------|-------|
| `ownerId` | string | FK → User.id |
| `plan` | enum | `free \| starter \| growth \| premium` |
| `planExpiry` | timestamp | |
| `loyaltyEnabled` | boolean | QR rewards active |
| `pointsPerVisit` | number | Default XP per check-in |
| `activeCampaigns` | string[] | FK → Campaign IDs |
| `stats` | object | `{ views, checkins, savedCount, rewardsClaimed }` |
| `approvalStatus` | enum | `pending \| approved \| rejected` |
| `submittedAt` | timestamp | |

---

## Reward

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `businessId` | string | FK → Business.id (null = platform reward) |
| `title` * | string | |
| `description` | string | |
| `type` | enum | `discount \| free_item \| points_multiplier \| event_ticket \| partner` |
| `value` | number | e.g. 20 for 20% off |
| `currency` | string | |
| `xpRequired` | number | Minimum XP to claim |
| `validUntil` | timestamp | |
| `maxClaims` | number | 0 = unlimited |
| `claimedCount` | number | |
| `qrCode` | string | QR data or URL |
| `active` | boolean | |
| `createdAt` | timestamp | |

---

## Challenge

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `icon` | string | Emoji or icon class |
| `name` * | string | |
| `description` | string | |
| `xp` | number | XP awarded on completion |
| `progress` | number | 0–100 (for current user) |
| `participants` | string[] | User IDs |
| `type` | enum | `exploration \| social \| patriot \| fitness \| review` |
| `requiredCheckins` | number | Completion criteria |
| `city` | string | City-specific or null (global) |
| `endsAt` | timestamp | |
| `active` | boolean | |

---

## Event

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `title` * | string | |
| `organizer` | string | Display name or business name |
| `organizerId` | string | FK → User.id or Business.id |
| `type` | enum | `concert \| workshop \| market \| meetup \| patriot \| sport \| festival` |
| `city` | string | |
| `venue` | string | |
| `lat` | number | |
| `lng` | number | |
| `startAt` * | timestamp | |
| `endAt` | timestamp | |
| `image` | string | |
| `description` | string | |
| `price` | number | 0 = free |
| `currency` | string | |
| `capacity` | number | |
| `soldCount` | number | |
| `tags` | string[] | |
| `featured` | boolean | |

---

## Ticket

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `eventId` * | string | FK → Event.id |
| `userId` * | string | FK → User.id |
| `quantity` | number | Default 1 |
| `code` * | string | QR code value |
| `status` | enum | `confirmed \| cancelled \| used` |
| `bookedAt` | timestamp | |
| `usedAt` | timestamp | Null until scanned |

---

## Message

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `conversationId` * | string | FK → Conversation.id |
| `senderId` * | string | FK → User.id |
| `recipientId` | string | FK → User.id |
| `text` | string | |
| `attachments` | string[] | URLs |
| `sentAt` * | timestamp | |
| `read` | boolean | |
| `readAt` | timestamp | |

---

## Conversation

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `participantIds` * | string[] | Exactly 2 for DM, multiple for group |
| `type` | enum | `dm \| group` |
| `lastMessage` | Message | Denormalized latest message |
| `updatedAt` | timestamp | |
| `createdAt` | timestamp | |

---

## CreatorOffer

Collaboration offer from a business to a creator.

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `fromUserId` * | string | Business/brand FK |
| `toCreatorId` * | string | Creator FK |
| `title` | string | |
| `description` | string | |
| `budget` | number | |
| `currency` | string | |
| `deliverables` | string[] | |
| `deadline` | timestamp | |
| `status` | enum | `pending \| accepted \| rejected \| completed` |
| `sentAt` | timestamp | |
| `respondedAt` | timestamp | |

---

## RealEstateListing

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `title` * | string | |
| `type` | enum | `apartment \| house \| commercial \| land \| studio` |
| `status` | enum | `for_rent \| for_sale` |
| `price` | number | |
| `currency` | string | |
| `city` | string | |
| `district` | string | |
| `address` | string | |
| `lat` | number | |
| `lng` | number | |
| `bedrooms` | number | |
| `bathrooms` | number | |
| `area` | number | sqm |
| `floor` | number | |
| `totalFloors` | number | |
| `images` | string[] | |
| `description` | string | |
| `agentId` | string | FK → User.id |
| `active` | boolean | |
| `createdAt` | timestamp | |

---

## ServiceProvider

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `userId` * | string | FK → User.id |
| `name` * | string | |
| `category` | string | `photography \| beauty \| legal \| medical \| design \| cleaning …` |
| `city` | string | |
| `bio` | string | |
| `skills` | string[] | |
| `rate` | number | Hourly rate |
| `currency` | string | |
| `availability` | string | Human-readable |
| `rating` | number | |
| `completedJobs` | number | |
| `verified` | boolean | |

---

## Teacher / Course

### Teacher

| Field | Type |
|-------|------|
| `id` | string |
| `userId` | string |
| `subject` | string |
| `level` | string |
| `languages` | string[] |
| `pricePerHour` | number |
| `rating` | number |
| `studentsCount` | number |

### Course

| Field | Type |
|-------|------|
| `id` | string |
| `teacherId` | string |
| `title` | string |
| `description` | string |
| `type` | enum: `in-person \| online \| hybrid` |
| `city` | string |
| `price` | number |
| `duration` | string |
| `maxStudents` | number |
| `enrolledCount` | number |
| `startAt` | timestamp |

---

## Report

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `reporterId` * | string | FK → User.id |
| `targetId` * | string | ID of reported entity |
| `targetType` * | enum | `user \| place \| post \| business \| review \| event` |
| `reason` * | enum | `spam \| fake \| scam \| inappropriate \| duplicate \| other` |
| `details` | string | Optional free text |
| `status` | enum | `pending \| reviewed \| resolved \| dismissed` |
| `submittedAt` | timestamp | |
| `resolvedAt` | timestamp | |
| `moderatorId` | string | FK → admin User.id |

---

## Notification

| Field | Type | Notes |
|-------|------|-------|
| `id` * | string | |
| `userId` * | string | Recipient |
| `type` * | enum | `like \| comment \| follow \| reward \| challenge \| event \| message \| system` |
| `fromUserId` | string | Actor (null for system) |
| `targetId` | string | Related entity ID |
| `targetType` | string | |
| `text` * | string | Pre-rendered notification copy |
| `icon` | string | Emoji or icon class |
| `read` | boolean | |
| `createdAt` | timestamp | |

---

*Last updated: 2026-05 — GeoHub v1.0-beta*
