/**
 * Simple Router — maps HTTP methods + URL patterns to handlers.
 * Supports named parameters (e.g. /api/clients/:id) and query strings.
 */

type RouteHandler = (request: any, params: Record<string, string>) => any;

interface Route {
  method: string;
  regex: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

class Router {
  routes: Route[];

  constructor() {
    this.routes = [];
  }

  /** Register a route handler */
  _register(method: string, path: string, handler: RouteHandler) {
    // Convert /api/clients/:id → regex with named capture groups
    const paramNames: string[] = [];
    const regexStr = path.replace(/:([a-zA-Z_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);
    this.routes.push({ method, regex, paramNames, handler });
  }

  get(path: string, handler: RouteHandler) {
    this._register('GET', path, handler);
  }
  post(path: string, handler: RouteHandler) {
    this._register('POST', path, handler);
  }
  put(path: string, handler: RouteHandler) {
    this._register('PUT', path, handler);
  }
  patch(path: string, handler: RouteHandler) {
    this._register('PATCH', path, handler);
  }
  delete(path: string, handler: RouteHandler) {
    this._register('DELETE', path, handler);
  }

  /**
   * Match an incoming request to a route and return the handler + params.
   */
  match(method: string, pathname: string): { handler: RouteHandler, params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.regex);
      if (match) {
        const params: Record<string, string> = {};
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

