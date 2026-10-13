import axios from 'axios';

const appBaseUrl = import.meta.env.BASE_URL.endsWith('/')
	? import.meta.env.BASE_URL
	: `${import.meta.env.BASE_URL}/`;
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredApiBaseUrl || `${appBaseUrl}api`).replace(/\/+$/, '');

export function apiUrl(path) {
	return `${API_BASE_URL}/${String(path).replace(/^\/+/, '')}`;
}

export const http = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });
