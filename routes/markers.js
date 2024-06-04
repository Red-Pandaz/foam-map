// Import dependencies
const express = require('express');
const router = express.Router();
const { getClaimCollection } = require('../database/database.js');

// Define route handlers
router.get('/markers', async (req, res) => {
    try {
        const markers = await getClaimCollection();
        res.json(markers);
    } catch (error) {
        console.error('Error fetching markers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export the router
module.exports = router;