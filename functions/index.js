'use strict';

const { initializeApp }     = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');

initializeApp();
const db = getFirestore();

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

/* Store idempotency result — fire-and-forget, never throws */
function saveIdempotencyResult(fromUserId, requestId, result) {
  if (!requestId) return;
  const key = `${fromUserId}_${requestId}`;
  db.collection('processedRequests').doc(key)
    .set({ result, createdAt: FieldValue.serverTimestamp() })
    .catch(() => {});
}

/* Check idempotency — returns cached result or null */
async function checkIdempotency(fromUserId, requestId) {
  if (!requestId) return null;
  const key = `${fromUserId}_${requestId}`;
  const snap = await db.collection('processedRequests').doc(key).get();
  return snap.exists ? snap.data().result : null;
}

/* ─────────────────────────────────────────────────────────────────
   transferPoints
   Peer-to-peer loyalty point transfer.
   Limits: 10–500 pts per tx, 2000 pts/day sent.
───────────────────────────────────────────────────────────────── */
exports.transferPoints = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

  const fromUserId = request.auth.uid;
  const { toUserId, amount, message, requestId } = request.data;

  // ── Validate inputs ──────────────────────────────────────────
  if (!toUserId || typeof toUserId !== 'string' || !toUserId.trim()) {
    throw new HttpsError('invalid-argument', 'toUserId is required');
  }
  const recipientId = toUserId.trim();
  if (recipientId === fromUserId) {
    throw new HttpsError('invalid-argument', 'You cannot transfer points to yourself');
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    throw new HttpsError('invalid-argument', 'amount must be an integer');
  }
  if (amount < 10)  throw new HttpsError('invalid-argument', 'Minimum transfer is 10 pts');
  if (amount > 500) throw new HttpsError('invalid-argument', 'Maximum transfer is 500 pts per transaction');
  if (message && typeof message === 'string' && message.length > 140) {
    throw new HttpsError('invalid-argument', 'Message must be 140 characters or fewer');
  }

  // ── Idempotency check ────────────────────────────────────────
  const cached = await checkIdempotency(fromUserId, requestId);
  if (cached) return cached;

  // ── Verify receiver exists ───────────────────────────────────
  const senderRef   = db.collection('users').doc(fromUserId);
  const receiverRef = db.collection('users').doc(recipientId);
  const receiverSnap = await receiverRef.get();
  if (!receiverSnap.exists) throw new HttpsError('not-found', 'Recipient user not found');

  // ── Daily cap ref (denormalised counter, avoids composite index) ─
  const dailyRef = db.collection('dailyTransferTotals').doc(`${fromUserId}_${todayStr()}`);

  // ── Transaction ──────────────────────────────────────────────
  const result = await db.runTransaction(async (tx) => {
    const [senderSnap, dailySnap] = await Promise.all([
      tx.get(senderRef),
      tx.get(dailyRef),
    ]);

    const senderData = senderSnap.data() || {};
    const balance    = Number(senderData.pointsBalance || 0);
    const dailyTotal = dailySnap.exists ? Number(dailySnap.data().total || 0) : 0;

    if (balance < amount) {
      throw new HttpsError('failed-precondition',
        `Insufficient balance — you have ${balance} pts, need ${amount} pts`);
    }
    if (dailyTotal + amount > 2000) {
      throw new HttpsError('resource-exhausted',
        `Daily transfer limit exceeded — used ${dailyTotal}/2000 pts today`);
    }

    const sentRef     = db.collection('pointTransactions').doc();
    const receivedRef = db.collection('pointTransactions').doc();
    const now         = FieldValue.serverTimestamp();

    // Update sender
    tx.update(senderRef, {
      pointsBalance:          FieldValue.increment(-amount),
      totalPointsTransferred: FieldValue.increment(amount),
      updatedAt:              now,
    });

    // Update receiver
    tx.update(receiverRef, {
      pointsBalance:        FieldValue.increment(amount),
      totalPointsReceived:  FieldValue.increment(amount),
      updatedAt:            now,
    });

    // Update daily cap counter
    tx.set(dailyRef, {
      uid:       fromUserId,
      date:      todayStr(),
      total:     FieldValue.increment(amount),
      updatedAt: now,
    }, { merge: true });

    // Shared transaction record fields
    const txBase = {
      fromUserId,
      toUserId:       recipientId,
      amount,
      message:        (message && message.trim()) || null,
      source:         'transferPoints',
      status:         'completed',
      participantIds: [fromUserId, recipientId],
      createdAt:      now,
      createdBy:      fromUserId,
    };

    tx.set(sentRef,     { ...txBase, type: 'transfer_sent'     });
    tx.set(receivedRef, { ...txBase, type: 'transfer_received' });

    return { success: true, newBalance: balance - amount, transferred: amount };
  });

  saveIdempotencyResult(fromUserId, requestId, result);
  return result;
});

