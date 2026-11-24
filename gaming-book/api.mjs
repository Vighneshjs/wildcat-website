import { API } from './config.mjs';
export const dateInIndia = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
export const rupees = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
export async function request(path, body, token) {
  if (!API) throw new Error('Online booking is currently unavailable. Please call the shop.');
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(API + path, {
    method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The booking service is unavailable.');
  return result;
}
