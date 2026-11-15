// Umaira Florist Real-Time Event Hub
// Lightweight in-process pub/sub using Node.js events for Server-Sent Events (SSE).
const { EventEmitter } = require('events');

class RealtimeHub extends EventEmitter {}

const eventHub = new RealtimeHub();
// Allow multiple concurrent admin and customer connections without memory leak warnings
eventHub.setMaxListeners(200);

module.exports = eventHub;
