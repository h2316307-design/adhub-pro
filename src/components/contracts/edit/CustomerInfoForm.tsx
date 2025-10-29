import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { User } from 'lucide-react';

interface CustomerInfoFormProps {
  customerName: string;
  setCustomerName: (name: string) => void;
  adType: string;
  setAdType: (type: string) => void;
  pricingCategory: string;
  setPricingCategory: (category: string) => void;
  pricingCategories: string[];
  customers: Array<{ id: string; name: string }>;
  customerOpen: boolean;
  setCustomerOpen: (open: boolean) => void;
  customerQuery: string;
  setCustomerQuery: (query: string) => void;
  onAddCustomer: (name: string) => Promise<void>;
  onSelectCustomer: (customer: { id: string; name: string }) => void;
}

export function CustomerInfoForm({
  customerName,
  setCustomerName,
  adType,
  setAdType,
  pricingCategory,
  setPricingCategory,
  pricingCategories,
  customers,
  customerOpen,
  setCustomerOpen,
  customerQuery,
  setCustomerQuery,
  onAddCustomer,
  onSelectCustomer
}: CustomerInfoFormProps) {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <User className="h-5 w-5 text-primary" />
          بيانات الزبون
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-card-foreground mb-2 block">
            اسم الزبون
          </label>
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                role="combobox" 
                className="w-full justify-between bg-input border-border text-foreground"
              >
                {customerName ? customerName : 'اختر أو اكتب اسم الزبون'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 bg-popover border-border">
              <Command>
                <CommandInput 
                  placeholder="ابحث أو اكتب اسم جديد" 
                  value={customerQuery} 
                  onValueChange={setCustomerQuery} 
                />
                <CommandList>
                  <CommandEmpty>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => onAddCustomer(customerQuery.trim())}
                    >
                      إضافة "{customerQuery}" كعميل جديد
                    </Button>
                  </CommandEmpty>
                  <CommandGroup>
                    {customers.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => onSelectCustomer(c)}
                      >
                        {c.name}
                      </CommandItem>
                    ))}
                    {customerQuery && !customers.some((x) => x.name === customerQuery.trim()) && (
                      <CommandItem
                        value={`__add_${customerQuery}`}
                        onSelect={() => onAddCustomer(customerQuery.trim())}
                      >
                        إضافة "{customerQuery}" كعميل جديد
                      </CommandItem>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium text-card-foreground mb-2 block">
            نوع الإعلان
          </label>
          <Input 
            value={adType} 
            onChange={(e) => setAdType(e.target.value)}
            className="bg-input border-border text-foreground"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-card-foreground mb-2 block">
            فئة السعر
          </label>
          <Select value={pricingCategory} onValueChange={setPricingCategory}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="الفئة" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {pricingCategories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground mt-1">
            الفئة المحددة: <span className="font-medium text-primary">{pricingCategory}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}