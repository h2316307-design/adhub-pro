// @ts-nocheck
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Save, Phone, MapPin, Users, ExternalLink } from 'lucide-react';
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

  // Group pending/in_progress task items by team, then by city
  const teamTasksData = useMemo(() => {
    const result: Record<string, {
      teamName: string;
      phoneNumber: string;
      items: any[];
      byCity: Record<string, any[]>;
      total: number;
    }> = {};

    // Get pending/in_progress tasks
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
          items: [],
          byCity: {},
          total: 0,
        };
      }

      taskItems.forEach(item => {
        const bb = billboardById[item.billboard_id];
        const city = bb?.City || 'غير محدد';
        const designs = designsByTask[task.id] || [];
        const designName = designs.map(d => d.design_name).join(', ') || 'غير محدد';
        const contract = contractById[task.contract_id];
        const adType = bb?.Ad_Type || contract?.['Ad Type'] || 'غير محدد';

        const enrichedItem = {
          ...item,
          task,
          bb,
          city,
          designName,
          adType,
          gpsLink: bb?.GPS_Link || '',
          billboardName: bb?.Billboard_Name || `لوحة #${item.billboard_id}`,
          size: bb?.Size || '',
        };

        result[teamId].items.push(enrichedItem);
        if (!result[teamId].byCity[city]) result[teamId].byCity[city] = [];
        result[teamId].byCity[city].push(enrichedItem);
        result[teamId].total++;
      });
    });

    return result;
  }, [tasks, allTaskItems, billboardById, teamById, contractById, designsByTask]);

  // Build message for a specific team
  const buildTeamMessage = (teamId: string) => {
    const data = teamTasksData[teamId];
    if (!data) return '';

    let msg = `*مهام التركيب - فريق ${data.teamName}*\n\n`;

    const cities = Object.keys(data.byCity).sort();
    cities.forEach((city, ci) => {
      const items = data.byCity[city];
      msg += `*مدينة: ${city}*\n`;

      items.forEach((item, i) => {
        msg += `${i + 1}. ${item.billboardName}`;
        if (item.size) msg += ` (${item.size})`;
        msg += `\n`;
        msg += `   - نوع الإعلان: ${item.adType}\n`;
        msg += `   - التصميم: ${item.designName}\n`;
        if (item.gpsLink) {
          msg += `   - الموقع: ${item.gpsLink}\n`;
        }
        if (i < items.length - 1) msg += '\n';
      });

      if (ci < cities.length - 1) msg += '\n---------------\n\n';
    });

    msg += `\n---------------\n`;
    msg += `*الإجمالي: ${data.total} لوحة*`;

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
      // Update local teamById
      if (teamById[teamId]) {
        teamById[teamId].phone_number = phone;
      }
    } catch (e: any) {
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

                return (
                  <div key={teamId} className="rounded-xl border-2 border-border bg-card p-4 space-y-3">
                    {/* Team header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-bold text-base">{data.teamName}</span>
                        <Badge variant="secondary">{data.total} لوحة</Badge>
                      </div>
                      <Button
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleSendToTeam(teamId)}
                        disabled={!currentPhone}
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
                        placeholder="رقم هاتف الفرقة (مثال: 0912345678)"
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

                    {/* Tasks by city */}
                    <div className="space-y-2 text-xs">
                      {Object.entries(data.byCity).sort().map(([city, items]) => (
                        <div key={city} className="border-b border-border/30 pb-2 last:border-0">
                          <div className="flex items-center gap-1 font-semibold text-sm mb-1">
                            <MapPin className="h-3 w-3 text-blue-500" />
                            {city}
                            <Badge variant="outline" className="text-[10px] mr-1">{items.length}</Badge>
                          </div>
                          {items.map((item, i) => (
                            <div key={item.id} className="py-1 pr-4 space-y-0.5">
                              <div className="font-medium">
                                {i + 1}. {item.billboardName}
                                {item.size && <span className="text-muted-foreground mr-1">({item.size})</span>}
                              </div>
                              <div className="text-muted-foreground pr-3">
                                نوع الإعلان: {item.adType} | التصميم: {item.designName}
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
