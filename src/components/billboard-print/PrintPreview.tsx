import { useState, useEffect, useRef } from 'react';
import { PrintSettings, ElementSettings, ELEMENT_LABELS } from '@/hooks/useBillboardPrintSettings';
import QRCode from 'qrcode';

interface BillboardData {
  ID: number;
  Billboard_Name?: string;
  Size?: string;
  Faces_Count?: number;
  Municipality?: string;
  District?: string;
  Nearest_Landmark?: string;
  Image_URL?: string;
  GPS_Coordinates?: string;
  GPS_Link?: string;
  has_cutout?: boolean;
  design_face_a?: string;
  design_face_b?: string;
  cutout_image_url?: string;
  installed_image_url?: string;
  installed_image_face_a_url?: string;
  installed_image_face_b_url?: string;
  installation_date?: string;
}

interface PrintPreviewProps {
  settings: PrintSettings;
  billboard?: BillboardData | null;
  contractNumber?: number;
  customerName?: string;
  adType?: string;
  previewTarget?: 'customer' | 'team';
  scale?: number;
  selectedElement?: string | null;
  onElementClick?: (elementKey: string) => void;
  hideBackground?: boolean;
}

export function PrintPreview({
  settings,
  billboard,
  contractNumber,
  customerName,
  adType,
  previewTarget = 'team',
  scale = 0.4,
  selectedElement,
  onElementClick,
  hideBackground = false,
}: PrintPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // توليد QR Code
  useEffect(() => {
    const generateQR = async () => {
      if (!billboard?.GPS_Link && !billboard?.GPS_Coordinates) {
        setQrCodeUrl('');
        return;
      }
      
      try {
        const qrContent = billboard.GPS_Link || 
          `https://www.google.com/maps?q=${billboard.GPS_Coordinates}`;
        const url = await QRCode.toDataURL(qrContent, {
          width: 200,
          margin: 1,
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error('QR generation failed:', err);
      }
    };
    generateQR();
  }, [billboard]);

  // تحديد الوضع الذكي بناءً على بيانات اللوحة
  const getSmartMode = (): string => {
    if (!billboard) return 'default';
    
    const hasTwoFaceInstallation = billboard.installed_image_face_a_url && billboard.installed_image_face_b_url;
    const hasSingleInstallation = billboard.installed_image_face_a_url || billboard.installed_image_url;
    const hasTwoDesigns = billboard.design_face_a && billboard.design_face_b;
    
    if (hasTwoFaceInstallation && hasTwoDesigns) return 'two_faces_with_designs';
    if (hasTwoFaceInstallation) return 'two_faces';
    if (hasSingleInstallation && hasTwoDesigns) return 'single_installation_with_designs';
    if (hasSingleInstallation) return 'single_face';
    if (hasTwoDesigns || billboard.design_face_a) return 'with_design';
    
    return 'default';
  };

  const effectiveMode = getSmartMode();

  // بناء تنسيق CSS لعنصر
  const buildElementStyle = (element: ElementSettings, key: string): string => {
    const isSelected = selectedElement === key;
    
    let style = `position: absolute;`;
    if (element.top) style += `top: ${element.top};`;
    if (element.left) style += `left: ${element.left};`;
    if (element.right) style += `right: ${element.right};`;
    if (element.bottom) style += `bottom: ${element.bottom};`;
    if (element.width) style += `width: ${element.width};`;
    if (element.height) style += `height: ${element.height};`;
    if (element.fontSize) style += `font-size: ${element.fontSize};`;
    if (element.fontWeight) style += `font-weight: ${element.fontWeight};`;
    if (element.fontFamily) style += `font-family: ${element.fontFamily};`;
    if (element.color) style += `color: ${element.color};`;
    if (element.textAlign) style += `text-align: ${element.textAlign};`;
    if (element.rotation && element.rotation !== '0') {
      style += `transform: rotate(${element.rotation}deg);`;
    }
    
    if (isSelected) {
      style += `outline: 2px dashed #3b82f6; outline-offset: 2px;`;
    }
    
    return style;
  };

  // تجهيز محتوى العنصر
  const renderElementContent = (key: string, element: ElementSettings): string => {
    switch (key) {
      case 'contractNumber':
        return String(contractNumber || '---');
      
      case 'adType':
        return `${element.label || 'نوع الإعلان:'} ${adType || 'عقد'}`;
      
      case 'billboardName':
        return billboard?.Billboard_Name || 'اسم اللوحة';
      
      case 'size':
        return billboard?.Size || '3x4';
      
      case 'facesCount':
        return `${billboard?.Faces_Count || 1} وجه`;
      
      case 'locationInfo':
        return `${billboard?.Municipality || ''} - ${billboard?.District || ''}`;
      
      case 'landmarkInfo':
        return billboard?.Nearest_Landmark || '';
      
      case 'installationDate':
        return billboard?.installation_date 
          ? new Date(billboard.installation_date).toLocaleDateString('ar-SA')
          : '';
      
      case 'printType':
        return previewTarget === 'team' ? 'نسخة التركيب' : '';
      
      case 'qrCode':
        if (!qrCodeUrl) return '';
        return `<img src="${qrCodeUrl}" style="width: 100%; height: 100%; object-fit: contain;" />`;
      
      case 'image': {
        const imageUrl = billboard?.Image_URL || '/placeholder.svg';
        const borderRadius = element.borderRadius || '0';
        const borderStyle = `border: ${element.borderWidth || '4px'} solid ${element.borderColor || '#000'}; border-radius: ${borderRadius};`;
        return `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: ${element.objectFit || 'contain'}; ${borderStyle}" />`;
      }
      
      case 'designs': {
        const designA = billboard?.design_face_a;
        const designB = billboard?.design_face_b;
        if (!designA && !designB) return '';
        
        const gap = element.gap || '38px';
        let html = `<div style="display: flex; gap: ${gap}; height: 100%; align-items: center; justify-content: center;">`;
        
        if (designA) {
          html += `<div style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: center;">
            <img src="${designA}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>`;
        }
        if (designB) {
          html += `<div style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: center;">
            <img src="${designB}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>`;
        }
        
        html += '</div>';
        return html;
      }
      
      case 'cutoutImage': {
        if (!billboard?.cutout_image_url && !billboard?.has_cutout) return '';
        const cutoutUrl = billboard?.cutout_image_url || '';
        if (!cutoutUrl) return '';
        
        const borderStyle = `border: ${element.borderWidth || '2px'} solid ${element.borderColor || '#000'};`;
        return `<img src="${cutoutUrl}" style="width: 100%; height: 100%; object-fit: contain; ${borderStyle}" />`;
      }
      
      case 'singleInstallationImage': {
        if (effectiveMode !== 'single_face' && effectiveMode !== 'single_installation_with_designs') return '';
        const imgUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url || billboard?.Image_URL;
        if (!imgUrl) return '';
        
        const borderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#000'}; border-radius: ${element.borderRadius || '8px'};`;
        return `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: ${element.objectFit || 'contain'}; ${borderStyle}" />`;
      }
      
      case 'faceAImage': {
        if (effectiveMode === 'two_faces_with_designs') return '';
        const faceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
        if (!faceAUrl) return '';
        
        const borderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${element.borderRadius || '0'};`;
        return `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${borderStyle}" />`;
      }
      
      case 'faceBImage': {
        if (effectiveMode === 'two_faces_with_designs') return '';
        const faceBUrl = billboard?.installed_image_face_b_url;
        if (!faceBUrl || (billboard?.Faces_Count || 1) <= 1) return '';
        
        const borderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${element.borderRadius || '0'};`;
        return `<img src="${faceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${borderStyle}" />`;
      }
      
      case 'twoFacesContainer': {
        if (effectiveMode !== 'two_faces_with_designs') return '';
        const faceAUrl = billboard?.installed_image_face_a_url || billboard?.installed_image_url;
        const faceBUrl = billboard?.installed_image_face_b_url;
        const gap = element.gap || '20px';
        const borderStyle = `border: ${element.borderWidth || '3px'} solid ${element.borderColor || '#ccc'}; border-radius: ${element.borderRadius || '0'};`;
        
        return `
          <div style="display: flex; gap: ${gap}; height: 100%; align-items: center; justify-content: center;">
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
              ${faceAUrl ? `<img src="${faceAUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${borderStyle}" />` : '<span style="color: #999;">الوجه الأمامي</span>'}
            </div>
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; max-width: 48%;">
              ${faceBUrl ? `<img src="${faceBUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; ${borderStyle}" />` : '<span style="color: #999;">الوجه الخلفي</span>'}
            </div>
          </div>
        `;
      }
      
      default:
        return ELEMENT_LABELS[key] || key;
    }
  };

  // بناء HTML للمعاينة
  const buildPreviewHTML = (): string => {
    const elements = settings.elements;
    let html = '';
    
    Object.entries(elements).forEach(([key, element]) => {
      if (!element.visible) return;
      
      const style = buildElementStyle(element, key);
      const content = renderElementContent(key, element);
      
      if (!content) return;
      
      html += `<div 
        style="${style}" 
        class="preview-element ${selectedElement === key ? 'selected' : ''}"
        data-element-key="${key}"
      >${content}</div>`;
    });
    
    return html;
  };

  return (
    <div 
      className="relative overflow-hidden bg-muted/30 rounded-lg border"
      style={{ 
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        ref={previewRef}
        className="relative"
        style={{
          width: settings.background_width,
          height: settings.background_height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          backgroundImage: hideBackground ? 'none' : `url(${settings.background_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: hideBackground ? '#f5f5f5' : 'white',
          fontFamily: settings.primary_font,
          direction: 'rtl',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const elementKey = target.closest('[data-element-key]')?.getAttribute('data-element-key');
          if (elementKey && onElementClick) {
            onElementClick(elementKey);
          }
        }}
        dangerouslySetInnerHTML={{ __html: buildPreviewHTML() }}
      />
    </div>
  );
}
