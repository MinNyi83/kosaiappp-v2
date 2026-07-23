# KosAI Reports - Customization Guide

## Overview

This guide explains how to customize the Excel report generator to match your needs.

## Files Created

| File | Description |
|------|-------------|
| `scripts/python/generate_reports.py` | Full report generator (connects to real database) |
| `scripts/python/generate_reports_demo.py` | Demo version with sample data |
| `REPORTS_CUSTOMIZATION_GUIDE.md` | This guide |

## Quick Start

### From Admin UI (Recommended)
1. Open the Admin Dashboard
2. Go to **Reports** tab
3. Click **Export All Excel** for quick export
4. Or click **Customize Reports** to select specific reports and style

### From Command Line
```bash
# Generate reports from real database
python scripts/python/generate_reports.py

# Generate demo reports (no database required)
python scripts/python/generate_reports_demo.py
```

## UI Features

### Export Buttons
- **Print Report** - Opens browser print dialog
- **Export All Excel** - Downloads all reports as .xlsx file
- **Customize Reports** - Opens customization modal

### Customization Modal
- **Style Presets**: Professional Blue, Modern Green, Corporate Gray, Warm Orange
- **Report Selection**: Choose which reports to include
- **Export Options**: Custom filename prefix

## Customizing Styles

### Color Palette
Edit the `ReportConfig.COLORS` dictionary in `generate_reports.py`:

```python
COLORS = {
    'primary': '1F4E79',      # Deep blue
    'secondary': '2E75B6',    # Medium blue
    'accent': 'FFC000',       # Gold
    'success': '00B050',      # Green
    'warning': 'FF6600',      # Orange
    'danger': 'FF0000',       # Red
}
```

### Fonts
Customize fonts in `ReportConfig.FONTS`:

```python
FONTS = {
    'title': Font(name='Calibri', size=16, bold=True, color='1F4E79'),
    'subtitle': Font(name='Calibri', size=12, bold=True, color='2E75B6'),
    'header': Font(name='Calibri', size=11, bold=True, color='FFFFFF'),
    'data': Font(name='Calibri', size=10),
    'total': Font(name='Calibri', size=11, bold=True, color='1F4E79'),
}
```

### Number Formats
Customize number formats in `ReportConfig.NUMBER_FORMATS`:

```python
NUMBER_FORMATS = {
    'currency_usd': '$#,##0.00',
    'currency_mmk': '#,##0.00 "Ks"',
    'percent': '0.0%',
    'number': '#,##0',
}
```

## Adding New Reports

### For UI Export (Admin Dashboard)

Add a new report generator function in `web/admin.js`:

```javascript
function generateMyCustomReport(lookups) {
  const data = lookups.my_table || [];
  return {
    name: 'My Custom Report',
    headers: ['Column 1', 'Column 2', 'Column 3'],
    data: data.map((item) => [item.col1, item.col2, item.col3]),
    summary: { 'Total Records': data.length },
  };
}
```

Then register it in the `allReports` object:

```javascript
const allReports = {
  // ... existing reports ...
  my_custom: () => generateMyCustomReport(lookups),
};
```

And add a checkbox in `admin.html`:

```html
<label class="flex items-center gap-2 text-slate-300 text-sm cursor-pointer hover:text-white">
  <input type="checkbox" checked value="my_custom" class="report-checkbox accent-emerald-500">
  My Custom Report
</label>
```

### For Python Script Export

Add a new method to the `ReportGenerator` class in `scripts/python/generate_reports.py`:

```python
def my_custom_report(self):
    """Description of the report."""
    data = self.db.query("""
        SELECT
            column1,
            column2,
            column3
        FROM my_table
        ORDER BY column1
    """)
    return {
        'title': 'My Custom Report',
        'subtitle': 'Description of what this report shows',
        'data': data,
        'columns': [
            ('column1', 'Column Header 1', 20),  # (field_name, display_name, width)
            ('column2', 'Column Header 2', 25),
            ('column3', 'Column Header 3', 15),
        ],
        'summary': {
            'total_records': len(data),
            'total_value': sum(r['column3'] or 0 for r in data),
        }
    }
```

### Step 2: Register the Report

Add your new report to the `reports` list in the `main()` function:

```python
reports = [
    # ... existing reports ...
    ("My Custom Report", generator.my_custom_report),
]
```

## Report Types Available (31 Reports)

### Inventory Reports (6)
- **Inventory Summary** - Complete stock levels and values
- **Inventory by Category** - Stock grouped by category
- **Inventory Value by Category** - Value analysis across categories
- **Low Stock Alert** - Items below threshold
- **Inventory by Batch** - Stock grouped by purchase batch
- **Batch Purchase Report** - Purchase batch details

### Client Reports (5)
- **Client Summary** - All clients with AMC status
- **AMC Breakdown** - Contract status distribution
- **Client Service History** - Services per client
- **Client-wise Job Summary** - Job distribution across clients
- **AMC Expiry Alert** - Contracts expiring within 60 days

