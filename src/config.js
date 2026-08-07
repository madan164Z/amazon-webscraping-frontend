const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

/**
 * Builds a full API URL from a path.
 * @param {string} path - Path starting with '/', e.g. '/api/rank'.
 * @returns {string} Absolute URL if VITE_API_BASE_URL is set, otherwise
 *   a relative path resolved against the current origin.
 */
export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
