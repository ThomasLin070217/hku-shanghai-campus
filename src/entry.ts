const entry = new URLSearchParams(location.search).get('experience') ??
  (import.meta.env.MODE === 'playtest' ? 'levels' : 'opening');
if ((import.meta.env.DEV || import.meta.env.MODE === 'review') && entry === 'macbook-lab') {
  void import('./review/macbookLab');
} else if (entry === 'levels') {
  void import('./levels/menu');
} else if (entry === 'lion-boss') {
  void import('./lionBoss/play');
} else {
  void import('./main');
}
