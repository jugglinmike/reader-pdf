'use strict';

const https = require('https');
const http = require('http');

const { jsdom } = require('jsdom');
const { Readability } = require('./readability/index');
const htmlPdf = require('html-pdf');

function toFilename(title) {
  return title
    .replace(/ /g, '-')
    .replace(/[^a-z0-9_-]/ig, '_')
    .replace(/_+/g, '_')
    .replace(/^/, (new Date()).toISOString().slice(0, 10) + '-')
    .toLowerCase() + '.pdf';
}

function get(url) {
  const method = /^https:/i.test(url) ? https.get : http.get;

  return new Promise((resolve, reject) => {
      method(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400) {
          get(response.headers.location)
            .then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error('HTTP error ' + response.statusCode));
          return;
        }
        response.setEncoding('utf8');

        let contents = '';
        response.on('data', (chunk) => contents += chunk);
        response.on('end', () => resolve(contents));
      }).on('error', reject);
    });
}

function open(markup) {
  return new Promise((resolve, reject) => {
      jsdom.env({
        html: markup,
        done(err, window) {
          err ? reject(err) : resolve(window);
        }
      });
    });
}

function toPdf({filename, url, markup}) {
  const options =  {
    format: 'Letter',
  };
  const header = `<div style="font-size: 0.7em; color: rgba(0, 0, 0, 0.4); text-align: right;">
    ${url}<br />
    retrieved: ${(new Date()).toISOString()}
  </div>`;

  return new Promise((resolve, reject) => {
      htmlPdf.create(header + markup, options)
        .toFile(filename, (err, x) => {
            err ? reject(err) : resolve();
          });
    });
}

(async () => {
  const url = process.argv[2];
  const outFile = process.argv[3];

  if (!url) {
    throw new Error('URL not specified.');
  }

  if (!outFile) {
    console.error('Output file not specified. Inferring from document title.');
  }

  console.error('Fetching web page...');

  const rawMarkup = await get(url);
  const window = await open(rawMarkup);
  const reader = new Readability(window.document);

  const markup = reader.parse().content;
  const filename = outFile || toFilename(window.document.title);

  console.error('Saving to ' + filename);

  await toPdf({ filename, url, markup });
})();
