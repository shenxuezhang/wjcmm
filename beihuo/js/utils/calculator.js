// 计算逻辑工具
const Calculator = {
  // 计算建议下单数
  calculateSuggestedOrder(product) {
    const sales7Days = this.safeNumber(product.sales7Days);
    const leadTime = this.safeNumber(product.leadTime);
    const bufferDays = this.safeNumber(product.bufferDays);
    const pendingShipment = this.safeNumber(product.pendingShipment);
    const inTransit = this.safeNumber(product.inTransit);
    const pendingShelf = this.safeNumber(product.pendingShelf);
    const sheinStock = this.safeNumber(product.sheinStock);

    // 预测日销 = 近7天销量 / 7
    product.dailySales = sales7Days / 7;
    if (isNaN(product.dailySales) || !isFinite(product.dailySales)) {
      product.dailySales = 0;
    }

    // 建议下单数 = 预测日销 × (货期 + 备货天数) - 待发货 - 在途 - 待上架 - SHEIN仓库存
    const totalDays = leadTime + bufferDays;
    const totalStock = pendingShipment + inTransit + pendingShelf + sheinStock;
    const suggestedOrder = product.dailySales * totalDays - totalStock;

    product.rawSuggestedOrder = suggestedOrder;

    // 实际建议单数：使用正常的四舍五入算法（Math.round）
    if (isNaN(suggestedOrder) || !isFinite(suggestedOrder)) {
      product.actualSuggestedOrder = 0;
    } else {
      product.actualSuggestedOrder = Math.round(suggestedOrder);
    }

    // 四舍五入规则：按5的倍数向上取整；若计算结果 < 5，则直接取5件
    if (isNaN(suggestedOrder) || !isFinite(suggestedOrder)) {
      product.suggestedOrder = 5;
    } else if (suggestedOrder < 5) {
      product.suggestedOrder = 5;
    } else {
      product.suggestedOrder = Math.ceil(suggestedOrder / 5) * 5;
    }
  },

  // 安全转换数字
  safeNumber(value) {
    if (isNaN(value) || value === null || value === undefined) return 0;
    return Number(value);
  }
};
