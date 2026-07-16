/**
 * Simple Router — maps HTTP methods + URL patterns to handlers.
 * Supports named parameters (e.g. /api/clients/:id) and query strings.
 */

class Router {
  constructor() {
    this.routes = [];
  }

  /** Register a route handler */
  _register(method, path, handler) {
    // Convert /api/clients/:id → regex with named capture groups
    const paramNames = [];
    const regexStr = path.replace(/:([a-zA-Z_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);
    this.routes.push({ method, regex, paramNames, handler });
  }

  get(path, handler) {
    this._register('GET', path, handler);
  }
  post(path, handler) {
    this._register('POST', path, handler);
  }
  put(path, handler) {
    this._register('PUT', path, handler);
  }
  patch(path, handler) {
    this._register('PATCH', path, handler);
  }
  delete(path, handler) {
    this._register('DELETE', path, handler);
  }

  /**
   * Match an incoming request to a route and return the handler + params.
   * @param {string} method
   * @param {string} pathname
   * @returns {{ handler: Function, params: Record<string,string> } | null}
   */
  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

export { Router };
