const { MongoClient } = require('mongodb');
const dotenv = require("dotenv").config();
const { retryApiCall, accessSecret } = require('../utils/apiutils.js');
const dbName = 'Foamcaster-V2'
const claimCollectionName ='Base Presence Claims'
// const DB_URI = await retryApiCall(() => accessSecret('DB_URI'));
let client

async function getClaimCollection() {
console.log('start')
    const DB_URI = await retryApiCall(() => accessSecret('DB_URI'));
    try {
        if (!client || !client.topology || !client.topology.isConnected()) {
            client = new MongoClient(DB_URI);
            await retryApiCall(() => client.connect());
            console.log("Connected to the database");
        }
        const db = client.db(dbName);
        const collection = db.collection(claimCollectionName);
        const documents = await retryApiCall(() => collection.find({}).toArray());
        return documents
    } catch (error) {
        console.error('Error fetching claims:', error);
        throw error; // Rethrow the error to be caught by the caller
    } finally {
        // Close the connection
        if (client && client.topology && client.topology.isConnected()) {
            await retryApiCall(() => client.close());
            console.log("Connection closed");
        }
    }
}

module.exports = { getClaimCollection }
