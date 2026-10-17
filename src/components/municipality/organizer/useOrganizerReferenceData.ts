import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeMuniName } from '@/components/municipality/organizer/organizerHelpers';

/** بيانات مرجعية لصفحة تنظيم اللوحات: البلديات والمدن والمقاسات وصور المقاسات والمجموعات المحفوظة */
export function useOrganizerReferenceData(allBillboards: any[]) {
  const [collections, setCollections] = useState<{ id: string; name: string; created_at: string; municipality_name?: string; city?: string }[]>([]);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [dbSizes, setDbSizes] = useState<string[]>([]);
  const [sizesList, setSizesList] = useState<{ name: string; sort_order: number }[]>([]);
  const [sizeCutoutMap, setSizeCutoutMap] = useState<Record<string, string>>({});

  const loadSizeCutoutImages = async () => {
    try {
      const { data } = await supabase.from('sizes').select('name, width, height, image_url');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(s => {
          if (s.image_url) {
            if (s.name) map[s.name.trim()] = s.image_url;
            if (s.width && s.height) {
              map[`${s.width}x${s.height}`] = s.image_url;
              map[`${s.height}x${s.width}`] = s.image_url;
            }
          }
        });
        setSizeCutoutMap(map);
      }
    } catch {}
  };
  const loadMunicipalities = async () => {
    const { data: dbMunis } = await supabase.from('municipalities').select('name').order('name');
    const dbMuniNames = (dbMunis || []).map(m => normalizeMuniName(m.name)).filter(Boolean) as string[];
    const billboardMunis = (allBillboards || []).map(b => normalizeMuniName(b.Municipality)).filter(Boolean) as string[];
    const combined = [...new Set([...dbMuniNames, ...billboardMunis])];
    setMunicipalities(combined.sort((a, b) => a.localeCompare(b, 'ar')));
  };
  const loadCities = async () => {
    if (allBillboards.length > 0) {
      const unique = [...new Set(allBillboards.map(b => b.City).filter(Boolean))] as string[];
      setCities(unique.sort());
    } else {
      const { data } = await supabase
        .from('billboards')
        .select('City')
        .not('City', 'is', null);
      if (data) {
        const unique = [...new Set(data.map(d => d.City).filter(Boolean))] as string[];
        setCities(unique.sort());
      }
    }
  };
  const loadSizes = async () => {
    const { data } = await supabase
      .from('sizes')
      .select('name, sort_order')
      .order('sort_order', { ascending: true });
    if (data) {
      setSizesList(data as { name: string; sort_order: number }[]);
      setDbSizes((data as any[]).map((d: any) => d.name).filter(Boolean));
    }
  };
  const loadCollections = async () => {
    const { data } = await supabase
      .from('municipality_collections')
      .select('id, name, created_at, municipality_name, city')
      .order('created_at', { ascending: false });
    if (data) setCollections(data);
  };

  return { collections, setCollections, municipalities, setMunicipalities, cities, setCities, dbSizes, setDbSizes, sizesList, setSizesList, sizeCutoutMap, setSizeCutoutMap, loadSizeCutoutImages, loadMunicipalities, loadCities, loadSizes, loadCollections };
}
