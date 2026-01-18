import React from "react";
import "./DatePicker.css";

const DatePicker = ({
  selectedYear,
  selectedMonth,
  selectedWeek,
  onSelect,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { value: 0, label: "January" },
    { value: 1, label: "February" },
    { value: 2, label: "March" },
    { value: 3, label: "April" },
    { value: 4, label: "May" },
    { value: 5, label: "June" },
    { value: 6, label: "July" },
    { value: 7, label: "August" },
    { value: 8, label: "September" },
    { value: 9, label: "October" },
    { value: 10, label: "November" },
    { value: 11, label: "December" },
  ];

  const getWeeksInMonth = (year, month) => {
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    return Math.ceil(daysInMonth / 7);
  };

  const weeks =
    selectedYear && selectedMonth !== null
      ? Array.from(
          { length: getWeeksInMonth(selectedYear, selectedMonth) },
          (_, i) => i + 1
        )
      : [];

  return (
    <div className="date-picker-container">
      <div className="date-picker-funnel">
        <div className="picker-section">
          <label>Year</label>
          <select
            value={selectedYear || ""}
            onChange={(e) =>
              onSelect({
                year: parseInt(e.target.value),
                month: null,
                week: null,
              })
            }
            className="picker-select"
          >
            <option value="">Select Year</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {selectedYear && <div className="picker-arrow">→</div>}

        {selectedYear && (
          <div className="picker-section">
            <label>Month</label>
            <select
              value={selectedMonth !== null ? selectedMonth : ""}
              onChange={(e) =>
                onSelect({
                  year: selectedYear,
                  month: parseInt(e.target.value),
                  week: null,
                })
              }
              className="picker-select"
            >
              <option value="">Select Month</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedYear && selectedMonth !== null && (
          <div className="picker-arrow">→</div>
        )}

        {selectedYear && selectedMonth !== null && (
          <div className="picker-section">
            <label>Week</label>
            <select
              value={selectedWeek || ""}
              onChange={(e) =>
                onSelect({
                  year: selectedYear,
                  month: selectedMonth,
                  week: parseInt(e.target.value),
                })
              }
              className="picker-select"
            >
              <option value="">Select Week</option>
              {weeks.map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatePicker;
