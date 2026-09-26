import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Modal, Confirm } from '../ui/Modal.jsx';
import { TextField, TextArea } from '../ui/Field.jsx';
import { Card, Empty, Img, PageSpinner, Spinner } from '../ui/misc.jsx';
import { t, tn } from '../lib/i18n.js';
import { useTitle, useLive, useAsync } from '../lib/hooks.js';
import { formatDate, formatTime, timeAgo } from '../lib/format.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { uid, isAdmin, profile } from '../lib/auth.js';
import { requireLogin, openComposer } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import {
  listenGroup, listenMembership, joinGroup, leaveGroup, listenMyJoinRequest, requestToJoin, cancelJoinRequest, claimApprovedMembership,
  listenJoinRequests, answerJoinRequest, listMembers, setMemberRole, removeMember, isManagerRole, deleteGroup, updateGroup,
  listGroupEvents, createGroupEvent, deleteGroupEvent, myGroupRsvp, setGroupRsvp,
} from '../data/groups.js';
import { listenTargetPosts, editPost } from '../data/posts.js';
import { useUser } from '../features/user/useUser.js';
import { PostCard } from '../features/post/PostCard.jsx';
import { copyLink } from '../features/post/ShareDialog.jsx';
import { groupCatLabel } from './Groups.jsx';

function Posts({ group, member, manager }) {
  const [posts, setPosts] = useState(null);
  useEffect(() => listenTargetPosts('group', group.id, setPosts), [group.id]);
  const p = profile.value;
  const visible = (posts || []).filter((x) => x.status === 'active' || manager || x.authorId === uid.value);
  return (
    <div class="feed">
      {member && (
        <Card class="composer-card">
          <div class="composer-card-top">
            <Avatar src={p?.avatar} name={p?.name || ''} size={40} />
            <button type="button" class="composer-card-input" onClick={() => openComposer({ groupId: group.id, groupPrivacy: group.privacy, needsApproval: group.postApproval && !manager })}>{t('groups.writeHere')}</button>
          </div>
        </Card>
      )}
      {!posts ? <div class="center-pad"><Spinner /></div> : visible.length ? visible.map((x) => (
        <div key={x.id} class={x.status === 'pending' ? 'pending-post' : ''}>
          {x.status === 'pending' && (
            <div class="pending-bar"><Icon name="hourglass" size={16} />{t('groups.pendingPost')}
              {manager && <><Button size="sm" variant="primary" onClick={() => editPost(x.id, { status: 'active' }).catch(() => toast.error(t('common.error')))}>{t('groups.approve')}</Button>
                <Button size="sm" variant="ghost" onClick={() => editPost(x.id, { status: 'declined' }).catch(() => toast.error(t('common.error')))}>{t('groups.decline')}</Button></>}
            </div>
          )}
          <PostCard post={x} />
        </div>
      )) : <Card><Empty compact icon="note-pencil" title={t('groups.noPosts')} /></Card>}
    </div>
  );
}

function MemberRow({ m, group, manager, onChange }) {
  const u = useUser(m.userId);
  const isOwner = group.ownerId === m.userId;
  return (
    <div class="visitor">
      <Avatar src={u?.avatar} name={u?.name || ''} size={40} href={`/u/${m.userId}`} />
      <a href={`/u/${m.userId}`} class="grow ellipsis bold">{u?.name || '…'}</a>
      {isManagerRole(m.role) && <span class="tag tag-brand">{t(isOwner ? 'groups.owner' : `groups.role.${m.role}`)}</span>}
      {manager && !isOwner && m.userId !== uid.value && (
        <Menu label={t('common.more')} width={220} items={[
          { icon: 'shield-check', label: t('groups.makeAdmin'), hidden: m.role === 'admin', onClick: () => setMemberRole(group.id, m.userId, 'admin').then(onChange) },
          { icon: 'user', label: t('groups.makeMember'), hidden: m.role === 'member', onClick: () => setMemberRole(group.id, m.userId, 'member').then(onChange) },
          { icon: 'user-minus', label: t('groups.remove'), danger: true, onClick: () => removeMember(group, m.userId).then(onChange) },
        ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} size={34} />} />
      )}
    </div>
  );
}

