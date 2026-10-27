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
const sceneNames = { coffee: 'Coffee shop', library: 'Library', workshop: 'Workshop' };
let sceneRequest = 0;
for (const input of document.querySelectorAll('input[name="scene"]')) {
  input.addEventListener('change', () => {
    if (!input.checked || !backgroundVideo || !sceneCaption) return;
    const request = ++sceneRequest;
    const wasPlaying = !backgroundVideo.paused && !backgroundVideo.ended;
    const oldTime = Number.isFinite(backgroundVideo.currentTime) ? backgroundVideo.currentTime : 0;
    const name = sceneNames[input.value];
    // Changing src with the autoplay attribute still enabled can restart a
    // video that the visitor explicitly paused.
    backgroundVideo.autoplay = wasPlaying;
    backgroundVideo.src = `assets/background-${input.value}.mp4`;
    backgroundVideo.setAttribute('aria-label', `Simulated trajectory with ${name.toLowerCase()} background`);
    sceneCaption.textContent = `${name} background. A shared recorded simulation trajectory is composited with the calibrated scene background.`;
    backgroundVideo.addEventListener('loadedmetadata', () => {
      if (request !== sceneRequest) return;
      if (Number.isFinite(backgroundVideo.duration)) {
        backgroundVideo.currentTime = Math.min(oldTime, Math.max(0, backgroundVideo.duration - 0.05));
      }
      if (wasPlaying) backgroundVideo.play().catch(() => {});
      else backgroundVideo.pause();
    }, { once: true });
    backgroundVideo.load();
  });
}
