/**
 * Automated Bill of Materials (BOM) Translation Engine
 * Returns categorized items ready for quotation_items table
 */
export interface SurveyBOMInput {
  camera_count: number;
  cat6_meters: number;
  retention_days?: number;
  resolution?: '1080p' | '2K' | '4K';
  ups_required?: boolean;
  poe_switch_required?: boolean;
}

export interface BOMItem {
  item_code: string;
  name: string;
  category: 'hardware' | 'cable' | 'labor' | 'software' | 'other';
  quantity: number;
  unit_price: number;
  unit: string;
  subtotal: number;
}

export function generateAutomatedBOM(input: SurveyBOMInput): { items: BOMItem[]; total_usd: number } {
  const cameraCount = Math.max(1, input.camera_count || 1);
  const cableMeters = Math.max(50, input.cat6_meters || 100);
  const retentionDays = input.retention_days || 30;
  const resolution = input.resolution || '1080p';
  const upsRequired = input.ups_required !== false;
  const poeRequired = input.poe_switch_required !== false;

  const items: BOMItem[] = [];

  // 1. Cameras
  const cameraUnitPrice = resolution === '4K' ? 85 : 35;
  const cameraCode = resolution === '4K' ? 'CAM-4K-COLORVU' : 'CAM-1080P-DOM';
  items.push({
    item_code: cameraCode,
    name: `${resolution} Night Vision CCTV Camera`,
    category: 'hardware',
    quantity: cameraCount,
    unit_price: cameraUnitPrice,
    unit: 'pc',
    subtotal: cameraCount * cameraUnitPrice,
  });

  // 2. NVR Recording Unit
  const nvrChannels = cameraCount <= 8 ? 8 : cameraCount <= 16 ? 16 : 32;
  const nvrUnitPrice = nvrChannels === 8 ? 120 : nvrChannels === 16 ? 220 : 450;
  items.push({
    item_code: `NVR-${nvrChannels}CH`,
    name: `${nvrChannels}-Channel Network Video Recorder`,
    category: 'hardware',
    quantity: 1,
    unit_price: nvrUnitPrice,
    unit: 'pc',
    subtotal: nvrUnitPrice,
  });

  // 3. Storage Hard Drive (approx 40GB/day per 1080p camera stream)
  const totalStorageTB = Math.ceil((cameraCount * 40 * retentionDays) / 1000);
  const hddSize = totalStorageTB <= 2 ? 2 : totalStorageTB <= 4 ? 4 : 8;
  const hddUnitPrice = hddSize * 30;
  const hddQty = Math.max(1, Math.ceil(totalStorageTB / hddSize));
  items.push({
    item_code: `HDD-PURPLE-${hddSize}TB`,
    name: `Surveillance Grade Hard Drive ${hddSize}TB`,
    category: 'hardware',
    quantity: hddQty,
    unit_price: hddUnitPrice,
    unit: 'pc',
    subtotal: hddQty * hddUnitPrice,
  });

  // 4. Cat6 Copper Cabling (305m per box)
  const cableBoxes = Math.ceil(cableMeters / 305);
  items.push({
    item_code: 'CAB-CAT6-UTP',
    name: 'Cat6 UTP Copper Cable Box (305m)',
    category: 'cable',
    quantity: cableBoxes,
    unit_price: 85,
    unit: 'box',
    subtotal: cableBoxes * 85,
  });

  // 5. PoE Switch
  if (poeRequired) {
    const poePorts = cameraCount <= 8 ? 8 : 16;
    const poeUnitPrice = poePorts === 8 ? 95 : 180;
    items.push({
      item_code: `SW-POE-${poePorts}P`,
      name: `${poePorts}-Port Gigabit PoE+ Switch`,
      category: 'hardware',
      quantity: 1,
      unit_price: poeUnitPrice,
      unit: 'pc',
      subtotal: poeUnitPrice,
    });
  }

  // 6. UPS Power Backup
  if (upsRequired) {
    items.push({
      item_code: 'UPS-1000VA',
      name: '1000VA Line-Interactive UPS Power Backup',
      category: 'hardware',
      quantity: 1,
      unit_price: 110,
      unit: 'pc',
      subtotal: 110,
    });
  }

  // 7. Installation Labor
  const laborUnitPrice = 25;
  items.push({
    item_code: 'SRV-LABOR-CAM',
    name: 'Professional Camera Mounting & Cabling Labor',
    category: 'labor',
    quantity: cameraCount,
    unit_price: laborUnitPrice,
    unit: 'hr',
    subtotal: cameraCount * laborUnitPrice,
  });

  const total_usd = items.reduce((sum, item) => sum + item.subtotal, 0);
  return { items, total_usd };
}