function Members({ group, manager }) {
  const { data, reload } = useAsync(() => listMembers(group.id), [group.id]);
  return <Card>{!data ? <Spinner /> : <div class="visitor-list">{data.map((m) => <MemberRow key={m.id} m={m} group={group} manager={manager} onChange={reload} />)}</div>}</Card>;
}

function Requests({ group }) {
  const [list, setList] = useState(null);
  useEffect(() => listenJoinRequests(group.id, setList), [group.id]);
  if (!list) return <Spinner />;
  if (!list.length) return <Card><Empty compact icon="user-plus" title={t('groups.noRequests')} /></Card>;
  return (
    <Card><div class="visitor-list">{list.map((r) => (
      <div key={r.id} class="visitor">
        <Avatar src={r.userPhoto} name={r.userName} size={40} href={`/u/${r.userId}`} />
        <span class="grow"><strong class="ellipsis" style={{ display: 'block' }}>{r.userName}</strong><span class="muted xs">{timeAgo(r.createdAt)}</span></span>
        <Button size="sm" variant="primary" onClick={() => answerJoinRequest(group, r, true).catch(() => toast.error(t('common.error')))}>{t('groups.approve')}</Button>
        <Button size="sm" variant="secondary" onClick={() => answerJoinRequest(group, r, false).catch(() => toast.error(t('common.error')))}>{t('groups.decline')}</Button>
      </div>
    ))}</div></Card>
  );
}

function GroupEvent({ group, ev, manager, onChange }) {
  const [going, setGoing] = useState(false);
  useEffect(() => { myGroupRsvp(group.id, ev.id).then(setGoing); }, [ev.id]);
  return (
    <div class="service-row">
      <div class="grow"><strong>{ev.title}</strong><p class="muted small">{formatDate(ev.date, { weekday: true })} · {formatTime(ev.date)}{ev.venue ? ` · ${ev.venue}` : ''}</p>{ev.description && <p class="small">{ev.description}</p>}</div>
      <Button size="sm" variant={going ? 'primary' : 'secondary'} icon={going ? 'check' : 'calendar-check'} onClick={() => { if (requireLogin('rsvp')) setGroupRsvp(group.id, ev.id, !going).then(() => setGoing(!going)).catch(() => toast.error(t('common.error'))); }}>{t('events.imGoing')}</Button>
      {manager && <IconButton icon="trash" label={t('common.delete')} size={32} onClick={() => deleteGroupEvent(group.id, ev.id).then(onChange)} />}
    </div>
  );
}

