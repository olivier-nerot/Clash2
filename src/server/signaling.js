const WebSocket = require('ws');

const wss = new WebSocket.Server({ 
  port: 8080,
  host: '0.0.0.0' // Listen on all network interfaces
});

const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'register') {
      // Register client with a unique ID
      const clientId = data.clientId;
      clients.set(clientId, ws);
      console.log(`Client registered: ${clientId}`);
    } else if (data.type === 'signal') {
      // Forward signaling data to the target client
      const targetClient = clients.get(data.targetId);
      if (targetClient) {
        targetClient.send(JSON.stringify({
          type: 'signal',
          data: data.data
        }));
      }
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
});

console.log('Signaling server running on ws://0.0.0.0:8080'); 