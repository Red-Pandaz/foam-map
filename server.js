// Import dependencies
require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { retryApiCall, accessSecret } = require('./utils/apiutils.js');
const router = require('./routes/markers.js');
const fs = require('fs');
const https = require('https');
const path = require('path');
const vhost = require('vhost');

async function startServer() {
    const app = express();
    app.use(helmet());

    // Set up Content Security Policy (CSP) using Helmet middleware
    app.use(
        helmet.contentSecurityPolicy({
            directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'", "https://api.mapbox.com"],
                'style-src': ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
                'img-src': ["'self'", 'data:', 'blob:'],
                'frame-src': ["'self'", "https://dune.com"],
                'child-src': ["'self'", 'blob:'],
                'connect-src': [
                    "'self'",
                    "https://optimism.io",
                    "https://*.tiles.mapbox.com",
                    "https://api.mapbox.com",
                    "https://events.mapbox.com",
                    "https://static.optimism.io",
		    "https://dune.com",
                    "http://www.map.foamcaster.xyz",
                    "http://map.foamcaster.xyz",
                    "http://www.token.foamcaster.xyz",
                    "http://token.foamcaster.xyz",
                    "http://www.foamcaster.xyz",
                    "http://foamcaster.xyz",
                    "https://www.map.foamcaster.xyz",
                    "https://map.foamcaster.xyz",
                    "https://www.token.foamcaster.xyz",
                    "https://token.foamcaster.xyz",
                    "https://www.foamcaster.xyz",
                    "https://foamcaster.xyz",
                    "http://foamcaster.xyz:3000/token",
                    "http://foamcaster.xyz:3000/api/markers",
                    "http://foamcaster.xyz:*",
                    "https://foamcaster.xyz:*"
                ],
                'worker-src': ["'self'", 'blob:'],
                'child-src': ["'self'", 'blob:']
                // Add other directives as needed
            }
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
    app.set('trust proxy', 1);

    // Fetch the Mapbox token from Google Secret Manager
    let mapboxToken;
    try {
        mapboxToken = await retryApiCall(() => accessSecret('MAPBOX_API'));
    } catch (error) {
        console.error('Failed to access Mapbox token:', error);
        process.exit(1); // Exit process if the token cannot be retrieved
    }

    // Middleware setup
    const allowedOrigins = [
        'http://www.map.foamcaster.xyz',
        'http://map.foamcaster.xyz',
        'http://www.token.foamcaster.xyz',
        'http://token.foamcaster.xyz',
        'http://www.foamcaster.xyz',
        'http://foamcaster.xyz',
        'https://www.map.foamcaster.xyz',
        'https://map.foamcaster.xyz',
        'https://www.token.foamcaster.xyz',
        'https://token.foamcaster.xyz',
        'https://www.foamcaster.xyz',
        'https://foamcaster.xyz'
    ];

    app.use(cors({
        origin: function (origin, callback) {
            // allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        }
    }));

    // Function to create static file serving apps
    const createStaticApp = (directory) => {
        const staticApp = express();
        staticApp.use(express.static(path.join(__dirname, 'public', directory)));
        return staticApp;
    };

    // Serve main subdomain
    app.use(vhost('foamcaster.xyz', createStaticApp('main')));
    app.use(vhost('www.foamcaster.xyz', createStaticApp('main')));

    // Serve map subdomain
    app.use(vhost('map.foamcaster.xyz', createStaticApp('map')));
    app.use(vhost('www.map.foamcaster.xyz', createStaticApp('map')));

    // Serve token subdomain
    app.use(vhost('token.foamcaster.xyz', createStaticApp('token')));
    app.use(vhost('www.token.foamcaster.xyz', createStaticApp('token')));

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

    // Configure HTTPS options
    const httpsOptions = {
        key: fs.readFileSync('/etc/letsencrypt/live/foamcaster.xyz/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/foamcaster.xyz/fullchain.pem'),
    };

    // Create HTTPS server
    const httpsServer = https.createServer(httpsOptions, app);

    // Start the HTTPS server
    const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS server running on port ${HTTPS_PORT}`);
    });
}

// Call the async function to start the server
startServer();
