const Sleep = require("../models/Sleep");
const tz = require("../utils/timezone");

// @desc    Start sleep session
// @route   POST /api/sleep/start
// @access  Private
const startSleep = async (req, res) => {
  try {
    const timezone = tz.getTimezoneFromRequest(req);
    
    // Check if there's already an active sleep session
    const activeSleep = await Sleep.findOne({
      user: req.user._id,
      isActive: true,
    }).lean();

    if (activeSleep) {
      return res
        .status(400)
        .json({ message: "Sleep session already in progress" });
    }

    const now = tz.getNow(timezone).toJSDate();

    const sleep = await Sleep.create({
      user: req.user._id,
      startTime: now,
      date: now,
      isActive: true,
    });

    res.status(201).json(sleep);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stop sleep session
// @route   PUT /api/sleep/stop
// @access  Private
const stopSleep = async (req, res) => {
  try {
    const timezone = tz.getTimezoneFromRequest(req);
    
    const activeSleep = await Sleep.findOne({
      user: req.user._id,
      isActive: true,
    }); // Not lean, we need to update and save

    if (!activeSleep) {
      return res.status(404).json({ message: "No active sleep session found" });
    }

    const endTime = tz.getNow(timezone).toJSDate();
    const duration = endTime - new Date(activeSleep.startTime);

    activeSleep.endTime = endTime;
    activeSleep.duration = duration;
    activeSleep.isActive = false;

    await activeSleep.save();

    res.json(activeSleep);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active sleep session
// @route   GET /api/sleep/active
// @access  Private
const getActiveSleep = async (req, res) => {
  try {
    const activeSleep = await Sleep.findOne({
      user: req.user._id,
      isActive: true,
    });

    res.json(activeSleep);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get sleep history
// @route   GET /api/sleep/history
// @access  Private
const getSleepHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { user: req.user._id };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const sleepSessions = await Sleep.find(query).sort({ startTime: -1 });

    res.json(sleepSessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get sleep analytics
// @route   GET /api/sleep/analytics
// @access  Private
const getSleepAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {
      user: req.user._id,
      isActive: false,
    };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const sleepSessions = await Sleep.find(query);

    const totalSleep = sleepSessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );
    const averageSleep =
      sleepSessions.length > 0 ? totalSleep / sleepSessions.length : 0;

    res.json({
      totalSessions: sleepSessions.length,
      totalDuration: totalSleep,
      averageDuration: averageSleep,
      sessions: sleepSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startSleep,
  stopSleep,
  getActiveSleep,
  getSleepHistory,
  getSleepAnalytics,
};
