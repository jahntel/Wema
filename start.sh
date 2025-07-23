#!/bin/sh

# Start the server in the background
cd /app/server && node index.js &

# Start the client
cd /app/client && node server.js