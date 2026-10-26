'use strict';
// Dataset and sequence selection within each experiment.
document.querySelectorAll('[data-controls]').forEach(function (controls) {
  function update() {
    var key = controls.querySelector('[data-dataset]').value + '-' + controls.querySelector('[data-length]').value;
    document.querySelectorAll('[data-panel="' + controls.dataset.controls + '"]').forEach(function (panel) {
      panel.hidden = panel.dataset.key !== key;
    });
    window.dispatchEvent(new Event('resize'));
  }
  controls.addEventListener('change', update);
  update();
});
var experimentTabs = Array.from(document.querySelectorAll('[data-experiment]'));
function selectExperiment(tab) {
  experimentTabs.forEach(function (item) {
    var active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  });
  window.dispatchEvent(new Event('resize'));
}
experimentTabs.forEach(function (tab, i) {
  tab.addEventListener('click', function () { selectExperiment(tab); });
  tab.addEventListener('keydown', function (event) {
    var next;
    if (event.key === 'ArrowRight') next = (i + 1) % experimentTabs.length;
    if (event.key === 'ArrowLeft') next = (i + experimentTabs.length - 1) % experimentTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = experimentTabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectExperiment(experimentTabs[next]); experimentTabs[next].focus(); }
  });
});

// Schematic inference: fixed conditioning, one latent update, then the geometric effect.
var planeDemo = document.querySelector('[data-plane-demo]');
if (planeDemo) {
  var movingPlane = planeDemo.querySelector('[data-moving-plane]');
  var movingNormal = planeDemo.querySelector('[data-moving-normal]');
  var movingCenter = planeDemo.querySelector('[data-moving-center]');
  var offsetGuide = planeDemo.querySelector('[data-offset-guide]');
  var slider = planeDemo.querySelector('input[type="range"]');
  var play = planeDemo.querySelector('[data-plane-play]');
  var caption = planeDemo.querySelector('[data-plane-caption]');
  var stages = Array.from(planeDemo.querySelectorAll('[data-stage]'));
  var progress = 0, running = false, frame = null, start = 0, started = false;
  var duration = 4500;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function projectPoint(x, y, z) { return [380 + x + .55 * z, 230 - y - .35 * z]; }
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function points(angle, offset) {
    return [[-135,-65],[135,-65],[135,65],[-135,65]].map(function (uv) {
      return projectPoint(uv[0] * Math.cos(angle), uv[0] * Math.sin(angle) + offset, uv[1]).join(',');
    }).join(' ');
  }
  function line(element, a, b) {
    element.setAttribute('x1', a[0]); element.setAttribute('y1', a[1]);
    element.setAttribute('x2', b[0]); element.setAttribute('y2', b[1]);
  }
  planeDemo.querySelector('[data-fixed-plane]').setAttribute('points', points(0, 0));
  // Camera and its local plane share the same rigid transform.
  function cameraPoint(v, angle, offset) {
    return projectPoint(v[0] * Math.cos(angle) - v[1] * Math.sin(angle), v[0] * Math.sin(angle) + v[1] * Math.cos(angle) + offset, v[2]);
  }
  function cameraPath(angle, offset) {
    var vertices = [[250,80,0],[208,60,-20],[208,100,-20],[208,100,20],[208,60,20]];
    var projected = vertices.map(function(v) { return cameraPoint(v, angle, offset); });
    return [[1,2,3,4,1],[0,1],[0,2],[0,3],[0,4]].map(function(ids) {
      return ids.map(function(id,i) { return (i ? 'L' : 'M') + projected[id].join(','); }).join('');
    }).join('');
  }
  planeDemo.querySelector('[data-camera-target]').setAttribute('d',cameraPath(0,0));
  var initialCamera = cameraPoint([250,80,0], -.42, 65);
  planeDemo.querySelector('[data-camera-ghost-path]').setAttribute('d', cameraPath(-.42,65));
  var initialLabel = planeDemo.querySelector('[data-camera-initial-label]');
  initialLabel.setAttribute('x',initialCamera[0] - 30); initialLabel.setAttribute('y',initialCamera[1] + 45);
  function render() {
    var applied = smooth((progress - .65) / .35);
    var angle = -.42 + .40 * applied;
    var offset = 65 - 62 * applied;
    var phase = progress < .2 ? 0 : progress < .65 ? 1 : 2;
    planeDemo.setAttribute('data-phase', String(phase));
    var center = projectPoint(0, offset, 0);
    movingPlane.setAttribute('points', points(angle, offset));
    line(movingNormal, center, projectPoint(-95 * Math.sin(angle), offset + 95 * Math.cos(angle), 0));
    movingCenter.setAttribute('cx', center[0]); movingCenter.setAttribute('cy', center[1]);
    line(offsetGuide, projectPoint(180, 0, 0), projectPoint(180, offset, 0));
    offsetGuide.setAttribute('opacity', offset < .1 ? '0' : '1');
    var camera = cameraPoint([250,80,0],angle,offset);
    planeDemo.querySelector('[data-camera-live]').setAttribute('d',cameraPath(angle,offset));
    planeDemo.querySelector('[data-camera-ghost]').setAttribute('opacity',applied > .02 ? '.7' : '0');
    initialLabel.setAttribute('opacity',applied > .02 ? '1' : '0');
    planeDemo.querySelector('[data-camera-motion]').setAttribute('d','M'+initialCamera.join(',')+'L'+camera.join(','));
    var liveLabel = planeDemo.querySelector('[data-camera-live-label]');
    liveLabel.setAttribute('x',camera[0] - (applied === 0 ? 30 : 15)); liveLabel.setAttribute('y',camera[1] + (applied === 0 ? 45 : -40));
    liveLabel.setAttribute('opacity',applied === 0 || applied === 1 ? '1' : '0');
    liveLabel.textContent = applied === 0 ? 'Initial pose' : applied < 1 ? 'Updating pose' : 'Refined pose';
    planeDemo.querySelector('.pose-update').classList.toggle('is-active',applied > 0);
    var text = progress < .2 ? 'Initial pose: matched planes disagree.' : progress < .65 ? 'Predict a pose correction, conditioned on matched planes.' : progress < 1 ? 'Update the camera pose to align the planes.' : 'The refined pose approaches the illustrative GT as plane disagreement decreases.';
    caption.textContent = text;
    slider.value = String(Math.round(progress * 100));
    slider.setAttribute('aria-valuetext', text);
    planeDemo.setAttribute('data-progress', progress.toFixed(3));
    var phaseStarts = [0, .2, .65], phaseLengths = [.2, .45, .35];
    stages.forEach(function (button, i) {
      button.setAttribute('aria-pressed', String(i === phase));
      var fraction = Math.max(0, Math.min(1, (progress - phaseStarts[i]) / phaseLengths[i]));
      button.style.setProperty('--stage-progress', fraction.toFixed(4));
    });
  }
  function stop() {
    running = false; if (frame !== null) cancelAnimationFrame(frame); frame = null;
    play.textContent = progress >= 1 ? 'Replay animation' : 'Play animation';
  }
  function tick(now) {
    progress = Math.min(1, (now - start) / duration); render();
    if (progress >= 1) stop(); else frame = requestAnimationFrame(tick);
  }
  function begin() {
    started = true; if (progress >= 1) progress = 0;
    running = true; play.textContent = 'Pause animation'; start = performance.now() - progress * duration;
    frame = requestAnimationFrame(tick);
  }
  play.addEventListener('click', function () { if (running) stop(); else begin(); });
  slider.addEventListener('input', function () { started = true; stop(); progress = Number(slider.value) / 100; render(); play.textContent = progress >= 1 ? 'Replay animation' : 'Play animation'; });
  stages.forEach(function (button) { button.addEventListener('click', function () { started = true; stop(); progress = Number(button.dataset.stage) / 100; render(); if (!reduced.matches) begin(); }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  reduced.addEventListener('change', function () { if (reduced.matches) stop(); });
  new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) { if (!started && !reduced.matches) begin(); }
    else if (running) stop();
  }, {threshold:.5}).observe(planeDemo);
  render();
}
