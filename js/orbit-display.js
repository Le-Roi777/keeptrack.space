/* global
  gl
  mat4
  Worker
  shaderLoader

  satSet
  timeManager
  groups
*/
(function () {
  var NUM_SEGS = 255;

  var inProgress = [];

  var orbitDisplay = {};

  var pathShader;

  orbitDisplay.glBuffers = [];

  var selectColor = settingsManager.orbitSelectColor;
  var hoverColor = settingsManager.orbitHoverColor;
  var inViewColor = settingsManager.orbitInViewColor;
  var groupColor = settingsManager.orbitGroupColor;

  var currentHoverId = -1;
  var currentSelectId = -1;
  var currentInView = [];

  var orbitMvMat = mat4.create();

  var orbitWorker = new Worker(settingsManager.installDirectory + 'js/orbit-calculation-worker.js');

  var initialized = false;

  orbitDisplay.init = function () {
    orbitDisplay.material = new THREE.LineBasicMaterial( { color: 0x0000ff } );

    orbitDisplay.selectOrbitBuf = new THREE.Line(new THREE.BufferGeometry().setAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array((NUM_SEGS + 1) * 3), 3 )), orbitDisplay.material);
    orbitDisplay.hoverOrbitBuf = new THREE.Line(new THREE.BufferGeometry().setAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array((NUM_SEGS + 1) * 3), 3 )), orbitDisplay.material);
    canvasManager.scene.add(orbitDisplay.selectOrbitBuf);
    canvasManager.scene.add(orbitDisplay.hoverOrbitBuf);

    orbitDisplay.glBuffers = new THREE.Group();
    for (var i = 0; i < satSet.missileSats; i++) {
      orbitDisplay.glBuffers.add(allocateBuffer());
      orbitDisplay.glBuffers.children[i].visible = false;
    }
    canvasManager.scene.add(orbitDisplay.glBuffers);


    orbitWorker.postMessage({
      isInit: true,
      satData: satSet.satDataString,
      numSegs: NUM_SEGS
    });
    initialized = true;

    // Discard now that we are loaded
    satSet.satDataString = null;
    objectManager.fieldOfViewSet = null;

    // var time = performance.now() - startTime;
    // console.log('orbitDisplay init: ' + time + ' ms');
  };

  orbitDisplay.updateOrbitBuffer = function (satId, force, TLE1, TLE2, missile, latList, lonList, altList) {
    if (!inProgress[satId] && !satSet.getSat(satId).static) {
      if (force) {
        orbitWorker.postMessage({
          isInit: false,
          isUpdate: true,
          satId: satId,
          realTime: timeManager.propRealTime,
          offset: timeManager.propOffset,
          rate: timeManager.propRate,
          TLE1: TLE1,
          TLE2: TLE2
        });
      } else if (missile) {
        orbitWorker.postMessage({
          isInit: false,
          isUpdate: true,
          missile: true,
          satId: satId,
          latList: latList,
          lonList: lonList,
          altList: altList
        });
      } else {
        orbitWorker.postMessage({
          isInit: false,
          satId: satId,
          realTime: timeManager.propRealTime,
          offset: timeManager.propOffset,
          rate: timeManager.propRate
        });
        inProgress[satId] = true;
      }
    } else {
    }
  };

  orbitWorker.onmessage = function (m) {
    orbitDisplay.glBuffers.children[m.data.satId].geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array(m.data.pointsOut), 3 ));
    orbitDisplay.glBuffers.children[m.data.satId].geometry.attributes.position.needsUpdate = true;
    inProgress[m.data.satId] = false;
  };

  orbitDisplay.setSelectOrbit = function (satId) {
    currentSelectId = satId;
    orbitDisplay.updateOrbitBuffer(satId);
  };

  orbitDisplay.clearSelectOrbit = function () {
    currentSelectId = -1;
    orbitDisplay.selectOrbitBuf.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array((NUM_SEGS + 1) * 3), 3 ));
    orbitDisplay.selectOrbitBuf.geometry.attributes.position.needsUpdate = true;
    orbitDisplay.selectOrbitBuf.visible = false;
  };

  orbitDisplay.addInViewOrbit = function (satId) {
    for (var i = 0; i < currentInView.length; i++) {
      if (satId === currentInView[i]) return;
    }
    currentInView.push(satId);
    orbitDisplay.updateOrbitBuffer(satId);
  };

  orbitDisplay.removeInViewOrbit = function (satId) {
    var r = null;
    for (var i = 0; i < currentInView.length; i++) {
      if (satId === currentInView[i]) {
        r = i;
      }
    }
    if (r === null) return;
    currentInView.splice(r, 1);
    orbitDisplay.updateOrbitBuffer(satId);
  };

  orbitDisplay.clearInViewOrbit = function (satId) {
    if (currentInView === []) return;
    currentInView = [];
  };

  orbitDisplay.setHoverOrbit = function (satId) {
    if (satId === currentHoverId) return;
    currentHoverId = satId;
    orbitDisplay.updateOrbitBuffer(satId);
  };

  orbitDisplay.clearHoverOrbit = function (satId) {
    if (currentHoverId === -1) return;
    currentHoverId = -1;
    orbitDisplay.hoverOrbitBuf.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array((NUM_SEGS + 1) * 3), 3 ));
    orbitDisplay.hoverOrbitBuf.visible = false;
    orbitDisplay.hoverOrbitBuf.geometry.attributes.position.needsUpdate = true;
  };

  orbitDisplay.draw = function (pMatrix, camMatrix) { // lol what do I do here
    if (!initialized) return;

    if (currentSelectId !== -1 && !satSet.getSatExtraOnly(currentSelectId).static) {
      // gl.uniform4fv(pathShader.uColor, selectColor);
      orbitDisplay.glBuffers.children[currentSelectId].visible = true;
    }

    if (currentHoverId !== -1 && currentHoverId !== currentSelectId && !satSet.getSatExtraOnly(currentHoverId).static) { // avoid z-fighting
      // gl.uniform4fv(pathShader.uColor, hoverColor);
      orbitDisplay.glBuffers.children[currentHoverId].visible = true;
    }

    if (currentInView.length >= 1) { // There might be some z-fighting
      // gl.uniform4fv(pathShader.uColor, inViewColor);
      currentInView.forEach(function (id) {
        orbitDisplay.glBuffers.children[id].visible = true;
      });
    }

    if (groups.selectedGroup !== null && !settingsManager.isGroupOverlayDisabled) {
      // gl.uniform4fv(pathShader.uColor, groupColor);
      groups.selectedGroup.forEach(function (id) {
        orbitDisplay.glBuffers.children[id].visible = true;
      });
    }

    // Done drawing
    return true;
  };

  function allocateBuffer () {
    return new THREE.Line(new THREE.BufferGeometry().setAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array((NUM_SEGS + 1) * 3), 3 )), orbitDisplay.material);
  }

  orbitDisplay.getPathShader = function () {
    return pathShader;
  };

  window.orbitDisplay = orbitDisplay;
})();
