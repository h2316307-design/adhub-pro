<#
  نسخة احتياطية كاملة لقاعدة سوبابيس (قابلة للاسترجاع في أي مشروع سوبابيس)
  - الهيكل الكامل: الجداول، الدوال، المشغّلات، السياسات، الفهارس (مخططات public و archive)
  - كل البيانات
  - مستخدمو تسجيل الدخول (auth.users / auth.identities)
  - بيانات التخزين الوصفية (storage.buckets / storage.objects) — الملفات نفسها تبقى في التخزين
  التشغيل: انقر بزر الفأرة الأيمن ← Run with PowerShell  (أو: powershell -ExecutionPolicy Bypass -File backup-supabase.ps1)
  المتطلبات: أدوات PostgreSQL 17 (pg_dump) — winget install PostgreSQL.PostgreSQL.17
  رابط الاتصال: Supabase ← Project Settings ← Database ← Connection string (URI) — استخدم Session pooler
#>
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Find-PgTool($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $hit = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin' -Filter "$name.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($hit) { return $hit.FullName }
  throw "لم يتم العثور على $name. ثبّت أدوات PostgreSQL 17: winget install PostgreSQL.PostgreSQL.17"
}

$pgDump = Find-PgTool 'pg_dump'
$ver = & $pgDump --version
if ($ver -notmatch ' (1[7-9]|[2-9]\d)\.') { Write-Warning "إصدار pg_dump ($ver) أقدم من خادم سوبابيس (17). قد تفشل النسخة؛ ثبّت الإصدار 17." }

$dbUrl = $env:SUPABASE_DB_URL
if (-not $dbUrl) {
  $secure = Read-Host 'ألصق رابط الاتصال (postgresql://...) — لن يُحفظ' -AsSecureString
  $dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if ($dbUrl -notmatch '^postgres(ql)?://') { throw 'رابط الاتصال غير صحيح' }

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$root = Join-Path $PSScriptRoot "..\..\..\_backups\supabase_$stamp"
New-Item -ItemType Directory -Force -Path $root | Out-Null
$root = (Resolve-Path $root).Path
Write-Host "📁 المجلد: $root" -ForegroundColor Cyan

Write-Host '1/3 الهيكل والبيانات (public + archive)...' -ForegroundColor Yellow
& $pgDump --dbname=$dbUrl --format=custom --no-owner --no-privileges --schema=public --schema=archive --file="$root\app.dump"
if ($LASTEXITCODE -ne 0) { throw 'فشل نسخ الهيكل والبيانات' }

Write-Host '2/3 مستخدمو الدخول...' -ForegroundColor Yellow
& $pgDump --dbname=$dbUrl --data-only --no-owner --no-privileges --table=auth.users --table=auth.identities --file="$root\auth_users.sql"
if ($LASTEXITCODE -ne 0) { Write-Warning 'تعذر نسخ المستخدمين (قد لا تملك الصلاحية) — تابعت بدونها' }

Write-Host '3/3 بيانات التخزين الوصفية...' -ForegroundColor Yellow
& $pgDump --dbname=$dbUrl --data-only --no-owner --no-privileges --table=storage.buckets --table=storage.objects --file="$root\storage_meta.sql"
if ($LASTEXITCODE -ne 0) { Write-Warning 'تعذر نسخ بيانات التخزين — تابعت بدونها' }

@"
نسخة احتياطية: $stamp
app.dump          : الهيكل الكامل + البيانات (يُسترجع بـ restore-supabase.ps1)
auth_users.sql    : مستخدمو تسجيل الدخول
storage_meta.sql  : سجلات التخزين (الملفات نفسها لا تُنسخ هنا)
"@ | Out-File -Encoding utf8 "$root\README.txt"

$zip = "$root.zip"
Compress-Archive -Path "$root\*" -DestinationPath $zip -Force
Write-Host "✅ تمت النسخة: $zip" -ForegroundColor Green
Write-Host 'احفظ نسخة منها خارج الجهاز (Google Drive أو قرص خارجي).'
