import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  MapPin, 
  Ruler, 
  CheckCircle2,
  Building2,
  Users,
  Filter,
  Calendar,
  Hash,
  Layers,
  Star,
  Check,
  X,
  FileText,
  AlertTriangle,
  Plus,
  Minus,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BillboardImage } from '@/components/BillboardImage';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  cities: string[];
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  City: string;
  Municipality: string;
  District: string;
  Nearest_Landmark: string;
  Image_URL: string;
  Faces_Count: number;
  Level: string;
  contractId?: number;
}

interface Contract {
  Contract_Number: number;
  'Customer Name': string;
  customer_id: string | null;
  'Ad Type': string;
  'Contract Date': string;
  'End Date': string;
  billboard_ids: string;
}

interface Customer {
  id: string;
  name: string;
  company: string | null;
}

interface TeamAssignment {
  teamId: string;
  teamName: string;
  billboardIds: number[];
}

interface ValidationError {
  billboardId: number;
  billboardName: string;
  size: string;
  city: string;
  reason: string;
}

interface EnhancedAddInstallationTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType: 'installation' | 'reinstallation';
  onTaskTypeChange: (type: 'installation' | 'reinstallation') => void;
  onSubmit: (data: {
    contractIds: number[];
    customerId: string | null;
    billboardIds: number[];
    teamAssignments: TeamAssignment[];
  }) => void;
  isSubmitting: boolean;
  teams: InstallationTeam[];
}

