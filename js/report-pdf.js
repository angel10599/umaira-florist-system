/**
 * UMAIRA FLORIST — Executive PDF Report Generator
 * Powered by jsPDF & jsPDF-AutoTable
 * Generates official, multi-page business reports styled in the Atelier floral aesthetic.
 */

(function () {
  'use strict';

  function formatPeso(amount) {
    const num = Number(amount) || 0;
    return 'PHP ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDateTimeManila(date) {
    try {
      const d = date ? new Date(date) : new Date();
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      }).format(d) + ' PHT';
    } catch (_) {
      return new Date().toLocaleString();
    }
  }

  const PALETTE = {
    burgundy: [138, 21, 53],      // #8A1535 (Primary Atelier Burgundy)
    roseAccent: [184, 36, 73],    // #B82449 (Accent Rose)
    softPeach: [246, 216, 207],   // #F6D8CF (Brand Soft Peach)
    softIvory: [250, 243, 237],   // #FAF3ED (Table Alt Rows / Background)
    warmStone: [235, 220, 210],   // #EBDCD2 (Border)
    charcoal: [44, 24, 16],       // #2C1810 (Body Text)
    mutedBrown: [122, 98, 91],    // #7A625B (Secondary / Muted)
    white: [255, 255, 255],
    amber: [184, 93, 25],
    green: [46, 125, 50]
  };

  const ReportPDFGenerator = {
    /**
     * Check if jsPDF runtime is ready
     */
    isSupported() {
      return typeof window !== 'undefined' && window.jspdf && typeof window.jspdf.jsPDF === 'function';
    },

    /**
     * Generate jsPDF document instance
     * @param {Object} reportData Data from store.getReportsData()
     * @param {Object} options Configuration options
     * @returns {jsPDF}
     */
    generate(reportData, options = {}) {
      if (!this.isSupported()) {
        throw new Error('PDF Generation engine (jsPDF) is not loaded. Please check your internet connection.');
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: options.orientation || 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const reportType = options.reportType || 'complete';
      const rangeLabel = options.rangeLabel || `${reportData.startDate} to ${reportData.endDate}`;
      const generatedBy = options.generatedBy || 'Administrator';
      const kpis = reportData.kpis || {};

      // Draw Top Brand Banner & Metadata Header
      this._drawHeader(doc, reportType, rangeLabel, generatedBy);

      // Render content based on selected report type
      switch (reportType) {
        case 'sales':
          this._renderSalesReport(doc, reportData, options);
          break;
        case 'orders':
          this._renderOrdersReport(doc, reportData, options);
          break;
        case 'products':
          this._renderProductsReport(doc, reportData, options);
          break;
        case 'inventory':
          this._renderInventoryReport(doc, reportData, options);
          break;
        case 'stock_history':
          this._renderStockHistoryReport(doc, reportData, options);
          break;
        case 'complete':
        default:
          this._renderCompleteBusinessReport(doc, reportData, options);
          break;
      }

      // Add Running Footers & Page Numbers
      this._drawFooters(doc);

      return doc;
    },

    // --- Header & Banner ---
    _drawHeader(doc, reportType, rangeLabel, generatedBy) {
      const pageWidth = doc.internal.pageSize.getWidth();

      // Top Burgundy Brand Bar (Height: 32mm)
      doc.setFillColor(...PALETTE.burgundy);
      doc.rect(0, 0, pageWidth, 32, 'F');

      // Decorative Accent Line in Soft Peach
      doc.setFillColor(...PALETTE.softPeach);
      doc.rect(0, 32, pageWidth, 1.5, 'F');

      // Atelier Branding Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...PALETTE.white);
      doc.text('UMAIRA FLORIST', 14, 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(245, 230, 225);
      doc.text('ATELIER & BOUTIQUE MANAGEMENT SYSTEM • METRO MANILA', 14, 19);

      // Report Type Title (Right side of banner)
      const titles = {
        complete: 'COMPLETE BUSINESS REPORT',
        sales: 'SALES & REVENUE PERFORMANCE',
        orders: 'ORDERS & DISPATCH REPORT',
        products: 'PRODUCT & MATERIAL PERFORMANCE',
        inventory: 'INVENTORY & STOCK REPORT',
        stock_history: 'STOCK MOVEMENT AUDIT REPORT'
      };
      const titleText = titles[reportType] || 'BUSINESS PERFORMANCE REPORT';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...PALETTE.white);
      doc.text(titleText, pageWidth - 14, 13, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(245, 230, 225);
      doc.text(`Period: ${rangeLabel}`, pageWidth - 14, 19, { align: 'right' });
      doc.text(`Generated: ${formatDateTimeManila(new Date())}`, pageWidth - 14, 25, { align: 'right' });

      // Metadata info pill below banner (Y: 37mm)
      doc.setFillColor(...PALETTE.softIvory);
      doc.setDrawColor(...PALETTE.warmStone);
      doc.roundedRect(14, 36, pageWidth - 28, 8.5, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...PALETTE.mutedBrown);
      doc.text(`Official Shop Document • Operator: ${generatedBy} • Currency: Philippine Peso (PHP) • Confidential`, 18, 41.5);
    },

    // --- Executive KPI Summary Tiles ---
    _drawKPITiles(doc, kpis, startY = 48) {
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const totalWidth = pageWidth - (margin * 2);
      const gap = 3.5;
      const cardWidth = (totalWidth - (gap * 3)) / 4;
      const cardHeight = 17;

      const items = [
        { label: 'REVENUE (PAID & COMPLETED)', value: formatPeso(kpis.realizedRevenue || 0), sub: `${formatPeso(kpis.completedUnpaidAmount || 0)} completed but unpaid` },
        { label: 'TOTAL ORDERS', value: String(kpis.totalOrders || 0), sub: `${kpis.completedOrders || 0} completed • ${kpis.cancelledOrders || 0} cancelled` },
        { label: 'PRODUCTS SOLD', value: `${kpis.productsSold || 0} units`, sub: 'Stems, materials & bouquets' },
        { label: 'AVG. ORDER VALUE', value: formatPeso(kpis.averageOrderValue), sub: 'Per active customer order' }
      ];

      items.forEach((item, index) => {
        const x = margin + (index * (cardWidth + gap));
        // Tile container
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...PALETTE.warmStone);
        doc.roundedRect(x, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        // Color accent pill on top border
        doc.setFillColor(...PALETTE.roseAccent);
        doc.rect(x + 2, startY, cardWidth - 4, 0.8, 'F');

        // Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...PALETTE.mutedBrown);
        doc.text(item.label, x + 3.5, startY + 5);

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...PALETTE.charcoal);
        doc.text(item.value, x + 3.5, startY + 10.5);

        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...PALETTE.mutedBrown);
        doc.text(item.sub, x + 3.5, startY + 14.5);
      });

      return startY + cardHeight + 6;
    },

    // --- Report 1: Complete Business Report ---
    _renderCompleteBusinessReport(doc, data, options) {
      let currentY = this._drawKPITiles(doc, data.kpis, 48);

      // Embedded Visual Chart (if provided)
      if (options.chartImage && options.includeCharts !== false) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const chartWidth = pageWidth - 28;
        const chartHeight = 48;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...PALETTE.charcoal);
        doc.text('Sales Performance Trend (Selected Period)', 14, currentY + 3);

        try {
          doc.addImage(options.chartImage, 'PNG', 14, currentY + 5, chartWidth, chartHeight);
          currentY += chartHeight + 9;
        } catch (_) {
          currentY += 4;
        }
      }

      // Best Selling Products Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Top 5 Best-Selling Products & Materials', 14, currentY);

      const bestSellersData = (data.bestSellers || []).map((p, idx) => [
        `#${idx + 1}`,
        p.name || 'Custom Bouquet',
        (p.itemType || 'Product').toUpperCase(),
        String(p.quantity || 0),
        formatPeso(p.revenue || 0)
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['Rank', 'Item Name', 'Category / Type', 'Quantity Sold', 'Gross Revenue']],
        body: bestSellersData.length ? bestSellersData : [['—', 'No product sales recorded in this period', '—', '—', '—']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.burgundy, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;

      // Order Status Breakdown Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Order Status Distribution', 14, currentY);

      const dist = data.orderDistribution || {};
      const totalDist = data.kpis.totalOrders || 1;
      const distRows = [
        ['Pending Confirmation', String(dist.pending || 0), `${Math.round(((dist.pending || 0) / totalDist) * 100)}%`, 'Awaiting shop review'],
        ['Confirmed & Preparing', String((dist.confirmed || 0) + (dist.preparing || 0)), `${Math.round((((dist.confirmed || 0) + (dist.preparing || 0)) / totalDist) * 100)}%`, 'In atelier assembly'],
        ['In Dispatch / Delivery', String(dist.inTransit || 0), `${Math.round(((dist.inTransit || 0) / totalDist) * 100)}%`, 'Rider assigned or en route'],
        ['Delivered / Completed', String(dist.delivered || 0), `${Math.round(((dist.delivered || 0) / totalDist) * 100)}%`, 'Fulfillment finished'],
        ['Cancelled / Rejected', String(dist.cancelled || 0), `${Math.round(((dist.cancelled || 0) / totalDist) * 100)}%`, 'Deducted / refunded']
      ];

      doc.autoTable({
        startY: currentY + 2,
        head: [['Fulfillment Status', 'Count', 'Share', 'Operational Note']],
        body: distRows,
        theme: 'plain',
        headStyles: { fillColor: PALETTE.roseAccent, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;

      // Inventory Alert Snapshot (Separated from date filter)
      const inv = data.inventoryHealth || {};
      const alertItems = inv.alertItems || [];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text(`Inventory Health Snapshot (${inv.trackedItems || 0} Tracked Items • ${inv.outOfStockCount || 0} Out of Stock • ${inv.lowStockCount || 0} Low Stock)`, 14, currentY);

      const invRows = alertItems.map(item => [
        item.name,
        (item.itemType || 'flower').toUpperCase(),
        `${item.stockCount} ${item.unitOfMeasure || 'stems'}`,
        `${item.threshold} ${item.unitOfMeasure || 'stems'}`,
        item.status === 'out_of_stock' ? 'OUT OF STOCK' : 'LOW STOCK'
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['Item Name', 'Type', 'Available Units', 'Min. Threshold', 'Inventory Status']],
        body: invRows.length ? invRows : [['All catalog items are currently healthy and well-stocked', '—', '—', '—', 'HEALTHY']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.charcoal, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;

      // Recent Customer Transactions
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Customer Orders & Transactions (Selected Period)', 14, currentY);

      const txRows = (data.recentTransactions || []).map(o => [
        o.orderNumber,
        o.date,
        o.customerName,
        o.status,
        formatPeso(o.total)
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['Order Number', 'Date', 'Customer Name', 'Status', 'Total Amount']],
        body: txRows.length ? txRows : [['—', '—', 'No orders recorded in this period', '—', '—']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.burgundy, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });
    },

    // --- Report 2: Sales Report ---
    _renderSalesReport(doc, data) {
      let currentY = this._drawKPITiles(doc, data.kpis, 48);

      // Daily Sales Performance Breakdown
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Daily Sales & Revenue Timeline', 14, currentY);

      const dailyRows = (data.salesPerformance || []).map(day => [
        day.date,
        day.label,
        String(day.orders || 0),
        String(day.itemsSold || 0),
        formatPeso(day.grossSales || 0),
        formatPeso(day.revenue || 0)
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['Date (YYYY-MM-DD)', 'Period Label', 'Orders Placed', 'Stems/Units Sold', 'Gross Sales', 'Net Revenue']],
        body: dailyRows.length ? dailyRows : [['—', 'No recorded daily sales in range', '0', '0', 'PHP 0.00', 'PHP 0.00']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.burgundy, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;

      // Recent Transactions in Period
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Detailed Sales Transactions', 14, currentY);

      const txRows = (data.recentTransactions || []).map(o => [
        o.orderNumber,
        o.date,
        o.customerName,
        o.fulfillment ? o.fulfillment.toUpperCase() : 'DELIVERY',
        (o.paymentMethod || 'cash').toUpperCase(),
        o.status,
        formatPeso(o.total)
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['Order Number', 'Date', 'Customer', 'Fulfillment', 'Payment', 'Status', 'Total Amount']],
        body: txRows.length ? txRows : [['—', '—', 'No transactions found in this period', '—', '—', '—', '—']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.roseAccent, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });
    },

    // --- Report 3: Orders Report ---
    _renderOrdersReport(doc, data) {
      let currentY = this._drawKPITiles(doc, data.kpis, 48);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Customer Orders & Dispatch Ledger', 14, currentY);

      const txRows = (data.recentTransactions || []).map(o => [
        o.orderNumber,
        o.date,
        o.customerName,
        o.recipientName || 'Same',
        o.fulfillment ? o.fulfillment.toUpperCase() : 'DELIVERY',
        o.paymentStatus || 'Pending',
        o.status,
        formatPeso(o.total)
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['Order Number', 'Order Date', 'Customer Name', 'Recipient', 'Fulfillment', 'Payment', 'Status', 'Order Total']],
        body: txRows.length ? txRows : [['—', '—', 'No orders found in this period', '—', '—', '—', '—', '—']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.burgundy, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });
    },

    // --- Report 4: Product Performance Report ---
    _renderProductsReport(doc, data) {
      let currentY = this._drawKPITiles(doc, data.kpis, 48);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Product & Bouquet Material Sales Performance', 14, currentY);

      const pRows = (data.bestSellers || []).map((p, idx) => [
        `#${idx + 1}`,
        p.name,
        (p.itemType || 'Product').toUpperCase(),
        String(p.quantity || 0),
        formatPeso(p.revenue || 0)
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['Rank', 'Product / Material Name', 'Item Type', 'Units Sold (Stems / Pieces)', 'Total Revenue Generated']],
        body: pRows.length ? pRows : [['—', 'No product sales recorded in this period', '—', '—', '—']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.burgundy, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });
    },

    // --- Report 5: Inventory Report ---
    _renderInventoryReport(doc, data) {
      const inv = data.inventoryHealth || {};
      const alertItems = inv.alertItems || [];

      // Custom Inventory KPI Cards
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const totalWidth = pageWidth - (margin * 2);
      const gap = 3.5;
      const cardWidth = (totalWidth - (gap * 3)) / 4;
      const cardHeight = 17;
      const startY = 48;

      const items = [
        { label: 'TRACKED ITEMS', value: String(inv.trackedItems || 0), sub: 'Active floral catalog items' },
        { label: 'LOW STOCK ALERTS', value: String(inv.lowStockCount || 0), sub: 'Units below min threshold' },
        { label: 'OUT OF STOCK', value: String(inv.outOfStockCount || 0), sub: 'Zero available stems/units' },
        { label: 'HEALTHY ITEMS', value: String(inv.inStockCount || 0), sub: 'Adequate stock buffer' }
      ];

      items.forEach((item, index) => {
        const x = margin + (index * (cardWidth + gap));
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...PALETTE.warmStone);
        doc.roundedRect(x, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        doc.setFillColor(...(index === 2 ? PALETTE.roseAccent : (index === 1 ? PALETTE.amber : PALETTE.burgundy)));
        doc.rect(x + 2, startY, cardWidth - 4, 0.8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...PALETTE.mutedBrown);
        doc.text(item.label, x + 3.5, startY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...PALETTE.charcoal);
        doc.text(item.value, x + 3.5, startY + 10.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...PALETTE.mutedBrown);
        doc.text(item.sub, x + 3.5, startY + 14.5);
      });

      let currentY = startY + cardHeight + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Inventory Stock Status & Levels', 14, currentY);

      const allItems = (inv.items && inv.items.length) ? inv.items : alertItems;
      const invRows = allItems.map(item => [
        item.id || '—',
        item.name,
        (item.category || item.itemType || 'flower').toUpperCase(),
        `${item.stockCount != null ? item.stockCount : 0} ${item.unitOfMeasure || 'units'}`,
        `${item.threshold != null ? item.threshold : (inv.threshold || 20)} ${item.unitOfMeasure || 'units'}`,
        item.status === 'out_of_stock' ? 'OUT OF STOCK' : (item.status === 'low_stock' ? 'LOW STOCK' : 'IN STOCK')
      ]);

      doc.autoTable({
        startY: currentY + 2,
        head: [['SKU / Item ID', 'Item Name', 'Category Type', 'Current Stock', 'Min Threshold', 'Health Status']],
        body: invRows.length ? invRows : [['—', 'All active inventory items are healthy and within thresholds', '—', '—', '—', 'HEALTHY']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.burgundy, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;

      // Section 2: Stock Movement History Audit Log (Selected Period)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Stock Movement History Audit Log (Selected Period)', 14, currentY);

      const movements = data.stockMovements || [];
      const typeLabel = (t) => {
        if (t === 'restock') return 'Restock';
        if (t === 'deduct') return 'Manual Adj.';
        if (t === 'order_fulfillment') return 'Order Deduct';
        if (t === 'order_restoration') return 'Order Restore';
        if (t === 'correction') return 'Correction';
        return t || 'Movement';
      };

      const movRows = movements.map(m => {
        const dt = formatDateTimeManila(m.createdAt || m.created_at);
        const changeStr = (Number(m.quantityChange) > 0) ? `+${m.quantityChange}` : `${m.quantityChange}`;
        const prev = m.previousStock !== null && m.previousStock !== undefined ? String(m.previousStock) : '—';
        const next = m.newStock !== null && m.newStock !== undefined ? String(m.newStock) : '—';
        return [
          dt,
          m.flowerName || m.productName || '—',
          m.category || 'General',
          prev,
          changeStr,
          next,
          typeLabel(m.type),
          m.reason || '—',
          m.adminUsername || m.performed_by || 'admin'
        ];
      });

      doc.autoTable({
        startY: currentY + 2,
        head: [['Date & Time (PHT)', 'Item Name', 'Category', 'Prev', 'Change', 'New', 'Type', 'Reason / Reference', 'By']],
        body: movRows.length ? movRows : [['—', 'No inventory movements recorded in this period', '—', '—', '—', '—', '—', '—', '—']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.roseAccent, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 6.5, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });
    },

    // --- Report 6: Stock Movement History Report ---
    _renderStockHistoryReport(doc, data, options = {}) {
      const movements = data.stockMovements || [];
      const margin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const totalWidth = pageWidth - (margin * 2);
      const gap = 3.5;
      const cardWidth = (totalWidth - (gap * 3)) / 4;
      const cardHeight = 17;
      const startY = 48;

      let restockCount = 0;
      let addedUnits = 0;
      let deductedUnits = 0;
      movements.forEach(m => {
        const change = Number(m.quantityChange) || 0;
        if (change > 0) {
          addedUnits += change;
          if (m.type === 'restock') restockCount++;
        } else {
          deductedUnits += Math.abs(change);
        }
      });
      const netChange = addedUnits - deductedUnits;

      const items = [
        { label: 'TOTAL MOVEMENTS', value: String(movements.length), sub: 'Recorded audit events' },
        { label: 'UNITS RESTOCKED', value: `+${addedUnits}`, sub: `${restockCount} restock shipments` },
        { label: 'UNITS DEDUCTED', value: `-${deductedUnits}`, sub: 'Orders & adjustments' },
        { label: 'NET CHANGE', value: (netChange >= 0 ? `+${netChange}` : `${netChange}`), sub: 'Period net delta' }
      ];

      items.forEach((item, index) => {
        const x = margin + (index * (cardWidth + gap));
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...PALETTE.warmStone);
        doc.roundedRect(x, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        const topBarColor = index === 1 ? PALETTE.green : (index === 2 ? PALETTE.roseAccent : PALETTE.burgundy);
        doc.setFillColor(...topBarColor);
        doc.rect(x + 2, startY, cardWidth - 4, 0.8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...PALETTE.mutedBrown);
        doc.text(item.label, x + 3.5, startY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...PALETTE.charcoal);
        doc.text(item.value, x + 3.5, startY + 10.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...PALETTE.mutedBrown);
        doc.text(item.sub, x + 3.5, startY + 14.5);
      });

      let currentY = startY + cardHeight + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PALETTE.charcoal);
      doc.text('Stock Movement History Audit Log', 14, currentY);

      const typeLabel = (t) => {
        if (t === 'restock') return 'Restock';
        if (t === 'deduct') return 'Manual Adj.';
        if (t === 'order_fulfillment') return 'Order Deduct';
        if (t === 'order_restoration') return 'Order Restore';
        if (t === 'correction') return 'Correction';
        return t || 'Movement';
      };

      const rows = movements.map(m => {
        const dt = formatDateTimeManila(m.createdAt);
        const changeStr = (m.quantityChange > 0) ? `+${m.quantityChange}` : `${m.quantityChange}`;
        const prev = m.previousStock !== null && m.previousStock !== undefined ? String(m.previousStock) : '—';
        const next = m.newStock !== null && m.newStock !== undefined ? String(m.newStock) : '—';
        return [
          dt,
          m.flowerName || '—',
          m.category || 'General',
          prev,
          changeStr,
          next,
          typeLabel(m.type),
          m.reason || '—',
          m.adminUsername || 'admin'
        ];
      });

      doc.autoTable({
        startY: currentY + 2,
        head: [['Date & Time (PHT)', 'Item Name', 'Category', 'Prev', 'Change', 'New', 'Type', 'Reason / Reference', 'By']],
        body: rows.length ? rows : [['—', 'No inventory movements recorded in this period', '—', '—', '—', '—', '—', '—', '—']],
        theme: 'plain',
        headStyles: { fillColor: PALETTE.burgundy, textColor: PALETTE.white, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 6.5, textColor: PALETTE.charcoal },
        alternateRowStyles: { fillColor: PALETTE.softIvory },
        margin: { left: 14, right: 14 }
      });
    },

    // --- Running Footers & Page Numbering ---
    _drawFooters(doc) {
      const pageCount = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Divider rule above footer
        doc.setDrawColor(...PALETTE.warmStone);
        doc.setLineWidth(0.3);
        doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...PALETTE.mutedBrown);

        // Left note
        doc.text('Umaira Florist Confidential Business Report • Valid for Internal Atelier Management Only', 14, pageHeight - 6);

        // Right page count
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
      }
    }
  };

  // Expose globally
  window.ReportPDFGenerator = ReportPDFGenerator;
})();
