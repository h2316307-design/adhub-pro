var doc = app.activeDocument;

for (var i = 0; i < doc.stories.length; i++) {
    var story = doc.stories[i];
    var regex = /<a href=(["»«“”])([^"»«“”]+)\1>([^<]+)<\/a>/g;
    var matches, plainText = story.contents;
    var offset = 0;

    while ((matches = regex.exec(plainText)) !== null) {
        var fullMatch = matches[0];
        var url = matches[2];   // الرابط
        var label = matches[3]; // النص المعروض

        var startIndex = matches.index - offset;
        var endIndex = startIndex + fullMatch.length;

        // استبدال النص بالنص الظاهر فقط
        story.characters.itemByRange(startIndex, endIndex - 1).contents = label;

        // إعادة تحديد النص بعد التعديل
        var hyperlinkTextRange = story.characters.itemByRange(startIndex, startIndex + label.length - 1);

        try {
            // إنشاء destination إذا لم يكن موجودًا
            var destination;
            try {
                destination = doc.hyperlinkURLDestinations.itemByName(url);
                destination.name; // تأكيد أنه موجود
            } catch (e) {
                destination = doc.hyperlinkURLDestinations.add(url);
            }

            // تحويل التحديد إلى HyperlinkTextSource
            var source = doc.hyperlinkTextSources.add(hyperlinkTextRange);

            // إنشاء الهايبرلينك
            doc.hyperlinks.add(source, destination);
        } catch (e) {
            alert("❌ خطأ أثناء إنشاء الرابط: " + e.message);
        }

        // تحديث فرق الطول
        offset += (fullMatch.length - label.length);
        plainText = story.contents;
    }
}

alert("✅ تم استبدال وإنشاء روابط تفاعلية بنجاح!");
