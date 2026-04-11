// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageCircle, Save, Phone, MapPin, Users, ExternalLink, ChevronDown, ChevronLeft, CheckSquare, XSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
}

interface ContractGroup {
  contractId: number | string;
  adType: string;
  designName: string;
  items: any[];
  byCity: Record<string, any[]>;
  total: number;
}

interface TeamData {
  teamName: string;
  phoneNumber: string;
  contracts: Record<string, ContractGroup>;
  total: number;
}

interface SendTeamInstallationReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: any[];
  allTaskItems: any[];
  billboardById: Record<number, any>;
  teamById: Record<string, any>;
  contractById: Record<number, any>;
  designsByTask: Record<string, TaskDesign[]>;
  teams: any[];
}

const openWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

export function SendTeamInstallationReportDialog({
  open, onOpenChange, tasks, allTaskItems, billboardById, teamById, contractById, designsByTask, teams
}: SendTeamInstallationReportDialogProps) {
  const [editingPhones, setEditingPhones] = useState<Record<string, string>>({});
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [openContracts, setOpenContracts] = useState<Set<string>>(new Set());

  // Group: team → contract → city → items
  const teamTasksData = useMemo(() => {
    const result: Record<string, TeamData> = {};

    const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

    activeTasks.forEach(task => {
      const teamId = task.team_id;
      const team = teamById[teamId];
      if (!team) return;

      const taskItems = allTaskItems.filter(item => item.task_id === task.id && item.status !== 'completed');
      if (taskItems.length === 0) return;

      if (!result[teamId]) {
        result[teamId] = {
          teamName: team.team_name || 'غير محدد',
          phoneNumber: team.phone_number || '',
          contracts: {},
          total: 0,
        };
      }

      const contractId = task.contract_id || 'no-contract';
      const contract = contractById[task.contract_id];
      const designs = designsByTask[task.id] || [];
      const designName = designs.map(d => d.design_name).join(', ') || 'غير محدد';
      const adType = contract?.['Ad Type'] || 'غير محدد';

      const contractKey = String(contractId);

      if (!result[teamId].contracts[contractKey]) {
        result[teamId].contracts[contractKey] = {
          contractId,
          adType,
          designName,
          items: [],
          byCity: {},
          total: 0,
        };
      }

      taskItems.forEach(item => {
        const bb = billboardById[item.billboard_id];
        const city = bb?.City || 'غير محدد';

        const enrichedItem = {
          ...item,
          task,
          bb,
          city,
          designName,
          adType,
          gpsLink: (bb?.GPS_Link && !bb.GPS_Link.endsWith('q=0') && bb.GPS_Link !== '') 
            ? bb.GPS_Link 
            : (bb?.GPS_Coordinates && bb.GPS_Coordinates !== '0' && bb.GPS_Coordinates !== '') 
              ? `https://www.google.com/maps?q=${bb.GPS_Coordinates}` 
              : '',
          billboardName: bb?.Billboard_Name || `لوحة #${item.billboard_id}`,
          size: bb?.Size || '',
        };

        result[teamId].contracts[contractKey].items.push(enrichedItem);
        if (!result[teamId].contracts[contractKey].byCity[city]) {
          result[teamId].contracts[contractKey].byCity[city] = [];
        }
        result[teamId].contracts[contractKey].byCity[city].push(enrichedItem);
        result[teamId].contracts[contractKey].total++;
        result[teamId].total++;
      });
    });

    return result;
  }, [tasks, allTaskItems, billboardById, teamById, contractById, designsByTask]);

  // Select all contracts by default when data changes
  useEffect(() => {
    const allKeys = new Set<string>();
    Object.entries(teamTasksData).forEach(([teamId, data]) => {
      Object.keys(data.contracts).forEach(contractKey => {
        allKeys.add(`${teamId}-${contractKey}`);
      });
    });
    setSelectedContracts(allKeys);
  }, [teamTasksData]);

  const toggleContract = (teamId: string, contractKey: string) => {
    const key = `${teamId}-${contractKey}`;
    setSelectedContracts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCollapsible = (key: string) => {
    setOpenContracts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAllForTeam = (teamId: string) => {
    setSelectedContracts(prev => {
      const next = new Set(prev);
      Object.keys(teamTasksData[teamId]?.contracts || {}).forEach(ck => next.add(`${teamId}-${ck}`));
      return next;
    });
  };

  const deselectAllForTeam = (teamId: string) => {
    setSelectedContracts(prev => {
      const next = new Set(prev);
      Object.keys(teamTasksData[teamId]?.contracts || {}).forEach(ck => next.delete(`${teamId}-${ck}`));
      return next;
    });
  };

  const getSelectedCountForTeam = (teamId: string) => {
    const contracts = teamTasksData[teamId]?.contracts || {};
    return Object.keys(contracts).filter(ck => selectedContracts.has(`${teamId}-${ck}`)).length;
  };

  // Build message for selected contracts only
  const buildTeamMessage = (teamId: string) => {
    const data = teamTasksData[teamId];
    if (!data) return '';

    let msg = `*مهام التركيب - فريق ${data.teamName}*\n\n`;
    let totalCount = 0;

    const contractEntries = Object.entries(data.contracts)
      .filter(([ck]) => selectedContracts.has(`${teamId}-${ck}`));

    contractEntries.forEach(([_, cGroup], ci) => {
      msg += `━━━━━━━━━━━━━━━━━\n`;
      msg += `*عقد #${cGroup.contractId} - ${cGroup.adType}*\n`;
      msg += `التصميم: ${cGroup.designName}\n\n`;

      const cities = Object.keys(cGroup.byCity).sort();
      cities.forEach((city) => {
        const items = cGroup.byCity[city];
        msg += `📍 *${city}*\n`;
        items.forEach((item, i) => {
          msg += `  ${i + 1}. ${item.billboardName}`;
          if (item.size) msg += ` (${item.size})`;
          msg += '\n';
          if (item.gpsLink) msg += `     📌 ${item.gpsLink}\n`;
        });
        msg += '\n';
      });

      totalCount += cGroup.total;
      if (ci < contractEntries.length - 1) msg += '\n';
    });

    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `*الإجمالي: ${totalCount} لوحة*`;

    return msg;
  };

  const handleSavePhone = async (teamId: string) => {
    const phone = editingPhones[teamId];
    if (phone === undefined) return;
    setSavingPhone(teamId);
    try {
      const { error } = await (supabase as any)
        .from('installation_teams')
        .update({ phone_number: phone })
        .eq('id', teamId);
      if (error) throw error;
      toast.success('تم حفظ رقم الهاتف');
      if (teamById[teamId]) teamById[teamId].phone_number = phone;
    } catch {
      toast.error('فشل في حفظ الرقم');
    } finally {
      setSavingPhone(null);
    }
  };

  const handleSendToTeam = (teamId: string) => {
    const data = teamTasksData[teamId];
    const phone = editingPhones[teamId] ?? data?.phoneNumber;
    if (!phone) {
      toast.error('يرجى إدخال رقم هاتف الفرقة أولاً');
      return;
    }
    const selectedCount = getSelectedCountForTeam(teamId);
    if (selectedCount === 0) {
      toast.error('يرجى تحديد عقد واحد على الأقل');
      return;
    }
    const message = buildTeamMessage(teamId);
    openWhatsApp(phone, message);
  };

  const teamEntries = Object.entries(teamTasksData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            إرسال مهام التركيب للفرق
          </DialogTitle>
        </DialogHeader>

        {teamEntries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            لا توجد مهام تركيب معلقة لأي فرقة
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pl-2">
              {teamEntries.map(([teamId, data]) => {
                const currentPhone = editingPhones[teamId] ?? data.phoneNumber;
                const phoneChanged = editingPhones[teamId] !== undefined && editingPhones[teamId] !== data.phoneNumber;
                const contractEntries = Object.entries(data.contracts);
                const selectedCount = getSelectedCountForTeam(teamId);

                return (
                  <div key={teamId} className="rounded-xl border-2 border-border bg-card p-4 space-y-3">
                    {/* Team header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-bold text-base">{data.teamName}</span>
                        <Badge variant="secondary">{data.total} لوحة</Badge>
                        <Badge variant="outline" className="text-xs">
                          {selectedCount}/{contractEntries.length} عقد
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleSendToTeam(teamId)}
                        disabled={!currentPhone || selectedCount === 0}
                      >
                        <MessageCircle className="h-4 w-4" />
                        إرسال
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Phone number */}
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={currentPhone}
                        onChange={(e) => setEditingPhones(prev => ({ ...prev, [teamId]: e.target.value }))}
                        placeholder="رقم هاتف الفرقة"
                        className="flex-1 text-sm h-8"
                        dir="ltr"
                      />
                      {phoneChanged && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 h-8"
                          onClick={() => handleSavePhone(teamId)}
                          disabled={savingPhone === teamId}
                        >
                          <Save className="h-3 w-3" />
                          حفظ
                        </Button>
                      )}
                    </div>

                    {/* Select/Deselect buttons */}
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => selectAllForTeam(teamId)}>
                        <CheckSquare className="h-3 w-3" /> تحديد الكل
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => deselectAllForTeam(teamId)}>
                        <XSquare className="h-3 w-3" /> إلغاء التحديد
                      </Button>
                    </div>

                    {/* Contracts (collapsible) */}
                    <div className="space-y-1.5">
                      {contractEntries.map(([contractKey, cGroup]) => {
                        const selKey = `${teamId}-${contractKey}`;
                        const isSelected = selectedContracts.has(selKey);
                        const isOpen = openContracts.has(selKey);

                        return (
                          <Collapsible key={contractKey} open={isOpen} onOpenChange={() => toggleCollapsible(selKey)}>
                            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleContract(teamId, contractKey)}
                                className="shrink-0"
                              />
                              <CollapsibleTrigger asChild>
                                <button className="flex items-center gap-2 flex-1 text-right text-sm">
                                  {isOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <span className="font-semibold">عقد #{cGroup.contractId}</span>
                                  <span className="text-muted-foreground">-</span>
                                  <Badge variant="secondary" className="text-xs font-normal">{cGroup.adType}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{cGroup.total} لوحة</Badge>
                                  <span className="text-xs text-muted-foreground mr-auto truncate max-w-[120px]">
                                    {cGroup.designName}
                                  </span>
                                </button>
                              </CollapsibleTrigger>
                            </div>

                            <CollapsibleContent>
                              <div className="mr-8 mt-1 mb-2 space-y-1.5 text-xs">
                                {Object.entries(cGroup.byCity).sort().map(([city, items]) => (
                                  <div key={city} className="border-r-2 border-primary/20 pr-3">
                                    <div className="flex items-center gap-1 font-semibold text-sm mb-0.5">
                                      <MapPin className="h-3 w-3 text-blue-500" />
                                      {city}
                                      <Badge variant="outline" className="text-[10px] mr-1">{items.length}</Badge>
                                    </div>
                                    {items.map((item, i) => (
                                      <div key={item.id} className="py-0.5 pr-4">
                                        <div className="font-medium">
                                          {i + 1}. {item.billboardName}
                                          {item.size && <span className="text-muted-foreground mr-1">({item.size})</span>}
                                        </div>
                                        {item.gpsLink && (
                                          <a
                                            href={item.gpsLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline pr-3 inline-flex items-center gap-1"
                                          >
                                            <MapPin className="h-3 w-3" /> الموقع
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
