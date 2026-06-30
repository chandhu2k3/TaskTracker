import React, { useState, useEffect } from "react";
import assistantService from "../services/assistantService";
import "./LiveInsightBanner.css";

// Returns yesterday's date as YYYY-MM-DD
const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const LiveInsightBanner = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const yesterday = getYesterdayString();
    assistantService
      .getDailyInsight(yesterday)
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="lib-wrapper">
      {/* Header row */}
      <div className="lib-header">
        <div className="lib-title-row">
          <span className="lib-star">✦</span>
          <h2 className="lib-title">Yesterday's Review</h2>
          <span className="lib-today-badge">Focus for Today</span>
        </div>
        <p className="lib-sub">
          What happened yesterday, what was missed, and one thing to improve today.
        </p>
      </div>

      {/* Body */}
      <div className="lib-body">
        {loading && (
          <div className="lib-skeleton-wrap">
            <div className="lib-skeleton lib-sk-pills" />
            <div className="lib-skeleton lib-sk-line" />
            <div className="lib-skeleton lib-sk-line lib-sk-short" />
          </div>
        )}

        {error && !loading && (
          <p className="lib-error">
            Couldn't load insight right now. Check your connection and try refreshing.
          </p>
        )}

        {data && !loading && (
          <>
            {/* Stat pills */}
            {data.stats && (
              <div className="lib-pills">
                <span className={`lib-pill ${
                  data.stats.completionRate >= 80 ? "lp-green"
                  : data.stats.completionRate >= 50 ? "lp-amber"
                  : "lp-red"
                }`}>
                  {data.stats.completed}/{data.stats.total} tasks done
                </span>
                <span className="lib-pill lp-neutral">{data.stats.completionRate}% completion</span>
                {data.stats.timeSpent && data.stats.timeSpent !== "0m" && (
                  <span className="lib-pill lp-blue">⏱ {data.stats.timeSpent} tracked</span>
                )}
                {data.stats.timePlanned && data.stats.timePlanned !== "0m" && (
                  <span className="lib-pill lp-neutral">/ {data.stats.timePlanned} planned</span>
                )}
                {data.stats.missed > 0 && (
                  <span className="lib-pill lp-red">⚠ {data.stats.missed} missed</span>
                )}
              </div>
            )}

            {/* AI narrative */}
            <p className="lib-narrative">{data.insight}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default LiveInsightBanner;
