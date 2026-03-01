import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GalleryTask {
  taskId: string;
  contractId: number;
  customerName: string;
  adType: string;
  teamName: string;
  status: string;
  isArchived: boolean;
  items: GalleryItem[];
  designs: GalleryDesign[];
}

export interface GalleryItem {
  id: string;
  billboardId: number;
  billboardName: string;
  size: string;
  designFaceA: string | null;
  designFaceB: string | null;
  installedFaceA: string | null;
  installedFaceB: string | null;
  installationDate: string | null;
  status: string;
}

export interface GalleryDesign {
  id: string;
  designName: string;
  faceAUrl: string | null;
  faceBUrl: string | null;
  cutoutUrl: string | null;
}

export type GalleryFilter = 'all' | 'designs' | 'installations' | 'completed' | 'archived';

export function useImageGallery() {
  const [tasks, setTasks] = useState<GalleryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [archivedTaskIds, setArchivedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch all task items (filter images client-side for reliability)
      const { data: allItems, error: itemsErr } = await supabase
        .from('installation_task_items')
        .select('id, task_id, billboard_id, status, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url, installation_date')
        .limit(5000);

      console.log('📸 Gallery: fetched items:', allItems?.length, 'error:', itemsErr?.message);

      // Filter to items that have at least one image
      const itemsWithImages = (allItems || []).filter(i => 
        i.design_face_a || i.design_face_b || i.installed_image_face_a_url || i.installed_image_face_b_url
      );

      console.log('📸 Gallery: items with images:', itemsWithImages.length);

      if (!itemsWithImages.length) { setTasks([]); setLoading(false); return; }

      // Get unique task IDs that actually have images
      const taskIdsWithImages = [...new Set(itemsWithImages.map(i => i.task_id))];
      
      // Get unique billboard IDs needed
      const billboardIds = [...new Set(itemsWithImages.map(i => i.billboard_id))];

      console.log('📸 Gallery: unique tasks:', taskIdsWithImages.length, 'unique billboards:', billboardIds.length);

      // Fetch tasks, contracts, designs, billboards in parallel
      const [tasksRes, designsRes, archivedRes] = await Promise.all([
        supabase.from('installation_tasks').select('id, contract_id, status, team_id, installation_teams!installation_tasks_team_id_fkey(team_name)').in('id', taskIdsWithImages),
        supabase.from('task_designs').select('id, task_id, design_name, design_face_a_url, design_face_b_url, cutout_image_url').in('task_id', taskIdsWithImages),
        supabase.from('system_settings').select('setting_value').eq('setting_key', 'archived_gallery_tasks').maybeSingle(),
      ]);

      console.log('📸 Gallery: tasks fetched:', tasksRes.data?.length, 'error:', tasksRes.error?.message);
      console.log('📸 Gallery: designs fetched:', designsRes.data?.length);

      const taskData = tasksRes.data || [];
      if (!taskData.length) { console.log('📸 Gallery: NO TASKS FOUND - stopping'); setTasks([]); setLoading(false); return; }

      const contractIds = [...new Set(taskData.map(t => t.contract_id).filter(Boolean))] as number[];

      // Fetch contracts and billboards
      const [contractsRes, billboardsRes] = await Promise.all([
        supabase.from('Contract').select('"Customer Name", "Ad Type", "Contract_Number"').in('Contract_Number', contractIds),
        supabase.from('billboards').select('"ID", "Billboard_Name", "Size"').in('ID', billboardIds),
      ]);

      const contractMap = new Map<number, any>();
      contractsRes.data?.forEach(c => contractMap.set(c.Contract_Number, c));

      const billboardMap = new Map<number, any>();
      billboardsRes.data?.forEach(b => billboardMap.set(b.ID, b));

      const archived = new Set<string>(
        archivedRes.data?.setting_value ? 
          (typeof archivedRes.data.setting_value === 'string' ? 
            JSON.parse(archivedRes.data.setting_value) : 
            (archivedRes.data.setting_value as any)) : []
      );
      setArchivedTaskIds(archived);

      const result: GalleryTask[] = taskData.map(task => {
        const contract = contractMap.get(task.contract_id!);
        const taskItems = (itemsWithImages || []).filter(i => i.task_id === task.id);
        const taskDesigns = (designsRes.data || []).filter(d => d.task_id === task.id);
        const teamName = (task as any).installation_teams?.team_name || 'غير محدد';

        return {
          taskId: task.id,
          contractId: task.contract_id!,
          customerName: contract?.['Customer Name'] || 'غير معروف',
          adType: contract?.['Ad Type'] || '',
          teamName,
          status: task.status || 'pending',
          isArchived: archived.has(task.id),
          items: taskItems.map(item => {
            const bb = billboardMap.get(item.billboard_id);
            return {
              id: item.id,
              billboardId: item.billboard_id,
              billboardName: bb?.Billboard_Name || `لوحة ${item.billboard_id}`,
              size: bb?.Size || '',
              designFaceA: item.design_face_a,
              designFaceB: item.design_face_b,
              installedFaceA: item.installed_image_face_a_url,
              installedFaceB: item.installed_image_face_b_url,
              installationDate: item.installation_date,
              status: item.status || 'pending',
            };
          }),
          designs: taskDesigns.map(d => ({
            id: d.id,
            designName: d.design_name || 'تصميم',
            faceAUrl: d.design_face_a_url,
            faceBUrl: d.design_face_b_url,
            cutoutUrl: d.cutout_image_url,
          })),
        };
      });

      // Sort by contract ID descending (newest first)
      result.sort((a, b) => b.contractId - a.contractId);
      setTasks(result);
    } catch (err) {
      console.error('Error fetching gallery data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleArchive(taskId: string) {
    const newArchived = new Set(archivedTaskIds);
    if (newArchived.has(taskId)) {
      newArchived.delete(taskId);
    } else {
      newArchived.add(taskId);
    }
    setArchivedTaskIds(newArchived);

    // Persist to system_settings
    const archivedArray = [...newArchived];
    await supabase
      .from('system_settings')
      .upsert({
        setting_key: 'archived_gallery_tasks',
        setting_value: JSON.stringify(archivedArray),
      }, { onConflict: 'setting_key' });

    // Update local state
    setTasks(prev => prev.map(t => 
      t.taskId === taskId ? { ...t, isArchived: newArchived.has(taskId) } : t
    ));
  }

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Apply filter
    switch (filter) {
      case 'designs':
        result = result.filter(t => t.designs.length > 0 || t.items.some(i => i.designFaceA || i.designFaceB));
        break;
      case 'installations':
        result = result.filter(t => t.items.some(i => i.installedFaceA || i.installedFaceB));
        break;
      case 'completed':
        result = result.filter(t => t.status === 'completed');
        break;
      case 'archived':
        result = result.filter(t => t.isArchived);
        break;
      case 'all':
      default:
        result = result.filter(t => !t.isArchived);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.customerName.toLowerCase().includes(q) ||
        t.adType.toLowerCase().includes(q) ||
        t.contractId.toString().includes(q) ||
        t.teamName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [tasks, filter, searchQuery]);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    loading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    toggleArchive,
    refetch: fetchData,
  };
}
