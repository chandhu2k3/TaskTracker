import React, { useState, useRef } from "react";
import assistantService from "../services/assistantService";
import "./DayInsight.css";

const DayInsight = ({ date, taskCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { insight, stats }
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  const handleToggle = async () => {
    const opening = !isOpen;
    setIsOpen(opening);

    // Only fetch once per mount
    if (opening && !fetchedRef.current && taskCount > 0) {
      fetchedRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const result = await assistantService.getDailyInsight(date);
        setData(result);
      } catch (err) {
        setError("Couldn't generate insight. Try again later.");
        fetchedRef.current = false; // allow retry
      } finally {
        setLoading(false);
      }
    }
  };

  if (taskCount === 0) return null;

  return (
    <div className="day-insight-wrapper">
      <button
        className={`day-insight-toggle ${isOpen ? "open" : ""}`}
        onClick={handleToggle}
        title="AI daily summary"
      >
        <span className="day-insight-icon">✦</span>
        <span className="day-insight-label">Day Insight</span>
        <span className="day-insight-chevron">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="day-insight-panel">
          {loading && (
            <div className="day-insight-loading">
              <span className="insight-spinner" />
              <span>Analyzing your day...</span>
            </div>
          )}

          {error && !loading && (
            <p className="day-insight-error">{error}</p>
          )}

          {data && !loading && (
            <>
              {/* Stat pills */}
              <div className="day-insight-stats">
                <span
                  className={`insight-pill ${
                    data.stats.completionRate >= 80
                      ? "pill-green"
                      : data.stats.completionRate >= 50
                      ? "pill-amber"
                      : "pill-red"
                  }`}
                >
                  {data.stats.completed}/{data.stats.total} done
                </span>
                {data.stats.timeSpent && data.stats.timeSpent !== "0m" && (
                  <span className="insight-pill pill-blue">
                    ⏱ {data.stats.timeSpent}
                  </span>
                )}
                {data.stats.missed > 0 && (
                  <span className="insight-pill pill-red">
                    ⚠ {data.stats.missed} missed
                  </span>
                )}
                <span className="insight-pill pill-neutral">
                  {data.stats.completionRate}%
                </span>
              </div>

              {/* AI narrative */}
              <p className="day-insight-text">{data.insight}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DayInsight;
