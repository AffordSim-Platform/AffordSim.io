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

const backgroundVideo = document.querySelector('#background-video');
const sceneCaption = document.querySelector('#scene-caption');
const sceneDescription = document.querySelector('#scene-description');
const scenes = {
  coffee: { name: 'Coffee shop', description: 'Franka FR3 · Pick banana and place on plate' },
  library: { name: 'Library', description: 'UR5e · Pick chocolate box and place on sugar box' },
  workshop: { name: 'Workshop', description: 'Kinova Gen3 · Pick bowl and place on plate' }
};
const viewpoints = {
  '02': { name: 'View 1', angle: '−90 degrees' },
  '04': { name: 'View 2', angle: '−60 degrees' },
  '06': { name: 'View 3', angle: '−30 degrees' }
};
let currentScene = 'coffee';
let pendingLoad = false;
let playbackIntent = true;
let requestedTime = 0;
let sceneRequest = 0;

if (backgroundVideo && sceneCaption && sceneDescription) {
  backgroundVideo.addEventListener('play', () => { if (!pendingLoad) playbackIntent = true; });
  backgroundVideo.addEventListener('pause', () => { if (!pendingLoad) playbackIntent = false; });

  const updateBackgroundVideo = () => {
    const scene = document.querySelector('input[name="scene"]:checked')?.value;
    const view = document.querySelector('input[name="view"]:checked')?.value;
    if (!scenes[scene] || !viewpoints[view]) return;
    const request = ++sceneRequest;
    const sameScene = scene === currentScene;
    if (!pendingLoad) {
      playbackIntent = !backgroundVideo.paused && !backgroundVideo.ended;
      requestedTime = Number.isFinite(backgroundVideo.currentTime) ? backgroundVideo.currentTime : 0;
    }
    if (!sameScene) requestedTime = 0;
    currentScene = scene;
    const { name, description } = scenes[scene];
    const { name: viewName, angle } = viewpoints[view];
    sceneDescription.textContent = description;
    sceneCaption.textContent = `${name}, ${description}, ${viewName}, orbit angle ${angle}.`;
    backgroundVideo.setAttribute('aria-label', `${description}, ${name}, ${viewName}, orbit angle ${angle}`);
    pendingLoad = true;
    backgroundVideo.autoplay = playbackIntent;
    backgroundVideo.src = `assets/background-${scene}-${view}.mp4`;
    backgroundVideo.onloadedmetadata = () => {
      if (request !== sceneRequest) return;
      if (Number.isFinite(backgroundVideo.duration)) {
        backgroundVideo.currentTime = Math.min(requestedTime, Math.max(0, backgroundVideo.duration - 0.05));
      }
      pendingLoad = false;
      if (playbackIntent) backgroundVideo.play().catch(() => {});
      else backgroundVideo.pause();
    };
    backgroundVideo.onerror = () => { if (request === sceneRequest) pendingLoad = false; };
    backgroundVideo.load();
  };
  for (const input of document.querySelectorAll('input[name="scene"], input[name="view"]')) {
    input.addEventListener('change', () => { if (input.checked) updateBackgroundVideo(); });
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
