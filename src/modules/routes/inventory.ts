/**
 * Inventory Routes — Thin handlers delegating to InventoryService
 */

import { success, error } from '../utils/response.js';
import { authenticate, requireCsrf } from '../utils/auth-middleware.js';
import { InventoryService } from '../services/inventory.service.js';

function register(router, env) {
  const db = env.DB;
  const inventoryService = new InventoryService(db);

  // ── GET /api/inventory ────────────────────────────────────────────────
  router.get('/api/inventory', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const url = new URL(request.url);
      const result = await inventoryService.list({
        search: url.searchParams.get('search') || undefined,
        category: url.searchParams.get('category') || undefined,
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '200'),
      });
      return success(result);
    } catch (err: any) {
      console.error('Fetch inventory error:', err.message);
      return error('Failed to fetch inventory', 500);
    }
  });

  // ── GET /api/inventory/low-stock ──────────────────────────────────────
  router.get('/api/inventory/low-stock', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const items = await inventoryService.getLowStock();
      return success(items);
    } catch (err: any) {
      console.error('Fetch low stock error:', err.message);
      return error('Failed to fetch low stock items', 500);
    }
  });

  // ── GET /api/inventory/categories ─────────────────────────────────────
  router.get('/api/inventory/categories', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const categories = await inventoryService.getCategories();
      return success(categories);
    } catch (err: any) {
      console.error('Fetch categories error:', err.message);
      return error('Failed to fetch categories', 500);
    }
  });

  // ── GET /api/inventory/:id ────────────────────────────────────────────
  router.get('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const item = await inventoryService.getById(params.id);
      if (!item) return error('Inventory item not found', 404);
      return success(item);
    } catch (err: any) {
      console.error('Fetch item error:', err.message);
      return error('Failed to fetch item', 500);
    }
  });

  // ── POST /api/inventory & /api/admin/inventory/add ────────────────────
  const addInventoryHandler = async (request: any) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      if (!body.item_code && !body.sku || !body.item_name && !body.name) {
        return error('Missing required fields: item_code (sku), item_name (name)', 400);
      }

      const result = await inventoryService.create({
        item_code: body.item_code || body.sku || '',
        item_name: body.item_name || body.name || '',
        category: body.category || '',
        sub_category_id: body.sub_category_id,
        brand_id: body.brand_id,
        stocking_um: body.stocking_um || body.unit,
        stock_qty: body.stock_qty || body.quantity,
        unit_price: body.unit_price || body.selling_price,
        unit_price_mmk: body.unit_price_mmk,
        buying_price: body.buying_price || body.cost_price,
        batch_code: body.batch_code,
      });
      return success(result, 201);
    } catch (err: any) {
      console.error('Save inventory error:', err.message);
      return error('Failed to save inventory item', 500);
    }
  };

  router.post('/api/inventory', addInventoryHandler);
  router.post('/api/admin/inventory/add', addInventoryHandler);

  // ── PUT /api/inventory/:id ────────────────────────────────────────────
  router.put('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const existing = await inventoryService.getById(params.id);
      if (!existing) return error('Inventory item not found', 404);

      const body = (await request.json()) as any;
      const updated = await inventoryService.update(params.id, body);
      if (!updated) return error('No fields to update', 400);
      return success({ message: 'Inventory item updated' });
    } catch (err: any) {
      console.error('Update inventory error:', err.message);
      return error('Failed to update inventory item', 500);
    }
  });

  // ── DELETE /api/inventory/:id & /api/admin/inventory/delete ───────────
  router.delete('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      await inventoryService.delete(params.id);
      return success({ message: 'Inventory item deleted' });
    } catch (err: any) {
      console.error('Delete inventory error:', err.message);
      return error('Failed to delete inventory item', 500);
    }
  });

  router.post('/api/admin/inventory/delete', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const { item_code } = (await request.json()) as any;
      if (!item_code) return error('Missing item_code', 400);
      await inventoryService.delete(item_code);
      return success({ message: 'Inventory item deleted' });
    } catch (err: any) {
      console.error('Delete inventory error:', err.message);
      return error('Failed to delete inventory item', 500);
    }
  });

  // ── POST /api/inventory/:id/adjust ────────────────────────────────────
  router.post('/api/inventory/:id/adjust', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const { quantity_change, reason } = (await request.json()) as any;
      if (quantity_change === undefined) return error('Missing quantity_change', 400);

      const result = await inventoryService.adjustStock(params.id, quantity_change, user.id, reason);
      if (result.error === 'not_found') return error('Inventory item not found', 404);
      if (result.error === 'insufficient_stock') return error('Insufficient stock', 400);
      if (result.error) return error(result.error, 400);
      return success(result);
    } catch (err: any) {
      console.error('Adjust inventory error:', err.message);
      return error('Failed to adjust inventory', 500);
    }
  });

  // ── GET /api/admin/inventory/list ────────────────────────────────────
  router.get('/api/admin/inventory/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const url = new URL(request.url);
      const result = await inventoryService.list({
        search: url.searchParams.get('search') || undefined,
        category: url.searchParams.get('category') || undefined,
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '50'),
      });
      return success(result);
    } catch (err: any) {
      console.error('Fetch inventory list error:', err.message);
      return error('Failed to fetch inventory list', 500);
    }
  });

  // ── GET /api/admin/inventory/batches ──────────────────────────────────
  router.get('/api/admin/inventory/batches', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const batches = await inventoryService.getBatches();
      return success(batches);
    } catch (err: any) {
      console.error('Fetch batches error:', err.message);
      return error('Failed to fetch batches', 500);
    }
  });

  // ── GET /api/admin/inventory/categories ───────────────────────────────
  router.get('/api/admin/inventory/categories', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const categories = await inventoryService.getInventoryCategories();
      return success(categories);
    } catch (err: any) {
      console.error('Fetch categories error:', err.message);
      return error('Failed to fetch categories', 500);
    }
  });

  // ── GET /api/admin/inventory/sub-categories ───────────────────────────
  router.get('/api/admin/inventory/sub-categories', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const subCategories = await inventoryService.getSubCategories();
      return success(subCategories);
    } catch (err: any) {
      console.error('Fetch sub-categories error:', err.message);
      return error('Failed to fetch sub-categories', 500);
    }
  });

  // ── GET /api/admin/inventory/brands ───────────────────────────────────
  router.get('/api/admin/inventory/brands', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const brands = await inventoryService.getBrands();
      return success(brands);
    } catch (err: any) {
      console.error('Fetch brands error:', err.message);
      return error('Failed to fetch brands', 500);
    }
  });

  // ── GET /api/admin/inventory/units ────────────────────────────────────
  router.get('/api/admin/inventory/units', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const units = await inventoryService.getUnits();
      return success(units);
    } catch (err: any) {
      console.error('Fetch units error:', err.message);
      return error('Failed to fetch units', 500);
    }
  });

  // ── GET /api/admin/warranty/list ──────────────────────────────────────
  router.get('/api/admin/warranty/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const warranties = await inventoryService.getWarrantyList();
      return success(warranties);
    } catch (err: any) {
      console.error('Fetch warranties error:', err.message);
      return error('Failed to fetch warranties', 500);
    }
  });

  // ── POST /api/admin/warranty/register ─────────────────────────────────
  router.post('/api/admin/warranty/register', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { serial_number, device_name, client_id, installed_date, warranty_months } = body;
      if (!serial_number || !device_name) {
        return error('Missing required fields: serial_number, device_name', 400);
      }

      const result = await inventoryService.registerWarranty({ serial_number, device_name, client_id, installed_date, warranty_months });
      if (result.error === 'already_registered') return error('Warranty already registered for this serial number', 409);
      return success(result, 201);
    } catch (err: any) {
      console.error('Register warranty error:', err.message);
      return error('Failed to register warranty', 500);
    }
  });

  // ── GET /api/warranty/lookup/:serial ──────────────────────────────────
  router.get('/api/warranty/lookup/:serial', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const item = await inventoryService.lookupWarranty(params.serial);
      if (!item) return error('Serial number not found', 404);
      return success(item);
    } catch (err: any) {
      console.error('Lookup warranty error:', err.message);
      return error('Failed to lookup warranty', 500);
    }
  });

  // ── POST /api/warranty/register ──────────────────────────────────────
  router.post('/api/warranty/register', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { serial_number, device_name, client_id, job_id, warranty_months } = body;
      if (!serial_number || !device_name) {
        return error('Missing required fields: serial_number, device_name', 400);
      }

      const result = await inventoryService.registerWarranty({ serial_number, device_name, client_id, job_id, warranty_months });
      if (result.error === 'already_registered') return error('Warranty already registered for this serial number', 409);
      return success(result, 201);
    } catch (err: any) {
      console.error('Register warranty error:', err.message);
      return error('Failed to register warranty', 500);
    }
  });

  // ── GET /api/admin/rma/list ───────────────────────────────────────────
  router.get('/api/admin/rma/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const rmaList = await inventoryService.getRmaList();
      return success(rmaList);
    } catch (err: any) {
      console.error('Fetch RMA error:', err.message);
      return error('Failed to fetch RMA records', 500);
    }
  });

  // ── POST /api/admin/rma/raise ─────────────────────────────────────────
  router.post('/api/admin/rma/raise', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { serial_number, distributor, rma_id, sent_date } = body;
      if (!serial_number) return error('Missing required field: serial_number', 400);

      const result = await inventoryService.raiseRma(serial_number, distributor, rma_id, sent_date);
      if (result.error === 'not_found') return error('Serial number not found in inventory', 404);
      return success(result);
    } catch (err: any) {
      console.error('Raise RMA error:', err.message);
      return error('Failed to raise RMA claim', 500);
    }
  });

  // ── POST /api/admin/rma/update ────────────────────────────────────────
  router.post('/api/admin/rma/update', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { serial_number, status, distributor, rma_tracking_id } = body;
      if (!serial_number) return error('Missing required field: serial_number', 400);

      const result = await inventoryService.updateRma(serial_number, status, distributor, rma_tracking_id);
      if (result.error) return error(result.error, 400);
      return success(result);
    } catch (err: any) {
      console.error('Update RMA error:', err.message);
      return error('Failed to update RMA', 500);
    }
  });

  // ── POST /api/admin/inventory/catalog/price ───────────────────────────
  router.post('/api/admin/inventory/catalog/price', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { item_code, unit_price, unit_price_mmk } = body;
      if (!item_code) return error('Missing item_code', 400);

      const result = await inventoryService.updatePrice(item_code, unit_price, unit_price_mmk);
      return success(result);
    } catch (err: any) {
      console.error('Update price error:', err.message);
      return error('Failed to update price', 500);
    }
  });

  // ── POST /api/admin/inventory/batches/create ──────────────────────────
  router.post('/api/admin/inventory/batches/create', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const result = await inventoryService.createBatch({
        batch_code: body.batch_code,
        item_code: body.item_code,
        buying_price: body.buying_price,
        supplier: body.supplier,
        serials: body.serials,
        quantity: body.quantity || body.manual_qty,
      });
      if (result.error) return error(result.error, 400);
      return success(result);
    } catch (err: any) {
      console.error('Register batch error:', err.message);
      return error('Failed to register batch', 500);
    }
  });

  // ── POST /api/admin/inventory/batches/edit ────────────────────────────
  router.post('/api/admin/inventory/batches/edit', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const result = await inventoryService.editBatch({
        batch_code: body.batch_code,
        buying_price: body.buying_price,
        supplier: body.supplier,
        quantity: body.quantity,
      });
      if (result.error) return error(result.error, 400);
      return success(result);
    } catch (err: any) {
      console.error('Edit batch error:', err.message);
      return error('Failed to edit batch', 500);
    }
  });
}

export { register };
