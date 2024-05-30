// Import dependencies
require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet')
const cors = require('cors');
const { retryApiCall, accessSecret } = require('./utils/apiutils.js');
const router = require('./routes/markers.js');

async function startServer() {
    const app = express();
    app.use(helmet())
    // Set up Content Security Policy (CSP) using Helmet middleware
    app.use(
        helmet.contentSecurityPolicy({
            directives: {
                'worker-src': ["'self'", 'blob:'], // Allow blob URLs for Workers
                'child-src': ["'self'", 'blob:'], // Allow blob URLs for child browsing contexts
                'img-src': ["'self'", 'data:', 'blob:'], // Allow data URLs and blob URLs for images
                'script-src': ["'self'", "https://api.mapbox.com"],
                'connect-src': [
                    "https://optimism.io",
                    "https://*.tiles.mapbox.com",
                    "https://api.mapbox.com",
                    "https://events.mapbox.com",
                    "https://static.optimism.io",
                    "http://localhost:3000/token",
                    "http://localhost:3000/api/markers",
                    "http://localhost:*", // Allow all localhost ports for HTTP
                    "https://localhost:*", // Allow all localhost ports for HTTPS
                ], // Allow connections to specified domains
                // Add other directives as needed
            },
        })
    );

    // Set up rate limiting middleware for the root endpoint
    const limiterForRootEndpoint = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
    });
    // Apply rate limiting middleware to the root endpoint
    app.use('/', limiterForRootEndpoint);
    app.set('trust proxy', 1)

    // Fetch the Mapbox token from Google Secret Manager
    let mapboxToken;
    try {
        mapboxToken = await retryApiCall(() => accessSecret('MAPBOX_API'));
    } catch (error) {
        console.error('Failed to access Mapbox token:', error);
        process.exit(1); // Exit process if the token cannot be retrieved
    }

    // Log the stack property of the router (if needed for debugging)
    // console.log('Router stack length:', router.stack.length);

    // Middleware setup
    app.use(cors());
    app.use(express.static('public')); // Serve static files from 'public' directory

    // Token endpoint
    app.get('/token', (req, res) => {
        res.json({ token: mapboxToken });
    });

    // API routes
    app.use('/api', router);

    // Start the server
    const PORT = process.env.PORT || 3000;
    try {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1); // Exit process with an error code
    }
}

// Call the async function to start the server
startServer();
