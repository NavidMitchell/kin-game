#!/bin/sh
# Serves the game at http://localhost:8765 using the Node binary installed by mise.
cd "$(dirname "$0")"
NODE="$HOME/.local/share/mise/installs/node/24.21.0/bin/node"
[ -x "$NODE" ] || NODE=node
exec "$NODE" -e "const h=require('http'),f=require('fs'),p=require('path');const m={'.html':'text/html','.png':'image/png','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'};h.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=p.join(process.cwd(),u);f.readFile(fp,(e,d)=>{if(e){r.writeHead(404);r.end('not found');return;}r.writeHead(200,{'Content-Type':m[p.extname(fp)]||'application/octet-stream'});r.end(d);});}).listen(8765,()=>console.log('Kin Runner running at http://localhost:8765'));"
