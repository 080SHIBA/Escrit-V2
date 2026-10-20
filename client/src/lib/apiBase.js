const configuredBase = import.meta.env?.DEV ? '' : import.meta.env?.VITE_API_URL || '';

export const API_BASE = configuredBase.replace(/\/+$/, '');

export function apiUrl(path) {
  return joinApiUrl(path, API_BASE);
}

export function joinApiUrl(path, base) {
  return `${base.replace(/\/+$/, '')}${path}`;
}
