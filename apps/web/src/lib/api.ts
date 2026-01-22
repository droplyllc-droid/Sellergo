const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RequestOptions extends RequestInit {
  token?: string;
}

interface ApiError extends Error {
  status: number;
  code: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      const apiError = new Error(error.message || 'API Error') as ApiError;
      apiError.status = response.status;
      apiError.code = error.code || 'UNKNOWN_ERROR';
      throw apiError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);

// API endpoints factory
export function createStoreApi(storeId: string, token: string) {
  const baseEndpoint = `/stores/${storeId}`;

  return {
    // Products
    products: {
      list: (params?: Record<string, string>) =>
        api.get(`${baseEndpoint}/products?${new URLSearchParams(params)}`, { token }),
      get: (id: string) => api.get(`${baseEndpoint}/products/${id}`, { token }),
      create: (data: unknown) => api.post(`${baseEndpoint}/products`, data, { token }),
      update: (id: string, data: unknown) => api.patch(`${baseEndpoint}/products/${id}`, data, { token }),
      delete: (id: string) => api.delete(`${baseEndpoint}/products/${id}`, { token }),
    },

    // Orders
    orders: {
      list: (params?: Record<string, string>) =>
        api.get(`${baseEndpoint}/orders?${new URLSearchParams(params)}`, { token }),
      get: (id: string) => api.get(`${baseEndpoint}/orders/${id}`, { token }),
      updateStatus: (id: string, status: string, note?: string) =>
        api.patch(`${baseEndpoint}/orders/${id}/status`, { status, note }, { token }),
      confirm: (id: string) => api.post(`${baseEndpoint}/orders/${id}/confirm`, {}, { token }),
      ship: (id: string, data: { trackingNumber?: string; carrier?: string }) =>
        api.post(`${baseEndpoint}/orders/${id}/ship`, data, { token }),
      deliver: (id: string) => api.post(`${baseEndpoint}/orders/${id}/deliver`, {}, { token }),
      cancel: (id: string, reason: string) =>
        api.post(`${baseEndpoint}/orders/${id}/cancel`, { reason }, { token }),
    },

    // Customers
    customers: {
      list: (params?: Record<string, string>) =>
        api.get(`${baseEndpoint}/customers?${new URLSearchParams(params)}`, { token }),
      get: (id: string) => api.get(`${baseEndpoint}/customers/${id}`, { token }),
      create: (data: unknown) => api.post(`${baseEndpoint}/customers`, data, { token }),
      update: (id: string, data: unknown) => api.patch(`${baseEndpoint}/customers/${id}`, data, { token }),
      block: (data: unknown) => api.post(`${baseEndpoint}/customers/blocks`, data, { token }),
    },

    // Analytics
    analytics: {
      dashboard: (period?: string) =>
        api.get(`${baseEndpoint}/analytics/dashboard?period=${period || 'last_30_days'}`, { token }),
      realtime: () => api.get(`${baseEndpoint}/analytics/realtime`, { token }),
      topProducts: (period?: string, limit?: number) =>
        api.get(`${baseEndpoint}/analytics/top-products?period=${period}&limit=${limit}`, { token }),
    },

    // Billing
    billing: {
      account: () => api.get(`${baseEndpoint}/billing/account`, { token }),
      topUp: (amount: number, paymentMethodId?: string) =>
        api.post(`${baseEndpoint}/billing/top-up`, { amount, paymentMethodId }, { token }),
      transactions: (params?: Record<string, string>) =>
        api.get(`${baseEndpoint}/billing/transactions?${new URLSearchParams(params)}`, { token }),
      statistics: () => api.get(`${baseEndpoint}/billing/statistics`, { token }),
    },

    // Settings
    settings: {
      get: () => api.get(`${baseEndpoint}`, { token }),
      update: (data: unknown) => api.patch(`${baseEndpoint}`, data, { token }),
    },

    // Integrations
    integrations: {
      status: () => api.get(`${baseEndpoint}/integrations/status`, { token }),
      pixels: {
        list: () => api.get(`${baseEndpoint}/integrations/pixels`, { token }),
        create: (data: unknown) => api.post(`${baseEndpoint}/integrations/pixels`, data, { token }),
        delete: (id: string) => api.delete(`${baseEndpoint}/integrations/pixels/${id}`, { token }),
      },
      webhooks: {
        list: () => api.get(`${baseEndpoint}/integrations/webhooks`, { token }),
        create: (data: unknown) => api.post(`${baseEndpoint}/integrations/webhooks`, data, { token }),
        delete: (id: string) => api.delete(`${baseEndpoint}/integrations/webhooks/${id}`, { token }),
        test: (id: string) => api.post(`${baseEndpoint}/integrations/webhooks/${id}/test`, {}, { token }),
      },
    },
  };
}

export default api;
