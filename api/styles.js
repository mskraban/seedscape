'use strict';
const { describe } = require('../lib/render');

/** GET /api/styles — everything the API supports, as JSON. */
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.statusCode = 200;
  res.end(JSON.stringify(describe(), null, 2));
};
