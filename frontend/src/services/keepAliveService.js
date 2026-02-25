/**
 * Keep-Alive Service
 * Aggressively pings the backend to prevent Vercel serverless cold starts
 * Optimized for unreliable college WiFi networks
 */

class KeepAliveService {
  constructor() {
    this.API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    this.intervals = [];
    this.isRunning = false;
    this.pingCount = 0;
    this.failCount = 0;
    
    // Multiple endpoints to keep entire backend warm
    this.endpoints = [
      '/api/ping',      // Lightweight, no DB
      '/api/health',    // Includes DB health check
    ];
  }

  /**
   * Start aggressive keep-alive pinging
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('🔥 Keep-Alive Service started - server will stay warm');
    
    // Immediate first ping
    this.ping();
    
    // Primary interval: Every 25 seconds (prevents 30s cold start)
    const primaryInterval = setInterval(() => this.ping(), 25000);
    this.intervals.push(primaryInterval);
    
    // Secondary interval: Hit health endpoint every 50 seconds
    const healthInterval = setInterval(() => this.ping(1), 50000);
    this.intervals.push(healthInterval);
    
    // Visibility change handler - ping immediately when tab becomes visible
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('👀 Tab visible - sending keep-alive ping');
        this.ping();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    this.visibilityHandler = visibilityHandler;
    
    // Online/Offline handlers - resume pinging when back online
    const onlineHandler = () => {
      console.log('🌐 Back online - resuming keep-alive');
      this.ping();
    };
    window.addEventListener('online', onlineHandler);
    this.onlineHandler = onlineHandler;
  }

  /**
   * Stop all keep-alive pinging
   */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Remove event listeners
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
    
    console.log('🛑 Keep-Alive Service stopped');
  }

  /**
   * Send a ping to the backend
   * @param {number} endpointIndex - Optional specific endpoint index
   */
  async ping(endpointIndex = null) {
    if (!navigator.onLine) {
      console.debug('📡 Offline - skipping keep-alive ping');
      return;
    }

    try {
      const index = endpointIndex !== null 
        ? endpointIndex 
        : this.pingCount % this.endpoints.length;
      
      const endpoint = this.endpoints[index];
      
      // Use fetch with aggressive 3-second timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.API_BASE}${endpoint}`, {
        signal: controller.signal,
        method: 'GET',
        headers: { 
          'X-Keep-Alive': 'true',
          'Cache-Control': 'no-cache'
        },
        // Bypass cache
        cache: 'no-store'
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        this.failCount = 0; // Reset fail count on success
        console.debug(`✅ Keep-alive ping ${this.pingCount + 1}: ${endpoint}`);
      }
      
      this.pingCount++;
    } catch (err) {
      this.failCount++;
      
      // Only log errors if we're consistently failing
      if (this.failCount > 3) {
        console.warn(`⚠️ Keep-alive ping failed ${this.failCount} times (${err.message})`);
      }
      
      // Reset fail count after 10 failures to avoid log spam
      if (this.failCount > 10) {
        this.failCount = 0;
      }
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pingCount: this.pingCount,
      failCount: this.failCount,
      apiBase: this.API_BASE
    };
  }
}

// Singleton instance
const keepAliveService = new KeepAliveService();

export default keepAliveService;