export function EnhancedAddInstallationTaskDialog({
  open,
  onOpenChange,
  taskType,
  onTaskTypeChange,
  onSubmit,
  isSubmitting,
  teams
}: EnhancedAddInstallationTaskDialogProps) {
  // Customer selection
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerAdTypeSearch, setCustomerAdTypeSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Contract selection (multiple)
  const [selectedContractIds, setSelectedContractIds] = useState<number[]>([]);
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [showAllContracts, setShowAllContracts] = useState(false); // بحث شامل عبر كل العقود
  
  // Billboard selection
  const [billboardSearchTerm, setBillboardSearchTerm] = useState('');
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  
  // Team assignments (multiple teams)
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  
  // Validation
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCustomerSearchTerm('');
      setCustomerAdTypeSearch('');
      setSelectedCustomerId(null);
      setShowCustomerDropdown(false);
      setSelectedContractIds([]);
      setContractSearchTerm('');
      setShowAllContracts(false);
      setBillboardSearchTerm('');
      setSelectedBillboardIds([]);
      setCityFilter('all');
      setSizeFilter('all');
      setTeamAssignments([]);
      setValidationErrors([]);
    }
  }, [open]);

  // Fetch customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers-for-task'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company')
        .eq('is_customer', true)
        .order('name')
        .limit(500);
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Fetch all contracts for ad type search
  const { data: allContracts = [] } = useQuery({
    queryKey: ['all-contracts-for-search'],
    enabled: open && customerAdTypeSearch.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, "Ad Type"')
        .not('customer_id', 'is', null)
        .order('Contract_Number', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Filter customers by name or ad type
  const filteredCustomers = useMemo(() => {
    const searchTerm = customerSearchTerm.trim().toLowerCase();
    const adTypeSearchTerm = customerAdTypeSearch.trim().toLowerCase();
    
    // If searching by ad type
    if (adTypeSearchTerm) {
      const matchingContracts = allContracts.filter(c => 
        c['Ad Type']?.toLowerCase().includes(adTypeSearchTerm)
      );
      const customerIdsWithAdType = new Set(matchingContracts.map(c => c.customer_id).filter(Boolean));
      return customers.filter(c => customerIdsWithAdType.has(c.id)).slice(0, 20);
    }
    
    // Normal name/company search
    if (!searchTerm) return customers.slice(0, 20);
    return customers.filter(c => 
      c.name?.toLowerCase().includes(searchTerm) ||
      c.company?.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
  }, [customers, customerSearchTerm, customerAdTypeSearch, allContracts]);

  // Fetch installation tasks count for contracts
  const { data: contractTasksInfo = {} } = useQuery({
    queryKey: ['contract-installation-tasks-info', selectedCustomerId],
    enabled: !!selectedCustomerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_tasks')
        .select('contract_id, created_at')
        .not('contract_id', 'is', null);
      
      if (error) throw error;
      
      // Group by contract_id
      const tasksByContract: Record<number, { count: number; lastDate: string | null }> = {};
      (data || []).forEach(task => {
        if (task.contract_id) {
          if (!tasksByContract[task.contract_id]) {
            tasksByContract[task.contract_id] = { count: 0, lastDate: null };
          }
          tasksByContract[task.contract_id].count++;
          if (!tasksByContract[task.contract_id].lastDate || task.created_at > tasksByContract[task.contract_id].lastDate!) {
            tasksByContract[task.contract_id].lastDate = task.created_at;
          }
        }
      });
      
      return tasksByContract;
    },
  });

  // Fetch contracts for selected customer (active OR all based on toggle)
  const { data: customerContracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['customer-contracts-dialog', selectedCustomerId, showAllContracts],
    enabled: !!selectedCustomerId && open,
    staleTime: 0,
    queryFn: async () => {
      // Fetch ALL contracts for this customer first, then filter client-side
      // to avoid Supabase column-name issues with "End Date" (contains space)
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, "Ad Type", "End Date", "Contract Date", billboard_ids')
        .eq('customer_id', selectedCustomerId!)
        .order('Contract_Number', { ascending: false })
        .limit(500);
      
      if (error) {
        console.error('Error fetching contracts:', error);
        // Return empty array instead of throwing to avoid error state
        return [];
      }
      
      const contracts = (data || []) as Contract[];
      
      // Filter expired contracts client-side if not showing all
      if (!showAllContracts) {
        const today = new Date().toISOString().split('T')[0];
        return contracts.filter(c => !c['End Date'] || c['End Date'] >= today);
      }
      
      return contracts;
    },
  });

  // Fetch billboards for selected contracts - fetch billboard_ids from DB directly
  const { data: contractBillboards = [], isLoading: loadingBillboards } = useQuery({
    queryKey: ['contracts-billboards-dialog', selectedContractIds],
    enabled: selectedContractIds.length > 0,
    queryFn: async () => {
      // Re-fetch the selected contracts to get their billboard_ids fresh
      const { data: contractsData, error: contractsError } = await supabase
        .from('Contract')
        .select('Contract_Number, billboard_ids')
        .in('Contract_Number', selectedContractIds);
      
      if (contractsError) throw contractsError;
      
      const allBillboardIds: { id: number; contractId: number }[] = [];
      
      for (const contract of (contractsData || [])) {
        if (contract?.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => allBillboardIds.push({ id, contractId: contract.Contract_Number }));
        }
      }
      
      if (allBillboardIds.length === 0) return [];
      
      const uniqueIds = [...new Set(allBillboardIds.map(b => b.id))];
      
      const { data, error } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, City, Municipality, District, Nearest_Landmark, Image_URL, Faces_Count, Level')
        .in('ID', uniqueIds);
      
      if (error) throw error;
      
      // Add contract info to each billboard
      return (data || []).map(billboard => {
        const contractInfo = allBillboardIds.find(b => b.id === billboard.ID);
        return {
          ...billboard,
          contractId: contractInfo?.contractId
        };
      }) as Billboard[];
    },
  });

  // Get unique cities and sizes from billboards
  const { cities, sizes } = useMemo(() => {
    const citiesSet = new Set<string>();
    const sizesSet = new Set<string>();
    contractBillboards.forEach(b => {
      if (b.City) citiesSet.add(b.City);
      if (b.Size) sizesSet.add(b.Size);
    });
    return {
      cities: Array.from(citiesSet).sort(),
      sizes: Array.from(sizesSet).sort()
    };
  }, [contractBillboards]);

  // Filter contracts by search term
  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm.trim()) return customerContracts;
    const term = contractSearchTerm.toLowerCase();
    return customerContracts.filter(c =>
      String(c.Contract_Number).includes(term) ||
      c['Ad Type']?.toLowerCase().includes(term)
    );
  }, [customerContracts, contractSearchTerm]);

  // Filter billboards
  const filteredBillboards = useMemo(() => {
    let result = contractBillboards;
    
    if (billboardSearchTerm.trim()) {
      const term = billboardSearchTerm.toLowerCase();
      result = result.filter(b =>
        b.Billboard_Name?.toLowerCase().includes(term) ||
        b.Nearest_Landmark?.toLowerCase().includes(term) ||
        b.Municipality?.toLowerCase().includes(term) ||
        b.District?.toLowerCase().includes(term) ||
        String(b.ID).includes(term)
      );
    }
    
    if (cityFilter !== 'all') {
      result = result.filter(b => b.City === cityFilter);
    }
    
    if (sizeFilter !== 'all') {
      result = result.filter(b => b.Size === sizeFilter);
    }
    
    return result;
  }, [contractBillboards, billboardSearchTerm, cityFilter, sizeFilter]);

  // Auto-select all billboards when contracts change
  useEffect(() => {
    if (contractBillboards.length > 0 && selectedContractIds.length > 0) {
      setSelectedBillboardIds(contractBillboards.map(b => b.ID));
    }
  }, [contractBillboards, selectedContractIds]);

  // Get sizes not covered by current team assignments
  const uncoveredSizes = useMemo(() => {
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    const allSizes = new Set(selectedBillboards.map(b => b.Size).filter(Boolean));
    const coveredSizes = new Set<string>();
    
    teamAssignments.forEach(assignment => {
      const team = teams.find(t => t.id === assignment.teamId);
      if (team?.sizes) {
        team.sizes.forEach(size => coveredSizes.add(size));
      }
    });
    
    return Array.from(allSizes).filter(size => !coveredSizes.has(size));
  }, [selectedBillboardIds, contractBillboards, teamAssignments, teams]);

  // Get cities not covered by current team assignments
  const uncoveredCities = useMemo(() => {
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    const allCities = new Set(selectedBillboards.map(b => b.City).filter(Boolean));
    const coveredCities = new Set<string>();
    
    teamAssignments.forEach(assignment => {
      const team = teams.find(t => t.id === assignment.teamId);
      if (team?.cities) {
        team.cities.forEach(city => coveredCities.add(city));
      }
    });
    
    return Array.from(allCities).filter(city => !coveredCities.has(city));
  }, [selectedBillboardIds, contractBillboards, teamAssignments, teams]);

  // Recommend teams based on selected billboards
  const getRecommendedTeams = useCallback((excludeTeamIds: string[] = []) => {
    if (selectedBillboardIds.length === 0) return [];
    
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    const billboardCities = new Set(selectedBillboards.map(b => b.City).filter(Boolean));
    const billboardSizes = new Set(selectedBillboards.map(b => b.Size).filter(Boolean));
    
    return teams
      .filter(team => !excludeTeamIds.includes(team.id))
      .map(team => {
        const teamCities = team.cities || [];
        const teamSizes = team.sizes || [];
        
        let cityMatch = teamCities.length === 0 || Array.from(billboardCities).some(city => teamCities.includes(city));
        let sizeMatch = teamSizes.length === 0 || Array.from(billboardSizes).some(size => teamSizes.includes(size));
        
        // Calculate coverage score
        const matchingCities = Array.from(billboardCities).filter(city => teamCities.includes(city));
        const matchingSizes = Array.from(billboardSizes).filter(size => teamSizes.includes(size));
        const score = matchingCities.length + matchingSizes.length;
        
        return {
          ...team,
          cityMatch,
          sizeMatch,
          isRecommended: cityMatch && sizeMatch,
          score,
          matchingCities,
          matchingSizes
        };
      })
      .sort((a, b) => {
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        return b.score - a.score;
      });
  }, [teams, selectedBillboardIds, contractBillboards]);

  // Add team assignment
  const addTeamAssignment = (teamId: string, teamName: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    // Get billboards that match this team's specialization
    const matchingBillboards = contractBillboards
      .filter(b => selectedBillboardIds.includes(b.ID))
      .filter(b => {
        const sizeMatch = team.sizes.length === 0 || team.sizes.includes(b.Size);
        const cityMatch = team.cities.length === 0 || team.cities.includes(b.City);
        return sizeMatch && cityMatch;
      })
      .map(b => b.ID);
    
    // Remove billboards already assigned to other teams
    const assignedBillboards = teamAssignments.flatMap(a => a.billboardIds);
    const availableBillboards = matchingBillboards.filter(id => !assignedBillboards.includes(id));
    
    setTeamAssignments(prev => [...prev, {
      teamId,
      teamName,
      billboardIds: availableBillboards
    }]);
  };

  // Remove team assignment
  const removeTeamAssignment = (teamId: string) => {
    setTeamAssignments(prev => prev.filter(a => a.teamId !== teamId));
  };

  // Validate before submit
  const validateAssignments = (): boolean => {
    const errors: ValidationError[] = [];
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    
    if (teamAssignments.length === 0) {
      // No teams assigned - that's ok, proceed without validation
      setValidationErrors([]);
      return true;
    }
    
    selectedBillboards.forEach(billboard => {
      // Check if billboard is assigned to any team
      const assignment = teamAssignments.find(a => a.billboardIds.includes(billboard.ID));
      
      if (assignment) {
        const team = teams.find(t => t.id === assignment.teamId);
        if (team) {
          // Check size compatibility
          if (team.sizes.length > 0 && !team.sizes.includes(billboard.Size)) {
            errors.push({
              billboardId: billboard.ID,
              billboardName: billboard.Billboard_Name,
              size: billboard.Size,
              city: billboard.City,
              reason: `المقاس "${billboard.Size}" خارج تخصص الفرقة "${team.team_name}"`
            });
          }
          
          // Check city compatibility
          if (team.cities.length > 0 && !team.cities.includes(billboard.City)) {
            errors.push({
              billboardId: billboard.ID,
              billboardName: billboard.Billboard_Name,
              size: billboard.Size,
              city: billboard.City,
              reason: `المدينة "${billboard.City}" خارج نطاق الفرقة "${team.team_name}"`
            });
          }
        }
      }
    });
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearchTerm(customer.name);
    setShowCustomerDropdown(false);
    setSelectedContractIds([]);
    setSelectedBillboardIds([]);
    setTeamAssignments([]);
  };

  // Toggle contract selection
  const toggleContract = (contractId: number) => {
    setSelectedContractIds(prev => 
      prev.includes(contractId) 
        ? prev.filter(id => id !== contractId)
        : [...prev, contractId]
    );
    setTeamAssignments([]);
  };

  const handleSelectAll = () => {
    setSelectedBillboardIds(filteredBillboards.map(b => b.ID));
  };

  const handleDeselectAll = () => {
    setSelectedBillboardIds([]);
  };

  const toggleBillboard = (id: number) => {
    setSelectedBillboardIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!validateAssignments()) {
      return;
    }
    
    onSubmit({
      contractIds: selectedContractIds,
      customerId: selectedCustomerId,
      billboardIds: selectedBillboardIds,
      teamAssignments
    });
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <DialogTitle className="text-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>إضافة مهمة تركيب جديدة</span>
              {selectedCustomer && (
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  الزبون: {selectedCustomer.name} • {selectedContractIds.length} عقود محددة
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Task Type Selection */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant={taskType === 'installation' ? 'default' : 'outline'}
                onClick={() => onTaskTypeChange('installation')}
                className="flex-1 h-12 gap-2"
              >
                <Layers className="h-4 w-4" />
                تركيب جديد
              </Button>
              <Button
                type="button"
                variant={taskType === 'reinstallation' ? 'default' : 'outline'}
                onClick={() => onTaskTypeChange('reinstallation')}
                className="flex-1 h-12 gap-2"
              >
                <FileText className="h-4 w-4" />
                إعادة تركيب
              </Button>
            </div>

            {/* Customer Search */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                اختيار الزبون
              </Label>
              
              {/* Dual search inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="ابحث باسم الزبون..."
                    value={customerSearchTerm}
                    onChange={(e) => {
                      setCustomerSearchTerm(e.target.value);
                      setCustomerAdTypeSearch('');
                      setShowCustomerDropdown(true);
                      if (selectedCustomerId && !e.target.value.includes(selectedCustomer?.name || '')) {
                        setSelectedCustomerId(null);
                        setSelectedContractIds([]);
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="pr-10 h-12 text-base"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="أو ابحث بنوع الإعلان..."
                    value={customerAdTypeSearch}
                    onChange={(e) => {
                      setCustomerAdTypeSearch(e.target.value);
                      setCustomerSearchTerm('');
                      setShowCustomerDropdown(true);
                      if (selectedCustomerId) {
                        setSelectedCustomerId(null);
                        setSelectedContractIds([]);
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="pr-10 h-12 text-base"
                  />
                </div>
              </div>
              
              {/* Customer Dropdown */}
              {showCustomerDropdown && (
                <div className="absolute left-6 right-6 z-[100] mt-1 bg-popover border rounded-xl shadow-xl max-h-[280px] overflow-hidden">
                  <ScrollArea className="h-[280px]">
                    <div className="p-2">
                      {loadingCustomers ? (
                        <div className="text-center text-sm text-muted-foreground py-6">
                          جاري التحميل...
                        </div>
                      ) : filteredCustomers.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-6">
                          {customerSearchTerm || customerAdTypeSearch ? 'لا توجد نتائج' : 'لا يوجد زبائن'}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredCustomers.map(customer => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => handleCustomerSelect(customer)}
                              className={cn(
                                "w-full p-3 rounded-lg text-right transition-all flex items-center gap-3",
                                selectedCustomerId === customer.id
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted"
                              )}
                            >
                              <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{customer.name}</div>
                                {customer.company && (
                                  <div className="text-xs opacity-75">{customer.company}</div>
                                )}
                              </div>
                              {selectedCustomerId === customer.id && (
                                <CheckCircle2 className="h-5 w-5 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {showCustomerDropdown && (
                <div 
                  className="fixed inset-0 z-[99]" 
                  onClick={() => setShowCustomerDropdown(false)}
                />
              )}
            </div>

            {/* Contract Selection (Multiple) with Search */}
            {selectedCustomerId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    اختيار العقود ({selectedContractIds.length} محدد)
                  </Label>
                  <button
                    type="button"
                    onClick={() => { setShowAllContracts(v => !v); setSelectedContractIds([]); setSelectedBillboardIds([]); }}
                    className={cn(
                      "text-xs px-3 py-1 rounded-full border transition-colors",
                      showAllContracts
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                    )}
                  >
                    {showAllContracts ? '✓ جميع العقود (بما فيها المنتهية)' : 'العقود النشطة فقط'}
                  </button>
                </div>
                
                {/* Contract Search */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="ابحث برقم العقد أو نوع الإعلان..."
                    value={contractSearchTerm}
                    onChange={(e) => setContractSearchTerm(e.target.value)}
                    className="pr-10 h-10"
                  />
                </div>
                
                {loadingContracts ? (
                  <div className="text-center py-4 text-muted-foreground">جاري التحميل...</div>
                ) : filteredContracts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground space-y-2">
                    <p>{contractSearchTerm ? 'لا توجد نتائج للبحث' : showAllContracts ? 'لا توجد عقود لهذا الزبون' : 'لا توجد عقود نشطة - جرّب "جميع العقود"'}</p>
                    {!showAllContracts && !contractSearchTerm && (
                      <button
                        type="button"
                        onClick={() => { setShowAllContracts(true); setSelectedContractIds([]); }}
                        className="text-xs text-primary underline"
                      >
                        عرض جميع العقود بما فيها المنتهية
                      </button>
                    )}
                  </div>
                ) : (
                  <ScrollArea className="h-[180px]">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-1">
                      {filteredContracts.map(contract => {
                        const isSelected = selectedContractIds.includes(contract.Contract_Number);
                        const taskInfo = contractTasksInfo[contract.Contract_Number];
                        const hasExistingTasks = taskInfo && taskInfo.count > 0;
                        
                        // Format date properly - DD/MM/YYYY
                        const formatDate = (dateStr: string | null) => {
                          if (!dateStr) return '';
                          const date = new Date(dateStr);
                          const day = date.getDate().toString().padStart(2, '0');
                          const month = (date.getMonth() + 1).toString().padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}/${month}/${year}`;
                        };
                        
                        return (
                          <button
                            key={contract.Contract_Number}
                            type="button"
                            onClick={() => toggleContract(contract.Contract_Number)}
                            className={cn(
                              "p-3 rounded-xl border-2 text-right transition-all",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : hasExistingTasks
                                  ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-500"
                                  : "border-border hover:border-primary/50"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Hash className="h-4 w-4 text-primary" />
                              <span className="font-bold">#{contract.Contract_Number}</span>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-primary mr-auto" />}
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                              {contract['Ad Type'] && (
                                <Badge variant="secondary" className="text-[10px] h-5">
                                  {contract['Ad Type']}
                                </Badge>
                              )}
                              {contract['Contract Date'] && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(contract['Contract Date'])}
                                </span>
                              )}
                            </div>
                            {/* Installation tasks info */}
                            {hasExistingTasks && (
                              <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                                <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>مدخل {taskInfo.count} {taskInfo.count === 1 ? 'مرة' : 'مرات'}</span>
                                </div>
                                {taskInfo.lastDate && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
                                    آخر إدخال: {formatDate(taskInfo.lastDate)}
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Billboard Selection */}
            {selectedContractIds.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    اللوحات ({selectedBillboardIds.length}/{contractBillboards.length} محددة)
                  </Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleSelectAll} className="h-8">
                      <Check className="h-3.5 w-3.5 ml-1" />
                      الكل
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll} className="h-8">
                      <X className="h-3.5 w-3.5 ml-1" />
                      إلغاء
                    </Button>
                  </div>
                </div>

                {/* Billboard Filters */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث عن لوحة..."
                      value={billboardSearchTerm}
                      onChange={(e) => setBillboardSearchTerm(e.target.value)}
                      className="pr-10 h-10"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant="outline" className="cursor-pointer h-10 px-3" onClick={() => setCityFilter('all')}>
                      <MapPin className="h-3.5 w-3.5 ml-1" />
                      {cityFilter === 'all' ? 'كل المدن' : cityFilter}
                    </Badge>
                    {cityFilter !== 'all' && (
                      <Button variant="ghost" size="sm" onClick={() => setCityFilter('all')}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant="outline" className="cursor-pointer h-10 px-3" onClick={() => setSizeFilter('all')}>
                      <Ruler className="h-3.5 w-3.5 ml-1" />
                      {sizeFilter === 'all' ? 'كل المقاسات' : sizeFilter}
                    </Badge>
                    {sizeFilter !== 'all' && (
                      <Button variant="ghost" size="sm" onClick={() => setSizeFilter('all')}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* City and Size Filters */}
                {(cities.length > 0 || sizes.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {cities.map(city => (
                      <Badge
                        key={city}
                        variant={cityFilter === city ? 'default' : 'secondary'}
                        className="cursor-pointer text-xs"
                        onClick={() => setCityFilter(cityFilter === city ? 'all' : city)}
                      >
                        {city}
                      </Badge>
                    ))}
                    <Separator orientation="vertical" className="h-5 mx-1" />
                    {sizes.map(size => (
                      <Badge
                        key={size}
                        variant={sizeFilter === size ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => setSizeFilter(sizeFilter === size ? 'all' : size)}
                      >
                        {size}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Billboard Cards Grid */}
                {loadingBillboards ? (
                  <div className="text-center py-8 text-muted-foreground">
                    جاري تحميل اللوحات...
                  </div>
                ) : filteredBillboards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد لوحات
                  </div>
                ) : (
                  <ScrollArea className="h-[250px]">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-1">
                      {filteredBillboards.map(billboard => {
                        const isSelected = selectedBillboardIds.includes(billboard.ID);
                        return (
                          <Card
                            key={billboard.ID}
                            onClick={() => toggleBillboard(billboard.ID)}
                            className={cn(
                              "cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg group",
                              isSelected 
                                ? "ring-2 ring-primary shadow-primary/20 bg-primary/5" 
                                : "hover:ring-1 hover:ring-primary/50"
                            )}
                          >
                            <CardContent className="p-0">
                              <div className="relative h-20 overflow-hidden bg-muted">
                                <BillboardImage 
                                  billboard={billboard as any}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  alt={billboard.Billboard_Name}
                                />
                                
                                <Badge variant="secondary" className="absolute top-1 right-1 text-[9px] h-4">
                                  #{billboard.ID}
                                </Badge>
                                
                                {isSelected && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <CheckCircle2 className="h-6 w-6 text-primary" />
                                  </div>
                                )}
                              </div>
                              
                              <div className="p-2 space-y-1">
                                <div className="font-medium text-xs truncate">
                                  {billboard.Billboard_Name}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                    {billboard.Size}
                                  </Badge>
                                  <span className="text-[9px] text-muted-foreground truncate">
                                    {billboard.City}
                                  </span>
                                </div>
                                {billboard.District && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                                    <span className="text-[9px] text-muted-foreground truncate">{billboard.District}</span>
                                  </div>
                                )}
                                {billboard.Nearest_Landmark && (
                                  <div className="flex items-start gap-1">
                                    <Star className="h-2.5 w-2.5 text-amber-500 shrink-0 mt-0.5" />
                                    <span className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">{billboard.Nearest_Landmark}</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Team Assignment Section */}
            {selectedBillboardIds.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    توزيع الفرق (اختياري)
                  </Label>
                  
                  {/* Uncovered sizes/cities warning */}
                  {(uncoveredSizes.length > 0 || uncoveredCities.length > 0) && teamAssignments.length > 0 && (
                    <div className="flex gap-2">
                      {uncoveredSizes.length > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 ml-1" />
                          مقاسات غير مغطاة: {uncoveredSizes.join(', ')}
                        </Badge>
                      )}
                      {uncoveredCities.length > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 ml-1" />
                          مدن غير مغطاة: {uncoveredCities.join(', ')}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Current Team Assignments */}
                {teamAssignments.length > 0 && (
                  <div className="space-y-2">
                    {teamAssignments.map(assignment => {
                      const team = teams.find(t => t.id === assignment.teamId);
                      return (
                        <div key={assignment.teamId} className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex-1">
                            <div className="font-medium">{assignment.teamName}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {team?.sizes?.slice(0, 3).map(size => (
                                <Badge key={size} variant="secondary" className="text-[9px] h-4">
                                  <Ruler className="h-2.5 w-2.5 ml-0.5" />
                                  {size}
                                </Badge>
                              ))}
                              {team?.cities?.slice(0, 2).map(city => (
                                <Badge key={city} variant="outline" className="text-[9px] h-4">
                                  <MapPin className="h-2.5 w-2.5 ml-0.5" />
                                  {city}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Badge variant="secondary">{assignment.billboardIds.length} لوحة</Badge>
                          <Button variant="ghost" size="sm" onClick={() => removeTeamAssignment(assignment.teamId)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available Teams */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {getRecommendedTeams(teamAssignments.map(a => a.teamId)).map(team => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => addTeamAssignment(team.id, team.team_name)}
                      className={cn(
                        "p-3 rounded-xl border-2 text-right transition-all relative",
                        team.isRecommended
                          ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20 hover:border-green-500"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {team.isRecommended && (
                        <Badge className="absolute -top-2 right-2 bg-green-500 text-[10px] h-5">
                          <Star className="h-3 w-3 ml-1" />
                          موصى به
                        </Badge>
                      )}
                      <div className="font-medium flex items-center gap-2">
                        {team.team_name}
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {team.sizes?.slice(0, 2).map(size => (
                          <Badge key={size} variant="secondary" className="text-[9px] h-4">
                            <Ruler className="h-2.5 w-2.5 ml-0.5" />
                            {size}
                          </Badge>
                        ))}
                        {team.cities?.slice(0, 2).map(city => (
                          <Badge key={city} variant="outline" className="text-[9px] h-4">
                            <MapPin className="h-2.5 w-2.5 ml-0.5" />
                            {city}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">أخطاء في التعيين:</div>
                  <ul className="space-y-1 text-sm">
                    {validationErrors.map((error, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="font-medium">#{error.billboardId} {error.billboardName}</span>
                        <span className="text-xs">({error.size} - {error.city})</span>
                        <span className="text-xs">- {error.reason}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {selectedBillboardIds.length > 0 && (
                  <span>تم اختيار <strong>{selectedBillboardIds.length}</strong> لوحة من <strong>{selectedContractIds.length}</strong> عقود</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={selectedContractIds.length === 0 || selectedBillboardIds.length === 0 || isSubmitting}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
