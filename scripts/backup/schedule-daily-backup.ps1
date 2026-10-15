<#
  جدولة نسخة احتياطية يومية على هذا الجهاز (الساعة 2 صباحاً).
  يتطلب حفظ رابط الاتصال في متغير بيئة للمستخدم الحالي فقط: SUPABASE_DB_URL
#>
$ErrorActionPreference = 'Stop'
$secure = Read-Host 'رابط الاتصال (يُحفظ كمتغير بيئة لحسابك فقط)' -AsSecureString
$url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
[Environment]::SetEnvironmentVariable('SUPABASE_DB_URL', $url, 'User')
$script = Join-Path $PSScriptRoot 'backup-supabase.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName 'AlFares Supabase Backup' -Action $action -Trigger $trigger -Description 'نسخة يومية لقاعدة سوبابيس' -Force | Out-Null
Write-Host '✅ تمت جدولة النسخة اليومية (2:00 صباحاً). النسخ تُحفظ في مجلد _backups.' -ForegroundColor Green
