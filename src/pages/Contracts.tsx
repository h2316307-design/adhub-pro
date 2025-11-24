// @ts-nocheck
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getPriceFor, CustomerType, CUSTOMERS } from '@/data/pricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Plus, Eye, Edit, Trash2, Calendar, User, DollarSign, Search, Filter, Building, AlertCircle, Clock, CheckCircle, Printer, RefreshCcw, Hammer, Wrench, Percent, PaintBucket, FileText, Send, FileSpreadsheet } from 'lucide-react';
import { SendContractDialog } from '@/components/contracts/SendContractDialog';
import { AddPaymentDialog } from '@/components/contracts/AddPaymentDialog';
import { BillboardPrintIndividual } from '@/components/contracts/BillboardPrintIndividual';
import { SendAlertsDialog } from '@/components/contracts/SendAlertsDialog';
import { QuickContractDialog } from '@/components/contracts/QuickContractDialog';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createContract,
  getContracts,
  getContractWithBillboards,
  getAvailableBillboards,
  updateContract,
  deleteContract,
  addBillboardsToContract,
  removeBillboardFromContract,
  Contract,
  ContractCreate
} from '@/services/contractService';
import { Billboard } from '@/types';
import { ContractPDFDialog } from '@/components/Contract';
import { supabase } from '@/integrations/supabase/client';
import { exportBillboardsToExcel } from '@/utils/exportBillboardsToExcel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableBillboards, setAvailableBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  const [billboardPrintData, setBillboardPrintData] = useState<{
    contractNumber: string | number;
    billboards: any[];
    designData?: any[] | null;
    customerPhone?: string;
  } | null>(null);
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const [formData, setFormData] = useState<ContractCreate>({
    customer_name: '',
    ad_type: '',
    start_date: '',
    end_date: '',
    rent_cost: 0,
    billboard_ids: []
  });
  const [pricingCategory, setPricingCategory] = useState<CustomerType>('عادي');

  // Renew state
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewSource, setRenewSource] = useState<Contract | null>(null);
  const [renewStart, setRenewStart] = useState<string>('');
  const [renewEnd, setRenewEnd] = useState<string>('');
  const [durationMonths, setDurationMonths] = useState<number>(3);

  const [bbSearch, setBbSearch] = useState('');
  const [editBbSearch, setEditBbSearch] = useState('');

  const loadData = async () => {
    try {
      const contractsData = await getContracts();
      const billboardsData = await getAvailableBillboards();
      setContracts(contractsData as Contract[]);
      setAvailableBillboards(billboardsData || []);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleBillboardPrint = (event: any) => {
      const { contractNumber, billboards, designData, customerPhone } = event.detail;
      setBillboardPrintData({ contractNumber, billboards, designData, customerPhone });
    };

    window.addEventListener('openBillboardPrint', handleBillboardPrint);
    return () => window.removeEventListener('openBillboardPrint', handleBillboardPrint);
  }, []);

  // احسب تاريخ النهاية تلقائياً حسب المدة المختارة
  useEffect(() => {
    if (!formData.start_date || !durationMonths) return;
    const d = new Date(formData.start_date);
    if (isNaN(d.getTime())) return;
    const end = new Date(d);
    end.setMonth(end.getMonth() + durationMonths);
    setFormData(prev => ({ ...prev, end_date: end.toISOString().split('T')[0] }));
  }, [formData.start_date, durationMonths]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn && !viewOpen) {
      handleViewContract(String(cn));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleCreateContract = async () => {
    try {
      if (!formData.customer_name || !formData.start_date || !formData.end_date || formData.billboard_ids.length === 0) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      await createContract(formData);
      toast.success('تم إنشاء العقد بنجاح');
      setCreateOpen(false);
      setFormData({
        customer_name: '',
        ad_type: '',
        start_date: '',
        end_date: '',
        rent_cost: 0,
        billboard_ids: []
      });
      loadData();
    } catch (error) {
      console.error('خطأ في إنشاء العقد:', error);
      toast.error('��شل في إنشاء العقد');
    }
  };

  const handleViewContract = async (contractId: string) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(contractId);
      setSelectedContract(contractWithBillboards);
      setViewOpen(true);
    } catch (error) {
      console.error('خطأ في ج��ب تفاصيل العقد:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العقد؟')) {
      try {
        await deleteContract(contractId);
        toast.success('تم حذف العقد بنجاح');
        loadData();
      } catch (error) {
        console.error('خطأ في حذف العقد:', error);
        toast.error('فشل في حذف العقد');
      }
    }
  };

  const handlePrintContract = async (contract: Contract) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(String(contract.id));
      setSelectedContractForPDF(contractWithBillboards);
      setPdfOpen(true);
    } catch (error) {
      console.error('خطأ في جلب تفاصيل العقد للطباعة:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const handlePrintInstallationNew = async (contract: Contract) => {
    try {
      const data = await getContractWithBillboards(String(contract.id));
      const boards: any[] = Array.isArray((data as any).billboards) ? (data as any).billboards : [];
      if (!boards.length) { toast.warning('لا توجد لوحات للطباعة'); return; }

      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const name = String(b.Billboard_Name ?? b.name ?? id);
        const image = String(b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? '');
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude; const lng = b.Longitude ?? b.lng ?? b.longitude; if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        return { id, name, image, municipality, district, landmark, size, faces, mapLink };
      };

      const normalized = boards.map(norm);
      const START_Y = 63.53;
      const ROW_H = 13.818;
      const PAGE_H = 297;
      const ROWS_PER_PAGE = Math.max(1, Math.floor((PAGE_H - START_Y) / ROW_H));

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:15mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:40mm" />
                      <col style="width:18mm" />
                      <col style="width:18mm" />
                      <col style="width:20mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>كشف تركيب - العقد ${String(contract.id)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 13.818mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; }
            .c-img img { width: 100%; height: 100%; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

      const w = window.open('', '_blank');
      if (!w) { toast.error('فشل فتح نافذة الطباعة'); return; }
      w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 600);
    } catch (e) {
      console.error(e);
      toast.error('فشل طباعة التركيب');
    }
  };

  // New: installation team selection + filtered print
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installationTeams, setInstallationTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [installContractTarget, setInstallContractTarget] = useState<Contract | null>(null);

  const openInstallDialog = async (contract: Contract) => {
    try {
      setInstallContractTarget(contract);
      // fetch teams from installation_teams table
      const { data, error } = await (supabase as any).from('installation_teams').select('*').order('id', { ascending: true });
      if (error) {
        console.error('Failed to load installation teams', error);
        toast.error('فشل في تحميل فرق التركيب');
        return;
      }
      setInstallationTeams(data || []);
      setSelectedTeamId(data && data.length ? String(data[0].id) : null);
      setInstallDialogOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('فشل في تحميل فرق التركيب');
    }
  };

  const handlePrintInstallationForTeam = async () => {
    if (!installContractTarget) return;
    try {
      const contract = await getContractWithBillboards(String(installContractTarget.id));
      const boards: any[] = Array.isArray((contract as any).billboards) ? (contract as any).billboards : [];
      if (!boards.length) { toast.warning('لا توجد لوحات للطباعة'); return; }

      // find selected team
      const team = installationTeams.find(t => String(t.id) === String(selectedTeamId));
      const teamName = team?.team_name || team?.name || `فرقة ${selectedTeamId}`;
      const teamSizes: string[] = Array.isArray(team?.sizes) ? team.sizes : (typeof team?.sizes === 'string' ? (team.sizes || '').split(',').map((s: string)=>s.trim()) : []);

      // filter boards by size membership in teamSizes
      const filtered = boards.filter((b: any) => {
        const size = String(b.Size ?? b.size ?? '');
        return teamSizes.length === 0 || teamSizes.includes(size);
      });

      if (!filtered.length) {
        toast.warning('لا توجد لوحات ضمن المقاسات التي تتعامل بها ال��رقة المختارة');
        return;
      }

      // Use same printing routine but with filtered boards
      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const name = String(b.Billboard_Name ?? b.name ?? id);
        const image = String(b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? '');
        const municipality = String(b.Municipality ?? b.municipality ?? b.City_Council ?? b.city_council ?? '');
        const district = String(b.District ?? b.district ?? b.Area ?? b.area ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? b.Location ?? '');
        const size = String(b.Size ?? b.size ?? b['Billboard size'] ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? b['Number of Faces'] ?? '');
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude; const lng = b.Longitude ?? b.lng ?? b.longitude; if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        return { id, name, image, municipality, district, landmark, size, faces, mapLink };
      };

      const normalized = filtered.map(norm);

      const ROWS_PER_PAGE = 12;

      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => { const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc; }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="contract-header">
                  <p style="font-size: 12px; font-weight: 700; color: #0066cc; margin-bottom: 8px;"><strong>فرقة التركيب:</strong> ${teamName}</p>
                  <p><strong>رقم العقد:</strong> ${String(installContractTarget.id)}</p>
                  <p><strong>نوع الإعلان:</strong> ${(installContractTarget as any).ad_type || 'غير محدد'}</p>
                  <p><strong>اسم الزبون:</strong> ${installContractTarget.customer_name}</p>
                </div>
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:40mm" />
                      <col style="width:18mm" />
                      <col style="width:18mm" />
                      <col style="width:20mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-name">${r.name || r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>كشف تركيب - العقد ${String(installContractTarget.id)}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .contract-header { position: absolute; top: 33mm; right: 13mm; z-index: 30; font-family: 'Doran', 'Noto Sans Arabic', sans-serif; font-size: 10px; text-align: right; }
            .contract-header p { margin: 0; padding: 1px 0; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; /* width is determined by left/right */ }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 15.5mm; max-height: 15.5mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; height: 15.5mm; }
            .c-img { height: 100%; padding: 0.5mm !important; }
            .c-img img { width: 100%; height: 100%; max-height: 14.5mm; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

      const w = window.open('', '_blank');
      if (!w) { toast.error('فشل فتح نافذة الطباعة'); return; }
      w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 600);
      setInstallDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('فشل طباعة التركيب');
    }
  };

  const getContractStatus = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) {
      return <Badge variant="secondary">غير محدد</Badge>;
    }
    
    if (today < startDate) {
      return <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        لم يبدأ
      </Badge>;
    } else if (today > endDate) {
      return <Badge className="bg-destructive text-destructive-foreground border-destructive gap-1">
        <AlertCircle className="h-3 w-3" />
        منتهي
      </Badge>;
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        return <Badge className="bg-orange-500 text-white border-orange-500 hover:bg-orange-600 gap-1">
          <Clock className="h-3 w-3" />
          ينتهي قريباً ({daysRemaining} أيام)
        </Badge>;
      }
      return <Badge className="bg-primary text-primary-foreground border-primary gap-1">
        <CheckCircle className="h-3 w-3" />
        نشط
      </Badge>;
    }
  };

  const getRowClassName = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    
    if (!contract.end_date) return '';
    
    if (today > endDate) {
      return 'bg-destructive/5 hover:bg-destructive/10 dark:bg-destructive/10 dark:hover:bg-destructive/20';
    }
    
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50';
    }
    
    return '';
  };

  // تصفية العقود
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((contract as any)['Ad Type'] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(contract.id || '').includes(searchQuery);

    const matchesCustomer = customerFilter === 'all' || contract.customer_name === customerFilter;
    
    if (statusFilter === 'all') return matchesSearch && matchesCustomer;
    
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) return false;
    
    let matchesStatus = false;
    if (statusFilter === 'active') {
      matchesStatus = today >= startDate && today <= endDate;
    } else if (statusFilter === 'expired') {
      matchesStatus = today > endDate;
    } else if (statusFilter === 'upcoming') {
      matchesStatus = today < startDate;
    } else if (statusFilter === 'expiring') {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      matchesStatus = daysRemaining <= 7 && daysRemaining > 0;
    }

    return matchesSearch && matchesCustomer && matchesStatus;
  });

  // تقسيم العقود حسب الحالة
  const contractStats = {
    total: contracts.length,
    active: contracts.filter(c => {
      if (!c.end_date || !c.start_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const startDate = new Date(c.start_date);
      return today >= startDate && today <= endDate;
    }).length,
    expired: contracts.filter(c => {
      if (!c.end_date) return false;
      return new Date() > new Date(c.end_date);
    }).length,
    expiring: contracts.filter(c => {
      if (!c.end_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysRemaining <= 7 && daysRemaining > 0;
    }).length
  };

  // ✅ FIXED: حساب إجمالي التركيب وتكلفة الطباعة ورسوم التشغيل من القيم المحفوظة مباشرة
  const totalInstallationCost = contracts.reduce((sum, contract) => {
    const installationCost = Number((contract as any).installation_cost || (contract as any)['Installation Cost'] || 0);
    return sum + installationCost;
  }, 0);

  const totalPrintCost = contracts.reduce((sum, contract) => {
    // ✅ NEW: حساب تكلفة الطباعة الإجمالية
    const printCost = Number((contract as any).print_cost || (contract as any)['Print Cost'] || 0);
    return sum + printCost;
  }, 0);

  const totalOperatingFees = contracts.reduce((sum, contract) => {
    const operatingFee = Number((contract as any).fee || (contract as any)['Operating Fee'] || 0);
    return sum + operatingFee;
  }, 0);

  const uniqueCustomers = [...new Set(contracts.map(c => c.customer_name))].filter(Boolean);

  const filteredAvailable = availableBillboards.filter((b) => {
    const q = bbSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.location, b.size, (b as any).city]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const selectedBillboardsDetails = (formData.billboard_ids
    .map((id) => availableBillboards.find((b) => b.id === id))
    .filter(Boolean)) as Billboard[];

  // حساب التكلفة التقديرية حسب باقات الأسعار والفئة
  const estimatedTotal = useMemo(() => {
    const months = Number(durationMonths || 0);
    if (!months) return 0;
    return selectedBillboardsDetails.reduce((acc, b) => {
      const size = (b.size || (b as any).Size || '') as string;
      const level = (b.level || (b as any).Level) as any;
      const price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      if (price !== null) return acc + price;
      const monthly = Number((b as any).price) || 0;
      return acc + monthly * months;
    }, 0);
  }, [selectedBillboardsDetails, durationMonths, pricingCategory]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, rent_cost: estimatedTotal }));
  }, [estimatedTotal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">جاري تحميل العقود...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* العنوان والأزرار */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-header">إدارة العقود</h1>
          <p className="text-muted">إنشاء وإدارة عقود الإيجار مع اللوحات الإعلانية</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAlertsDialogOpen(true)}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            إرسال تنبيهات
          </Button>
          <Button
            className="btn-primary"
            onClick={() => setQuickCreateOpen(true)}
          >
            <Plus className="h-4 w-4 ml-2" />
            إنشاء عقد جديد
          </Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="card-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted">إجمالي العقود</p>
                <p className="text-2xl font-bold">{contractStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green" />
              <div>
                <p className="text-sm text-muted">عقود نشطة</p>
                <p className="text-2xl font-bold text-green">{contractStats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-yellow" />
              <div>
                <p className="text-sm text-muted">قريبة الانتهاء</p>
                <p className="text-2xl font-bold text-yellow">{contractStats.expiring}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red" />
              <div>
                <p className="text-sm text-muted">عقود منتهية</p>
                <p className="text-2xl font-bold text-red">{contractStats.expired}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Wrench className="h-6 w-6 text-orange" />
              <div>
                <p className="text-sm text-muted">إجمالي التركيب</p>
                <p className="text-2xl font-bold text-orange">
                  {totalInstallationCost.toLocaleString('ar-LY')} د.ل
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elegant">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <PaintBucket className="h-6 w-6 text-purple" />
              <div>
                <p className="text-sm text-muted">إجمالي الطباعة</p>
                <p className="text-2xl font-bold text-purple">
                  {totalPrintCost.toLocaleString('ar-LY')} د.ل
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ��لبحث والفلاتر */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            البحث والتصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder="ابحث في العقود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حالة العقد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="expiring">قريبة الانتهاء</SelectItem>
                <SelectItem value="expired">منتهية</SelectItem>
                <SelectItem value="upcoming">لم تبدأ</SelectItem>
              </SelectContent>
            </Select>

            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="العميل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العملاء</SelectItem>
                {uniqueCustomers.map(customer => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* جدول العقود */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            قائمة العقود ({filteredContracts.length} من {contracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم العقد</TableHead>
                  <TableHead>اسم الزبون</TableHead>
                  <TableHead>نوع الإعلان</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>التركيب</TableHead>
                  <TableHead>الطباعة</TableHead>
                  <TableHead>رسوم التشغيل</TableHead>
                  <TableHead>المجموع الكلي</TableHead>
                  <TableHead>نسبة السداد</TableHead>
                  <TableHead>التقدم / التأخر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => {
                  // ✅ عرض القيم المحفوظة في قاعدة البيانات مباشرة بدون أي حسابات أو تعديلات
                  const totalRent = Number(contract.rent_cost || (contract as any)['Total Rent'] || 0);
                  const installationCost = Number((contract as any).installation_cost || (contract as any)['Installation Cost'] || 0);
                  const printCost = Number((contract as any).print_cost || (contract as any)['Print Cost'] || 0);
                  const operatingFee = Number((contract as any).fee || (contract as any)['Operating Fee'] || 0);
                  const totalCost = Number((contract as any).total_cost || (contract as any)['Total'] || 0);
                  
                  // ✅ المجموع الكلي: إما من قاعدة البيانات أو مجموع القيم المحفوظة
                  const finalTotalCost = totalCost > 0 ? totalCost : (totalRent + installationCost + printCost + operatingFee);
                  
                  // حساب نسبة السداد
                  const totalPaid = Number((contract as any)['Total Paid'] || (contract as any).total_paid || 0);
                  const paymentPercentage = finalTotalCost > 0 ? (totalPaid / finalTotalCost) * 100 : 0;
                  
                  // حساب نسبة المدة المقضية
                  const startDate = contract.start_date ? new Date(contract.start_date) : null;
                  const endDate = contract.end_date ? new Date(contract.end_date) : null;
                  const today = new Date();
                  let timePercentage = 0;
                  let timeDifference = 0;
                  
                  if (startDate && endDate) {
                    const totalDuration = endDate.getTime() - startDate.getTime();
                    const elapsed = today.getTime() - startDate.getTime();
                    timePercentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0;
                    timeDifference = paymentPercentage - timePercentage;
                  }
                  
                  // تحديد لون ورمز المؤشر
                  const getProgressIndicator = () => {
                    if (!startDate || !endDate || today < startDate) {
                      return { text: '—', color: 'text-muted', icon: null };
                    }
                    if (Math.abs(timeDifference) < 5) {
                      return { text: 'متوازن', color: 'text-green', icon: <CheckCircle className="h-4 w-4" /> };
                    }
                    if (timeDifference > 0) {
                      return { text: `متقدم ${Math.abs(timeDifference).toFixed(0)}%`, color: 'text-blue', icon: <CheckCircle className="h-4 w-4" /> };
                    }
                    return { text: `متأخر ${Math.abs(timeDifference).toFixed(0)}%`, color: 'text-red', icon: <AlertCircle className="h-4 w-4" /> };
                  };
                  
                  const progressIndicator = getProgressIndicator();
                  
                  return (
                    <TableRow key={contract.id} className={`card-hover ${getRowClassName(contract)}`}>
                      <TableCell className="font-semibold">{String((contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? contract.id)}</TableCell>
                      <TableCell className="font-medium">{contract.customer_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Building className="h-3 w-3" />
                          {(contract as any)['Ad Type'] || 'غير محدد'}
                        </Badge>
                      </TableCell>
                      <TableCell>{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</TableCell>
                      <TableCell>{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-green">
                          {totalRent > 0 ? `${totalRent.toLocaleString('ar-LY')} د.ل` : '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {installationCost > 0 ? (
                          <div className="font-semibold text-orange flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            {installationCost.toLocaleString('ar-LY')} د.ل
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {printCost > 0 ? (
                          <div className="font-semibold text-purple flex items-center gap-1">
                            <PaintBucket className="h-3 w-3" />
                            {printCost.toLocaleString('ar-LY')} د.ل
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {operatingFee > 0 ? (
                          <div className="font-semibold text-blue flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {operatingFee.toLocaleString('ar-LY')} د.ل
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {finalTotalCost > 0 ? `${finalTotalCost.toLocaleString('ar-LY')} د.ل` : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold">
                            {paymentPercentage.toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted">
                            ({totalPaid.toLocaleString('ar-LY')} من {finalTotalCost.toLocaleString('ar-LY')})
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 ${progressIndicator.color} font-medium text-sm`}>
                          {progressIndicator.icon}
                          <span>{progressIndicator.text}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getContractStatus(contract)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Use contract ID directly for navigation - matching ContractView useParams
                              const contractId = String(contract.id);
                              navigate(`/admin/contracts/view/${contractId}`);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/contracts/edit?contract=${String(contract.id)}`)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteContract(String(contract.id))}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintContract(contract)}
                            className="h-8 px-2 gap-1"
                          >
                            <Printer className="h-4 w-4" />
                            طباعة
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openInstallDialog(contract)}
                            className="h-8 px-2 gap-1"
                            title="طباعة تركيب - جدول"
                          >
                            <Hammer className="h-4 w-4" />
                            تركيب
                          </Button>
                          <AddPaymentDialog
                            contractNumber={String(contract.Contract_Number || contract.id)}
                            customerName={contract.customer_name || ''}
                            customerId={(contract as any).customer_id}
                            onPaymentAdded={loadData}
                          />
                          <SendContractDialog
                            contractNumber={String(contract.Contract_Number || contract.id)}
                            customerName={contract.customer_name || ''}
                            customerPhone={(contract as any).Phone}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const contractWithBillboards = await getContractWithBillboards(String(contract.id));
                                const billboardsData = (contractWithBillboards as any).billboards || [];
                                let designData = null;
                                try {
                                  const rawDesignData = (contractWithBillboards as any).design_data;
                                  if (rawDesignData) {
                                    designData = typeof rawDesignData === 'string' ? JSON.parse(rawDesignData) : rawDesignData;
                                  }
                                } catch (e) {
                                  console.error('Failed to parse design_data:', e);
                                }

                                if (billboardsData.length === 0) {
                                  toast.warning('لا توجد لوحات لهذا العقد');
                                  return;
                                }

                                window.dispatchEvent(new CustomEvent('openBillboardPrint', {
                                  detail: {
                                    contractNumber: contract.id,
                                    billboards: billboardsData,
                                    designData: designData,
                                    customerPhone: (contract as any).Phone || (contractWithBillboards as any).Phone || ''
                                  }
                                }));
                              } catch (error) {
                                console.error('Error loading contract data:', error);
                                toast.error('فشل في تحميل بيانات العقد');
                              }
                            }}
                            className="h-8 px-2 gap-1"
                            title="طباعة اللوحات منفصلة"
                          >
                            <FileText className="h-4 w-4" />
                            لوحات منفصلة
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1"
                                title="تصدير اللوحات إلى Excel"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                                Excel
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const contractWithBillboards = await getContractWithBillboards(String(contract.id));
                                    const billboardsData = (contractWithBillboards as any).billboards || [];
                                    
                                    if (billboardsData.length === 0) {
                                      toast.warning('لا توجد لوحات لهذا العقد');
                                      return;
                                    }

                                    exportBillboardsToExcel({
                                      contractNumber: contract.Contract_Number || contract.id,
                                      billboards: billboardsData,
                                      customerName: contract.customer_name || '',
                                      includePrices: false
                                    });
                                    
                                    toast.success('تم تصدير اللوحات بنجاح');
                                  } catch (error) {
                                    console.error('Error exporting billboards:', error);
                                    toast.error('فشل في تصدير اللوحات');
                                  }
                                }}
                              >
                                تصدير بدون أسعار
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    const contractWithBillboards = await getContractWithBillboards(String(contract.id));
                                    const billboardsData = (contractWithBillboards as any).billboards || [];
                                    
                                    if (billboardsData.length === 0) {
                                      toast.warning('لا توجد لوحات لهذا العقد');
                                      return;
                                    }

                                    exportBillboardsToExcel({
                                      contractNumber: contract.Contract_Number || contract.id,
                                      billboards: billboardsData,
                                      customerName: contract.customer_name || '',
                                      includePrices: true
                                    });
                                    
                                    toast.success('تم تصدير اللوحات بنجاح');
                                  } catch (error) {
                                    console.error('Error exporting billboards:', error);
                                    toast.error('فشل في تصدير اللوحات');
                                  }
                                }}
                              >
                                تصدير مع الأسعار
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const s = contract.start_date || (contract as any)['Contract Date'] || '';
                              const e = contract.end_date || (contract as any)['End Date'] || '';
                              let months = 1;
                              try {
                                if (s && e) { const sd = new Date(s); const ed = new Date(e); const diffDays = Math.max(1, Math.ceil(Math.abs(ed.getTime() - sd.getTime())/86400000)); months = Math.max(1, Math.round(diffDays/30)); }
                              } catch {}
                              const start = new Date();
                              const end = new Date(start); end.setMonth(end.getMonth() + months);
                              setRenewSource(contract); setRenewStart(start.toISOString().slice(0,10)); setRenewEnd(end.toISOString().slice(0,10)); setRenewOpen(true);
                            }}
                            className="h-8 px-2 gap-1"
                            title="تجديد العقد ب��فس اللوحات"
                          >
                            <RefreshCcw className="h-4 w-4" />
                            تجديد
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredContracts.length === 0 && contracts.length > 0 && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
              <p className="text-muted">لم يتم العثور على عقود تطابق معايير البحث</p>
            </div>
          )}

          {contracts.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">ل�� توجد عقود</h3>
              <p className="text-muted">ابدأ بإنشاء عقد جدي��</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* مودال عرض تفاصيل العقد */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العقد</DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-6">
              {/* معلومات العقد */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      معلومات الزبون
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>الاسم:</strong> {selectedContract.customer_name}</p>
                      <p><strong>نوع الإعلان:</strong> {selectedContract.ad_type || '—'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      تفاصيل العقد
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>تاريخ البداية:</strong> {selectedContract.start_date ? new Date(selectedContract.start_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>تاريخ النهاية:</strong> {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>الإيجار:</strong> {(selectedContract.rent_cost || 0).toLocaleString()} د.ل</p>
                      <p><strong>التركيب:</strong> {(selectedContract.installation_cost || 0).toLocaleString()} د.ل</p>
                      <p><strong>الطباعة:</strong> {(selectedContract.print_cost || 0).toLocaleString()} د.ل</p>
                      <p><strong>الإجمالي:</strong> {(selectedContract.total_cost || selectedContract.rent_cost || 0).toLocaleString()} د.ل</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* اللوحات المرتبطة */}
              {selectedContract.billboards && selectedContract.billboards.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">اللوحات المرتبطة ({selectedContract.billboards.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedContract.billboards.map((billboard: any) => (
                        <Card key={billboard.ID || billboard.id} className="border">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{billboard.Billboard_Name || billboard.name}</h4>
                              <p className="text-sm text-muted">{billboard.Nearest_Landmark || billboard.location}</p>
                              <p className="text-sm">الحجم: {billboard.Size || billboard.size}</p>
                              <p className="text-sm">المدي��ة: {billboard.City || billboard.city}</p>
                            </div>
                            <div className="text-xs text-muted">ضمن العقد</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Dialog */}
      <ContractPDFDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        contract={selectedContractForPDF}
      />

      {/* Renew Dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تجديد العقد #{String(renewSource?.id || '')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البداية الجديد</Label>
                <Input type="date" value={renewStart} onChange={(e) => setRenewStart(e.target.value)} />
              </div>
              <div>
                <label>تاريخ النهاية الجديد</label>
                <Input type="date" value={renewEnd} onChange={(e) => setRenewEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenewOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                if (!renewSource) return;
                try {
                  const { renewContract } = await import('@/services/contractService');
                  const created = await renewContract(String(renewSource.id), { start_date: renewStart, end_date: renewEnd, keep_cost: true });
                  toast.success(`تم إنشاء عقد جديد برقم ${String(created?.Contract_Number ?? created?.id ?? '')}`);
                  setRenewOpen(false); setRenewSource(null); setRenewStart(''); setRenewEnd('');
                  loadData();
                } catch (e) {
                  console.error(e);
                  toast.error('فشل تجديد العقد');
                }
              }}>تجديد</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Install Team Selection Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>اختر فرقة التركيب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اختر فرقة التركيب التي ستقوم بالتركيب لهذه العقدة</Label>
              <Select value={selectedTeamId || 'none'} onValueChange={(v) => setSelectedTeamId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر فرقة" />
                </SelectTrigger>
                <SelectContent>
                  {installationTeams.length === 0 ? (
                    <SelectItem value="none">لا توجد فرق</SelectItem>
                  ) : (
                    installationTeams.map(team => (
                      <SelectItem key={team.id} value={String(team.id)}>{team.team_name || team.name || `فرقة ${team.id}`}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handlePrintInstallationForTeam}>طباعة التركيب للفرقة</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billboard Print Individual Dialog */}
      {billboardPrintData && (
        <BillboardPrintIndividual
          contractNumber={billboardPrintData.contractNumber}
          billboards={billboardPrintData.billboards}
          designData={billboardPrintData.designData}
          customerPhone={billboardPrintData.customerPhone}
        />
      )}

      {/* Send Alerts Dialog */}
      <SendAlertsDialog
        open={alertsDialogOpen}
        onOpenChange={setAlertsDialogOpen}
        contracts={contracts}
      />

      {/* Quick Contract Creation Dialog */}
      <QuickContractDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
      />
    </div>
  );
}
