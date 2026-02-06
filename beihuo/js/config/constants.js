// 字段映射配置（Excel表头 -> 内部字段名）
const FIELD_MAPPING = {
  '图片链接': 'imageUrl',
  '图片': 'imageUrl',
  '供货方号': 'supplierCode',
  '供货方': 'supplierCode',
  'SKC': 'skc',
  'SKU': 'sku',
  '商家SKU': 'merchantSku',
  '属性集': 'attributes',
  '属性': 'attributes',
  '质量等级': 'qualityLevel',
  '质量': 'qualityLevel',
  'SHEIN仓库存': 'sheinStock',
  'SHEIN库存': 'sheinStock',
  '在仓': 'sheinStock',
  '近7天销量': 'sales7Days',
  '7天销量': 'sales7Days',
  '货期': 'leadTime',
  '备货天数': 'bufferDays',
  '备货': 'bufferDays',
  '待发货': 'pendingShipment',
  '在途': 'inTransit',
  '待上架': 'pendingShelf',
  '低销尾品不允许下单': 'lowSalesNotAllowed'
};

// 必需字段列表
const REQUIRED_FIELDS = ['sku', 'sales7Days', 'leadTime', 'bufferDays', 'pendingShipment', 'inTransit', 'pendingShelf', 'sheinStock'];

// SheetJS CDN源配置
const XLSX_CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/xlsx@0.20.1/dist/xlsx.full.min.js',
  'https://unpkg.com/xlsx@0.20.1/dist/xlsx.full.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
];

// 批量渲染配置
const BATCH_SIZE = 50;