function Events({ group, manager }) {
  const { data, reload } = useAsync(() => listGroupEvents(group.id), [group.id]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', date: '', venue: '', description: '' });
  const create = () => createGroupEvent(group.id, f).then(() => { setOpen(false); setF({ title: '', date: '', venue: '', description: '' }); reload(); }).catch(() => toast.error(t('common.error')));
  return (
    <Card>
      <div class="card-head"><h2 class="card-title">{t('nav.events')}</h2>{manager && <Button size="sm" variant="primary" icon="plus" onClick={() => setOpen(true)}>{t('events.create')}</Button>}</div>
      {!data ? <Spinner /> : data.length ? <div class="service-list">{data.map((ev) => <GroupEvent key={ev.id} group={group} ev={ev} manager={manager} onChange={reload} />)}</div> : <Empty compact icon="calendar-blank" title={t('events.none')} />}
      <Modal open={open} onClose={() => setOpen(false)} title={t('events.create')} size="sm"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" disabled={!f.title.trim() || !f.date} onClick={create}>{t('common.publish')}</Button></>}>
        <div class="stack">
          <TextField label={t('events.title')} value={f.title} onInput={(e) => setF({ ...f, title: e.currentTarget.value })} maxLength={100} />
          <TextField label={t('events.starts')} type="datetime-local" value={f.date} onInput={(e) => setF({ ...f, date: e.currentTarget.value })} />
          <TextField label={t('events.venue')} optional={t('common.optional')} value={f.venue} onInput={(e) => setF({ ...f, venue: e.currentTarget.value })} maxLength={100} />
          <TextArea label={t('common.description')} optional={t('common.optional')} value={f.description} onInput={(e) => setF({ ...f, description: e.currentTarget.value })} maxLength={1000} minRows={2} />
        </div>
      </Modal>
    </Card>
  );
}

function About({ group, manager }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(group.description);
  const [rules, setRules] = useState(group.rules.join('\n'));
  const save = () => updateGroup(group.id, { description: desc, rules: rules.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 20) }).then(() => { setEditing(false); toast.success(t('biz.saved')); }).catch(() => toast.error(t('common.error')));
  if (editing) {
    return (
      <Card><div class="stack">
        <TextArea label={t('common.description')} value={desc} onInput={(e) => setDesc(e.currentTarget.value)} maxLength={2000} minRows={3} />
        <TextArea label={t('groups.rules')} hint={t('groups.rulesHint')} value={rules} onInput={(e) => setRules(e.currentTarget.value)} maxLength={2000} minRows={3} />
        <div class="row gap-8"><Button variant="primary" onClick={save}>{t('common.save')}</Button><Button variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button></div>
      </div></Card>
    );
  }
  return (
    <Card>
      <div class="card-head"><h2 class="card-title">{t('groups.about')}</h2>{manager && <Button size="sm" variant="ghost" icon="pencil-simple" onClick={() => setEditing(true)}>{t('common.edit')}</Button>}</div>
      <p class="place-desc">{group.description || t('place.noDescription')}</p>
      <ul class="event-facts">
        <li><Icon name={group.privacy === 'private' ? 'lock' : 'globe-simple'} size={18} />{t(group.privacy === 'private' ? 'groups.privateHint' : 'groups.publicHint')}</li>
        <li><Icon name="tag" size={18} />{groupCatLabel(group.category)}</li>
        {group.createdAt > 0 && <li><Icon name="calendar-blank" size={18} />{t('groups.createdOn', { date: formatDate(group.createdAt) })}</li>}
      </ul>
      {group.rules.length > 0 && <><h3 class="card-title" style={{ marginTop: 16 }}>{t('groups.rules')}</h3><ol class="group-rules">{group.rules.map((r, i) => <li key={i}>{r}</li>)}</ol></>}
    </Card>
  );
}

