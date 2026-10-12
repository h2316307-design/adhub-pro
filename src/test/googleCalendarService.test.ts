import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { 
  extractCalendarEvents, 
  loadCalendarRecords, 
  generateGoogleCalendarWebUrl, 
  updateCustomerAlertEmail,
  syncEventsToGoogleCalendar,
  cleanOldGoogleCalendarEvents,
  getAppsScriptSourceCode,
  buildContractDesignsMap,
  formatAlertTimeArabic
} from '@/services/googleCalendarService';

describe('calendar records', () => {
  beforeEach(() => vi.clearAllMocks());
  it('loads every page using existing contract columns', async () => {
    const selections: string[] = [];
    from.mockImplementation((table: string) => {
      const query = {
        select: (columns: string) => { selections.push(columns); return query; },
        order: () => query,
        in: () => query,
        range: async (start: number) => ({ error: null, data: table === 'Contract'
          ? Array.from({ length: start === 0 ? 500 : 1 }, (_, i) => ({ Contract_Number: start + i })) : [] }),
      };
      return query;
    });
    const result = await loadCalendarRecords();
    expect(result.contracts).toHaveLength(501);
    expect(selections.join()).not.toContain('Start Date');
    expect(selections.join()).toContain('Contract Date');
  });
  it('rejects payment failures instead of treating unpaid balances as accurate', async () => {
    from.mockImplementation(() => {
      const query = { select: () => query, order: () => query, in: () => query,
        range: async () => ({ data: null, error: new Error('Unavailable') }) };
      return query;
    });
    await expect(loadCalendarRecords()).rejects.toThrow('Unavailable');
  });
});

