const entry = new URLSearchParams(location.search).get('experience');
if (entry === 'lion-boss') {
  void import('./lionBoss/play');
} else {
  void import('./main');
}
