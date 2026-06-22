/**
 * MessageBus — range-limited inter-drone communication (broadcast + direct).
 * A singleton the swarm engine wires every DroneAgent into so swarms can
 * actually coordinate (the old code built this but never used it).
 */
class MessageBus {
  constructor() {
    this.subscribers = new Map(); // droneId -> { callback, getPosition }
    this.commRange = 300;
    this.messageHistory = [];
    this.maxHistory = 60;
    this.deliveredThisTick = 0;
  }

  setCommRange(range) {
    this.commRange = range;
  }

  subscribe(droneId, callback, getPosition) {
    this.subscribers.set(droneId, { callback, getPosition });
  }

  unsubscribe(droneId) {
    this.subscribers.delete(droneId);
  }

  broadcast(senderId, message, senderPosition) {
    const msg = { type: 'broadcast', from: senderId, to: null, payload: message, t: this._now() };
    this._record(msg);
    this.subscribers.forEach((sub, id) => {
      if (id === senderId) return;
      if (this._inRange(senderPosition, sub.getPosition())) {
        this.deliveredThisTick++;
        sub.callback(msg);
      }
    });
  }

  send(senderId, targetId, message, senderPosition) {
    const target = this.subscribers.get(targetId);
    if (!target) return false;
    const msg = { type: 'direct', from: senderId, to: targetId, payload: message, t: this._now() };
    this._record(msg);
    if (this._inRange(senderPosition, target.getPosition())) {
      this.deliveredThisTick++;
      target.callback(msg);
      return true;
    }
    return false;
  }

  getDronesInRange(position) {
    const out = [];
    this.subscribers.forEach((sub, id) => {
      if (this._inRange(position, sub.getPosition())) out.push(id);
    });
    return out;
  }

  /** Pairs of drone ids currently within comm range — for drawing the mesh. */
  links() {
    const ids = [...this.subscribers.keys()];
    const links = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = this.subscribers.get(ids[i]).getPosition();
        const b = this.subscribers.get(ids[j]).getPosition();
        if (this._inRange(a, b)) links.push([ids[i], ids[j]]);
      }
    }
    return links;
  }

  _inRange(a, b) {
    if (this.commRange === Infinity) return true;
    return Math.hypot(a.x - b.x, a.y - b.y) <= this.commRange;
  }

  _record(msg) {
    this.messageHistory.push(msg);
    if (this.messageHistory.length > this.maxHistory) this.messageHistory.shift();
  }

  _now() {
    return this.messageHistory.length; // monotonic, avoids Date.now in tests
  }

  getMessageHistory(count = 10) {
    return this.messageHistory.slice(-count);
  }

  resetTick() {
    this.deliveredThisTick = 0;
  }

  clear() {
    this.subscribers.clear();
    this.messageHistory = [];
    this.deliveredThisTick = 0;
  }
}

export const messageBus = new MessageBus();
export default MessageBus;
