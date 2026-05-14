/* GeoHub Canonical Schema v1
   Single source of truth for Firestore data structures.
   Load this before firestore-social.js and add-business.js on every page.
   Writers must use factory functions. Readers must use normalizers.
*/
(function (root) {
  'use strict';

  /* ── COLLECTION PATHS ────────────────────────────────────── */
  var col = {
    users:              'users',
    posts:              'posts',
    businesses:         'businesses',
    businessAdmins:     'businessAdmins',
    businessStaff:      'businessStaff',
    businessInvites:    'businessEmployeeInvites',
    businessFollowers:  'businessFollowers',
    businessReviews:    'businessReviews',
    groups:             'groups',
    groupMembers:       'groupMembers',
    places:             'places',
    placeReviews:       'placeReviews',
    events:             'events',
    eventParticipants:  'eventParticipants',
    stories:            'stories',
    conversations:      'conversations',
    follows:            'follows',
    friends:            'friends',
    friendRequests:     'friendRequests',
    savedItems:         'savedItems',
    reports:            'reports',
    blockedUsers:       'blockedUsers',
    notifications:      'userNotifications',
    rewards:            'rewards',
    rewardCoupons:      'rewardCoupons',
    pointTransactions:  'pointTransactions',
    admins:             'admins',
    adminFlags:         'adminFlags',
  };

  /* ── SUBCOLLECTION NAMES ─────────────────────────────────── */
  var sub = {
    gallery:   'gallery',
    services:  'services',
    staff:     'staff',
    comments:  'comments',
    replies:   'replies',
    reactions: 'reactions',
    messages:  'messages',
    analytics: 'analytics',
  };

  /* ── ENUMS ───────────────────────────────────────────────── */
  var status = {
    active:       'active',
    suspended:    'suspended',
    under_review: 'under_review',
    pending:      'pending',
    accepted:     'accepted',
    declined:     'declined',
    expired:      'expired',
    inactive:     'inactive',
  };

  var role = {
    owner:  'owner',
    admin:  'admin',
    staff:  'staff',
    member: 'member',
  };

  var bizType = { physical: 'physical', online: 'online' };

  /* ── NORMALIZERS (read old OR new docs → canonical shape) ── */

  function normBiz(doc, id) {
    if (!doc) return null;
    var d = doc;
    return {
      id:              id || d.id || '',
      title:           d.title || d.name || '',
      description:     d.description || d.desc || '',
      category:        d.category || '',
      tags:            Array.isArray(d.tags) ? d.tags : [],
      plan:            d.plan || 'free',
      status:          d.status || 'active',
      verified:        !!d.verified,

      ownerId:         d.ownerId || d.createdBy || d.userId || '',
      ownerName:       d.ownerName || '',
      ownerEmail:      d.ownerEmail || '',

      businessType:    d.businessType || (d.isOnline ? 'online' : 'physical'),
      isOnline:        !!(d.isOnline || d.businessType === 'online'),
      city:            d.city || '',
      address:         d.address || '',
      mapsLink:        d.mapsLink || '',
      serviceArea:     d.serviceArea || '',
      serviceAreaText: d.serviceAreaText || '',

      phone:           d.phone || '',
      email:           d.email || '',
      website:         d.website || '',
      socialLinks: {
        instagram: (d.socialLinks && d.socialLinks.instagram) || d.instagram || '',
        facebook:  (d.socialLinks && d.socialLinks.facebook)  || d.facebook  || '',
        whatsapp:  (d.socialLinks && d.socialLinks.whatsapp)  || d.whatsapp  || '',
      },

      coverUrl:      d.coverUrl || d.coverImageUrl || d.imageUrl || d.image || '',
      logoUrl:       d.logoUrl || '',

      priceRange:    d.priceRange    || '',
      startingPrice: d.startingPrice || '',
      workingHours:  d.workingHours  || null,

      followerCount: Number(d.followerCount) || 0,
      postCount:     Number(d.postCount)     || 0,
      reviewCount:   Number(d.reviewCount)   || 0,
      viewCount:     Number(d.viewCount)     || 0,
      ratingAverage: Number(d.ratingAverage) || 0,
      ratingTotal:   Number(d.ratingTotal)   || 0,
      ratingCount:   Number(d.ratingCount)   || 0,

      createdAt: d.createdAt || null,
      updatedAt: d.updatedAt || null,
    };
  }

  function normUser(doc, id) {
    if (!doc) return null;
    var d = doc;
    return {
      id:        id || d.uid || d.id || '',
      uid:       id || d.uid || d.id || '',
      name:      d.fullName || d.displayName || d.name || '',
      email:     d.email || '',
      avatarUrl: d.photoURL || d.avatar || d.avatarUrl || d.photoUrl || '',
      bio:       d.bio || '',
      city:      d.city || '',
      xp:        Number(d.xp) || 0,
      createdAt: d.createdAt || null,
    };
  }

  function normPost(doc, id) {
    if (!doc) return null;
    var d = doc;
    return {
      id:           id || d.id || '',
      text:         d.text || '',
      mediaUrl:     d.mediaUrl || d.imageUrl || d.photoUrl || '',
      mediaType:    d.mediaType || '',
      authorId:     d.authorId || d.userId || d.createdByUserId || '',
      authorName:   d.authorName || d.userName || '',
      authorAvatar: d.authorAvatar || d.userPhoto || d.avatar || '',
      targetType:   d.targetType || 'user',
      targetId:     d.targetId || '',
      visibility:   d.visibility || 'public',
      status:       d.status || 'active',
      likeCount:    Number(d.likeCount)    || 0,
      commentCount: Number(d.commentCount) || 0,
      shareCount:   Number(d.shareCount)   || 0,
      createdAt:    d.createdAt || null,
    };
  }

  function normGroup(doc, id) {
    if (!doc) return null;
    var d = doc;
    return {
      id:          id || d.id || '',
      title:       d.name || d.title || '',
      description: d.description || d.desc || '',
      category:    d.category || 'general',
      privacy:     d.privacy || 'public',
      coverUrl:    d.coverUrl || d.coverImage || d.imageUrl || d.image || '',
      location:    d.location || '',
      tags:        Array.isArray(d.tags) ? d.tags : [],
      creatorId:   d.creatorId || d.userId || '',
      memberCount: Number(d.memberCount) || 0,
      postCount:   Number(d.postCount)   || 0,
      createdAt:   d.createdAt || null,
    };
  }

  function normReview(doc, id) {
    if (!doc) return null;
    var d = doc;
    return {
      id:         id || d.id || '',
      businessId: d.businessId || '',
      userId:     d.userId || '',
      userName:   d.userName || '',
      avatarUrl:  d.userAvatarUrl || d.userPhoto || d.avatar || '',
      rating:     Number(d.rating) || 0,
      text:       d.text || d.comment || '',
      status:     d.status || 'active',
      helpful:    Number(d.helpful) || 0,
      reported:   !!d.reported,
      editedAt:            d.editedAt            || null,
      ownerReply:          d.ownerReply          || null,
      reportCount:         Number(d.reportCount) || 0,
      hidden:              !!d.hidden,
      moderationStatus:    d.moderationStatus    || 'active',
      verifiedInteraction: !!d.verifiedInteraction,
      helpfulCount:        Number(d.helpfulCount || d.helpful) || 0,
      createdAt:  d.createdAt || null,
    };
  }

  /* ── FACTORIES (write clean documents to Firestore) ─────── */

  function newBusiness(fields, userId, userName, userEmail, ts) {
    return {
      title:           fields.title || '',
      description:     fields.description || '',
      category:        fields.category || '',
      tags:            Array.isArray(fields.tags) ? fields.tags.slice(0, 8) : [],
      plan:            fields.plan || 'free',
      status:          'active',
      verified:        false,

      ownerId:         userId || '',
      ownerName:       userName || '',
      ownerEmail:      userEmail || '',

      businessType:    fields.businessType || 'physical',
      isOnline:        fields.businessType === 'online',
      city:            fields.businessType === 'online' ? '' : (fields.city || ''),
      address:         fields.businessType === 'online' ? '' : (fields.address || ''),
      mapsLink:        fields.businessType === 'online' ? '' : (fields.mapsLink || ''),
      serviceArea:     fields.serviceArea || (fields.businessType === 'online' ? 'georgia' : ''),
      serviceAreaText: fields.serviceAreaText || '',

      phone:   fields.phone   || '',
      email:   fields.email   || '',
      website: fields.website || '',
      socialLinks: {
        instagram: fields.instagram || '',
        facebook:  fields.facebook  || '',
        whatsapp:  fields.whatsapp  || '',
      },

      coverUrl: fields.coverUrl || '',
      logoUrl:  fields.logoUrl  || '',

      priceRange:    fields.priceRange    || '',
      startingPrice: fields.startingPrice || '',
      workingHours:  fields.workingHours  || null,

      followerCount: 0,
      postCount:     0,
      reviewCount:   0,
      viewCount:     0,
      ratingAverage: 0,
      ratingTotal:   0,
      ratingCount:   0,

      createdAt: ts,
      updatedAt: ts,
    };
  }

  function newGalleryPhoto(url, uploadedBy, caption, order, ts) {
    return {
      url:        url || '',
      caption:    caption || '',
      order:      Number(order) || 0,
      uploadedBy: uploadedBy || '',
      createdAt:  ts,
    };
  }

  function newService(fields, createdBy, order, ts) {
    return {
      title:       fields.title || fields.name || '',
      description: fields.description || '',
      price:       fields.price || '',
      currency:    fields.currency || 'GEL',
      category:    fields.category || '',
      status:      'active',
      order:       Number(order) || 0,
      createdBy:   createdBy || '',
      createdAt:   ts,
      updatedAt:   ts,
    };
  }

  function newStaff(businessId, userId, role, invitedBy, ts) {
    return {
      businessId: businessId || '',
      userId:     userId || '',
      role:       role || 'staff',
      status:     'invited',
      invitedBy:  invitedBy || '',
      invitedAt:  ts,
      joinedAt:   null,
    };
  }

  function newInvite(businessId, businessTitle, inviteeEmail, role, sentBy, ts) {
    return {
      businessId:    businessId    || '',
      businessTitle: businessTitle || '',
      inviteeEmail:  inviteeEmail  || '',
      role:          role          || 'staff',
      status:        'pending',
      sentBy:        sentBy || '',
      createdAt:     ts,
      expiresAt:     null,
      acceptedAt:    null,
    };
  }

  function newAnalyticsDay(date, ts) {
    return {
      date:              date || '',
      views:             0,
      uniqueViews:       0,
      phoneClicks:       0,
      whatsappClicks:    0,
      emailClicks:       0,
      bookingClicks:     0,
      websiteClicks:     0,
      directionsClicks:  0,
      serviceClicks:     0,
      galleryViews:      0,
      follows:           0,
      unfollows:         0,
      postImpressions:   0,
      postEngagements:   0,
      reviewsReceived:   0,
      updatedAt:         ts,
    };
  }

  function newReport(reporterId, targetType, targetId, reason, details, ts) {
    return {
      reporterId:  reporterId  || '',
      targetType:  targetType  || '',
      targetId:    targetId    || '',
      reason:      reason      || '',
      details:     details     || '',
      status:      'pending',
      reviewedBy:  null,
      reviewedAt:  null,
      createdAt:   ts,
    };
  }

  function newBusinessReview(businessId, userId, userName, avatarUrl, rating, text, ts) {
    return {
      businessId:   businessId || '',
      userId:       userId     || '',
      userName:     userName   || '',
      userAvatarUrl: avatarUrl || '',
      rating:       Number(rating) || 0,
      text:         text || '',
      status:       'active',
      helpful:      0,
      reported:     false,
      createdAt:    ts,
      updatedAt:    ts,
    };
  }

  /* ── EXPORT ──────────────────────────────────────────────── */
  root.GH = {
    col:   col,
    sub:   sub,
    status: status,
    role:  role,
    bizType: bizType,

    normBiz:    normBiz,
    normUser:   normUser,
    normPost:   normPost,
    normGroup:  normGroup,
    normReview: normReview,

    newBusiness:      newBusiness,
    newGalleryPhoto:  newGalleryPhoto,
    newService:       newService,
    newStaff:         newStaff,
    newInvite:        newInvite,
    newAnalyticsDay:  newAnalyticsDay,
    newReport:        newReport,
    newBusinessReview: newBusinessReview,
  };

})(typeof window !== 'undefined' ? window : this);
