const http = require('http');

const keys = [
    "pt_live_c9a30d18431c6a7bfc55ee1b5f2ca9ecca6fed5c8ab421ccccf493a8868a9c61",
    "pt_live_22d2c595e3af39d1bcb0ded9ed8719eb4d94f688e54d51fd5c39063cf00701fc"
];

console.log("Testing API Keys against localhost:3001...");

keys.forEach(key => {
    const data = JSON.stringify({ power_w: 500, voltage: 230, current_a: 2 });
    const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': key,
            'Content-Length': data.length
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log(`\n---------------------------------------------------`);
            console.log(`Key Prefix: ${key.substring(0, 15)}...`);
            console.log(`Status Code: ${res.statusCode}`);
            try {
                const json = JSON.parse(body);
                console.log(`Mapped Scool ID: ${json.school_id}`);
                if (json.error) console.log(`Error: ${json.error}`);
            } catch (e) {
                console.log(`Raw Body: ${body}`);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(data);
    req.end();
});
