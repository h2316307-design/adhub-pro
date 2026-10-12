// سكريبت الرفع فقط. انشره في مشروع منفصل عن سكريبت التقويم.
var MAIN_FOLDER_ID = '1slgjSJK29P5JtqNRGyAfkfCh4buspZVF';
var MAX_FILE_BYTES = 25 * 1024 * 1024;

function uploadJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  var savedId = '';
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('لم تصل بيانات الملف.');
    var data = JSON.parse(e.postData.contents);
    if (!data || typeof data.file !== 'string' || !data.file) throw new Error('بيانات الملف مفقودة.');
    var encoded = data.file.replace(/^data:[^,]*;base64,/, '').replace(/\s/g, '');
    if (encoded.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) throw new Error('الحد الأقصى للملف 25 ميجابايت.');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error('ترميز الملف غير صالح.');
    var name = String(data.name || 'file').trim();
    if (!name || name.length > 200 || /[\x00-\x1f\/\\]/.test(name)) throw new Error('اسم الملف غير صالح.');
    var mime = String(data.type || 'application/octet-stream');
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime)) throw new Error('نوع الملف غير صالح.');
    var parts = String(data.folder || '').split('/').map(function(p) { return p.trim(); }).filter(Boolean);
    if (parts.length > 10 || parts.some(function(p) { return p === '.' || p === '..' || p.length > 150 || /[\x00-\x1f\\]/.test(p); })) throw new Error('مسار المجلد غير صالح.');
    var bytes = Utilities.base64Decode(encoded);
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error('الملف فارغ أو يتجاوز الحجم المسموح.');
    var blob = Utilities.newBlob(bytes, mime, name);
    locked = lock.tryLock(30000);
    if (!locked) throw new Error('هناك رفع آخر قيد التنفيذ. أعد المحاولة بعد قليل.');
    var folder = DriveApp.getFolderById(MAIN_FOLDER_ID);
    parts.forEach(function(part) {
      var folders = folder.getFoldersByName(part);
      folder = folders.hasNext() ? folders.next() : folder.createFolder(part);
      if (folders.hasNext()) throw new Error('يوجد أكثر من مجلد بالاسم نفسه: ' + part);
    });
    var files = folder.getFilesByName(name);
    var file = files.hasNext() ? files.next() : null;
    if (files.hasNext()) throw new Error('يوجد أكثر من ملف بالاسم نفسه. عالج التكرار قبل الاستبدال.');
    var updated = !!file;
    if (file) {
      if (file.getMimeType().indexOf('application/vnd.google-apps.') === 0) throw new Error('لا يمكن استبدال مستند Google أصلي بملف مرفوع.');
      var result = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(file.getId()) + '?uploadType=media&supportsAllDrives=true', {
        method: 'patch', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        contentType: mime, payload: bytes, muteHttpExceptions: true
      });
      var status = result.getResponseCode();
      if (status < 200 || status >= 300) throw new Error('فشل تحديث الملف في Google Drive (' + status + '). لم يتم تأكيد الاستبدال.');
    } else {
      file = folder.createFile(blob);
    }
    savedId = file.getId();
    // Preserve the existing public-link behavior required by image display.
    try {
      if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      return uploadJSON({ success: false, saved: true, fileId: savedId, error: 'تم حفظ الملف، لكن سياسة الحساب منعت مشاركة الرابط. عدّل صلاحيات الملف ثم أعد المحاولة.' });
    }
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + savedId;
    // A file-ID based display URL avoids storing short-lived thumbnailLink URLs.
    var url = mime.indexOf('image/') === 0 ? 'https://lh3.googleusercontent.com/d/' + savedId : downloadUrl;
    return uploadJSON({ success: true, url: url, fileId: savedId, updated: updated,
      viewUrl: file.getUrl(), downloadUrl: downloadUrl, mimeType: mime, size: bytes.length });
  } catch (error) {
    return uploadJSON({ success: false, saved: !!savedId, fileId: savedId || undefined, error: String(error.message || error) });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function forceAllPermissions() {
  DriveApp.getFolderById(MAIN_FOLDER_ID).getName();
  var response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(MAIN_FOLDER_ID) + '?fields=id,name&supportsAllDrives=true', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('تعذّر الوصول إلى المجلد أو Drive API. تحقق من صلاحيات الحساب وتفعيل Google Drive API.');
  console.log('صلاحيات الرفع جاهزة. انشر نسخة جديدة من تطبيق الويب.');
}
