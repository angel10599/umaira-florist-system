// Shop-owner command-line tool for reading and updating orders (the Admin page does the same in the browser).
//   node view-orders.js                              list the latest orders
//   node view-orders.js show "#FLR-20261010-1234"    full details of one order
//   node view-orders.js status "#FLR-20261010-1234" Preparing
const store = require('./server/store');
const peso = (n) => 'PHP ' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const [cmd, a, b] = process.argv.slice(2);

if (!cmd) {
  const orders = store.list(50);
  if (!orders.length) console.log('No orders yet.');
  orders.forEach(o => console.log(`${o.orderNumber}  ${o.createdAt.slice(0, 16).replace('T', ' ')}  ${o.status.padEnd(20)} ${o.fulfillment.padEnd(9)} ${(o.firstName + ' ' + o.lastName).padEnd(24)} ${peso(o.total)}`));
} else if (cmd === 'show' && a) {
  const o = store.get(a);
  if (!o) { console.log('Order not found.'); process.exit(1); }
  console.log(JSON.stringify(o, null, 2));
} else if (cmd === 'status' && a && b) {
  const r = store.setStatus(a, b);
  console.log(r.ok ? `Updated ${r.order.orderNumber} -> ${r.order.status}` : 'Error: ' + r.error);
  process.exit(r.ok ? 0 : 1);
} else {
  console.log('Usage:\n  node view-orders.js\n  node view-orders.js show "#FLR-YYYYMMDD-NNNN"\n  node view-orders.js status "#FLR-YYYYMMDD-NNNN" "Preparing"');
}