/** Group page: join / request, posts (with approval), about, members, events, requests. */
export default function GroupPage({ params }) {
  const { data: group, loading } = useLive((ok, err) => listenGroup(params.id, ok, err), [params.id]);
  const [member, setMember] = useState(undefined);
  const [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  useTitle(group?.name || t('nav.groups'));
  useEffect(() => listenMembership(params.id, setMember), [params.id, uid.value]);
  useEffect(() => listenMyJoinRequest(params.id, setRequest), [params.id, uid.value]);
  useEffect(() => { if (group && member === null && request?.status === 'approved') claimApprovedMembership(group, request).then((ok) => ok && toast.success(t('groups.welcome'))); }, [group?.id, member, request?.status]);
  const tab = query.value.get('tab') || 'posts';

  if (loading || member === undefined) return <PageSpinner />;
  if (!group) return <Card><Empty icon="users-three" title={t('groups.notFound')} action={<Button variant="primary" href="/groups">{t('nav.groups')}</Button>} /></Card>;
  const manager = isAdmin.value || isManagerRole(member?.role) || group.ownerId === uid.value;
  const isMember = !!member;
  const locked = group.privacy === 'private' && !isMember && !isAdmin.value;

  const join = async () => {
    if (!requireLogin('group')) return;
    setBusy(true);
    try {
      if (group.privacy === 'private') { if (request) await cancelJoinRequest(group.id); else { await requestToJoin(group); toast.success(t('groups.requestSent')); } }
      else { await joinGroup(group); toast.success(t('groups.welcome')); }
    } catch { toast.error(t('common.error')); }
    setBusy(false);
  };

  return (
    <div class="place-page">
      <Card class="place-hero" pad={false}>
        <div class="event-cover">{group.cover ? <Img src={group.cover} width={1400} alt="" eager /> : <span class="biz-cover-fallback">{group.emoji || '👥'}</span>}</div>
        <div class="place-head">
          <h1 class="place-name">{group.name}</h1>
          <p class="place-meta"><span><Icon name={group.privacy === 'private' ? 'lock' : 'globe-simple'} size={15} />{t(group.privacy === 'private' ? 'groups.private' : 'groups.public')}</span><span>{tn('groups.members', group.memberCount)}</span></p>
          <div class="place-actions">
            {isMember ? (
              <>
                <Button variant="primary" icon="note-pencil" onClick={() => openComposer({ groupId: group.id, groupPrivacy: group.privacy, needsApproval: group.postApproval && !manager })}>{t('groups.write')}</Button>
                <Menu label={t('groups.joined')} width={220} items={[
                  { icon: 'sign-out', label: t('groups.leave'), danger: true, hidden: group.ownerId === uid.value, onClick: () => setConfirm('leave') },
                ]} trigger={(p) => <Button {...p} variant="secondary" icon="check" iconRight="caret-down">{t('groups.joined')}</Button>} />
              </>
            ) : (
              <Button variant={request ? 'secondary' : 'primary'} icon={request ? 'hourglass' : 'user-plus'} loading={busy} onClick={join}>
                {t(request ? 'groups.cancelRequest' : group.privacy === 'private' ? 'groups.requestJoin' : 'groups.join')}
              </Button>
            )}
            <Menu label={t('common.more')} width={220} items={[
              { icon: 'share-fat', label: t('common.copyLink'), onClick: () => copyLink(`${location.origin}/groups/${group.id}`) },
              { icon: 'trash', label: t('groups.delete'), danger: true, hidden: !(group.ownerId === uid.value || isAdmin.value), onClick: () => setConfirm('delete') },
            ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} variant="soft" size={40} />} />
          </div>
        </div>
        {!locked && (
          <div class="place-tabs">
            <Tabs value={tab} onChange={(v) => setQuery({ tab: v === 'posts' ? null : v })} label={group.name} items={[
              { value: 'posts', label: t('place.posts') },
              { value: 'about', label: t('groups.about') },
              { value: 'members', label: t('groups.membersTab') },
              { value: 'events', label: t('nav.events') },
              { value: 'requests', label: t('groups.requests'), hidden: !manager || group.privacy !== 'private' },
            ]} />
          </div>
        )}
      </Card>
      <div class="place-body">
        {locked ? <Card><Empty icon="lock" title={t('groups.lockedTitle')} text={t('groups.lockedText')} /></Card> : (
          <>
            {tab === 'posts' && <Posts group={group} member={isMember} manager={manager} />}
            {tab === 'about' && <About group={group} manager={manager} />}
            {tab === 'members' && <Members group={group} manager={manager} />}
            {tab === 'events' && <Events group={group} manager={manager} />}
            {tab === 'requests' && manager && <Requests group={group} />}
          </>
        )}
      </div>
      <Confirm open={!!confirm} danger title={t(confirm === 'delete' ? 'groups.deleteTitle' : 'groups.leaveTitle')} confirmLabel={t(confirm === 'delete' ? 'common.delete' : 'groups.leave')} onClose={() => setConfirm('')}
        onConfirm={() => (confirm === 'delete'
          ? deleteGroup(group.id).then(() => navigate('/groups'))
          : leaveGroup(group)).catch(() => toast.error(t('common.error')))} />
    </div>
  );
}
