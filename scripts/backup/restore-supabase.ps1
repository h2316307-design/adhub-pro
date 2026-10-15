<#
  استرجاع نسخة backup-supabase.ps1 في أي مشروع سوبابيس (يفضّل مشروعاً جديداً فارغاً)
  تحذير: الاسترجاع يكتب في القاعدة الهدف. لا تستخدمه على القاعدة الحالية إلا إن كنت متأكداً.
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
$pgRestore = Find-PgTool 'pg_restore'
$psql = Find-PgTool 'psql'

$source = Read-Host 'مسار ملف النسخة (.zip) أو مجلدها'
if ($source.EndsWith('.zip')) {
  $dir = Join-Path $env:TEMP ("sb_restore_" + [guid]::NewGuid().ToString('N'))
  Expand-Archive -Path $source -DestinationPath $dir
} else { $dir = $source }
if (-not (Test-Path "$dir\app.dump")) { throw 'لم يتم العثور على app.dump في النسخة' }

$secure = Read-Host 'رابط اتصال القاعدة الهدف (postgresql://...)' -AsSecureString
$target = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$confirm = Read-Host 'اكتب "استرجاع" للتأكيد'
if ($confirm -ne 'استرجاع') { Write-Host 'أُلغي.'; exit }

Write-Host '1/3 الهيكل والبيانات...' -ForegroundColor Yellow
& $psql $target -v ON_ERROR_STOP=0 -c 'create schema if not exists archive;' | Out-Null
& $pgRestore --dbname=$target --no-owner --no-privileges --clean --if-exists "$dir\app.dump"
Write-Host '(تحذيرات pg_restore عن كائنات موجودة مسبقاً طبيعية في مشروع سوبابيس جديد)'

if (Test-Path "$dir\auth_users.sql") {
  Write-Host '2/3 المستخدمون...' -ForegroundColor Yellow
  & $psql $target -v ON_ERROR_STOP=0 -f "$dir\auth_users.sql" | Out-Null
}
if (Test-Path "$dir\storage_meta.sql") {
  Write-Host '3/3 بيانات التخزين...' -ForegroundColor Yellow
  & $psql $target -v ON_ERROR_STOP=0 -f "$dir\storage_meta.sql" | Out-Null
}
Write-Host '✅ انتهى الاسترجاع. حدّث رابط المشروع والمفتاح في إعدادات التطبيق (.env) إن كان مشروعاً جديداً.' -ForegroundColor Green
