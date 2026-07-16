/**
 * Google Routes — Google Sign-In auth, Drive OAuth, Maps URL resolver
 */

import { success, error } from '../utils/response.js';
import { verifyToken, signToken } from '../utils/jwt.js';

function register(router, env) {
  const db = env.DB;

  // ── POST /api/auth/google ─────────────────────────────────────────────
  router.post('/api/auth/google', async (request) => {
    try {
      const { credential, client_id } = await request.json();
      if (!credential) return error('Missing Google credential', 400);

      // Verify Google token
      const ticketResp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
      );
      const ticketData = await ticketResp.json();

      if (ticketData.error) return error('Invalid Google token', 401);

      const googleId = ticketData.sub;
      const email = ticketData.email;
      const name = ticketData.name;

      // Find or create technician
      let tech = await db
        .prepare('SELECT * FROM technicians WHERE google_id = ? OR email = ?')
        .bind(googleId, email)
        .first();

      if (!tech) {
        // Auto-register with Google
        const id = 'TECH-' + Date.now().toString(36).toUpperCase();
        await db
          .prepare(
            "INSERT INTO technicians (id, name, email, google_id, role, active) VALUES (?, ?, ?, ?, 'technician', 1)"
          )
          .bind(id, name, email, googleId)
          .run();
        tech = await db.prepare('SELECT * FROM technicians WHERE id = ?').bind(id).first();
      } else if (!tech.google_id) {
        // Link Google account
        await db
          .prepare('UPDATE technicians SET google_id = ? WHERE id = ?')
          .bind(googleId, tech.id)
          .run();
      }

      const token = await signToken({
        id: tech.id,
        name: tech.name,
        role: tech.role,
        email: tech.email,
      });

      return success({
        token,
        technician: {
          id: tech.id,
          name: tech.name,
          email: tech.email,
          role: tech.role,
        },
      });
    } catch (err) {
      return error('Google sign-in failed: ' + err.message, 500);
    }
  });

  // ── POST /api/auth/login-password ─────────────────────────────────────
  router.post('/api/auth/login-password', async (request) => {
    try {
      const { username, password } = await request.json();
      if (!username || !password) return error('Missing username or password', 400);

      const tech = await db
        .prepare('SELECT * FROM technicians WHERE (email = ? OR id = ?) AND active = 1')
        .bind(username, username)
        .first();

      if (!tech) return error('Invalid credentials', 401);

      // Verify password using Web Crypto API
      const encoder = new TextEncoder();
      const [_, algo, storedSalt, storedHash] =
        tech.pin.match(/^\$(sha256)\$([a-f0-9]+)\$([a-f0-9]+)$/) || [];
      if (algo === 'sha256') {
        const pinData = encoder.encode(password + storedSalt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', pinData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        if (computedHash !== storedHash) return error('Invalid credentials', 401);
      } else {
        return error('Unknown hash algorithm', 500);
      }

      const token = await signToken({
        id: tech.id,
        name: tech.name,
        role: tech.role,
        email: tech.email,
      });

      return success({
        token,
        technician: {
          id: tech.id,
          name: tech.name,
          email: tech.email,
          role: tech.role,
        },
      });
    } catch (err) {
      return error('Login failed: ' + err.message, 500);
    }
  });

  // ── GET /api/auth/google/drive-url ────────────────────────────────────
  router.get('/api/auth/google/drive-url', async () => {
    try {
      const clientId = env.GOOGLE_CLIENT_ID;
      const redirectUri = `${env.BASE_URL || 'https://kosai.app'}/api/auth/google/drive-callback`;

      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set(
        'scope',
        'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
      );
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');

      return success({ auth_url: url.toString() });
    } catch (err) {
      return error('Failed to generate Drive URL: ' + err.message, 500);
    }
  });

  // ── GET /api/auth/google/drive-callback ───────────────────────────────
  router.get('/api/auth/google/drive-callback', async (request) => {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');

      if (!code) return error('Missing authorization code', 400);

      // Exchange code for tokens
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${env.BASE_URL || 'https://kosai.app'}/api/auth/google/drive-callback`,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResp.json();

      // Store refresh token
      if (tokens.refresh_token) {
        await db
          .prepare(
            "INSERT INTO system_config (key, value) VALUES ('google_drive_refresh_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
          )
          .bind(tokens.refresh_token)
          .run();
      }

      return success({
        message: 'Google Drive connected successfully',
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
      });
    } catch (err) {
      return error('OAuth callback failed: ' + err.message, 500);
    }
  });

  // ── POST /api/resolve-maps-url ────────────────────────────────────────
  router.post('/api/resolve-maps-url', async (request) => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
      const user = await verifyToken(authHeader.slice(7));
      if (!user) return error('Unauthorized', 401);

      const { url } = await request.json();
      if (!url) return error('Missing Google Maps URL', 400);

      // Parse coordinates from Google Maps URL
      // Format: https://www.google.com/maps/place/.../@lat,lng,...
      const coordsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordsMatch) {
        return success({
          latitude: parseFloat(coordsMatch[1]),
          longitude: parseFloat(coordsMatch[2]),
          source: 'parsed',
        });
      }

      // Try Geocoding API as fallback
      if (env.GOOGLE_MAPS_API_KEY) {
        const geoResp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(url)}&key=${env.GOOGLE_MAPS_API_KEY}`
        );
        const geoData = await geoResp.json();
        if (geoData.results?.[0]?.geometry?.location) {
          return success({
            latitude: geoData.results[0].geometry.location.lat,
            longitude: geoData.results[0].geometry.location.lng,
            formatted_address: geoData.results[0].formatted_address,
            source: 'geocoding',
          });
        }
      }

      return error('Could not resolve coordinates from URL', 400);
    } catch (err) {
      return error('Failed to resolve Maps URL: ' + err.message, 500);
    }
  });
}

export { register };
