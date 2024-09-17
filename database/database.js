const { MongoClient } = require('mongodb');
const dotenv = require('dotenv').config();
const { retryApiCall, accessSecret } = require('../utils/apiutils.js');
const dbName = 'Foamcaster-V2';
const claimCollectionName = 'Base Presence Claims';

let client;
let isConnected = false;

// Function to connect to MongoDB
async function connectToDatabase() {
    if (!client || !isConnected) {
        const DB_URI = await retryApiCall(() => accessSecret('DB_URI'));
        client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        isConnected = true;
        console.log('Connected to the database');
    }
    return client;
}

// Function to get claims collection
async function getClaimCollection() {
    try {
        const client = await connectToDatabase();  // Ensure connection
        const db = client.db(dbName);
        const collection = db.collection(claimCollectionName);
        const documents = await retryApiCall(() => collection.find({}).toArray());
        return documents;
    } catch (error) {
        console.error('Error fetching claims:', error);
        throw error;  // Rethrow the error to be caught by the caller
    }
}

// Optional: Function to close the connection when needed
async function closeConnection() {
    if (client && isConnected) {
        await client.close();
        isConnected = false;
        console.log('Connection closed');
    }
}

module.exports = { getClaimCollection, closeConnection };
