function readDateRange() {
  const from = document.getElementById('date-from')?.value || '';
  const to = document.getElementById('date-to')?.value || '';
  return { from, to };
}

function matchesRange(iso, from, to) {
  if (!iso) return false;
  const d = new Date(iso).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to && d > new Date(to + 'T23:59:59Z').getTime()) return false;
  return true;
}
