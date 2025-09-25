import { API_URL } from './api';

// API client functions
export const apiClient = {
  // Auth endpoints
  login: (email: string, password: string) => 
    fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string, organization?: string) =>
    fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, organization }),
    }),

  refresh: (refreshToken: string) =>
    fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }),

  profile: (accessToken: string) =>
    fetch(`${API_URL}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }),

  verifyEmail: (email: string, code: string, password: string, name: string, organization?: string) =>
    fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, password, name, organization }),
    }),

  forgotPassword: (email: string) =>
    fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    }),

  // Befund endpoints
  getBefundHistory: (accessToken: string) =>
    fetch(`${API_URL}/api/befund-history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }),

  saveBefund: (accessToken: string, data: any) =>
    fetch(`${API_URL}/api/befund-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    }),

  deleteBefund: (accessToken: string, befundId: string) =>
    fetch(`${API_URL}/api/befund-history/${befundId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }),

  // Layout endpoints
  getLayouts: (accessToken: string) =>
    fetch(`${API_URL}/layouts`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }),

  saveLayout: (accessToken: string, layout: any) =>
    fetch(`${API_URL}/layouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(layout),
    }),

  updateLayout: (accessToken: string, layoutId: string, layout: any) =>
    fetch(`${API_URL}/layouts/${layoutId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(layout),
    }),

  deleteLayout: (accessToken: string, layoutId: string) =>
    fetch(`${API_URL}/layouts/${layoutId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }),

  // Processing endpoint
  processStructured: (accessToken: string, data: any) =>
    fetch(`${API_URL}/structured`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    }),
};
