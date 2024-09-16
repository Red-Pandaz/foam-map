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

async function startServer() {
    const app = express();
    app.use(helmet());

    app.use(
        helmet.contentSecurityPolicy({
            directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'", "https://api.mapbox.com"],  // Allow Mapbox GL script
                'style-src': ["'self'", "'unsafe-inline'", "https://api.mapbox.com"], // Allow Mapbox GL stylesheet
                'img-src': ["'self'", 'data:', 'blob:'], // Allow images from self, data URIs, and blob URIs
                'connect-src': [
                    "'self'",
                    "https://optimism.io",
                    "https://*.tiles.mapbox.com",
                    "https://api.mapbox.com",
                    "https://events.mapbox.com",
                    "https://static.optimism.io",
                    "https://dune.com",
                    "http://localhost:3000",
                    "https://www.foamcaster.xyz",
                    "https://foamcaster.xyz"
                ],
                'worker-src': ["'self'", 'blob:'],
                'child-src': ["'self'", 'blob:']
            }
        })
    );


    const limiterForRootEndpoint = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
    });
    app.use('/', limiterForRootEndpoint);
    app.set('trust proxy', 1);


    let mapboxToken;
    try {
        mapboxToken = await retryApiCall(() => accessSecret('MAPBOX_API'));
    } catch (error) {
        console.error('Failed to access Mapbox token:', error);
        process.exit(1); // Exit process if the token cannot be retrieved
    }

    // Middleware setup
    const allowedOrigins = [
        'http://localhost:3000',
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


    app.use(express.static(path.join(__dirname, 'public')));


    app.get('/token', (req, res) => {
        res.json({ token: mapboxToken });
    });


    app.use('/api', router);

    app.use((err, req, res, next) => {
        console.error('Error occurred:', err.message);
        res.status(500).send('Internal Server Error');
    });


    const httpsOptions = {
        key: fs.readFileSync('/etc/letsencrypt/live/foamcaster.xyz/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/foamcaster.xyz/fullchain.pem'),
    };


    const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
    const httpsServer = https.createServer(httpsOptions, app);
    
    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS server running on port ${HTTPS_PORT}`);
    });
}


startServer();
