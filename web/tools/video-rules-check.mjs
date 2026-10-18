// Focused regressions. Writes ONLY to explicitly local demo Firebase emulators.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {initializeApp as initAdmin,deleteApp as deleteAdmin} from 'firebase-admin/app';
import {getFirestore as adminDb} from 'firebase-admin/firestore';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,updateDoc,getDoc,serverTimestamp} from 'firebase/firestore';
const PROJECT='demo-geohub';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
for(const name of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])if(!/^127\.0\.0\.1:\d+$/.test(process.env[name]))throw Error('Only local emulators permitted');
const response=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}:securityRules`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:await readFile('firestore.rules','utf8')}]}})});
assert.ok(response.ok,await response.text());
const adminApp=initAdmin({projectId:PROJECT},'video-rules-admin');const admin=adminDb(adminApp);
const stamp=Date.now().toString(36),clients=[],results=[];
async function client(name,guest=false){const app=initializeApp({apiKey:'demo-key',projectId:PROJECT,authDomain:PROJECT+'.firebaseapp.com'},name+stamp);const auth=getAuth(app);connectAuthEmulator(auth,'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});const db=getFirestore(app);const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');connectFirestoreEmulator(db,host,Number(port));const uid=guest?'':(await createUserWithEmailAndPassword(auth,`${name}_${stamp}@test.ge`,'geohub123')).user.uid;const value={app,db,uid};clients.push(value);return value;}
async function check(name,allowed,operation){try{await operation();if(!allowed)throw Error('Expected refusal');results.push({name,passed:true});console.log('PASS '+name);}catch(error){if(!allowed&&error.code==='permission-denied'){results.push({name,passed:true});console.log('PASS '+name+' (denied)');}else{results.push({name,passed:false,error:error.code||error.message});console.log('FAIL '+name+' '+(error.code||error.message));}}}
const owner=await client('video-owner'),other=await client('video-other'),guest=await client('video-guest',true),manager=await client('video-manager');
const channelId=stamp+'_channel',bizId=stamp+'_business',videoId=stamp+'_video';
await admin.doc('businesses/'+bizId).set({name:'Business',ownerId:owner.uid,status:'active'});await admin.doc(`businesses/${bizId}/admins/${manager.uid}`).set({userId:manager.uid,role:'admin'});
const channel={name:'Own channel',ownerId:owner.uid,avatar:'',subscriberCount:0,videoCount:0};
const video={title:'Video',authorId:owner.uid,status:'active',channelId,youtubeId:'dQw4w9WgXcQ',createdAt:serverTimestamp()};
const comment={text:'Comment',authorId:owner.uid,userId:owner.uid,authorType:'business',businessId:bizId,authorName:'Business',authorAvatar:'',createdAt:serverTimestamp()};
const notification={userId:other.uid,toUserId:other.uid,fromUserId:owner.uid,title:'Reply',type:'comment',createdAt:serverTimestamp()};
try{
 await check('owner creates channel',true,()=>setDoc(doc(owner.db,'channels',channelId),channel));
 await check('guest cannot create channel',false,()=>setDoc(doc(guest.db,'channels',stamp+'_guest'),channel));
 await check('channel owner UID cannot be forged',false,()=>setDoc(doc(other.db,'channels',stamp+'_forged'),channel));
 await check('channel name must be a string',false,()=>setDoc(doc(owner.db,'channels',stamp+'_nonstring'),{...channel,name:[]}));
 await check('channel name cannot be empty',false,()=>setDoc(doc(owner.db,'channels',stamp+'_empty'),{...channel,name:''}));
 await check('channel name has bounded length',false,()=>setDoc(doc(owner.db,'channels',stamp+'_long'),{...channel,name:'x'.repeat(81)}));
 await check('owner publishes on own channel',true,()=>setDoc(doc(owner.db,'videos',videoId),video));
 await check('personal unchannelled legacy publish remains valid',true,()=>setDoc(doc(owner.db,'videos',stamp+'_personal'),{...video,channelId:null}));
 await check('another user cannot publish on owner channel',false,()=>setDoc(doc(other.db,'videos',stamp+'_forged'),{...video,authorId:other.uid}));
 await check('nonexistent channel cannot be claimed',false,()=>setDoc(doc(owner.db,'videos',stamp+'_missing'),{...video,channelId:stamp+'_missing'}));
 await check('published channel identity is immutable',false,()=>updateDoc(doc(owner.db,'videos',videoId),{channelId:null}));
 await check('channel cannot transfer owner through profile edit',false,()=>updateDoc(doc(owner.db,'channels',channelId),{ownerId:other.uid}));
 await check('channel normal owner edit works',true,()=>updateDoc(doc(owner.db,'channels',channelId),{name:'Edited channel'}));
 await check('subscriber may increment count one step',true,()=>updateDoc(doc(other.db,'channels',channelId),{subscriberCount:1}));
 await check('stranger cannot inflate channel counters',false,()=>updateDoc(doc(other.db,'channels',channelId),{subscriberCount:999999}));
 await check('business owner comments with business identity',true,()=>setDoc(doc(owner.db,'videos',videoId,'comments','owner'),comment));
 await check('business manager comments with business identity',true,()=>setDoc(doc(manager.db,'videos',videoId,'comments','manager'),{...comment,authorId:manager.uid,userId:manager.uid}));
 await check('unmanaged business comment rejected',false,()=>setDoc(doc(other.db,'videos',videoId,'comments','forged'),{...comment,authorId:other.uid,userId:other.uid}));
 await check('legacy personal video comment accepted',true,()=>setDoc(doc(other.db,'videos',videoId,'comments','legacy'),{text:'Legacy',authorId:other.uid}));
 await check('comment identity cannot be switched later',false,()=>updateDoc(doc(owner.db,'videos',videoId,'comments','owner'),{authorType:'user',businessId:null}));
 await check('comment text edit preserves identity',true,()=>updateDoc(doc(owner.db,'videos',videoId,'comments','owner'),{text:'Edited'}));
 await check('legacy personal notification accepted',true,()=>setDoc(doc(owner.db,'userNotifications',stamp+'_legacy'),notification));
 await check('explicit personal notification accepted',true,()=>setDoc(doc(owner.db,'userNotifications',stamp+'_personal'),{...notification,fromActorType:'user',fromActorId:owner.uid}));
 await check('managed business notification accepted',true,()=>setDoc(doc(owner.db,'userNotifications',stamp+'_biz'),{...notification,fromActorType:'business',fromActorId:bizId}));
 await check('page manager notification accepted',true,()=>setDoc(doc(manager.db,'userNotifications',stamp+'_manager'),{...notification,fromUserId:manager.uid,fromActorType:'business',fromActorId:bizId}));
 await check('forged business notification rejected',false,()=>setDoc(doc(other.db,'userNotifications',stamp+'_forgedbiz'),{...notification,fromUserId:other.uid,fromActorType:'business',fromActorId:bizId}));
 await check('forged personal notification rejected',false,()=>setDoc(doc(owner.db,'userNotifications',stamp+'_forgedperson'),{...notification,fromActorType:'user',fromActorId:other.uid}));
 await check('incomplete actor metadata rejected',false,()=>setDoc(doc(owner.db,'userNotifications',stamp+'_incomplete'),{...notification,fromActorType:'business'}));
 await check('notification real UID cannot be forged',false,()=>setDoc(doc(other.db,'userNotifications',stamp+'_forgeduid'),notification));
 await check('guest still reads existing videos',true,()=>getDoc(doc(guest.db,'videos',videoId)));
 await writeFile('.codex/artifacts/video-rules-results.json',JSON.stringify({results,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},null,2));
 assert.ok(results.every(result=>result.passed),JSON.stringify(results.filter(result=>!result.passed)));
}finally{await Promise.all(clients.map(c=>deleteApp(c.app)));await deleteAdmin(adminApp);}