describe('calendar extraction', () => {
  beforeEach(() => {
    from.mockImplementation(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));
  });
  const contract = { Contract_Number: 25, 'Customer Name': 'عميل', Total: 1000,
    'Contract Date': '2026-10-01', 'End Date': '2026-12-31' };
  it('includes contract dates and only the unpaid portion of installments', () => {
    const events = extractCalendarEvents([{ ...contract, installments_data: JSON.stringify([
      { dueDate: '2026-10-01', amount: 400 }, { dueDate: '2026-11-01', amount: 600 },
    ]) }], [{ contract_number: 25, amount: 500 }], { syncContractStarts: true, activeAndUpcomingOnly: false });
    expect(events).toHaveLength(3);
    expect(events.find(e => e.type === 'installment')?.amount).toBe(500);
    expect(events.find(e => e.type === 'contract_start')?.startDate).toBe('2026-10-01');
  });
  it('does not let invalid dates break valid contracts', () => {
    const events = extractCalendarEvents([{ ...contract, 'Contract Date': 'bad', 'End Date': 'bad' }, contract], [], { activeAndUpcomingOnly: false, syncContractStarts: false });
    expect(events).toHaveLength(2);
    expect(events.every(e => Number.isFinite(Date.parse(e.startDate)))).toBe(true);
  });

  it('filters out expired contracts by default when activeAndUpcomingOnly is true', () => {
    const expiredContract = {
      Contract_Number: 99,
      'Customer Name': 'عميل منتهي',
      Total: 2000,
      'Contract Date': '2020-01-01',
      'End Date': '2020-12-31',
      installments_data: JSON.stringify([{ dueDate: '2020-06-01', amount: 1000 }]),
    };
    const activeContract = {
      Contract_Number: 100,
      'Customer Name': 'عميل ساري',
      Total: 5000,
      'Contract Date': '2026-01-01',
      'End Date': '2030-12-31',
      installments_data: JSON.stringify([{ dueDate: '2030-06-01', amount: 2500 }]),
    };

    // Default: activeAndUpcomingOnly is true
    const activeOnlyEvents = extractCalendarEvents([expiredContract, activeContract], []);
    expect(activeOnlyEvents.some(e => e.contractNumber === 99)).toBe(false);
    expect(activeOnlyEvents.some(e => e.contractNumber === 100)).toBe(true);
    expect(activeOnlyEvents.every(e => e.isContractActive)).toBe(true);

    // When activeAndUpcomingOnly is explicitly false: historical contracts are included
    const allEvents = extractCalendarEvents([expiredContract, activeContract], [], { activeAndUpcomingOnly: false });
    expect(allEvents.some(e => e.contractNumber === 99)).toBe(true);
  });

  it('excludes past contract_start events when activeAndUpcomingOnly is true, even if contract is active', () => {
    const activeContract = {
      Contract_Number: 1056,
      'Customer Name': 'عامر محمد سويد',
      Total: 90000,
      'Contract Date': '2024-03-01',
      'End Date': '2030-12-31',
    };

    const events = extractCalendarEvents([activeContract], [], {
      syncContractStarts: true,
      activeAndUpcomingOnly: true,
    });

    // Past start from 2024 must NOT be included as an active upcoming alert
    expect(events.some(e => e.type === 'contract_start')).toBe(false);
    // But upcoming end date should be present
    expect(events.some(e => e.type === 'contract_end')).toBe(true);
  });

  it('sets amount to remaining unpaid balance (0 when fully paid) for contract events', () => {
    const paidContract = {
      Contract_Number: 1056,
      'Customer Name': 'عامر محمد سويد',
      Total: 90000,
      'Contract Date': '2026-01-01',
      'End Date': '2030-12-31',
    };
    const payments = [{ contract_number: 1056, amount: 90000 }];

    const events = extractCalendarEvents([paidContract], payments, {
      syncContracts: true,
      activeAndUpcomingOnly: false,
    });

    const endEvent = events.find(e => e.type === 'contract_end');
    expect(endEvent?.amount).toBe(0);
    expect(endEvent?.description).toContain('حالة السداد: مسدد بالكامل');
    expect(endEvent?.description).toContain('المبلغ المتبقي: 0 د.ل');
  });

  it('marks old contracts without end date that started >365 days ago or are fully paid as expired', () => {
    const oldContractNoEndDate = {
      Contract_Number: 1056,
      'Customer Name': 'عامر محمد سويد',
      Total: 90000,
      'Contract Date': '2024-03-01', // started ~954 days ago
    };
    const payments = [{ contract_number: 1056, amount: 90000 }];

    // Under activeAndUpcomingOnly, this old settled contract should be completely excluded
    const activeEvents = extractCalendarEvents([oldContractNoEndDate], payments, {
      syncContractStarts: true,
      activeAndUpcomingOnly: true,
    });
    expect(activeEvents).toHaveLength(0);

    // In archive view (activeAndUpcomingOnly: false), it is marked as not active
    const archiveEvents = extractCalendarEvents([oldContractNoEndDate], payments, {
      syncContractStarts: true,
      activeAndUpcomingOnly: false,
    });
    expect(archiveEvents.every(e => !e.isContractActive)).toBe(true);
  });

  it('extracts sales invoices with due amounts and marks paid ones properly', () => {
    const invoices = [
      {
        id: 'inv-1',
        invoice_number: '2026-001',
        customer_name: 'شركة النجوم',
        invoice_date: '2026-11-15',
        total_amount: 12000,
        paid_amount: 4000,
        remaining_amount: 8000,
        paid: false,
      },
      {
        id: 'inv-2',
        invoice_number: '2026-002',
        customer_name: 'شركة الأفق',
        invoice_date: '2026-05-01',
        total_amount: 5000,
        paid_amount: 5000,
        remaining_amount: 0,
        paid: true,
      },
    ];

    const events = extractCalendarEvents([], [], { syncInvoices: true, activeAndUpcomingOnly: true }, invoices);
    expect(events).toHaveLength(1);
    const invEvent = events[0];
    expect(invEvent.type).toBe('invoice');
    expect(invEvent.invoiceNumber).toBe('2026-001');
    expect(invEvent.customerName).toBe('شركة النجوم');
    expect(invEvent.amount).toBe(8000);
    expect(invEvent.adType).toBe('فاتورة مبيعات');
    expect(invEvent.description).toContain('شركة النجوم');
    expect(invEvent.description).toContain('2026-001');
    expect(invEvent.description).toContain('المبلغ المستحق:');
    expect(invEvent.description).toContain('د.ل');
  });

  it('attaches design url and earliest installation date to contract events', () => {
    const contractWithDesign = {
      Contract_Number: 300,
      'Customer Name': 'مجموعة الرائد',
      Total: 40000,
      'Contract Date': '2026-11-01',
      'End Date': '2027-11-01',
      ad_type: 'شاشات إلكترونية LED',
      design_data: JSON.stringify({
        url: 'https://example.com/designs/ad300.jpg',
      }),
    };

    const installations = [
      { contract_id: 300, installation_date: '2026-11-03' },
      { contract_id: 300, installation_date: '2026-11-02' }, // earlier
    ];

    const events = extractCalendarEvents(
      [contractWithDesign],
      [],
      { syncContracts: true, syncContractStarts: true, activeAndUpcomingOnly: false },
      [],
      installations
    );

    const startEvent = events.find(e => e.type === 'contract_start');
    expect(startEvent).toBeDefined();
    expect(startEvent?.designUrl).toBe('https://example.com/designs/ad300.jpg');
    expect(startEvent?.firstInstallationDate).toBe('2026-11-02');
    expect(startEvent?.adType).toBe('شاشات إلكترونية LED');
    expect(startEvent?.description).toContain('https://example.com/designs/ad300.jpg');
    expect(startEvent?.description).toContain('2026-11-02');
  });

  it('maps customer email to contract and invoice events and includes in Google Calendar URL', () => {
    const contracts = [
      {
        Contract_Number: 501,
        'Customer Name': 'مؤسسة السلام',
        customer_id: 'cust-501',
        Total: 50000,
        'Contract Date': '2026-12-01',
        'End Date': '2027-12-01',
      },
    ];
    const customers = [
      {
        id: 'cust-501',
        name: 'مؤسسة السلام',
        email: 'info@alsalam.ly',
      },
    ];

    const events = extractCalendarEvents(
      contracts,
      [],
      { syncContracts: true, activeAndUpcomingOnly: false },
      [],
      [],
      customers
    );

    const event = events.find(e => e.contractNumber === 501);
    expect(event).toBeDefined();
    expect(event?.customerEmail).toBe('info@alsalam.ly');
    expect(event?.description).toContain('info@alsalam.ly');

    // Test Google Calendar Web URL generation with customer email as guest
    const url = generateGoogleCalendarWebUrl(event!, ['manager@agency.ly']);
    expect(url).toContain('add=manager%40agency.ly%2Cinfo%40alsalam.ly');
    expect(url).toContain('info%40alsalam.ly');
  });

  it('updates customer alert email in Supabase correctly', async () => {
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    from.mockImplementation(() => ({
      update: updateFn,
    }));

    const result = await updateCustomerAlertEmail('cust-123', 'client@test.com');
    expect(result).toBe(true);
    expect(updateFn).toHaveBeenCalledWith({ email: 'client@test.com' });
  });

  it('includes cleanup and deduplication routines in generated Apps Script source code', () => {
    const code = getAppsScriptSourceCode();
    expect(code).toContain('purgePastAndDuplicateAdHubEvents');
    expect(code).toContain('clean_old');
    expect(code).toContain('d < foundEvents.length');
  });

  it('syncs without automatic deletion and keeps customer email scoped to the event', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        createdCount: 2,
        updatedCount: 1,
        deletedCount: 4,
      }),
    });
    global.fetch = fetchMock;

    try {
      const config = {
        scriptUrl: 'https://script.google.com/macros/s/test-script/exec',
        emails: ['test@example.com'],
        reminders: [1440],
        syncContracts: true,
        syncInstallments: true,
        syncContractStarts: true,
        syncInvoices: true,
        autoSync: false,
        lastSync: null,
      };

      const events = [
        {
          id: 'test-event-1',
          customerEmail: 'customer@example.com',
          tag: 'ADHUB_CONTRACT_100',
          type: 'contract_end' as const,
          title: 'عقد 100',
          description: 'تفاصيل العقد',
          startDate: '2026-12-01',
          allDay: true,
          customerName: 'العميل',
          daysRemainingOrOverdue: -50,
          isOverdue: false,
          isContractActive: true,
          statusText: 'متبقي 50 يوم',
        },
      ];

      const result = await syncEventsToGoogleCalendar(config, events);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe('https://script.google.com/macros/s/test-script/exec');
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.action).toBe('sync');
      expect(payload.cleanOld).toBe(false);
      expect(payload.events).toHaveLength(1);
      expect(payload.emails).toEqual(['test@example.com']);
      expect(payload.events[0].customerEmail).toBe('customer@example.com');

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(2);
      expect(result.updatedCount).toBe(1);
      expect(result.deletedCount).toBe(4);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('triggers clean_old action via cleanOldGoogleCalendarEvents correctly', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        deletedCount: 7,
        message: 'تم حذف 7 أحداث قديمة ومكررة',
      }),
    });
    global.fetch = fetchMock;

    try {
      const config = {
        scriptUrl: 'https://script.google.com/macros/s/test-script/exec',
        emails: [],
        reminders: [],
        syncContracts: true,
        syncInstallments: true,
        syncContractStarts: true,
        syncInvoices: true,
        autoSync: false,
        lastSync: null,
      };

      const result = await cleanOldGoogleCalendarEvents(config);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      expect(payload.action).toBe('clean_old');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(7);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('chunks events into batches of 15 with onProgress when count exceeds batch size', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        createdCount: 10,
        updatedCount: 0,
        deletedCount: 0,
      }),
    });
    global.fetch = fetchMock;

    try {
      const config = {
        scriptUrl: 'https://script.google.com/macros/s/test-script/exec',
        emails: [],
        reminders: [],
        syncContracts: true,
        syncInstallments: true,
        syncContractStarts: true,
        syncInvoices: true,
        autoSync: false,
        lastSync: null,
      };

      // 25 events (should be 2 batches: 15 and 10)
      const events = Array.from({ length: 25 }, (_, i) => ({
        id: `ev-${i}`,
        tag: `ADHUB_${i}`,
        type: 'installment' as const,
        title: `موعد ${i}`,
        description: 'تفاصيل',
        startDate: '2026-12-01',
        allDay: true,
        customerName: 'عميل',
        daysRemainingOrOverdue: -10,
        isOverdue: false,
        isContractActive: true,
        statusText: 'قادم',
      }));

      const progressHistory: any[] = [];
      const result = await syncEventsToGoogleCalendar(config, events, undefined, {
        cleanOld: true,
        batchSize: 15,
        delayMs: 0,
        onProgress: (p) => progressHistory.push(p),
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // First batch should have cleanOld: true
      const firstPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(firstPayload.cleanOld).toBe(true);
      expect(firstPayload.events).toHaveLength(15);

      // Second batch should have cleanOld: false
      const secondPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(secondPayload.cleanOld).toBe(false);
      expect(secondPayload.events).toHaveLength(10);

      expect(progressHistory.length).toBeGreaterThanOrEqual(2);
      expect(result.createdCount).toBe(20);
      expect(result.totalProcessed).toBe(25);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('translates Google rate limit exception into clear Arabic cooldown guidance', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Exception: لقد أنشأت أو حذفت عددًا كبيرًا جدًا من التقاويم أو أحداث التقويم خلال فترة زمنية قصيرة. يُرجى إعادة المحاولة لاحقًا.',
      }),
    });
    global.fetch = fetchMock;

    try {
      const config = {
        scriptUrl: 'https://script.google.com/macros/s/rate-test/exec',
        emails: [],
        reminders: [],
        syncContracts: true,
        syncInstallments: true,
        syncContractStarts: true,
        syncInvoices: true,
        autoSync: false,
        lastSync: null,
      };

      await expect(syncEventsToGoogleCalendar(config, [{
        id: '1',
        tag: 'T',
        type: 'contract_end',
        title: 'C',
        description: 'D',
        startDate: '2026-11-01',
        allDay: true,
        customerName: 'N',
        daysRemainingOrOverdue: -1,
        isOverdue: false,
        isContractActive: true,
        statusText: 'S',
      }])).resolves.toMatchObject({ success: false, rateLimited: true, lastProcessedIndex: 0, error: expect.stringContaining('Google Rate Limit') });
      await expect(syncEventsToGoogleCalendar(config, [])).rejects.toThrow('ثانية');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('maps designs from composite tasks and task_designs, and embeds direct inline img tags', () => {
    const contractWithoutDirectDesign = {
      Contract_Number: 777,
      'Customer Name': 'شركة الأمل',
      Total: 30000,
      'Contract Date': '2026-12-01',
      'End Date': '2027-12-01',
      design_data: null, // No direct contract design_data
    };

    const compositeTasks = [
      { id: 'comp-1', contract_id: 777, installation_task_id: 'task-inst-99' },
    ];
    const taskDesigns = [
      {
        task_id: 'task-inst-99',
        design_face_a_url: 'https://example.com/designs/composite-design-face-a.png',
        design_face_b_url: null,
      },
    ];

    const designsMap = buildContractDesignsMap(compositeTasks, taskDesigns, []);
    expect(designsMap.get(777)).toEqual(['https://example.com/designs/composite-design-face-a.png']);

    const events = extractCalendarEvents(
      [contractWithoutDirectDesign],
      [],
      { syncContracts: true, activeAndUpcomingOnly: false, alertTime: '12:00' },
      [],
      [],
      [],
      designsMap
    );

    const event = events.find(e => e.contractNumber === 777);
    expect(event).toBeDefined();
    expect(event?.designUrl).toBe('https://example.com/designs/composite-design-face-a.png');
    // Direct inline image tag in event description
    expect(event?.description).toContain('<img src="https://example.com/designs/composite-design-face-a.png"');
    expect(event?.description).toContain('رابط التصميم المباشر:');
    // Default alert time
    expect(event?.alertTime).toBe('12:00');
    expect(event?.description).toContain('12:00 (12:00 ظهرًا)');
  });

  it('formats custom alertTime and generates timed Google Calendar Web URLs at configured hour', () => {
    expect(formatAlertTimeArabic('12:00')).toBe('12:00 ظهرًا');
    expect(formatAlertTimeArabic('14:30')).toBe('02:30 مساءً');
    expect(formatAlertTimeArabic('09:00')).toBe('09:00 صباحًا');

    const contract = {
      Contract_Number: 888,
      'Customer Name': 'مؤسسة النور',
      Total: 15000,
      'Contract Date': '2026-10-15',
      'End Date': '2027-10-15',
    };

    const events = extractCalendarEvents(
      [contract],
      [],
      { syncContracts: true, activeAndUpcomingOnly: false, alertTime: '14:00' },
    );

    const event = events.find(e => e.contractNumber === 888);
    expect(event?.alertTime).toBe('14:00');
    expect(event?.description).toContain('14:00 (02:00 مساءً)');

    // Verify 1-click Google Calendar Web URL has timed slot (14:00 to 15:00)
    const url = generateGoogleCalendarWebUrl({
      title: event!.title,
      description: event!.description,
      startDate: '2026-10-15',
      alertTime: '14:00',
    });
    expect(url).toContain('dates=20261015T140000%2F20261015T150000');
  });

  it('supports resuming sync with startIndex, skipping already synced items without cleanOld', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, createdCount: 10, updatedCount: 0, deletedCount: 0 }),
    });
    global.fetch = fetchMock;

    try {
      const config = {
        scriptUrl: 'https://script.google.com/macros/s/test-script/exec',
        emails: [],
        reminders: [1440],
        syncContracts: true,
        syncInstallments: true,
        syncContractStarts: true,
        syncInvoices: true,
        autoSync: false,
        lastSync: null,
      };

      const events = Array.from({ length: 30 }, (_, i) => ({
        id: `ev-${i}`,
        tag: `ADHUB_${i}`,
        type: 'installment' as const,
        title: `موعد ${i}`,
        description: 'تفاصيل',
        startDate: '2027-01-15',
        allDay: true,
        customerName: 'عميل',
        daysRemainingOrOverdue: -30,
        isOverdue: false,
        isContractActive: true,
        statusText: 'قادم',
      }));

      // Resume from item index 15
      const result = await syncEventsToGoogleCalendar(config, events, undefined, {
        startIndex: 15,
        batchSize: 15,
        cleanOld: true,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
      // cleanOld should be false when resuming (startIndex > 0)
      expect(payload.cleanOld).toBe(false);
      expect(payload.events).toHaveLength(15);
      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(30);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns partial result with rateLimited: true when a later batch hits quota', async () => {
    const originalFetch = global.fetch;
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({ success: true, createdCount: 15, updatedCount: 0, deletedCount: 0 }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: false,
          error: 'Exception: لقد أنشأت أو حذفت عددًا كبيرًا جدًا من التقاويم أو أحداث التقويم خلال فترة زمنية قصيرة. يُرجى إعادة المحاولة لاحقًا.',
        }),
      };
    });
    global.fetch = fetchMock;

    try {
      const config = {
        scriptUrl: 'https://script.google.com/macros/s/test-script/exec',
        emails: [],
        reminders: [1440],
        syncContracts: true,
        syncInstallments: true,
        syncContractStarts: true,
        syncInvoices: true,
        autoSync: false,
        lastSync: null,
      };

      const events = Array.from({ length: 30 }, (_, i) => ({
        id: `ev-${i}`,
        tag: `ADHUB_${i}`,
        type: 'installment' as const,
        title: `موعد ${i}`,
        description: 'تفاصيل',
        startDate: '2026-11-01',
        allDay: true,
        customerName: 'عميل',
        daysRemainingOrOverdue: -10,
        isOverdue: false,
        isContractActive: true,
        statusText: 'قادم',
      }));

      const result = await syncEventsToGoogleCalendar(config, events, undefined, {
        batchSize: 15,
        delayMs: 10,
      });

      expect(result.success).toBe(false);
      expect(result.rateLimited).toBe(true);
      expect(result.createdCount).toBe(15);
      expect(result.lastProcessedIndex).toBe(15);
      expect(result.error).toContain('Google Rate Limit');
    } finally {
      global.fetch = originalFetch;
    }
  });
});


