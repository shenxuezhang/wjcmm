// Excel文件解析工具
const FileParser = {
  // 解析表头映射
  parseHeaders(headers) {
    const headerMap = {};
    
    headers.forEach((header, index) => {
      if (header) {
        const normalizedHeader = String(header).trim();
        let matched = false;
        
        // 优先精确匹配
        for (const [excelField, internalField] of Object.entries(FIELD_MAPPING)) {
          if (normalizedHeader === excelField) {
            if (headerMap[internalField] !== undefined) {
              const prevHeader = headers[headerMap[internalField]];
              if (prevHeader && String(prevHeader).trim() === excelField) {
                continue;
              }
            }
            headerMap[internalField] = index;
            matched = true;
            break;
          }
        }
        
        // 模糊匹配
        if (!matched) {
          for (const [excelField, internalField] of Object.entries(FIELD_MAPPING)) {
            if (normalizedHeader.includes(excelField) || excelField.includes(normalizedHeader)) {
              if (this.shouldSkipMatch(excelField, normalizedHeader, headerMap, headers, internalField)) {
                continue;
              }
              headerMap[internalField] = index;
              break;
            }
          }
        }
      }
    });
    
    return headerMap;
  },

  // 判断是否应该跳过匹配
  shouldSkipMatch(excelField, normalizedHeader, headerMap, headers, internalField) {
    // 避免商家SKU被误识别为SKU
    if (excelField === 'SKU' && normalizedHeader.includes('商家')) {
      return true;
    }
    
    // 避免SKC被其他包含"SKC"的字段误匹配
    if (excelField === 'SKC' && normalizedHeader !== 'SKC' && normalizedHeader.includes('SKC')) {
      if (!normalizedHeader.match(/^SKC$/i)) {
        return true;
      }
    }
    
    // 避免"SKC近7天销量"被误识别为"近7天销量"
    if (excelField === '近7天销量' && normalizedHeader.includes('SKC') && normalizedHeader !== '近7天销量') {
      return true;
    }
    
    // 避免"7天销量"被"SKC近7天销量"误匹配
    if (excelField === '7天销量' && normalizedHeader.includes('SKC') && normalizedHeader !== '7天销量') {
      return true;
    }
    
    // 避免"备货标准"被误识别为"备货天数"
    if ((excelField === '备货天数' || excelField === '备货') && normalizedHeader === '备货标准') {
      return true;
    }
    
    // 如果该字段已经通过精确匹配映射过，不再用模糊匹配覆盖
    if (headerMap[internalField] !== undefined) {
      const prevHeader = headers[headerMap[internalField]];
      if (prevHeader && FIELD_MAPPING[String(prevHeader).trim()] === internalField) {
        return true;
      }
    }
    
    return false;
  },

  // 验证必需字段
  validateRequiredFields(headerMap) {
    const missingFields = REQUIRED_FIELDS.filter(field => headerMap[field] === undefined);
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  },

  // 读取SKC字段（防止被转换为科学计数法）
  readSKCField(sheet, rowIndex, skcIndex) {
    if (skcIndex === undefined) return '';
    
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: skcIndex });
    const cell = sheet[cellAddress];
    
    if (cell) {
      if (cell.w !== undefined && cell.w !== null && cell.w !== '') {
        return String(cell.w).trim();
      } else if (cell.v !== undefined && cell.v !== null) {
        return String(cell.v).trim();
      }
    }
    
    return '';
  },

  // 安全解析数值字段
  parseNumber(value) {
    if (value === undefined || value === null || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  },

  // 解析产品数据行
  parseProductRow(row, headerMap, sheet, rowIndex) {
    const skcIndex = headerMap['skc'];
    const skcStr = this.readSKCField(sheet, rowIndex, skcIndex);
    
    return {
      imageUrl: row[headerMap['imageUrl']] !== undefined ? String(row[headerMap['imageUrl']]).trim() : '',
      supplierCode: row[headerMap['supplierCode']] !== undefined ? String(row[headerMap['supplierCode']]).trim() : '',
      skc: skcStr || (row[skcIndex] !== undefined ? String(row[skcIndex]).trim() : ''),
      sku: row[headerMap['sku']] !== undefined ? String(row[headerMap['sku']]).trim() : '',
      attributes: row[headerMap['attributes']] !== undefined ? String(row[headerMap['attributes']]).trim() : '',
      qualityLevel: row[headerMap['qualityLevel']] !== undefined ? String(row[headerMap['qualityLevel']]).trim() : '',
      sales7Days: this.parseNumber(row[headerMap['sales7Days']]),
      leadTime: this.parseNumber(row[headerMap['leadTime']]),
      bufferDays: this.parseNumber(row[headerMap['bufferDays']]),
      pendingShipment: this.parseNumber(row[headerMap['pendingShipment']]),
      inTransit: this.parseNumber(row[headerMap['inTransit']]),
      pendingShelf: this.parseNumber(row[headerMap['pendingShelf']]),
      sheinStock: this.parseNumber(row[headerMap['sheinStock']])
    };
  }
};
