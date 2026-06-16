// Server-Sent Events manager for real-time booking notifications
const clients = new Map(); // userId -> Set<res>

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (!set.size) clients.delete(userId);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let count = 0;
  clients.forEach(set => set.forEach(res => {
    try { res.write(payload); count++; } catch { /* client disconnected */ }
  }));
  return count;
}

module.exports = { addClient, removeClient, broadcast };
