/**
 * بيانات أوامر إزالة الدعاية: الأوامر واللوحات والعقود والفرق والتصاميم،
 * مع الإنشاء التلقائي لأوامر العقود المنتهية (منقولة كما هي من الصفحة القديمة).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { readRemovalPages } from '@/services/removalCleanupService';
import { removalPrintImages, verifiedRemovalDesignSource, matchesRemovalDesignBillboard, isRemovalDesignEnabled } from '@/services/removalPrintImages';
import { excludePreviouslyCompletedRemovals } from '@/services/removalTaskHistory';
import { findOptimalTeamForRemoval } from '@/utils/teamAssignment';

export interface RemovalTask {
  id: string;
  contract_id: number;
  contract_ids?: number[];
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  Contract?: any;
  installation_teams?: any;
}

export interface RemovalTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  status: 'pending' | 'completed';
  completed_at: string | null;
  removal_date: string | null;
  notes: string | null;
  removed_image_url: string | null;
  installed_image_url?: string | null;
  installed_image_face_a_url?: string | null;
  installed_image_face_b_url?: string | null;
  design_face_a?: string | null;
  design_face_b?: string | null;
}

export interface CleanupReportData {
  checked: number;
  removed: Array<{
    id: string;
    task_id: string;
    billboard_id: number | string;
    name: string;
    contracts: string;
    reason?: string;
  }>;
  emptyTasksRemoved?: number;
}

export async function getLatestInstallationSnapshot(contractIds: number[], billboardId: number) {
  const normalizedContractIds = [...new Set(contractIds.map(Number).filter(Number.isFinite))];
  if (normalizedContractIds.length === 0) return null;

  const { data: installationTasks, error: tasksError } = await supabase
    .from('installation_tasks')
    .select('id')
    .in('contract_id', normalizedContractIds);
  if (tasksError) return null;

  const taskIds = (installationTasks || []).map((task: any) => task.id).filter(Boolean);
  if (taskIds.length === 0) return null;

  const { data, error } = await supabase
    .from('installation_task_items')
    .select('design_face_a, design_face_b, installed_image_url, installed_image_face_a_url, installed_image_face_b_url')
    .eq('billboard_id', billboardId)
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export function useRemovalData() {
  const queryClient = useQueryClient();

  // 1. Fetch Removal Tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['removal-tasks'],
    queryFn: async () => {
      return await readRemovalPages((from, to) => supabase
        .from('removal_tasks')
        .select('*')
        .order('created_at', { ascending: false }).order('id').range(from, to)) as RemovalTask[];
    },
  });

  // 2. Fetch Teams
  const { data: teams = [] } = useQuery({
    queryKey: ['installation-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_teams')
        .select('*');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const teamById = useMemo(() => {
    const m: Record<string, any> = {};
    teams.forEach((t) => {
      m[t.id] = t;
      m[String(t.id)] = t;
    });
    return m;
  }, [teams]);

  // 3. Fetch Raw Task Items
  const { data: rawTaskItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['all-removal-task-items'],
    queryFn: async () => {
      const data = await readRemovalPages((from, to) =>
        supabase.from('removal_task_items').select('*').order('id').range(from, to)
      );
      const unique = data?.filter((item, index, self) =>
        index === self.findIndex((t) => t.task_id === item.task_id && t.billboard_id === item.billboard_id && t.status === item.status)
      ) || [];
      return unique as RemovalTaskItem[];
    },
  });

  // Map task_id -> contract_id
  const removalTaskContractMap = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => {
      const cId = Number(t.contract_id);
      m.set(String(t.id), cId);
      m.set(t.id, cId);
    });
    return m;
  }, [tasks]);

  // 4. Fetch Installation Designs for Task Items
  const itemBillboardIds = useMemo(() => {
    return [...new Set(rawTaskItems.map((i) => Number(i.billboard_id)).filter((id) => Number.isFinite(id) && id > 0))];
  }, [rawTaskItems]);

  const { data: installationDesigns = [] } = useQuery({
    queryKey: ['installation-designs-for-removal-v5', itemBillboardIds.join(',')],
    enabled: itemBillboardIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_task_items')
        .select(`
          billboard_id,
          design_face_a,
          design_face_b,
          installed_image_url,
          installed_image_face_a_url,
          installed_image_face_b_url,
          task_id,
          created_at,
          selected_design_id,
          task_designs:selected_design_id(
            design_name,
            design_face_a_url,
            design_face_b_url
          )
        `)
        .in('billboard_id', itemBillboardIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const taskIds = [...new Set((data || []).map((item: any) => item.task_id).filter(Boolean))];
      if (taskIds.length === 0) return [];

      const { data: instTasks, error: tasksError } = await supabase
        .from('installation_tasks')
        .select('id, contract_id')
        .in('id', taskIds);
      if (tasksError) throw tasksError;

      const contractByTask = new Map((instTasks || []).map((task: any) => [task.id, Number(task.contract_id)]));
      return (data || []).map((item: any) => ({
        ...item,
        design_face_a: item.selected_design_id ? (item.task_designs?.design_face_a_url || null) : (item.design_face_a || null),
        design_face_b: item.selected_design_id ? (item.task_designs?.design_face_b_url || null) : (item.design_face_b || null),
        contract_id: contractByTask.get(item.task_id) || null,
      }));
    },
  });

  // 5. Fetch Billboards Details
  const { data: billboardsDetails = [] } = useQuery({
    queryKey: ['billboards-for-removal-tasks', itemBillboardIds.join(',')],
    enabled: itemBillboardIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('billboards').select('*').in('ID', itemBillboardIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const billboardById = useMemo(() => {
    const m: Record<string | number, any> = {};
    billboardsDetails.forEach((b: any) => {
      m[b.ID] = b;
      m[String(b.ID)] = b;
      m[Number(b.ID)] = b;
    });
    return m;
  }, [billboardsDetails]);

  // 6. Fetch Contract Details for Tasks (including design_data & billboard_ids)
  const contractIds = useMemo(() => {
    const ids: number[] = [];
    tasks.forEach((t) => {
      if (t.contract_id) ids.push(Number(t.contract_id));
      if (Array.isArray(t.contract_ids)) {
        t.contract_ids.forEach((id: any) => ids.push(Number(id)));
      }
    });
    return [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  }, [tasks]);

  const { data: taskContracts = [] } = useQuery({
    queryKey: ['contracts-for-removal-tasks', contractIds.join(',')],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", design_data, billboard_ids, installation_enabled')
        .in('Contract_Number', contractIds);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const contractByNumber = useMemo(() => {
    const m: Record<string | number, any> = {};
    taskContracts.forEach((c: any) => {
      const num = Number(c.Contract_Number);
      m[num] = c;
      m[String(c.Contract_Number)] = c;
    });
    return m;
  }, [taskContracts]);

  // 7. Merge designs with items (Multi-layer fallback: DB Item -> Installation Tasks -> Contract design_data -> Billboard)
  const allTaskItems = useMemo(() => {
    // A. Parse Contract.design_data for each contract
    const contractDesignMap = new Map<string, { design_face_a?: string | null; design_face_b?: string | null }>();
    taskContracts.forEach((c: any) => {
      if (c.installation_enabled === false) return;
      if (!c.design_data) return;
      try {
        let dd = typeof c.design_data === 'string' ? JSON.parse(c.design_data) : c.design_data;
        if (typeof dd === 'string') {
          try { dd = JSON.parse(dd); } catch {}
        }
        const cleanUrl = (val: any): string | null => {
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed && (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:'))) {
              return trimmed;
            }
          }
          return null;
        };

        if (Array.isArray(dd)) {
          const contractBillboardIds = c.billboard_ids
            ? String(c.billboard_ids).split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n) && n > 0)
            : [];
          const contractBillboards = billboardsDetails.filter((b: any) => {
            if (contractBillboardIds.length > 0) {
              return contractBillboardIds.includes(Number(b.ID));
            }
            return true;
          });

          dd.forEach((d: any) => {
            if (!isRemovalDesignEnabled(d)) return;

            const faceA = cleanUrl(d.designFaceA) || cleanUrl(d.design_face_a) || cleanUrl(d.faceA) || cleanUrl(d.face_a) ||
                          cleanUrl(d.design_face_a_url) || cleanUrl(d.designFaceAUrl);

            const faceB = cleanUrl(d.designFaceB) || cleanUrl(d.design_face_b) || cleanUrl(d.faceB) || cleanUrl(d.face_b) ||
                          cleanUrl(d.design_face_b_url) || cleanUrl(d.designFaceBUrl);

            // Only map when the design actually contains an image
            if (!faceA && !faceB) return;

            contractBillboards.forEach((billboard: any) => {
              if (matchesRemovalDesignBillboard(d, billboard)) {
                contractDesignMap.set(`${Number(c.Contract_Number)}:${Number(billboard.ID)}`, {
                  design_face_a: faceA || null,
                  design_face_b: faceB || null,
                });
              }
            });
          });
        }
      } catch (err) {
        console.warn('Error parsing contract design_data:', err);
      }
    });

    // B. Build installation designs map
    const installDesignMap = new Map<string, any>();
    installationDesigns.forEach((d: any) => {
      const key = `${Number(d.contract_id)}:${Number(d.billboard_id)}`;
      if (!installDesignMap.has(key)) {
        installDesignMap.set(key, d);
      }
    });

    const cleanItemUrl = (val: any): string | null => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed && (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.startsWith('data:'))) {
          return trimmed;
        }
      }
      return null;
    };

    return excludePreviouslyCompletedRemovals(rawTaskItems, tasks).map((item) => {
      const contractId = removalTaskContractMap.get(item.task_id) || removalTaskContractMap.get(String(item.task_id));
      const bId = Number(item.billboard_id);
      const cId = Number(contractId);
      const installDesign = contractId ? installDesignMap.get(`${cId}:${bId}`) : undefined;
      const contractDesign = contractId
        ? contractDesignMap.get(`${cId}:${bId}`)
        : undefined;

      const bStreetPhoto = (billboardById[bId]?.Image_URL || '').trim();
      const sanitizeDesign = (val: any): string | null => {
        const u = cleanItemUrl(val);
        if (!u) return null;
        if (bStreetPhoto && u === bStreetPhoto) return null;
        return u;
      };

      // Resolve only sources matched to this billboard and the removal contract.
      const photoUrls = [item.installed_image_url, item.installed_image_face_a_url, item.installed_image_face_b_url,
        installDesign?.installed_image_url, installDesign?.installed_image_face_a_url, installDesign?.installed_image_face_b_url];
      const cleanSource = (source: any) => {
        const images = removalPrintImages({
          design_face_a: sanitizeDesign(source?.design_face_a),
          design_face_b: sanitizeDesign(source?.design_face_b),
        }, billboardById[bId] || {}, true, photoUrls);
        return { design_face_a: images.faceA, design_face_b: images.faceB };
      };
      const sourceDesign = verifiedRemovalDesignSource(cleanSource(installDesign), cleanSource(contractDesign));
      const verifiedImages = removalPrintImages(sourceDesign, billboardById[bId] || {}, true, photoUrls);
      const finalFaceA = verifiedImages.faceA;
      const finalFaceB = verifiedImages.faceB;

      const finalInstalledUrl = cleanItemUrl(item.installed_image_url) ||
                                cleanItemUrl(installDesign?.installed_image_face_a_url) ||
                                cleanItemUrl(installDesign?.installed_image_url) ||
                                null;

      const finalInstalledFaceA = cleanItemUrl(item.installed_image_face_a_url) ||
                                  cleanItemUrl(installDesign?.installed_image_face_a_url) ||
                                  null;

      const finalInstalledFaceB = cleanItemUrl(item.installed_image_face_b_url) ||
                                  null;

      return {
        ...item,
        contract_id: contractId,
        design_face_a: finalFaceA,
        design_face_b: finalFaceB,
        installed_image_url: finalInstalledUrl,
        installed_image_face_a_url: finalInstalledFaceA,
        installed_image_face_b_url: finalInstalledFaceB,
      };
    });
  }, [rawTaskItems, tasks, installationDesigns, removalTaskContractMap, taskContracts, billboardById, billboardsDetails]);

  // Helper groupings
  const itemsByTask = useMemo(() => {
    const grouped: Record<string, RemovalTaskItem[]> = {};
    allTaskItems.forEach((item) => {
      if (!grouped[item.task_id]) grouped[item.task_id] = [];
      grouped[item.task_id].push(item);
    });
    return grouped;
  }, [allTaskItems]);

  const existingTaskContractIds = useMemo(() => {
    return new Set(
      tasks
        .filter((t) => t.status !== 'cancelled')
        .flatMap((t) => t.contract_ids || [t.contract_id])
    );
  }, [tasks]);

  const existingTaskBillboardIds = useMemo(() => {
    const activeTasks = new Set(tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').map((t) => t.id));
    return new Set(
      allTaskItems
        .filter((item) => activeTasks.has(item.task_id) && item.status === 'pending')
        .map((item) => item.billboard_id)
    );
  }, [tasks, allTaskItems]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeTasksList = tasks.filter((task) => (itemsByTask[task.id] || []).some((item) => item.status !== 'completed'));
    const pendingBillboardsCount = allTaskItems.filter((item) => item.status !== 'completed').length;
    const completedBillboardsCount = allTaskItems.filter((item) => item.status === 'completed').length;
    const activeTeamsCount = new Set(activeTasksList.map((t) => t.team_id).filter(Boolean)).size;

    return {
      activeTasksCount: activeTasksList.length,
      pendingBillboardsCount,
      completedBillboardsCount,
      activeTeamsCount,
    };
  }, [tasks, allTaskItems, itemsByTask]);

  // Calculate duplicate billboards in pending items
  const duplicateTasksCount = useMemo(() => {
    const billboardCount: Record<number, number> = {};
    let count = 0;
    for (const item of allTaskItems) {
      if (item.status === 'completed') continue;
      billboardCount[item.billboard_id] = (billboardCount[item.billboard_id] || 0) + 1;
    }
    for (const c of Object.values(billboardCount)) {
      if (c > 1) count += c - 1;
    }
    return count;
  }, [allTaskItems]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Creation of Tasks for Expired Contracts (Strict Rented Conflict Shield)
  // ─────────────────────────────────────────────────────────────────────────────
  const autoTasksCreatedRef = useState<Set<number>>(() => new Set())[0];

  const { data: expiredContracts = [] } = useQuery({
    queryKey: ['expired-contracts-auto-sync'],
    queryFn: async () => {
      const todayIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", billboard_ids, "Ad Type", "Contract Date", "End Date", design_data')
        .lte('"End Date"', todayIso)
        .gte('"End Date"', '2025-10-01')
        .order('Contract_Number', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    const createAutoRemovalTasks = async () => {
      if (!expiredContracts.length || !teams.length || !tasks.length) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Fetch all active contracts (end date strictly > today, uncancelled)
      const { data: activeContracts } = await supabase
        .from('Contract')
        .select('Contract_Number, billboard_ids, "End Date", billboards_released')
        .gt('"End Date"', todayStr);

      const billboardsInActiveContracts = new Set<number>();
      (activeContracts || []).forEach((c: any) => {
        if (c.billboards_released === true) return;
        if (c.billboard_ids) {
          const ids = String(c.billboard_ids).split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => billboardsInActiveContracts.add(id));
        }
      });

      const seenInNewerContracts = new Set<number>();
      billboardsInActiveContracts.forEach((id) => seenInNewerContracts.add(id));

      let tasksCreated = false;

      for (const contract of expiredContracts) {
        const cNum = Number(contract.Contract_Number);
        const billboardIds = contract.billboard_ids
          ? String(contract.billboard_ids).split(',').map((id: string) => parseInt(id.trim())).filter(Boolean)
          : [];

        if (autoTasksCreatedRef.has(cNum)) {
          billboardIds.forEach((id) => seenInNewerContracts.add(id));
          continue;
        }

        // Always register billboards of existing or newer contracts so older contracts can NEVER claim them
        if (existingTaskContractIds.has(cNum)) {
          billboardIds.forEach((id) => seenInNewerContracts.add(id));
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        if (contract['End Date']) {
          const endDate = new Date(contract['End Date']);
          endDate.setHours(0, 0, 0, 0);
          if (endDate > today) {
            billboardIds.forEach((id) => seenInNewerContracts.add(id));
            autoTasksCreatedRef.add(cNum);
            continue;
          }
        }

        if (billboardIds.length === 0) {
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        // Billboards that have NOT been superseded by a newer contract
        const eligibleBillboardIds = billboardIds.filter((id) => !seenInNewerContracts.has(id));
        billboardIds.forEach((id) => seenInNewerContracts.add(id));

        if (eligibleBillboardIds.length === 0) {
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        // Fetch billboard records
        const { data: contractBillboards, error: billError } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', eligibleBillboardIds);

        if (billError || !contractBillboards || contractBillboards.length === 0) {
          autoTasksCreatedRef.add(cNum);
          continue;
        }

        // Strict filter: exclude billboards already in pending removal tasks or currently rented in active contracts
        const availableBillboards = contractBillboards.filter((billboard) => {
          if (existingTaskBillboardIds.has(billboard.ID)) return false;
          if (!excludePreviouslyCompletedRemovals([...rawTaskItems, { task_id: '__candidate', billboard_id: billboard.ID, status: 'pending' }], [...tasks, { id: '__candidate', contract_id: cNum, status: 'pending' }]).some(item => item.task_id === '__candidate')) return false;
          if (billboardsInActiveContracts.has(billboard.ID)) return false;
          return true;
        });

        autoTasksCreatedRef.add(cNum);
        if (availableBillboards.length === 0) continue;

        // Group billboards by team
        const teamsByTeamId: Record<string, { teamId: string; billboards: number[] }> = {};
        for (const billboard of availableBillboards) {
          const suitableTeam = findOptimalTeamForRemoval(teams, billboard.Size, billboard.City, billboard.friend_company_id);
          if (!suitableTeam) continue;
          const tId = suitableTeam.id;
          if (!teamsByTeamId[tId]) {
            teamsByTeamId[tId] = { teamId: tId, billboards: [] };
          }
          teamsByTeamId[tId].billboards.push(billboard.ID);
        }

        for (const teamData of Object.values(teamsByTeamId)) {
          const { data: newTask, error: insertError } = await supabase
            .from('removal_tasks')
            .insert({
              contract_id: cNum,
              contract_ids: [cNum],
              team_id: teamData.teamId,
              status: 'pending',
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError || !newTask) continue;
          tasksCreated = true;

          for (const billboardId of teamData.billboards) {
            const instSnap = await getLatestInstallationSnapshot([cNum], billboardId);
            await supabase.from('removal_task_items').insert({
              task_id: newTask.id,
              billboard_id: billboardId,
              status: 'pending',
              design_face_a: instSnap?.design_face_a || null,
              design_face_b: instSnap?.design_face_b || null,
              installed_image_url: instSnap?.installed_image_url || null,
            });
          }
        }
      }

      if (tasksCreated) {
        queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      }
    };

    createAutoRemovalTasks();
  }, [expiredContracts.length, teams.length, tasks.length]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
  };

  return {
    tasks, teams, teamById, allTaskItems, itemsByTask, billboardById, contractByNumber,
    existingTaskContractIds, existingTaskBillboardIds, stats, duplicateTasksCount,
    isLoading: tasksLoading || itemsLoading, refresh,
  };
}
