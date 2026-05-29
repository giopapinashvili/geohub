$f = 'business-page.js'
$c = [IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)

# Patterns with slightly different spacing/quoting
$c = $c.Replace("showToast('Visibility: ' + (labels[vis] || vis))", "showToast(_bpt('visibility','Visibility')+': ' + (labels[vis] || vis))")
$c = $c.Replace("showToast('Visibility: '+(labels[vis]||vis))", "showToast(_bpt('visibility','Visibility')+': '+(labels[vis]||vis))")
$c = $c.Replace("showToast('Could not save: '+(err.code||err.message), false)", "showToast(_bpt('post_save_fail')+': '+(err.code||err.message), false)")
$c = $c.Replace("showToast('Delete failed: ' + (err.code || err.message), false)", "showToast(_bpt('post_del_fail')+': '+(err.code||err.message), false)")
$c = $c.Replace("showToast('Could not update: '+(err.code||err.message), false)", "showToast(_bpt('update_fail')+': '+(err.code||err.message), false)")
$c = $c.Replace("showToast('Please fill in name, email, and message',false)", "showToast(_bpt('please_fill_contact'),false)")
$c = $c.Replace("showToast('Please sign in',false)", "showToast(_bpt('please_sign_in'),false)")
$c = $c.Replace("showToast('Could not send. Try again.',false)", "showToast(_bpt('send_fail'),false)")
$c = $c.Replace("showToast('Sign in to post',false)", "showToast(_bpt('sign_in_to_post'),false)")
$c = $c.Replace("showToast('Write something or add a photo',false)", "showToast(_bpt('write_something'),false)")
$c = $c.Replace("showToast('Sign in to like posts',false)", "showToast(_bpt('sign_in_to_like'),false)")
$c = $c.Replace("showToast('Could not like',false)", "showToast(_bpt('soc_reaction_fail'),false)")
$c = $c.Replace("showToast('Sign in to review',false)", "showToast(_bpt('sign_in_to_review'),false)")
$c = $c.Replace("showToast('Please select a star rating',false)", "showToast(_bpt('please_rate'),false)")
$c = $c.Replace("showToast('Please write a review',false)", "showToast(_bpt('please_write_review'),false)")
$c = $c.Replace("showToast('Could not post review',false)", "showToast(_bpt('review_post_fail'),false)")

# Post failed with dynamic err
$c = $c.Replace("showToast('Post failed: '+(err.code||err.message||'check console'),false)", "showToast(_bpt('post_save_fail')+': '+(err.code||err.message||'?'),false)")

# Uploading states with ellipsis character
$uploadEllipsis = [char]0x2026
$c = $c.Replace("showToast('Uploading cover" + $uploadEllipsis + "')", "showToast(_bpt('uploading_cover'))")
$c = $c.Replace("showToast('Uploading logo" + $uploadEllipsis + "')", "showToast(_bpt('uploading_logo'))")
$c = $c.Replace("showToast('Uploading photo" + $uploadEllipsis + "')", "showToast(_bpt('uploading_photo'))")
$c = $c.Replace("showToast('Uploading" + $uploadEllipsis + "')", "showToast(_bpt('uploading'))")
$c = $c.Replace("showToast('Uploading" + $uploadEllipsis + " '", "showToast(_bpt('uploading')+' '")
$c = $c.Replace("showToast('Upload failed', false)", "showToast(_bpt('upload_failed'), false)")

[IO.File]::WriteAllText($f, $c, [Text.Encoding]::UTF8)
Write-Host 'Done'
