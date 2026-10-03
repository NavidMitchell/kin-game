#!/usr/bin/env python3
"""Bundle index.html and every asset it references into one self-contained HTML file."""
import base64, mimetypes, os, re
root = os.path.dirname(os.path.abspath(__file__))
mimetypes.add_type('image/webp', '.webp'); mimetypes.add_type('image/svg+xml', '.svg')
html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
def inline(m):
    path = m.group(1)
    data = open(os.path.join(root, path), 'rb').read()
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return "'data:%s;base64,%s'" % (mime, base64.b64encode(data).decode())
out = re.sub(r"'(assets/[^']+)'", inline, html)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
dest = os.path.join(root, 'dist', 'kin-runner.html')
open(dest, 'w', encoding='utf-8').write(out)
print('wrote', dest, '%.1f MB' % (os.path.getsize(dest) / 1e6))
