// C:\Project\barakah_finance2\js\live-counter.js

class LiveVisitorCounter {
    constructor() {
        this.sessionKey = 'bf_visitor_session';
        this.visitorsKey = 'bf_live_visitors';
        this.sessionId = this.getOrCreateSession();
        this.updateInterval = 5000; // Update every 5 seconds
        this.timeoutDuration = 30000; // Consider visitor offline after 30 seconds

        this.init();
    }

    init() {
        this.registerVisitor();
        this.startTracking();
        this.updateDisplay();

        // Update on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.registerVisitor();
                this.updateDisplay();
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.removeVisitor();
        });
    }

    getOrCreateSession() {
        let sessionId = sessionStorage.getItem(this.sessionKey);
        if (!sessionId) {
            sessionId = `VS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem(this.sessionKey, sessionId);
        }
        return sessionId;
    }

    registerVisitor() {
        const visitors = this.getAllVisitors();
        const now = Date.now();

        // Add or update current visitor
        visitors[this.sessionId] = {
            lastSeen: now,
            page: window.location.pathname
        };

        localStorage.setItem(this.visitorsKey, JSON.stringify(visitors));
    }

    removeVisitor() {
        const visitors = this.getAllVisitors();
        delete visitors[this.sessionId];
        localStorage.setItem(this.visitorsKey, JSON.stringify(visitors));
    }

    getAllVisitors() {
        const data = localStorage.getItem(this.visitorsKey);
        return data ? JSON.parse(data) : {};
    }

    getActiveVisitors() {
        const visitors = this.getAllVisitors();
        const now = Date.now();
        const activeVisitors = {};

        // Filter out inactive visitors
        Object.keys(visitors).forEach(sessionId => {
            const visitor = visitors[sessionId];
            if (now - visitor.lastSeen < this.timeoutDuration) {
                activeVisitors[sessionId] = visitor;
            }
        });

        // Update localStorage with only active visitors
        localStorage.setItem(this.visitorsKey, JSON.stringify(activeVisitors));

        return activeVisitors;
    }

    getCount() {
        return Object.keys(this.getActiveVisitors()).length;
    }

    updateDisplay() {
        const count = this.getCount();
        const counterElement = document.getElementById('visitorCount');

        if (counterElement) {
            // Animate number change
            const currentCount = parseInt(counterElement.textContent) || 0;
            if (currentCount !== count) {
                this.animateCount(counterElement, currentCount, count);
            }
        }
    }

    animateCount(element, from, to) {
        const duration = 500;
        const steps = 10;
        const stepValue = (to - from) / steps;
        let current = from;
        let step = 0;

        const interval = setInterval(() => {
            step++;
            current += stepValue;

            if (step >= steps) {
                element.textContent = to;
                clearInterval(interval);
            } else {
                element.textContent = Math.round(current);
            }
        }, duration / steps);
    }

    startTracking() {
        // Update visitor timestamp periodically
        setInterval(() => {
            this.registerVisitor();
            this.updateDisplay();
        }, this.updateInterval);
    }
}

// Initialize live counter
document.addEventListener('DOMContentLoaded', () => {
    window.LiveCounter = new LiveVisitorCounter();
});

// Also support for older browsers
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.LiveCounter) {
            window.LiveCounter = new LiveVisitorCounter();
        }
    });
} else {
    window.LiveCounter = new LiveVisitorCounter();
}
