/**
 * MessageBus - Inter-drone communication system
 * Supports range-limited broadcast and direct messaging
 */

class MessageBus {
    constructor() {
        this.subscribers = new Map(); // droneId -> { callback, position }
        this.messageQueue = [];
        this.commRange = 300; // Default communication range in pixels, Infinity for global
        this.messageHistory = []; // For telemetry/debugging
        this.maxHistory = 100;
    }

    /**
     * Set the communication range
     * @param {number} range - Range in pixels, use Infinity for global comms
     */
    setCommRange(range) {
        this.commRange = range;
    }

    /**
     * Register a drone to receive messages
     * @param {string} droneId - Unique drone identifier
     * @param {Function} callback - Function to call when message received
     * @param {Function} getPosition - Function that returns drone's current position
     */
    subscribe(droneId, callback, getPosition) {
        this.subscribers.set(droneId, { callback, getPosition });
    }

    /**
     * Unregister a drone from receiving messages
     * @param {string} droneId - Drone to unsubscribe
     */
    unsubscribe(droneId) {
        this.subscribers.delete(droneId);
    }

    /**
     * Broadcast a message to all drones within range
     * @param {string} senderId - ID of the sending drone
     * @param {Object} message - Message payload
     * @param {Object} senderPosition - {x, y} position of sender
     */
    broadcast(senderId, message, senderPosition) {
        const fullMessage = {
            type: 'broadcast',
            from: senderId,
            to: null,
            payload: message,
            timestamp: Date.now()
        };

        this._recordMessage(fullMessage);

        this.subscribers.forEach((sub, droneId) => {
            if (droneId === senderId) return; // Don't send to self

            const receiverPos = sub.getPosition();
            if (this._isInRange(senderPosition, receiverPos)) {
                sub.callback(fullMessage);
            }
        });
    }

    /**
     * Send a direct message to a specific drone
     * @param {string} senderId - ID of the sending drone
     * @param {string} targetId - ID of the target drone
     * @param {Object} message - Message payload
     * @param {Object} senderPosition - {x, y} position of sender
     */
    send(senderId, targetId, message, senderPosition) {
        const target = this.subscribers.get(targetId);
        if (!target) return false;

        const fullMessage = {
            type: 'direct',
            from: senderId,
            to: targetId,
            payload: message,
            timestamp: Date.now()
        };

        this._recordMessage(fullMessage);

        const receiverPos = target.getPosition();
        if (this._isInRange(senderPosition, receiverPos)) {
            target.callback(fullMessage);
            return true;
        }
        return false;
    }

    /**
     * Get list of drones within communication range
     * @param {Object} position - {x, y} position to check from
     * @returns {Array} List of drone IDs within range
     */
    getDronesInRange(position) {
        const inRange = [];
        this.subscribers.forEach((sub, droneId) => {
            const dronePos = sub.getPosition();
            if (this._isInRange(position, dronePos)) {
                inRange.push(droneId);
            }
        });
        return inRange;
    }

    /**
     * Check if two positions are within communication range
     */
    _isInRange(pos1, pos2) {
        if (this.commRange === Infinity) return true;
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.commRange;
    }

    /**
     * Record message for telemetry
     */
    _recordMessage(message) {
        this.messageHistory.push(message);
        if (this.messageHistory.length > this.maxHistory) {
            this.messageHistory.shift();
        }
    }

    /**
     * Get recent messages for telemetry display
     */
    getMessageHistory(count = 10) {
        return this.messageHistory.slice(-count);
    }

    /**
     * Clear all subscribers and history
     */
    clear() {
        this.subscribers.clear();
        this.messageHistory = [];
    }
}

// Singleton instance for global access
export const messageBus = new MessageBus();
export default MessageBus;
