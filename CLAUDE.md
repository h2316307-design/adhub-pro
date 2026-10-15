# الفارس الذهبي — نظام إدارة اللوحات الإعلانية (adhub-pro)

## قواعد العمل (إلزامية)
- الردود بالعربية دائماً، ومختصرة.
- لا تُدخل كلمات مرور أو مفاتيح، ولا تكرر أي مفتاح ظهر في ملف أو سجل.
- لا حذف نهائي لملفات: انقل إلى `E:\adhub-pro-main (4)\_to_delete\`.
- قبل تعديل أي ملف: نسخة احتياطية في `E:\adhub-pro-main (4)\_to_delete\main-backup\ops1\<الوقت>-<الموضوع>\`.
- الكتابة ذرّية (ملف مؤقت ثم استبدال)، وعدّل بأقل تغيير ممكن.
- قاعدة البيانات: لا تعديل مباشر. اكتب ملف SQL في `E:\adhub-pro-main (4)\_to_delete\sql\NN_name.sql` والمستخدم يطبّقه بنفسه. القراءة (SELECT) مسموحة.
- الأرشفة بدل الحذف في البيانات.
- بعد التعديل: `npx tsc --noEmit -p tsconfig.app.json` — يوجد ~410 خطأ قديم؛ المهم ألا تظهر أخطاء جديدة في الملفات المعدّلة.
- عند إنشاء ملفات جديدة يعتمد بعضها على بعض: اكتب الملف المستورَد أولاً ثم الملف الذي يستورده (وإلا يظهر خطأ Vite مؤقت).

## البيئة
- React + TypeScript + Vite + Tailwind (shadcn) + @tanstack/react-query + Supabase. واجهة RTL عربية.
- خادم التطوير: `npm run dev` على `localhost:8080`، الصفحات تحت `/admin/...`.
- Supabase project: `atqjaiebixuzomrfwilu` (Postgres 17، الخطة المجانية — لا نسخ احتياطي تلقائي؛ السكربتات في `scripts/backup/`).
- العملة دينار ليبي (د.ل)، والأرقام بخط Manrope/أرقام لاتينية.

## خريطة الأنظمة الرئيسية
- **المهام المجمعة (العمليات)**: `pages/CompositeOperations.tsx` (route `composite-tasks`)، الخدمات `services/compositeOperations.ts` (تحميل/محرر التكاليف/`repriceOperation`)، `services/operationBoards.ts` (إدارة اللوحات، نقل الفرق، التصاميم)، الحساب `lib/compositeCosts.ts` (`operationKeyOf`, `computeOperation`, `mergeCompositeOperations`).
  - عملية واحدة = بطاقة واحدة = فاتورة واحدة = قيد واحد في الدفتر، حتى مع عدة فرق/عقود. الهوية في `system_settings` بمفتاح `installation_operation_task:<taskId>`.
  - التركيب الأول مشمول بالعقد إلا إذا `installation_enabled = false`؛ الطباعة مشمولة إذا `include_print_in_billboard_price` أو `print_cost_enabled`. المشمول يظهر «مشمول» بقيمة 0 للزبون.
- **فاتورة المهمة**: `components/composite-tasks/UnifiedTaskInvoice.tsx` (عرض واحد + مفتاح «تفصيل الطباعة والتركيب»).
- **فرق التركيب**: `utils/smartTeamAssignment.ts` (`pickInstallationTeam`)، `utils/teamAssignment.ts` (`installationTeamCoversBillboard`).
- **الدفعات**: صفحة `pages/PaymentsReceiptsPage.tsx`، التوزيع `components/billing/SmartDistributeDialog.tsx` عبر RPC `save_payment_distribution`، التفاصيل `components/billing/DistributedPaymentDetailsDialog.tsx`.
- **صفحة الزبون**: `pages/CustomerAccount.tsx`، الدفتر الموحد `lib/canonicalCustomerLedger.ts`.
- **العقود/العروض**: `pages/ContractEdit.tsx`, `pages/OfferEdit.tsx` (إعادة حساب الإجمالي والدفعات عند إضافة/حذف لوحة).
- **المراسلات والتقارير**: `pages/Correspondence.tsx`, `pages/PeriodicReports.tsx`, `services/correspondence.ts` (`renderLetterHtml` على قالب `src/assets/letterhead/*.svg`)، `services/periodicReports.ts`. الجداول `letterhead_companies`, `letters` (kind = letter | report).
- **التنبيهات**: `pages/AlertsCenter.tsx`. **البحث العام**: `components/Layout/CommandMenu.tsx` (فهرس الصفحات من `NAV_SEARCH_INDEX` في `Sidebar.tsx`).
- **مشترك**: عارض الصور `components/shared/ImageViewer.tsx`، لصق الصور العام `components/shared/GlobalImagePaste.tsx`، زر الأعلى `components/shared/ScrollTopButton.tsx`، الطباعة `utils/printWindowHelper.ts` (`preparePrintWindow`/`writePrintWindow`؛ الصفحات الثابتة تحتاج `class="page"` و`@page { margin: 0 }`).
- **التصدير/المتاح**: `hooks/useBillboardExport.ts` — علامة `is_visible_in_available` (true = إظهار قسري، false = إخفاء إداري، null = افتراضي).
