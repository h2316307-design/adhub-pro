// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

export interface ExpiredContract {
  id: string;
  client_name: string;
  end_date: string;
  billboard_ids: string;
  billboards_data: string;
  status: string;
}

export class ExpiredContractCleanupService {
  
  /**
   * البحث عن العقود المنتهية الصلاحية
   */
  async findExpiredContracts(): Promise<ExpiredContract[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('Contract')
        .select('*')
        .lt('end_date', today)
        .neq('status', 'منتهي'); // استبعاد العقود المحددة كمنتهية بالفعل

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('خطأ في البحث عن العقود المنتهية:', error);
      throw error;
    }
  }

  /**
   * تحرير اللوحات من العقد المنتهي
   */
  async releaseContractBillboards(contractId: string): Promise<boolean> {
    try {
      // الحصول على تفاصيل العقد
      const { data: contract, error: fetchError } = await supabase
        .from('Contract')
        .select('*')
        .eq('id', contractId)
        .single();

      if (fetchError) throw fetchError;
      if (!contract) return false;

      // استخراج أرقام اللوحات
      const billboardIds = this.extractBillboardIds(contract.billboard_ids || '');
      
      // تحرير اللوحات
      if (billboardIds.length > 0) {
        const { error: updateError } = await supabase
          .from('billboards')
          .update({ 
            status: 'متاح',
            current_contract_id: null,
            updated_at: new Date().toISOString()
          })
          .in('ID', billboardIds);

        if (updateError) throw updateError;
      }

      // تحديث حالة العقد إلى منتهي وإزالة مراجع اللوحات
      const { error: contractUpdateError } = await supabase
        .from('Contract')
        .update({
          status: 'منتهي',
          billboard_ids: null,
          billboards_data: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contractId);

      if (contractUpdateError) throw contractUpdateError;

      return true;
    } catch (error) {
      console.error('خطأ في تحرير اللوحات:', error);
      throw error;
    }
  }

  /**
   * تنظيف جميع العقود المنتهية تلقائياً
   */
  async cleanupAllExpiredContracts(): Promise<{ success: number; failed: number; details: string[] }> {
    try {
      const expiredContracts = await this.findExpiredContracts();
      let success = 0;
      let failed = 0;
      const details: string[] = [];

      for (const contract of expiredContracts) {
        try {
          await this.releaseContractBillboards(contract.id);
          success++;
          details.push(`✅ تم تنظيف العقد ${contract.id} - ${contract.client_name}`);
        } catch (error) {
          failed++;
          details.push(`❌ فشل تنظيف العقد ${contract.id} - ${contract.client_name}: ${error}`);
        }
      }

      return { success, failed, details };
    } catch (error) {
      console.error('خطأ في التنظيف الشامل:', error);
      throw error;
    }
  }

  /**
   * إخفاء العقود المنتهية من العرض (بدلاً من حذفها)
   */
  async hideExpiredContracts(): Promise<{ hidden: number; details: string[] }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // تحديث حالة جميع العقود المنتهية إلى "مخفي"
      const { data, error } = await supabase
        .from('Contract')
        .update({ 
          status: 'مخفي',
          billboard_ids: null,
          billboards_data: null,
          updated_at: new Date().toISOString()
        })
        .lt('end_date', today)
        .neq('status', 'مخفي')
        .select('id, client_name');

      if (error) throw error;

      const details = (data || []).map(contract => 
        `✅ تم إخفاء العقد ${contract.id} - ${contract.client_name}`
      );

      return { hidden: data?.length || 0, details };
    } catch (error) {
      console.error('خطأ في إخفاء العقود المنتهية:', error);
      throw error;
    }
  }

  /**
   * استخراج أرقام اللوحات من النص
   */
  private extractBillboardIds(billboardIdsText: string): number[] {
    if (!billboardIdsText) return [];
    
    return billboardIdsText
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id) && id > 0);
  }

  /**
   * تنظيف شامل - إخفاء العقود المنتهية وتحرير اللوحات
   */
  async performComprehensiveCleanup(): Promise<{
    contractsHidden: number;
    billboardsReleased: number;
    details: string[];
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // الحصول على العقود المنتهية
      const { data: expiredContracts, error: fetchError } = await supabase
        .from('Contract')
        .select('*')
        .lt('end_date', today)
        .neq('status', 'مخفي');

      if (fetchError) throw fetchError;

      let billboardsReleased = 0;
      const details: string[] = [];

      // تحرير اللوحات من كل عقد منتهي
      for (const contract of expiredContracts || []) {
        const billboardIds = this.extractBillboardIds(contract.billboard_ids || '');
        
        if (billboardIds.length > 0) {
          // تحرير اللوحات
          const { error: releaseError } = await supabase
            .from('billboards')
            .update({ 
              status: 'متاح',
              current_contract_id: null,
              updated_at: new Date().toISOString()
            })
            .in('ID', billboardIds);

          if (!releaseError) {
            billboardsReleased += billboardIds.length;
            details.push(`🔓 تم تحرير ${billboardIds.length} لوحة من العقد ${contract.id}`);
          }
        }
      }

      // إخفاء جميع العقود المنتهية
      const { data: hiddenContracts, error: hideError } = await supabase
        .from('Contract')
        .update({ 
          status: 'مخفي',
          billboard_ids: null,
          billboards_data: null,
          updated_at: new Date().toISOString()
        })
        .lt('end_date', today)
        .neq('status', 'مخفي')
        .select('id, client_name');

      if (hideError) throw hideError;

      const contractsHidden = hiddenContracts?.length || 0;
      
      details.push(`👻 تم إخفاء ${contractsHidden} عقد منتهي الصلاحية`);
      details.push(`🔓 تم تحرير ${billboardsReleased} لوحة إجمالي`);

      return {
        contractsHidden,
        billboardsReleased,
        details
      };
    } catch (error) {
      console.error('خطأ في التنظيف الشامل:', error);
      throw error;
    }
  }
}

export const expiredContractCleanup = new ExpiredContractCleanupService();