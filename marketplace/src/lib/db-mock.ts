// Mock database for testing when real database is unavailable
// Used when DATABASE_URL is invalid or database is down

export const mockData = {
  users: new Map([
    ['999001', {
      id: '999001',
      username: 'demo_brand',
      role: 'brand',
      email: 'brand@test.local',
      display_name: 'Demo Brand',
      is_active: true,
    }],
    ['999002', {
      id: '999002',
      username: 'demo_creator',
      role: 'creator',
      email: 'creator@test.local',
      display_name: 'Demo Creator',
      followers_count: 12400,
      is_active: true,
    }],
  ]),

  auth_sessions: new Map(),
  deals: new Map(),
  campaigns: new Map(),
  applications: new Map(),
  direct_payments: new Map(),
  accounts: new Map([
    ['999001', { id: 'acc-999001', user_id: '999001' }],
    ['999002', { id: 'acc-999002', user_id: '999002' }],
  ]),
};

export async function mockQuery(text: string, params?: any[]) {
  // Handle auth_sessions lookups
  if (text.includes('FROM auth_sessions') && text.includes('WHERE id')) {
    const sessionToken = params?.[0];
    if (sessionToken) {
      let userId = '999002'; // default to creator
      try {
        const decoded = Buffer.from(sessionToken, 'base64').toString();
        if (decoded.includes('brand')) userId = '999001';
      } catch {
        userId = sessionToken.includes('brand') ? '999001' : '999002';
      }
      const futureDate = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      return {
        rows: [{
          id: sessionToken,
          user_id: userId,
          is_active: true,
          expires_at: futureDate,
        }],
        rowCount: 1,
        command: 'SELECT',
      };
    }
  }

  // Handle INSERT INTO deals
  if (text.includes('INSERT INTO deals') && text.includes('RETURNING')) {
    // Generate a proper UUID v4
    const dealId = `${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`.slice(0, 36);
    const now = new Date().toISOString();
    const deal = {
      id: dealId,
      brand_id: params?.[0],
      title: params?.[1],
      description: params?.[2],
      amount: params?.[3],
      workflow_status: params?.[4] || 'DRAFT',
      created_at: now,
      updated_at: now,
      application_deadline: params?.[5],
      content_upload_deadline: params?.[6],
      deal_deadline: params?.[7],
      published_at: params?.[8],
      status: params?.[9],
      phase: params?.[10],
    };
    mockData.deals.set(dealId, deal);
    return {
      rows: [{
        id: dealId,
        workflow_status: deal.workflow_status,
        created_at: now,
      }],
      rowCount: 1,
      command: 'INSERT',
    };
  }

  // Handle SELECT FROM deals (single deal lookup)
  if (text.includes('SELECT') && text.includes('FROM deals') && (text.includes('WHERE id') || text.includes('WHERE\n'))) {
    const dealId = params?.[0];
    if (dealId && mockData.deals.has(dealId)) {
      const deal = mockData.deals.get(dealId);
      // Ensure brand_id is set for authorization checks
      const fullDeal = {
        id: deal.id,
        brand_id: deal.brand_id || '999001',
        creator_id: null,
        title: deal.title,
        description: deal.description,
        amount: deal.amount,
        workflow_status: deal.workflow_status,
        application_deadline: deal.application_deadline,
        content_upload_deadline: deal.content_upload_deadline,
        deal_deadline: deal.deal_deadline,
        content_link: deal.content_link || null,
        content_uploaded_at: null,
        feedback: null,
        revision_count: 0,
        applications_closed: false,
        published_at: deal.published_at,
        cancelled_at: null,
        created_at: deal.created_at,
      };
      return {
        rows: [fullDeal],
        rowCount: 1,
        command: 'SELECT',
      };
    }
    return { rows: [], rowCount: 0, command: 'SELECT' };
  }

  // Handle SELECT FROM deals (browse deals)
  if (text.includes('SELECT') && text.includes('FROM deals') && !text.includes('WHERE id')) {
    const deals = Array.from(mockData.deals.values());
    return {
      rows: deals,
      rowCount: deals.length,
      command: 'SELECT',
    };
  }

  // Handle accounts lookups/inserts
  if (text.includes('FROM accounts') && text.includes('WHERE user_id')) {
    const userId = params?.[0];
    if (userId && mockData.accounts.has(userId)) {
      const account = mockData.accounts.get(userId);
      return {
        rows: [account],
        rowCount: 1,
        command: 'SELECT',
      };
    }
    return {
      rows: [{ id: `acc-${userId}` }],
      rowCount: 1,
      command: 'INSERT',
    };
  }

  // Handle user lookups
  if (text.includes('FROM users') && text.includes('WHERE')) {
    const userId = params?.[0];
    if (userId && mockData.users.has(userId)) {
      const user = mockData.users.get(userId);
      return {
        rows: [user],
        rowCount: 1,
        command: 'SELECT',
      };
    }
  }

  // Handle INSERT INTO applications
  if (text.includes('INSERT INTO applications') || text.includes('INSERT INTO deal_applications')) {
    const appId = Math.random().toString(36).substr(2, 9);
    const app = {
      id: appId,
      deal_id: params?.[0],
      creator_id: params?.[1],
      status: params?.[2] || 'pending',
      created_at: new Date().toISOString(),
    };
    mockData.applications.set(appId, app);
    return {
      rows: [app],
      rowCount: 1,
      command: 'INSERT',
    };
  }

  // Handle SELECT FROM applications
  if (text.includes('SELECT') && text.includes('FROM applications')) {
    const apps = Array.from(mockData.applications.values());
    return {
      rows: apps,
      rowCount: apps.length,
      command: 'SELECT',
    };
  }

  // Handle UPDATE queries
  if (text.includes('UPDATE')) {
    return {
      rows: [],
      rowCount: 1,
      command: 'UPDATE',
    };
  }

  // Default: empty results
  return {
    rows: [],
    rowCount: 0,
    command: 'SELECT',
  };
}

export async function mockQueryOne(text: string, params?: any[]) {
  const result = await mockQuery(text, params);
  return result.rows[0] || null;
}

export async function mockTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const mockClient = {
    query: mockQuery,
    queryOne: mockQueryOne,
  };
  return await callback(mockClient);
}
