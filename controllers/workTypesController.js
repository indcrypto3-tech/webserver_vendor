// Work-types feature removed. Export safe no-op handlers.
function getWorkTypes(req, res) {
  return res.status(404).json({ ok: false, error: 'work_types_removed' });
}

function seedWorkTypes() {
  // noop: work types removed from codebase
}

module.exports = { getWorkTypes, seedWorkTypes };
