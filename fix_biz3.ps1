$f = 'business-page.js'
$c = [IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)

$c = $c.Replace("showToast('Could not save', false)", "showToast(_bpt('post_save_fail'), false)")
$c = $c.Replace("showToast('Upload failed',false)", "showToast(_bpt('upload_failed'),false)")
$c = $c.Replace("showToast('Could not delete', false)", "showToast(_bpt('post_del_fail'), false)")
$c = $c.Replace("showToast('RSVP saved: '+status.replace('_',' '))", "showToast(_bpt('rsvp_saved')+': '+status.replace('_',' '))")
$c = $c.Replace("showToast('Status: ' + newStatus)", "showToast(_bpt('status_label','Status')+': ' + newStatus)")

[IO.File]::WriteAllText($f, $c, [Text.Encoding]::UTF8)
Write-Host 'Done'
