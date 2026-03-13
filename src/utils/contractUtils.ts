/**
 * Contract utility functions for handling expired contracts and billboard status
 */

export const isContractExpired = (endDate: string | null): boolean => {
  if (!endDate) return false;
  
  try {
    const contractEndDate = new Date(endDate);
    const today = new Date();
    
    // Set time to start of day for accurate comparison
    contractEndDate.setHours(23, 59, 59, 999);
    today.setHours(0, 0, 0, 0);
    
    return contractEndDate < today;
  } catch (error) {
    console.error('Error parsing contract end date:', error);
    return false;
  }
};

export const isContractActive = (startDate: string | null, endDate: string | null): boolean => {
  if (!startDate || !endDate) return false;
  
  try {
    const contractStartDate = new Date(startDate);
    const contractEndDate = new Date(endDate);
    const today = new Date();
    
    // Set time boundaries for accurate comparison
    contractStartDate.setHours(0, 0, 0, 0);
    contractEndDate.setHours(23, 59, 59, 999);
    today.setHours(12, 0, 0, 0); // Use noon to avoid timezone issues
    
    return today >= contractStartDate && today <= contractEndDate;
  } catch (error) {
    console.error('Error checking contract active status:', error);
    return false;
  }
};

export const getDaysUntilExpiry = (endDate: string | null): number | null => {
  if (!endDate) return null;
  
  try {
    const contractEndDate = new Date(endDate);
    const today = new Date();
    
    contractEndDate.setHours(23, 59, 59, 999);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = contractEndDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.error('Error calculating days until expiry:', error);
    return null;
  }
};

export const shouldShowContractInfo = (billboard: any): boolean => {
  const contractNumber = billboard.Contract_Number || billboard.contractNumber;
  const endDate = billboard.Rent_End_Date || billboard.rent_end_date || billboard.contract?.end_date;
  
  // If no contract number, don't show contract info
  if (!contractNumber) return false;
  
  // If no end date, assume contract is active
  if (!endDate) return true;
  
  // Only show contract info if contract is not expired
  return !isContractExpired(endDate);
};

export const isBillboardAvailable = (billboard: any): boolean => {
  const contractNumber = billboard.Contract_Number || billboard.contractNumber;
  const endDate = billboard.Rent_End_Date || billboard.rent_end_date || billboard.contract?.end_date;
  const status = (billboard.Status || billboard.status || '').toString().trim().toLowerCase();
  const maintenanceStatus = String(billboard.maintenance_status || '').trim().toLowerCase();
  const maintenanceType = String(billboard.maintenance_type || '').trim();
  
  // غير متاحة: صيانة/إزالة/خارج الخدمة
  if (
    status === 'صيانة' || status === 'maintenance' ||
    status === 'إزالة' || status === 'ازالة' || status === 'removed' ||
    status === 'مؤجر' || status === 'rented' ||
    maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' ||
    maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
    maintenanceStatus === 'repair_needed' || maintenanceStatus === 'out_of_service' ||
    maintenanceStatus === 'متضررة اللوحة' ||
    maintenanceType === 'تمت الإزالة' || maintenanceType === 'تحتاج إزالة' || maintenanceType === 'لم يتم التركيب'
  ) {
    return false;
  }
  
  // متاحة إذا لا يوجد عقد
  if (!contractNumber) {
    return true;
  }
  
  // إذا كان هناك عقد بلا تاريخ انتهاء نعدّه نشطاً (غير متاح)
  if (!endDate) {
    return false;
  }
  
  // متاحة فقط إذا انتهى العقد
  return isContractExpired(endDate);
};