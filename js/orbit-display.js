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
  var NUM_SEGS = 511;

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
    orbitDisplay.materialRed = new THREE.LineBasicMaterial({
      color: 0xff0000,
      linewidth: 3,
      polygonOffset: true,
      polygonOffsetFactor: -5.0,
      polygonOffsetUnits: 10.0,
    });

    orbitDisplay.materialYellow = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 3,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: 1.0,
    });

    let lineBuf = new THREE.BufferGeometry();
    lineBuf.setAttribute('position', new THREE.BufferAttribute( new Float32Array((NUM_SEGS + 1) * 3), 3 ));
    orbitDisplay.selectOrbitBuf = new THREE.Line(lineBuf, orbitDisplay.materialRed);
    orbitDisplay.hoverOrbitBuf = new THREE.Line(lineBuf, orbitDisplay.materialYellow);
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
    orbitDisplay.glBuffers.children[m.data.satId].geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(m.data.pointsOut), 3 ));
    orbitDisplay.glBuffers.children[m.data.satId].geometry.rotateX(-90 * DEG2RAD);
    orbitDisplay.glBuffers.children[m.data.satId].geometry.attributes.position.needsUpdate = true;
    inProgress[m.data.satId] = false;
  };

  orbitDisplay.setSelectOrbit = function (satId) {
    // Reset Any Red Orbits
    if (currentSelectId !== -1) {
      orbitDisplay.glBuffers.children[currentSelectId].material = orbitDisplay.materialYellow;
    }
    // Set Red Orbits
    currentSelectId = satId;
    orbitDisplay.glBuffers.children[satId].material = orbitDisplay.materialRed;
    orbitDisplay.updateOrbitBuffer(satId);
  };

  orbitDisplay.clearSelectOrbit = function () {
    // Reset Any Red Orbits
    if (currentSelectId !== -1) {
      orbitDisplay.glBuffers.children[currentSelectId].material = orbitDisplay.materialYellow;
    }
    currentSelectId = -1;
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
    // Show Orbit Through Earth
    // orbitDisplay.glBuffers.children[currentHoverId].material.depthTest = false;
    orbitDisplay.updateOrbitBuffer(satId);
  };

  orbitDisplay.clearHoverOrbit = function (satId) {
    if (currentHoverId === -1) return;
    // Hide Orbit Through Earth
    // orbitDisplay.glBuffers.children[currentHoverId].material.depthTest = true;
    currentHoverId = -1;
    orbitDisplay.hoverOrbitBuf.visible = false;
  };

  orbitDisplay.draw = function () {
    if (!initialized) return;

    if (currentSelectId !== -1 && !satSet.getSatExtraOnly(currentSelectId).static) {
      orbitDisplay.glBuffers.children[currentSelectId].visible = true;
    }

    if (currentHoverId !== -1 && currentHoverId !== currentSelectId && !satSet.getSatExtraOnly(currentHoverId).static) { // avoid z-fighting
      orbitDisplay.glBuffers.children[currentHoverId].visible = true;
    }

    if (currentInView.length >= 1) { // There might be some z-fighting
      currentInView.forEach(function (id) {
        orbitDisplay.glBuffers.children[id].visible = true;
      });
    }

    if (groups.selectedGroup !== null && !settingsManager.isGroupOverlayDisabled) {
      groups.selectedGroup.forEach(function (id) {
        orbitDisplay.glBuffers.children[id].visible = true;
      });
    }

    // Done drawing
    return true;
  };

  function allocateBuffer () {
    let lineBuf = new THREE.BufferGeometry();
    lineBuf.setAttribute('position', new THREE.BufferAttribute( new Float32Array((NUM_SEGS + 1) * 3), 3 ));
    let line = new THREE.Line(lineBuf, orbitDisplay.materialYellow);
    return line;
  }

  orbitDisplay.getPathShader = function () {
    return pathShader;
  };

  window.orbitDisplay = orbitDisplay;
})();