/* ─────────────────────────────────────────────────────────────────
   redeemReward
   Deduct points and issue a userReward record atomically.
───────────────────────────────────────────────────────────────── */
exports.redeemReward = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

  const userId = request.auth.uid;
  const { rewardId, requestId } = request.data;

  if (!rewardId || typeof rewardId !== 'string') {
    throw new HttpsError('invalid-argument', 'rewardId is required');
  }

  // ── Idempotency check ────────────────────────────────────────
  const cached = await checkIdempotency(userId, requestId);
  if (cached) return cached;

  const rewardRef = db.collection('rewards').doc(rewardId);
  const userRef   = db.collection('users').doc(userId);

  const result = await db.runTransaction(async (tx) => {
    const [rewardSnap, userSnap] = await Promise.all([
      tx.get(rewardRef),
      tx.get(userRef),
    ]);

    if (!rewardSnap.exists) throw new HttpsError('not-found', 'Reward not found');

    const rd = rewardSnap.data();
    const ud = userSnap.data() || {};

    if (!rd.active) {
      throw new HttpsError('failed-precondition', 'This reward is no longer available');
    }

    const stock = rd.stock != null ? Number(rd.stock) : null;
    if (stock !== null && stock <= 0) {
      throw new HttpsError('resource-exhausted', 'This reward is out of stock');
    }

    const cost    = Number(rd.cost || rd.pointsCost || 0);
    const balance = Number(ud.pointsBalance || 0);

    if (balance < cost) {
      throw new HttpsError('failed-precondition',
        `Insufficient balance — you have ${balance} pts, need ${cost} pts`);
    }

    const userRewardRef = db.collection('userRewards').doc();
    const txRef         = db.collection('pointTransactions').doc();
    const now           = FieldValue.serverTimestamp();

    tx.update(userRef, {
      pointsBalance:    FieldValue.increment(-cost),
      totalPointsSpent: FieldValue.increment(cost),
      updatedAt:        now,
    });

    if (stock !== null) {
      tx.update(rewardRef, { stock: FieldValue.increment(-1), updatedAt: now });
    }

    tx.set(userRewardRef, {
      userId,
      rewardId,
      rewardTitle: rd.title || 'Reward',
      cost,
      status:      'active',
      source:      'redeemReward',
      redeemedAt:  now,
      createdAt:   now,
      createdBy:   userId,
    });

    tx.set(txRef, {
      type:           'redeem',
      fromUserId:     userId,
      toUserId:       null,
      amount:         cost,
      rewardId,
      rewardTitle:    rd.title || 'Reward',
      source:         'redeemReward',
      status:         'completed',
      participantIds: [userId],
      createdAt:      now,
      createdBy:      userId,
    });

    return { success: true, rewardTitle: rd.title || 'Reward', cost, newBalance: balance - cost };
  });

  saveIdempotencyResult(userId, requestId, result);
  return result;
});

