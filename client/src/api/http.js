import axios from 'axios';

// Mọi request tới server đi qua đây: http.get('/weather', { params: {...} })
export const http = axios.create({ baseURL: '/api', timeout: 10000 });
