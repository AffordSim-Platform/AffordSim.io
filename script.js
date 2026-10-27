const copyButton = document.querySelector('#copy-citation');
const copyStatus = document.querySelector('#copy-status');
if (copyButton && copyStatus) {
  copyButton.addEventListener('click', async () => {
    const citation = document.querySelector('#bibtex').textContent;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(citation);
      copyButton.textContent = 'Copied';
      copyStatus.textContent = 'Citation copied to clipboard.';
      window.setTimeout(() => { copyButton.textContent = 'Copy citation'; }, 2000);
    } catch (_) {
      copyStatus.textContent = 'Copy unavailable. Select the citation text to copy it.';
      copyButton.textContent = 'Select text to copy';
    }
  });
}

// Each scene has an independently controlled, twice-speed video.
const viewpoints = {
  '02': { name: 'View 1', angle: '−90 degrees' },
  '04': { name: 'View 2', angle: '−60 degrees' },
  '06': { name: 'View 3', angle: '−30 degrees' }
};
for (const demo of document.querySelectorAll('.scene-demo')) {
  const scene = demo.dataset.scene;
  const name = demo.querySelector('h4').textContent;
  const task = demo.querySelector('.scene-task').textContent;
  const video = demo.querySelector('.background-video');
  const caption = demo.querySelector('.scene-caption');
  let request = 0;
  let pendingLoad = false;
  let playbackIntent = true;
  let requestedTime = 0;
  video.defaultPlaybackRate = 2;
  video.playbackRate = 2;
  video.addEventListener('play', () => { if (!pendingLoad) playbackIntent = true; });
  video.addEventListener('pause', () => { if (!pendingLoad) playbackIntent = false; });
  for (const input of demo.querySelectorAll('input[type="radio"]')) {
    input.addEventListener('change', () => {
      if (!input.checked || !viewpoints[input.value]) return;
      const currentRequest = ++request;
      if (!pendingLoad) {
        playbackIntent = !video.paused && !video.ended;
        requestedTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      }
      const { name: viewName, angle } = viewpoints[input.value];
      caption.textContent = `${name}, ${task}, ${viewName}, orbit angle ${angle}.`;
      video.setAttribute('aria-label', `${name}, ${task}, ${viewName}, orbit angle ${angle}`);
      pendingLoad = true;
      video.autoplay = playbackIntent;
      video.src = `assets/background-${scene}-${input.value}.mp4`;
      video.onloadedmetadata = () => {
        if (currentRequest !== request) return;
        video.defaultPlaybackRate = 2;
        video.playbackRate = 2;
        if (Number.isFinite(video.duration)) {
          video.currentTime = Math.min(requestedTime, Math.max(0, video.duration - 0.05));
        }
        pendingLoad = false;
        if (playbackIntent) video.play().catch(() => {});
        else video.pause();
      };
      video.onerror = () => { if (currentRequest === request) pendingLoad = false; };
      video.load();
    });
  }
}

// Highlight the matching cells of the 10-by-5 animated task gallery.
const taskGallery = document.querySelector('.benchmark-figure');
const skillButtons = [...document.querySelectorAll('.skill-list button[data-tasks]')];
const skillStatus = document.querySelector('#skill-status');
if (taskGallery && skillButtons.length) {
  const overlay = document.createElement('div');
  overlay.className = 'task-highlight-grid';
  overlay.setAttribute('aria-hidden', 'true');
  const cells = Array.from({ length: 50 }, (_, index) => {
    const cell = document.createElement('span');
    cell.className = 'task-highlight-cell';
    cell.dataset.task = String(index + 1);
    overlay.appendChild(cell);
    return cell;
  });
  taskGallery.appendChild(overlay);
  for (const button of skillButtons) {
    button.addEventListener('click', () => {
      const activate = button.getAttribute('aria-pressed') !== 'true';
      skillButtons.forEach(item => item.setAttribute('aria-pressed', String(activate && item === button)));
      overlay.classList.toggle('is-filtering', activate);
      const matching = new Set(button.dataset.tasks.split(',').map(item => Number(item.trim())));
      for (const [index, cell] of cells.entries()) {
        cell.classList.toggle('is-match', activate && matching.has(index + 1));
        cell.style.setProperty('--skill-color', button.dataset.color);
      }
      if (skillStatus) skillStatus.textContent = activate
        ? `${button.textContent.trim()}: ${matching.size} matching task examples highlighted. Select again to clear.`
        : 'All task examples shown.';
    });
  }
}

// Select a difficulty tier to emphasize its explanation.
const difficultyButtons = [...document.querySelectorAll('.difficulty-button')];
for (const button of difficultyButtons) {
  button.addEventListener('click', () => {
    const select = button.getAttribute('aria-pressed') !== 'true';
    for (const item of difficultyButtons) {
      const active = select && item === button;
      item.setAttribute('aria-pressed', String(active));
      item.closest('li').classList.toggle('is-selected', active);
    }
  });
}
