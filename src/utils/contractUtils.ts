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

const getBillboardContractNumber = (billboard: any) => billboard.Contract_Number || billboard.contractNumber;
const getBillboardEndDate = (billboard: any) => billboard.Rent_End_Date || billboard.rent_end_date || billboard.contract?.end_date;
const getBillboardStatus = (billboard: any) => (billboard.Status || billboard.status || '').toString().trim().toLowerCase();

export const isBillboardBlockedFromAvailability = (billboard: any): boolean => {
  const status = getBillboardStatus(billboard);
  const maintenanceStatus = String(billboard.maintenance_status || '').trim().toLowerCase();
  const maintenanceType = String(billboard.maintenance_type || '').trim();
  
  return (
    status === 'إزالة' || status === 'ازالة' || status === 'removed' ||
    maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' ||
    maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
    maintenanceType === 'تمت الإزالة' || maintenanceType === 'تحتاج إزالة' || maintenanceType === 'لم يتم التركيب'
  );
};

export const isBillboardAvailable = (billboard: any, ignoreVisibility = false): boolean => {
  const contractNumber = getBillboardContractNumber(billboard);
  const endDate = getBillboardEndDate(billboard);
  const status = getBillboardStatus(billboard);

  if (isBillboardBlockedFromAvailability(billboard)) {
    return false;
  }

  if (!ignoreVisibility) {
    // مخفية يدوياً (مثل لوحات الشركات الصديقة)
    if (billboard.is_visible_in_available === false) return false;
    // ملاحظة: is_visible_in_available === true لم يعد يؤثر على التوفر العام
    // يؤثر فقط على التصدير/النسخ في useBillboardExport
  }

  // ✅ FIX: إذا كانت اللوحة مرتبطة بعقد نشط (غير منتهي) فهي ليست متاحة
  // حتى لو كان حقل Status يقول "متاح" (قد لا يتزامن مع العقود الجديدة).
  if (contractNumber && String(contractNumber).trim() && String(contractNumber).trim() !== '0') {
    if (!endDate) return false; // عقد بلا تاريخ انتهاء = نشط
    return isContractExpired(endDate);
  }

  if (status === 'available' || status === 'متاح') {
    return true;
  }

  if (status === 'rented' || status === 'مؤجر' || status === 'مؤجرة' || status === 'محجوز' || status === 'booked') {
    return !!endDate && isContractExpired(endDate);
  }

  // متاحة إذا لا يوجد عقد ولا حالة صريحة
  return true;
};

/**
 * Generates a clean 2-3 letter uppercase code from an Arabic or English municipality name
 */
export const generateMunicipalityCode = (name: string): string => {
  const cleanName = name.trim().toLowerCase();
  
  const charMap: { [key: string]: string } = {
    'أ': 'a', 'ا': 'a', 'إ': 'a', 'آ': 'a',
    'ب': 'b',
    'ت': 't',
    'ث': 'th',
    'ج': 'j',
    'ح': 'h',
    'خ': 'kh',
    'د': 'd',
    'ذ': 'dh',
    'ر': 'r',
    'ز': 'z',
    'س': 's',
    'ش': 'sh',
    'ص': 's',
    'ض': 'd',
    'ط': 't',
    'ظ': 'z',
    'ع': 'a',
    'غ': 'gh',
    'ف': 'f',
    'ق': 'q',
    'ك': 'k',
    'ل': 'l',
    'م': 'm',
    'ن': 'n',
    'ه': 'h',
    'و': 'w',
    'ي': 'y', 'ى': 'y', 'ئ': 'y', 'ء': 'a'
  };

  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    let code = '';
    for (let i = 0; i < Math.min(words.length, 3); i++) {
      const w = words[i];
      let cleanWord = w;
      if (cleanWord.startsWith('ال') && cleanWord.length > 2) {
        cleanWord = cleanWord.slice(2);
      }
      const firstChar = cleanWord[0];
      if (charMap[firstChar]) {
        code += charMap[firstChar];
      } else if (/[a-z]/i.test(firstChar)) {
        code += firstChar;
      }
    }
    if (code.length >= 2) {
      return code.slice(0, 3).toUpperCase();
    }
  }

  let cleanNameSingle = cleanName;
  if (cleanNameSingle.startsWith('ال') && cleanNameSingle.length > 2) {
    cleanNameSingle = cleanNameSingle.slice(2);
  }

  let code = '';
  for (let i = 0; i < cleanNameSingle.length; i++) {
    const char = cleanNameSingle[i];
    if (charMap[char]) {
      code += charMap[char];
    } else if (/[a-z]/i.test(char)) {
      code += char;
    }
    if (code.length >= 3) break;
  }

  if (code.length >= 2) {
    return code.slice(0, 3).toUpperCase();
  }

  return 'MU';
};
