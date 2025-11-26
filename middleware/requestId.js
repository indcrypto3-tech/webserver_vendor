// Ensure each request has a requestId and attach it to req and response
function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const id = incoming || generateRequestId();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = requestId;
