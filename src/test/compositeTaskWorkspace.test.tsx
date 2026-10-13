import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubContractDetail } from '@/components/composite-tasks/list/HubContractDetail';
import { TaskCardRow } from '@/components/composite-tasks/list/TaskCardRow';

vi.mock('@/lib/contractDesignUtils', () => ({ fetchContractDesignUrls: vi.fn(async () => []) }));
vi.mock('@/components/composite-tasks/list/DesignPanel', () => ({ DesignPanel: ({ urls = [], label }: any) => <div aria-label={label}>{urls.map((url: string) => <img key={url} src={url} alt="صورة" />)}</div> }));

describe('Composite task workspace navigation', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  function render(view: React.ReactNode) { root.render(<QueryClientProvider client={queryClient}>{view}</QueryClientProvider>); }
  const task = { id: 'composite-9', installation_task_id: 'install/9', contract_id: 1320, contractIds: [1320], printEnabledContractIds: [1320], teamName: 'فرقة التركيب', status: 'pending', task_type: 'new_installation', customer_total: 500, company_total: 200, installationItemCount: 5, completedItemCount: 2, assignedDesignCount: 3, _totalPaid: 100, designUrls: ['/design.jpg'] };
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  function click(label: string) {
    const button = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.trim() === label);
    expect(button).toBeTruthy(); act(() => button!.click());
  }
  function renderGroup() {
    const navigate = vi.fn();
    const group = { key: 'group-1320', contractId: 1320, contractIds: [1320], printEnabledContractIds: [1320], customerName: 'زبون الاختبار', latestDesignUrls: ['/design.jpg'], groupTotalBillboards: 5, groupCompletedBillboards: 2, groupProgressPercentage: 40, groupTotal: 500, groupPaid: 100, groupRemaining: 400, groupProfit: 300, tasks: [task], operations: [{ key: 'op-1', label: 'التركيب الأول', tasks: [task] }] };
    const props = { group, expandedOperations: new Set(), toggleOperationExpansion: vi.fn(), navigate, handleCreateReinstallationForGroup: vi.fn(), loadInstallationWorkflow: vi.fn(), handleDownloadGroupZip: vi.fn(), setEditingOperationTasks: vi.fn(), setEditingTask: vi.fn(), setEditDialogOpen: vi.fn() };
    act(() => render(<HubContractDetail {...props} />));
    return props;
  }

  it('opens the actual installation task and marks contracts with printing', () => {
    const props = renderGroup();
    click('إدارة اللوحات');
    expect(props.navigate).toHaveBeenCalledWith('/admin/installation-tasks?task=install%2F9&from=hub');
    expect(host.textContent).toContain('مع الطباعة');
  });

  it('keeps the newest operation collapsed with cost and amount due visible', () => {
    const props = renderGroup();
    expect(host.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')).toBe('false');
    expect(host.textContent).toContain('تكلفة التنفيذ');
    expect(host.textContent).toContain('المستحق على الزبون');
    expect(host.textContent).not.toContain('التوزيع');
    const operation = host.querySelector('[aria-expanded]') as HTMLButtonElement;
    act(() => operation.click());
    expect(props.toggleOperationExpansion).toHaveBeenCalledWith('group-1320::op-1');
    act(() => render(<HubContractDetail {...props} expandedOperations={new Set(['group-1320::op-1'])}/>));
    expect(host.textContent).toContain('التوزيع');
  });

  it('exposes cost editing beside the collapsed operation and opens its own tasks', () => {
    const props = renderGroup();
    click('تعديل التكاليف');
    expect(props.setEditingOperationTasks).toHaveBeenCalledWith([task]);
    expect(props.setEditingTask).toHaveBeenCalledWith(task);
    expect(props.setEditDialogOpen).toHaveBeenCalledWith(true);
    const tab = Array.from(host.querySelectorAll('[role="tab"]')).find(b => b.textContent === 'الحسابات')!;
    act(() => tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(host.textContent).toContain('تعديل التكاليف');
    expect(host.textContent).toContain('فاتورة العملية');
    expect(host.textContent).not.toContain('إدارة اللوحات');
  });

  it('passes all operation task IDs to design management and distribution', () => {
    const manage = vi.fn(), distribute = vi.fn(), open = vi.fn(), print = vi.fn();
    const ids = ['install/9', 'install/10'];
    act(() => render(<TaskCardRow task={task} idx={0} operationInstallationTaskIds={ids} onDelete={vi.fn()} onOpenInvoice={vi.fn()} onNavigateToPayment={vi.fn()} onManageDesigns={manage} onDistributeDesigns={distribute} onPrintInstallationTask={print} onOpenInstallationTask={open} />));
    click('التصاميم'); click('التوزيع'); click('إدارة اللوحات'); click('طباعة التركيب');
    expect(manage).toHaveBeenCalledWith(task, ids);
    expect(distribute).toHaveBeenCalledWith(task, ids);
    expect(open).toHaveBeenCalledWith(task);
    expect(print).toHaveBeenCalledWith(task);
  });

  it('keeps installed photos and completed markers attached to their operation after reordering', () => {
    const props = renderGroup();
    const doneTask = { ...task, id: 'finished', status: 'completed', installationImages: ['/finished-installation.jpg'] };
    const pendingTask = { ...task, id: 'pending', installationImages: ['/pending-installation.jpg'] };
    const operations = [
      { key: 'finished-operation', label: 'تركيب 1', tasks: [doneTask] },
      { key: 'pending-operation', label: 'تركيب 2', tasks: [pendingTask] },
    ];
    const group = { ...props.group, operations };
    act(() => render(<HubContractDetail {...props} group={group} />));
    expect(host.querySelector('[aria-label="صور تركيب تركيب 1"] img')?.getAttribute('src')).toBe('/finished-installation.jpg');
    expect(host.querySelectorAll('section')[0].textContent).toContain('مكتملة');
    act(() => render(<HubContractDetail {...props} group={{ ...group, operations: [{ ...operations[1], label: 'تركيب 1' }, { ...operations[0], label: 'تركيب 2' }] }} />));
    expect(host.querySelector('[aria-label="صور تركيب تركيب 2"] img')?.getAttribute('src')).toBe('/finished-installation.jpg');
    expect(host.querySelector('[aria-label="صور تركيب تركيب 1"] img')?.getAttribute('src')).toBe('/pending-installation.jpg');
    expect(Array.from(host.querySelectorAll('section')).find(section => section.textContent?.includes('صور تركيب تركيب 2'))?.textContent).toContain('مكتملة');
  });
});