### Service/Job Reports (7)
- **Service Summary** - All service records
- **Services by Type** - Jobs grouped by service type
- **Services by Status** - Jobs grouped by status
- **Monthly Service Trend** - Job volume over time
- **Monthly Job Trend** - Detailed monthly job analysis
- **Job Duration Analysis** - Time taken for completed jobs
- **Service Status Timeline** - Status changes over time

### Technician Reports (4)
- **Technician Summary** - Technician profiles
- **Technician Performance** - Completion rates
- **Technician Workload** - Current job allocation
- **Technician Workload Detail** - Detailed workload breakdown

### Financial Reports (4)
- **Cash Safe Summary** - Safe balances
- **Cash Transactions** - Transaction history
- **Monthly Cash Flow** - Cash flow trends
- **Service Fees** - Pricing schedule

### Warranty & Device Reports (5)
- **Warranty Status** - Device warranty tracking
- **Warranty Expiry Alert** - Devices expiring within 60 days
- **RMA Tracking** - Devices under RMA process
- **Device Installation Log** - Installation history
- **Device Status Overview** - Distribution of device statuses

### Dashboard (1)
- **Operational Dashboard** - High-level metrics
- **Monthly Service Trend** - Job volume over time

### Technician Reports
- **Technician Summary** - Technician profiles
- **Technician Performance** - Completion rates
- **Technician Workload** - Current job allocation

### Financial Reports
- **Cash Safe Summary** - Safe balances
- **Cash Transactions** - Transaction history
- **Monthly Cash Flow** - Cash flow trends
- **Service Fees** - Pricing schedule

### Warranty & RMA Reports
- **Warranty Status** - Device warranty tracking
- **RMA Tracking** - Devices under RMA process
- **Device Installation Log** - Installation history

### Dashboard
- **Operational Dashboard** - High-level metrics

## Modifying Existing Reports

### Change Column Order
Reorder the tuples in the `columns` list:

```python
'columns': [
    ('column2', 'Column 2', 20),  # Moved to first
    ('column1', 'Column 1', 25),  # Moved to second
]
```

### Add/Remove Columns
Add or remove tuples from the `columns` list:

```python
'columns': [
    ('column1', 'Column 1', 20),
    # Removed column2
    ('column3', 'Column 3', 15),  # Added new column
]
```

### Change Column Widths
Adjust the third value in each tuple:

```python
('column1', 'Column 1', 30),  # Changed from 20 to 30
```

### Add Summary Metrics
Add new calculations to the `summary` dictionary:

```python
'summary': {
    'existing_metric': len(data),
    'new_metric': sum(r['column'] or 0 for r in data),
    'average': sum(r['column'] or 0 for r in data) / len(data) if data else 0,
}
```

## Styling Customization

### Change Header Background Color
```python
FILLS = {
    'header': PatternFill(start_color='YOUR_COLOR', end_color='YOUR_COLOR', fill_type='solid'),
}
```

### Change Alternating Row Color
```python
FILLS = {
    'alt_row': PatternFill(start_color='YOUR_COLOR', end_color='YOUR_COLOR', fill_type='solid'),
}
```

### Change Border Style
```python
BORDER = Border(
    left=Side(style='medium', color='000000'),  # Changed from 'thin'
    right=Side(style='medium', color='000000'),
    top=Side(style='medium', color='000000'),
    bottom=Side(style='medium', color='000000'),
)
```

## Color Presets

### In Admin UI
Choose from the customization modal:
- **Professional Blue** - Deep blue headers, clean look
- **Modern Green** - Fresh green, eco-friendly feel
- **Corporate Gray** - Neutral, professional
- **Warm Orange** - energetic, attention-grabbing

### In Python Script
Edit the `COLORS` dictionary in `ReportConfig`:

```python
COLORS = {
    'primary': '1F4E79',      # Professional Blue
    'secondary': '2E75B6',
    'accent': 'FFC000',
    'success': '00B050',
    'warning': 'FF6600',
    'danger': 'FF0000',
}
```

### Custom Presets
Add your own preset to `reportStyles` in `web/admin.js`:

```javascript
const reportStyles = {
  // ... existing presets ...
  myBrand: {
    primary: 'YOUR_PRIMARY_COLOR',
    secondary: 'YOUR_SECONDARY_COLOR',
    accent: 'YOUR_ACCENT_COLOR',
    headerBg: 'YOUR_HEADER_BG',
    headerFont: 'FFFFFF',
    altRow: 'YOUR_ALT_ROW',
  },
};
```

## Troubleshooting

### "Database not found" Error
Ensure the local D1 database exists at:
```
.wrangler/state/v3/d1/miniflare-D1DatabaseObject/...
```

### Sheet Name Errors
Excel sheet names cannot contain: `: / \ ? * [ ]`
The generator automatically removes these characters.

### Missing Data
Check that your database tables have the expected columns by running:
```sql
SELECT sql FROM sqlite_master WHERE type='table';
```

## Support

For issues or questions, check:
1. Database connection and table structure
2. Python package versions (`pip install openpyxl`)
3. File permissions for output directory
