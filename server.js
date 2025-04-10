const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start Express server
const PORT = process.env.PORT || 4321;
const server = app.listen(PORT, () => {
  console.log(`HTTP server is running on port ${PORT}`);
});

// WebSocket server setup
const wss = new WebSocket.Server({ 
  server, // Use the same server instance
  path: '/ws' // WebSocket path
});

const clients = new Map();

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received WebSocket message:', data);
      
      if (data.type === 'register') {
        // Register client with a unique ID
        const clientId = data.clientId;
        clients.set(clientId, ws);
        console.log(`Client registered: ${clientId}`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'registered',
          clientId: clientId
        }));
      } else if (data.type === 'signal') {
        // Forward signaling data to the target client
        const targetClient = clients.get(data.targetId);
        if (targetClient) {
          console.log(`Forwarding signal to ${data.targetId}`);
          targetClient.send(JSON.stringify({
            type: 'signal',
            data: data.data
          }));
        } else {
          console.log(`Target client ${data.targetId} not found`);
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    // Remove client from the map
    for (const [clientId, client] of clients.entries()) {
      if (client === ws) {
        clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
        break;
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}/ws`); 