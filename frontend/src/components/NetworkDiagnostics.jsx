import { useState } from "react";
import api from "../services/api";
import "./NetworkDiagnostics.css";

const NetworkDiagnostics = ({ onClose }) => {
  const [results, setResults] = useState({});
  const [testing, setTesting] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const runDiagnostics = async () => {
    setTesting(true);
    const newResults = {};

    // Test 1: DNS Resolution
    try {
      const start = Date.now();
      await fetch(`${API_URL}/api/ping`, { method: "HEAD", mode: "no-cors" });
      newResults.dns = { status: "✅ OK", time: Date.now() - start };
    } catch (error) {
      newResults.dns = { status: "❌ Failed", error: error.message };
    }

    // Test 2: Ping endpoint (no DB)
    try {
      const start = Date.now();
      const response = await fetch(`${API_URL}/api/ping`, { timeout: 5000 });
      const data = await response.json();
      newResults.ping = { 
        status: data.status === "ok" ? "✅ OK" : "⚠️ Slow", 
        time: Date.now() - start 
      };
    } catch (error) {
      newResults.ping = { status: "❌ Failed", error: error.message };
    }

    // Test 3: Health check (with DB)
    try {
      const start = Date.now();
      const response = await fetch(`${API_URL}/api/health`, { timeout: 10000 });
      const data = await response.json();
      newResults.health = { 
        status: data.mongodb === "connected" ? "✅ OK" : "⚠️ DB Issue", 
        time: Date.now() - start,
        details: data
      };
    } catch (error) {
      newResults.health = { status: "❌ Failed", error: error.message };
    }

    // Test 4: Auth check
    try {
      const start = Date.now();
      await api.get("/api/categories");
      newResults.auth = { status: "✅ OK", time: Date.now() - start };
    } catch (error) {
      if (error.response?.status === 401) {
        newResults.auth = { status: "⚠️ Not logged in", error: "401" };
      } else {
        newResults.auth = { status: "❌ Failed", error: error.message };
      }
    }

    setResults(newResults);
    setTesting(false);
  };

  return (
    <div className="network-diagnostics-overlay" onClick={onClose}>
      <div className="network-diagnostics-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🔧 Network Diagnostics</h2>
        <p className="api-url">Backend: {API_URL}</p>

        <button 
          className="btn-run-diagnostics" 
          onClick={runDiagnostics}
          disabled={testing}
        >
          {testing ? "Testing..." : "Run Tests"}
        </button>

        {Object.keys(results).length > 0 && (
          <div className="diagnostics-results">
            <div className="test-result">
              <strong>DNS Resolution:</strong> {results.dns?.status}
              {results.dns?.time && <span> ({results.dns.time}ms)</span>}
              {results.dns?.error && <div className="error-detail">{results.dns.error}</div>}
            </div>

            <div className="test-result">
              <strong>Ping (no DB):</strong> {results.ping?.status}
              {results.ping?.time && <span> ({results.ping.time}ms)</span>}
              {results.ping?.error && <div className="error-detail">{results.ping.error}</div>}
            </div>

            <div className="test-result">
              <strong>Health Check (with DB):</strong> {results.health?.status}
              {results.health?.time && <span> ({results.health.time}ms)</span>}
              {results.health?.error && <div className="error-detail">{results.health.error}</div>}
              {results.health?.details && (
                <div className="health-details">
                  <div>MongoDB: {results.health.details.mongodb}</div>
                  <div>Redis: {results.health.details.redis}</div>
                </div>
              )}
            </div>

            <div className="test-result">
              <strong>API Request (auth):</strong> {results.auth?.status}
              {results.auth?.time && <span> ({results.auth.time}ms)</span>}
              {results.auth?.error && <div className="error-detail">{results.auth.error}</div>}
            </div>

            <div className="recommendations">
              <h3>Recommendations:</h3>
              {results.dns?.status?.includes("❌") && (
                <p>❌ DNS failed - Check if you can access {API_URL} in your browser</p>
              )}
              {results.ping?.status?.includes("❌") && (
                <p>❌ Backend not responding - College firewall might be blocking Vercel</p>
              )}
              {results.health?.status?.includes("❌") && (
                <p>⚠️ Backend running but database unreachable - Try again in 30 seconds</p>
              )}
              {results.ping?.time > 2000 && (
                <p>⚠️ High latency ({results.ping.time}ms) - Network is very slow</p>
              )}
            </div>
          </div>
        )}

        <button className="btn-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default NetworkDiagnostics;