/* ─────────────────────────────────────────────────────────────────
   adminAdjustPoints
   Admin-only balance adjustment with mandatory reason.
   Amount can be positive (award) or negative (deduct).
   Balance cannot go below 0.
───────────────────────────────────────────────────────────────── */
exports.adminAdjustPoints = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

  const callerUid = request.auth.uid;

  // ── Admin check ──────────────────────────────────────────────
  const adminSnap = await db.collection('admins').doc(callerUid).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'Admin access required');
  }

  const { userId, amount, reason } = request.data;

  if (!userId || typeof userId !== 'string') {
    throw new HttpsError('invalid-argument', 'userId is required');
  }
  if (typeof amount !== 'number') {
    throw new HttpsError('invalid-argument', 'amount must be a number');
  }
  if (amount === 0) {
    throw new HttpsError('invalid-argument', 'amount cannot be zero');
  }
  if (!reason || !String(reason).trim()) {
    throw new HttpsError('invalid-argument', 'reason is required');
  }

  const userRef = db.collection('users').doc(userId);
  const txRef   = db.collection('pointTransactions').doc();

  const result = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');

    const currentBalance = Number(userSnap.data().pointsBalance || 0);
    const newBalance     = currentBalance + amount;

    if (newBalance < 0) {
      throw new HttpsError('failed-precondition',
        `Balance cannot go below 0 (current: ${currentBalance}, adjustment: ${amount})`);
    }

    const now = FieldValue.serverTimestamp();

    tx.update(userRef, {
      pointsBalance: FieldValue.increment(amount),
      updatedAt:     now,
    });

    tx.set(txRef, {
      type:           'admin_adjustment',
      fromUserId:     callerUid,
      toUserId:       userId,
      amount,
      reason:         String(reason).trim(),
      source:         'adminAdjustPoints',
      status:         'completed',
      participantIds: [userId, callerUid],
      createdAt:      now,
      createdBy:      callerUid,
    });

    return {
      success:         true,
      userId,
      previousBalance: currentBalance,
      newBalance,
      adjustment:      amount,
    };
  });

  return result;
});

/* ─────────────────────────────────────────────────────────────────
   Counter triggers — server-authoritative likeCount / commentCount
   Client writes are best-effort (optimistic UI); these functions
   keep the counts accurate and prevent client-side forgery.
───────────────────────────────────────────────────────────────── */

// Reaction created → likeCount +1
exports.onReactionCreated = onDocumentCreated(
  'posts/{postId}/reactions/{uid}',
  async (event) => {
    const postRef = db.collection('posts').doc(event.params.postId);
    await postRef.update({
      likeCount:     FieldValue.increment(1),
      reactionCount: FieldValue.increment(1),
    }).catch(() => {});
  }
);

// Reaction deleted → likeCount -1
exports.onReactionDeleted = onDocumentDeleted(
  'posts/{postId}/reactions/{uid}',
  async (event) => {
    const postRef = db.collection('posts').doc(event.params.postId);
    await postRef.update({
      likeCount:     FieldValue.increment(-1),
      reactionCount: FieldValue.increment(-1),
    }).catch(() => {});
  }
);

// Comment created → commentCount +1
exports.onCommentCreated = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    const data = event.data && event.data.data ? event.data.data() : null;
    // Only count top-level comments; replies have a parentId field
    if (data && data.parentId) return;
    const postRef = db.collection('posts').doc(event.params.postId);
    await postRef.update({ commentCount: FieldValue.increment(1) }).catch(() => {});
  }
);

// Comment deleted → commentCount -1
exports.onCommentDeleted = onDocumentDeleted(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    const data = event.data && event.data.data ? event.data.data() : null;
    if (data && data.parentId) return;
    const postRef = db.collection('posts').doc(event.params.postId);
    await postRef.update({ commentCount: FieldValue.increment(-1) }).catch(() => {});
  }
);
