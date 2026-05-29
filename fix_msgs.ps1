$f = "C:\Users\Asus\Desktop\Geohub\real-messages.js"
$t = [IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)

function DoRep([string]$old, [string]$new) {
    $script:t = $script:t.Replace($old, $new)
}

DoRep "window.showToast && window.showToast('Reaction failed')" "window.showToast&&window.showToast(_t('msg_reaction_fail','Reaction failed'))"
DoRep "window.showToast&&window.showToast('Reaction failed')" "window.showToast&&window.showToast(_t('msg_reaction_fail','Reaction failed'))"
DoRep "window.showToast&&window.showToast('Copied')" "window.showToast&&window.showToast(_t('msg_copied','Copied'))"
DoRep "window.showToast&&window.showToast('Could not copy')" "window.showToast&&window.showToast(_t('msg_copy_fail','Could not copy'))"
DoRep "window.showToast&&window.showToast('Conversation restored')" "window.showToast&&window.showToast(_t('msg_conv_restored','Conversation restored'))"
DoRep "window.showToast&&window.showToast('Could not undo')" "window.showToast&&window.showToast(_t('msg_undo_fail','Could not undo'))"
DoRep "window.showToast&&window.showToast('Could not archive')" "window.showToast&&window.showToast(_t('msg_archive_fail','Could not archive'))"
DoRep "window.showToast&&window.showToast('Could not delete conversation')" "window.showToast&&window.showToast(_t('msg_conv_del_fail','Could not delete conversation'))"
DoRep "window.showToast&&window.showToast(isCurrentlyUnread?'Marked as read':'Marked as unread')" "window.showToast&&window.showToast(isCurrentlyUnread?_t('msg_marked_read','Marked as read'):_t('msg_marked_unread','Marked as unread'))"
DoRep "window.showToast&&window.showToast(isPinned?'Unpinned':'Conversation pinned')" "window.showToast&&window.showToast(isPinned?_t('msg_unpinned','Unpinned'):_t('msg_pinned','Conversation pinned'))"
DoRep "window.showToast && window.showToast('Theme update failed')" "window.showToast&&window.showToast(_t('msg_theme_fail','Theme update failed'))"
DoRep "window.showToast&&window.showToast('Nicknames saved')" "window.showToast&&window.showToast(_t('msg_nicknames_saved','Nicknames saved'))"
DoRep "window.showToast && window.showToast(muted?'Conversation unmuted':'Conversation muted')" "window.showToast&&window.showToast(muted?_t('msg_unmuted','Conversation unmuted'):_t('msg_muted','Conversation muted'))"
DoRep "window.showToast && window.showToast('Only image upload is supported')" "window.showToast&&window.showToast(_t('msg_img_only','Only image upload is supported'))"
DoRep "window.showToast && window.showToast('Image must be under 8 MB')" "window.showToast&&window.showToast(_t('msg_img_size','Image must be under 8 MB'))"
DoRep "window.showToast&&window.showToast('Allowed: PDF, DOC, TXT, XLS, CSV')" "window.showToast&&window.showToast(_t('msg_file_types','Allowed: PDF, DOC, TXT, XLS, CSV'))"
DoRep "window.showToast&&window.showToast('File must be under 10 MB')" "window.showToast&&window.showToast(_t('msg_file_size','File must be under 10 MB'))"
DoRep "window.showToast&&window.showToast('Uploading file…')" "window.showToast&&window.showToast(_t('msg_uploading_file','Uploading file…'))"
DoRep "window.showToast&&window.showToast('Upload failed')" "window.showToast&&window.showToast(_t('msg_upload_fail','Upload failed'))"
DoRep "window.showToast&&window.showToast('Uploading voice…')" "window.showToast&&window.showToast(_t('msg_uploading_voice','Uploading voice…'))"
DoRep "window.showToast&&window.showToast('Voice upload failed')" "window.showToast&&window.showToast(_t('msg_voice_fail','Voice upload failed'))"
DoRep "window.showToast && window.showToast('Uploading photo...')" "window.showToast&&window.showToast(_t('msg_uploading_photo','Uploading photo…'))"
DoRep "window.showToast && window.showToast('Image upload failed')" "window.showToast&&window.showToast(_t('msg_photo_fail','Image upload failed'))"
DoRep "window.showToast && window.showToast('Uploading file...')" "window.showToast&&window.showToast(_t('msg_uploading_file','Uploading file…'))"
DoRep "window.showToast && window.showToast('File upload failed')" "window.showToast&&window.showToast(_t('msg_upload_fail','File upload failed'))"
DoRep "window.showToast&&window.showToast('Could not start conversation')" "window.showToast&&window.showToast(_t('msg_conv_start_fail','Could not start conversation'))"

[IO.File]::WriteAllText($f, $t, [Text.Encoding]::UTF8)
Write-Host "Done"
