require('dotenv').config({ path: '.env' })

const http = require('http');
const fs = require('fs');
const dns = require('dns');
const { parse } = require('querystring');
const { MongoClient } = require('mongodb');
const { shortenUrl, checkIfShortUrlCodeExists } = require('./db');

const databaseUrl = process.env.DATABASE;

function sendJSONResponse(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function parseRequestBody(request, callback) {
    const FORM_URLENCODED = 'application/x-www-form-urlencoded';

    if (request.headers['content-type'] === FORM_URLENCODED) {
      let body = '';
      request.on('data', chunk => {
        body += chunk.toString();
      });

      request.on('end', () => {
        callback(parse(body));
      });
    } else {
      callback(null);
    }
}

const requestHandler = (req, res) => {
  if (req.url === '/') {
    return fs.readFile('views/index.html', (err, html) => {
      if (err) throw err;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
  }

  if (req.method === 'POST' && req.url === '/new') {
    return parseRequestBody(req, body => {
      let originalUrl;
      try {
        originalUrl = new URL(body.url);
      } catch (err) {
        sendJSONResponse(res, { error: 'invalid URL' });
        return;
      }

      dns.lookup(originalUrl.hostname, (err, address) => {
        if (err) {
          sendJSONResponse(res, { error: 'invalid URL' });
          return;
        };

        MongoClient.connect(databaseUrl, { useNewUrlParser: true })
          .then(client => {
            const db = client.db('shortener');
            return shortenUrl(db, originalUrl.href);
          })
          .then(doc => {
            sendJSONResponse(res, {
              originalUrl: doc.originalUrl,
              shortUrl: doc.shortUrl,
            });
          })
          .catch(console.error);
        });
      });
  }

  if (req.url.startsWith('/r')) {
    const shortUrlCode = req.url.split('/r/')[1];

    if (shortUrlCode === undefined || shortUrlCode.trim() === '' || isNaN(shortUrlCode)) {
      sendJSONResponse(res, { error: 'Invalid short url' });
      return;
    }

    MongoClient.connect(databaseUrl, { useNewUrlParser: true })
      .then(client => {
        const db = client.db('shortener');
        return checkIfShortUrlCodeExists(db, Number(shortUrlCode));
      })
      .then(doc => {
        res.writeHead(301, { 'Location': doc.originalUrl });
        res.end();
      })
      .catch(error => {
        sendJSONResponse(res, { error: error.message });
      });
  }
};

const server = http.createServer(requestHandler);

server.listen(process.env.PORT || 4100, err => {
  if (err) throw err;

  console.log(`Server running on PORT ${server.address().port}`);
});
