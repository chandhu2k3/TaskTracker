import React from "react";
import "./Analytics.css";

const Analytics = ({ analytics, type }) => {
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatPercentage = (value, total) => {
    if (total === 0) return "0%";
    return `${Math.round((value / total) * 100)}%`;
  };

  if (!analytics) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-container">
      {type === "week" && (
        <>
          <div className="analytics-summary">
            <div className="stat-card">
              <div className="stat-value">{analytics.totalTasks}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.sessionCount}</div>
              <div className="stat-label">Sessions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {formatTime(analytics.totalTime)}
              </div>
              <div className="stat-label">Actual Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {formatTime(analytics.totalPlannedTime || 0)}
              </div>
              <div className="stat-label">Planned Time</div>
            </div>
          </div>

          <div className="analytics-section">
            <h4>📅 By Day - Actual vs Planned</h4>
            <div className="day-breakdown">
              {analytics.byDay &&
                Object.entries(analytics.byDay).map(([day, data]) => (
                  <div key={day} className="day-stat-detailed">
                    <div className="day-name">
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                    <div className="progress-bars-container">
                      <div className="bar-row">
                        <span className="bar-label">Actual:</span>
                        <div className="bar-wrapper">
                          <div
                            className="bar-fill actual"
                            style={{
                              width: formatPercentage(
                                data.totalTime,
                                Math.max(data.plannedTime, data.totalTime) || 1
                              ),
                            }}
                          />
                        </div>
                        <span className="bar-value">
                          {formatTime(data.totalTime)}
                        </span>
                      </div>
                      <div className="bar-row">
                        <span className="bar-label">Target:</span>
                        <div className="bar-wrapper">
                          <div
                            className="bar-fill target"
                            style={{
                              width: formatPercentage(
                                data.plannedTime,
                                Math.max(data.plannedTime, data.totalTime) || 1
                              ),
                            }}
                          />
                        </div>
                        <span className="bar-value">
                          {formatTime(data.plannedTime || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="day-meta">
                      {data.taskCount} tasks • {data.sessions} sessions
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="analytics-section">
            <h4>📊 Category Distribution - Time Achieved</h4>
            <div className="pie-chart-container">
              <div className="pie-chart-wrapper">
                <svg
                  viewBox="0 0 200 200"
                  className="pie-chart"
                  width="300"
                  height="300"
                >
                  {(() => {
                    if (
                      !analytics.byCategory ||
                      Object.keys(analytics.byCategory).length === 0
                    ) {
                      return (
                        <>
                          <circle cx="100" cy="100" r="80" fill="#e5e7eb" />
                          <text
                            x="100"
                            y="105"
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="14"
                          >
                            No data
                          </text>
                        </>
                      );
                    }

                    const categoryData = Object.entries(analytics.byCategory);
                    const total = categoryData.reduce(
                      (sum, [, data]) => sum + data.totalTime,
                      0
                    );

                    if (total === 0) {
                      return (
                        <>
                          <circle cx="100" cy="100" r="80" fill="#e5e7eb" />
                          <text
                            x="100"
                            y="105"
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="14"
                          >
                            No time logged
                          </text>
                        </>
                      );
                    }

                    const colors = [
                      "#D97706",
                      "#10b981",
                      "#6366f1",
                      "#f59e0b",
                      "#8b5cf6",
                      "#ec4899",
                    ];
                    let cumulativeAngle = 0;

                    return categoryData.map(([category, data], index) => {
                      const percentage = (data.totalTime / total) * 100;
                      const angle = (percentage / 100) * 360;
                      const startAngle = cumulativeAngle - 90;
                      const endAngle = startAngle + angle;

                      const startRadians = (startAngle * Math.PI) / 180;
                      const endRadians = (endAngle * Math.PI) / 180;

                      const x1 = 100 + 80 * Math.cos(startRadians);
                      const y1 = 100 + 80 * Math.sin(startRadians);
                      const x2 = 100 + 80 * Math.cos(endRadians);
                      const y2 = 100 + 80 * Math.sin(endRadians);

                      const largeArc = angle > 180 ? 1 : 0;

                      cumulativeAngle += angle;

                      return (
                        <path
                          key={category}
                          d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                          fill={colors[index % colors.length]}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="pie-legend">
                  {analytics.byCategory &&
                    Object.entries(analytics.byCategory).map(
                      ([category, data], index) => {
                        const colors = [
                          "#D97706",
                          "#10b981",
                          "#6366f1",
                          "#f59e0b",
                          "#8b5cf6",
                          "#ec4899",
                        ];
                        const total = Object.values(
                          analytics.byCategory
                        ).reduce((sum, d) => sum + d.totalTime, 0);
                        const percentage =
                          total > 0
                            ? Math.round((data.totalTime / total) * 100)
                            : 0;

                        return (
                          <div key={category} className="legend-item">
                            <span
                              className="legend-color"
                              style={{
                                background: colors[index % colors.length],
                              }}
                            ></span>
                            <span className="legend-label">
                              {category}: {formatTime(data.totalTime)} (
                              {percentage}%)
                            </span>
                          </div>
                        );
                      }
                    )}
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-section">
            <h4>📂 By Category - Detailed</h4>
            <div className="category-breakdown">
              {analytics.byCategory &&
                Object.entries(analytics.byCategory).map(([category, data]) => (
                  <div key={category} className="category-stat">
                    <div className="category-info">
                      <span className="category-name-analytics">
                        {category}
                      </span>
                      <span className="category-tasks">
                        {data.taskCount} tasks
                      </span>
                    </div>
                    <div className="category-bar-container">
                      <div
                        className="category-bar"
                        style={{
                          width: formatPercentage(
                            data.totalTime,
                            analytics.totalTime
                          ),
                          background:
                            "linear-gradient(135deg, #10b981, #059669)",
                        }}
                      />
                    </div>
                    <div className="category-time">
                      {formatTime(data.totalTime)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {type === "month" && (
        <>
          <div className="analytics-summary">
            <div className="stat-card">
              <div className="stat-value">{analytics.totalTasks}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.sessionCount}</div>
              <div className="stat-label">Total Sessions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {formatTime(analytics.totalTime)}
              </div>
              <div className="stat-label">Total Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.completedTasks}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>

          <div className="analytics-section">
            <h4>📊 By Week</h4>
            <div className="week-comparison">
              {analytics.byWeek &&
                Object.entries(analytics.byWeek).map(([week, data]) => (
                  <div key={week} className="week-stat">
                    <div className="week-label">
                      {week.replace("week", "Week ")}
                    </div>
                    <div className="week-bar-container">
                      <div
                        className="week-bar"
                        style={{
                          width: formatPercentage(
                            data.totalTime,
                            analytics.totalTime
                          ),
                          background:
                            "linear-gradient(135deg, #f59e0b, #d97706)",
                        }}
                      />
                    </div>
                    <div className="week-details">
                      <span>{formatTime(data.totalTime)}</span>
                      <span>{data.taskCount} tasks</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="analytics-section">
            <h4>📂 By Category</h4>
            <div className="category-breakdown">
              {analytics.byCategory &&
                Object.entries(analytics.byCategory).map(([category, data]) => (
                  <div key={category} className="category-stat">
                    <div className="category-info">
                      <span className="category-name-analytics">
                        {category}
                      </span>
                      <span className="category-tasks">
                        {data.taskCount} tasks
                      </span>
                    </div>
                    <div className="category-bar-container">
                      <div
                        className="category-bar"
                        style={{
                          width: formatPercentage(
                            data.totalTime,
                            analytics.totalTime
                          ),
                          background:
                            "linear-gradient(135deg, #10b981, #059669)",
                        }}
                      />
                    </div>
                    <div className="category-time">
                      {formatTime(data.totalTime)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {type === "category" && (
        <>
          <div className="analytics-summary">
            <div className="stat-card">
              <div className="stat-value">{analytics.totalTasks}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{analytics.totalSessions}</div>
              <div className="stat-label">Total Sessions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {formatTime(analytics.totalTime)}
              </div>
              <div className="stat-label">Actual Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {formatTime(analytics.totalPlannedTime || 0)}
              </div>
              <div className="stat-label">Planned Time</div>
            </div>
          </div>

          <div className="analytics-section">
            <h4>⏱️ Time Comparison: Actual vs Planned</h4>
            <div className="pie-chart-container">
              <div className="pie-chart-wrapper">
                <svg
                  viewBox="0 0 200 200"
                  className="pie-chart"
                  width="300"
                  height="300"
                >
                  {(() => {
                    const actualTime = analytics.totalTime;
                    const plannedTime = analytics.totalPlannedTime || 0;

                    if (plannedTime === 0) {
                      return (
                        <>
                          <circle cx="100" cy="100" r="80" fill="#D97706" />
                          <text
                            x="100"
                            y="105"
                            textAnchor="middle"
                            fill="#fff"
                            fontSize="14"
                            fontWeight="600"
                          >
                            No planned time
                          </text>
                        </>
                      );
                    }

                    const percentage = Math.min(
                      (actualTime / plannedTime) * 100,
                      100
                    );
                    const angle = (percentage / 100) * 360;
                    const radians = (angle - 90) * (Math.PI / 180);

                    const x = 100 + 80 * Math.cos(radians);
                    const y = 100 + 80 * Math.sin(radians);

                    const largeArc = angle > 180 ? 1 : 0;

                    return (
                      <>
                        {/* Background circle (planned) */}
                        <circle cx="100" cy="100" r="80" fill="#e5e7eb" />

                        {/* Actual time arc */}
                        {percentage > 0 && (
                          <path
                            d={`M 100 20 A 80 80 0 ${largeArc} 1 ${x} ${y} L 100 100 Z`}
                            fill="#D97706"
                          />
                        )}

                        {/* Center text */}
                        <text
                          x="100"
                          y="95"
                          textAnchor="middle"
                          fill="#334155"
                          fontSize="24"
                          fontWeight="700"
                        >
                          {Math.round(percentage)}%
                        </text>
                        <text
                          x="100"
                          y="115"
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="12"
                        >
                          Complete
                        </text>
                      </>
                    );
                  })()}
                </svg>
                <div className="pie-legend">
                  <div className="legend-item">
                    <span
                      className="legend-color"
                      style={{ background: "#D97706" }}
                    ></span>
                    <span className="legend-label">
                      Actual: {formatTime(analytics.totalTime)}(
                      {Math.round(
                        (analytics.totalTime /
                          (analytics.totalPlannedTime || 1)) *
                          100
                      )}
                      %)
                    </span>
                  </div>
                  <div className="legend-item">
                    <span
                      className="legend-color"
                      style={{ background: "#e5e7eb" }}
                    ></span>
                    <span className="legend-label">
                      Planned: {formatTime(analytics.totalPlannedTime || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-section">
            <h4>📅 Activity Over Time</h4>
            <div className="date-timeline">
              {Object.entries(analytics.byDate || {}).map(([date, data]) => (
                <div key={date} className="date-stat">
                  <div className="date-label">
                    {new Date(date).toLocaleDateString()}
                  </div>
                  <div className="date-bar-container">
                    <div
                      className="date-bar"
                      style={{
                        width: formatPercentage(
                          data.totalTime,
                          analytics.totalTime
                        ),
                        background: "linear-gradient(135deg, #D97706, #b45309)",
                      }}
                    />
                  </div>
                  <div className="date-details">
                    <span>{formatTime(data.totalTime)}</span>
                    <span>{data.taskCount} tasks</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
