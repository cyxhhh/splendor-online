const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const WebSocket = require('ws');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const rooms = new Map();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.json':'application/json; charset=utf-8'};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Bad Request'); }
  if (urlPath === '/health') { res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true,rooms:rooms.size})); }
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  if (relative.split(/[\\/]/).some(part => part.startsWith('.') || part === 'node_modules')) { res.writeHead(403); return res.end('Forbidden'); }
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  });
});
const wss = new WebSocket.Server({server, path:'/ws', maxPayload:2*1024*1024});
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const roomCode = () => { const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code; do { code=Array.from({length:6},()=>chars[crypto.randomInt(chars.length)]).join(''); } while(rooms.has(code)); return code; };
const publicRoom = room => ({code:room.code,hostId:room.hostId,maxPlayers:room.maxPlayers,started:!!room.game,players:room.players.map(p=>({id:p.id,name:p.name,connected:!!p.ws}))});
function broadcast(room, message) { for(const p of room.players) if(p.ws) send(p.ws,message); }
function broadcastRoom(room) { broadcast(room,{type:'room',room:publicRoom(room)}); }
function fail(ws, message) { send(ws,{type:'error',message}); }
function bindPlayer(ws, room, player) {
  if(player.ws && player.ws !== ws) { try { player.ws.close(4001,'Session replaced'); } catch {} }
  player.ws=ws; ws.room=room; ws.player=player;
  send(ws,{type:'joined',room:publicRoom(room),playerId:player.id,secret:player.secret,game:room.game});
  broadcastRoom(room);
  if(room.game) send(ws,{type:'game',game:room.game});
}

wss.on('connection',(ws)=>{
  ws.isAlive = true;
  ws.on('pong',()=>{ws.isAlive=true;});
  ws.on('message',(raw)=>{
    let msg; try { msg=JSON.parse(raw.toString()); } catch { return fail(ws,'Invalid message'); }
    if(!msg || typeof msg.type!=='string') return fail(ws,'Invalid message');
    if(msg.type==='create') {
      if(ws.player) return fail(ws,'Already in a room');
      const name=String(msg.name||'').trim().slice(0,16); const maxPlayers=Number(msg.maxPlayers);
      if(!name || ![2,3,4].includes(maxPlayers)) return fail(ws,'Please enter a name and choose 2¨C4 seats');
      const room={code:roomCode(),hostId:null,maxPlayers,players:[],game:null,version:0};
      const player={id:crypto.randomUUID(),secret:crypto.randomBytes(24).toString('hex'),name,ws}; room.hostId=player.id; room.players.push(player); rooms.set(room.code,room); bindPlayer(ws,room,player); return;
    }
    if(msg.type==='join') {
      if(ws.player) return fail(ws,'Already in a room');
      const code=String(msg.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); const name=String(msg.name||'').trim().slice(0,16); const room=rooms.get(code);
      if(!name) return fail(ws,'Please enter a player name');
      if(!room) return fail(ws,'Room not found');
      const resume=room.players.find(p=>p.id===msg.playerId && p.secret===msg.secret);
      if(resume) { if(room.game && !room.players.some(p=>p.id===resume.id)) return fail(ws,'Cannot rejoin this game'); return bindPlayer(ws,room,resume); }
      if(room.game) return fail(ws,'This game has already started');
      if(room.players.length>=room.maxPlayers) return fail(ws,'Room is full');
      if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) return fail(ws,'That name is already in use');
      const player={id:crypto.randomUUID(),secret:crypto.randomBytes(24).toString('hex'),name,ws}; room.players.push(player); bindPlayer(ws,room,player); return;
    }
    const room=ws.room, player=ws.player;
    if(!room || !player) return fail(ws,'Join a room first');
    if(msg.type==='start') {
      if(player.id!==room.hostId) return fail(ws,'Only the host can start the game');
      if(room.game) return fail(ws,'Game has already started');
      if(room.players.length<2 || room.players.some(p=>!p.ws)) return fail(ws,'All players must be connected before the game starts');
      const game=msg.game;
      if(!game || !Array.isArray(game.players) || game.players.length!==room.players.length || game.players.some((p,i)=>p.name!==room.players[i].name)) return fail(ws,'Game setup does not match the room');
      room.game=game; room.version++;
      broadcastRoom(room); broadcast(room,{type:'game',game:room.game,version:room.version}); return;
    }
    if(msg.type==='state') {
      if(!room.game || player.id!==room.players[room.game.turn]?.id) return fail(ws,'It is not your turn');
      if(!msg.game || !Array.isArray(msg.game.players) || msg.game.players.length!==room.players.length) return fail(ws,'Invalid game state');
      room.game=msg.game; room.version++;
      broadcast(room,{type:'game',game:room.game,version:room.version}); return;
    }
    if(msg.type==='leave') {
      player.ws=null; ws.room=null; ws.player=null; broadcastRoom(room); return;
    }
    fail(ws,'Unknown command');
  });
  ws.on('close',()=>{if(ws.player && ws.player.ws===ws){ws.player.ws=null;broadcastRoom(ws.room);}});
});
server.listen(PORT,HOST,()=>console.log(`Splendor server listening on http://${HOST}:${PORT}`));

const heartbeat = setInterval(()=>{
  for(const ws of wss.clients){
    if(!ws.isAlive){ws.terminate();continue;}
    ws.isAlive=false;
    if(ws.readyState===WebSocket.OPEN) ws.ping();
  }
},25000);
heartbeat.unref();
server.on('close',()=>clearInterval(heartbeat));
