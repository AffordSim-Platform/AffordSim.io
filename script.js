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

// All filters use the same manifest in the same row-major order as the GIF.
// Selecting a different filter replaces the previous one; clicking again clears it.
const taskGallery = document.querySelector('.benchmark-figure');
const skillButtons = [...document.querySelectorAll('.skill-list button[data-skill]')];
const difficultyButtons = [...document.querySelectorAll('.difficulty-button[data-difficulty]')];
const skillStatus = document.querySelector('#skill-status');
const benchmarkTasks = window.AFFORDSIM_BENCHMARK_TASKS;
if (taskGallery && Array.isArray(benchmarkTasks) && benchmarkTasks.length === 50) {
  const overlay = document.createElement('div');
  overlay.className = 'task-highlight-grid';
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', '50 benchmark tasks, ordered by difficulty');
  const cells = benchmarkTasks.map(task => {
    const cell = document.createElement('button');
    const label = task.id.replaceAll('_', ' ');
    cell.type = 'button';
    cell.className = 'task-highlight-cell';
    cell.dataset.task = task.id;
    cell.dataset.label = label;
    cell.setAttribute('aria-label', `${label} (${task.difficulty})`);
    cell.setAttribute('aria-pressed', 'false');
    cell.addEventListener('click', () => {
      const show = cell.getAttribute('aria-pressed') !== 'true';
      for (const item of overlay.children) {
        item.classList.remove('is-inspected');
        item.setAttribute('aria-pressed', 'false');
      }
      cell.classList.toggle('is-inspected', show);
      cell.setAttribute('aria-pressed', String(show));
    });
    overlay.appendChild(cell);
    return cell;
  });
  taskGallery.appendChild(overlay);
  const allButtons = [...skillButtons, ...difficultyButtons];
  for (const button of allButtons) {
    button.addEventListener('click', () => {
      const activate = button.getAttribute('aria-pressed') !== 'true';
      for (const item of allButtons) {
        const selected = activate && item === button;
        item.setAttribute('aria-pressed', String(selected));
        if (item.matches('.difficulty-button')) {
          item.closest('li').classList.toggle('is-selected', selected);
        }
      }
      const matches = task => button.dataset.difficulty
        ? task.difficulty === button.dataset.difficulty
        : task.skills.includes(button.dataset.skill);
      let count = 0;
      overlay.classList.toggle('is-filtering', activate);
      for (const [index, cell] of cells.entries()) {
        const match = activate && matches(benchmarkTasks[index]);
        cell.classList.toggle('is-match', match);
        cell.style.setProperty('--skill-color', button.dataset.color);
        if (match) count += 1;
      }
      if (skillStatus) skillStatus.textContent = activate
        ? `${button.textContent.trim()}: ${count} matching tasks highlighted. Select again to clear.`
        : 'All task examples shown.';
    });
  }
} else if (taskGallery && skillStatus) {
  skillStatus.textContent = 'Task highlighting is unavailable because the gallery manifest is missing or incomplete.';
}
