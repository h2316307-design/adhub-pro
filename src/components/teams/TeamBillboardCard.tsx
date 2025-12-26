import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, Calendar, Ruler, ImageIcon } from 'lucide-react';

interface TeamBillboardCardProps {
  account: {
    id: string;
    billboard_id: number;
    contract_id: number;
    installation_date: string;
    amount: number;
    status: string;
    notes?: string;
  };
  billboardDetails: {
    billboard_name: string;
    customer_name: string;
    size: string;
    image_url?: string;
  } | undefined;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function TeamBillboardCard({
  account,
  billboardDetails,
  isSelected,
  onSelectChange,
  disabled = false
}: TeamBillboardCardProps) {
  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      pending: { label: 'معلق', className: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400' },
      paid: { label: 'مدفوع', className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400' },
      cancelled: { label: 'ملغي', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400' }
    };
    const config = configs[status] || configs.pending;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card 
      className={`transition-all duration-200 overflow-hidden ${
        isSelected 
          ? 'ring-2 ring-primary bg-primary/5' 
          : 'hover:shadow-lg hover:scale-[1.02]'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {/* Billboard Image */}
      <div className="relative h-32 bg-muted overflow-hidden">
        {billboardDetails?.image_url ? (
          <img 
            src={billboardDetails.image_url} 
            alt={billboardDetails.billboard_name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        
        {/* Status Badge Overlay */}
        <div className="absolute top-2 left-2">
          {getStatusBadge(account.status)}
        </div>
        
        {/* Checkbox Overlay */}
        {!disabled && account.status === 'pending' && (
          <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded-md p-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectChange}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      <CardContent className="p-3">
        {/* Billboard Name */}
        <h4 className="font-semibold text-sm truncate mb-2">
          {billboardDetails?.billboard_name || `لوحة ${account.billboard_id}`}
        </h4>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
          <div className="flex items-center gap-1">
            <Ruler className="h-3 w-3 text-primary" />
            <span>{billboardDetails?.size || '-'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-primary" />
            <span>{new Date(account.installation_date).toLocaleDateString('ar-LY')}</span>
          </div>
        </div>

        {billboardDetails?.customer_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="truncate">{billboardDetails.customer_name}</span>
          </div>
        )}

        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">التركيب</span>
          <span className="font-bold text-primary text-sm">
            {account.amount.toLocaleString('ar-LY')} د.ل
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
