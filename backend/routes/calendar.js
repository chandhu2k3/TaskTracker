const express = require('express');
const router = express.Router();
const {
  getAuthUrl,
  handleCallback,
  getStatus,
  disconnect,
  createEvent,
  deleteEvent,
} = require('../controllers/calendarController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// OAuth routes
router.get('/auth-url', getAuthUrl);
router.post('/callback', handleCallback);
router.get('/status', getStatus);
router.delete('/disconnect', disconnect);

// Event routes
router.post('/events', createEvent);
router.delete('/events/:eventId', deleteEvent);

module.exports = router;
