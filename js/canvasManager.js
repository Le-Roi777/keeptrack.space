var canvasDOM = $('#keeptrack-canvas');
var canvasDOM2 = $('#keep3-canvas');

var RADIUS_OF_DRAW_SUN = 6600;
var SUN_SCALAR_DISTANCE = 250000;

var RADIUS_OF_DRAW_MOON = 6500;
var MOON_SCALAR_DISTANCE = 7500;

let lastDrawTime = 0;
var earth = {};
earth.lightDirection = [];
let earthInfo = {};
let earthNow = 0;
let createClockDOMOnce = false;

var isPropRateVisible = false;

let satBuf;
// let satPosBuf;
// let starPosBuf;
// let pickColorBuf;

var isHoverBoxVisible = false;
var rotateTheEarthSpeed = 0.000075; // Adjust to change camera speed when rotating around earth
var isShowDistance = true;

earthInfo.earthJ = 0;
earthInfo.earthEra = 0;
earthInfo.timeTextStr = '';
earthInfo.timeTextStrEmpty = '';
earthInfo.propRateDOM = $('#propRate-status-box');

canvasManager = {};
canvasManager.start = () => {
  canvasManager.addLine = (points) => {
    for (var i = 0; i < points.length; i++) {
      canvasManager.lines.push(points[i]);
    }
  };
  canvasManager.initSun = () => {
    // Sun Object
    {
      const radius =  RADIUS_OF_DRAW_SUN;
      const widthSegments = 32;
      const heightSegments = 32;
      const geometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);
      const color = 0x44aa88;
      const material = new THREE.MeshBasicMaterial({
        map: loader.load(settingsManager.installDirectory + 'images/sun-1024.jpg'),
      });

      const sunObj = new THREE.Mesh(geometry, material);
      canvasManager.objects.sun = sunObj;
    }
    // Sun's Light
    {
      const color = 0xFFFFFF;
      const intensity = 1;
      // canvasManager.objects.sun.lightEarth = new THREE.DirectionalLight(color, intensity);
      canvasManager.objects.sun.lightMoon = new THREE.DirectionalLight(color, intensity);
    }
  };
  canvasManager.initEarth = () => {
    // Make Earth and Black Earth
    {
      const radius =  RADIUS_OF_EARTH;
      const widthSegments = 512;
      const heightSegments = 512;
      const geometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);

      let uniforms = {
        uSampler: {type: THREE.Texture, value: loader.load(settingsManager.installDirectory + 'images/no_clouds_4096.jpg')},
        uNightSampler: {type: THREE.Texture, value: loader.load(settingsManager.installDirectory + 'images/nightearth-4096.png')},
        uLightDirection: {type: 'vec3', value: earth.lightDirection}
      };

      sun.currentDirection();

      const fs = `
          uniform vec3 uLightDirection;

          varying vec2 texCoord;
          varying vec3 vnormal;

          uniform sampler2D uSampler;
          uniform sampler2D uNightSampler;

          void main(void) {
            float directionalLightAmount = max(dot(vnormal, uLightDirection), 0.0);
            vec3 lightColor = vec3(0.0,0.0,0.0) + (vec3(1.0,1.0,1.0) * directionalLightAmount);
            vec3 litTexColor = texture2D(uSampler, texCoord).rgb * lightColor * 2.0;

            vec3 nightLightColor = texture2D(uNightSampler, texCoord).rgb * pow(1.0 - directionalLightAmount, 2.0) ;

            gl_FragColor = vec4(litTexColor + nightLightColor, 1.0);
          }`;
      const vs = `
          varying vec2 texCoord;
          varying vec3 vnormal;
          varying float directionalLightAmount;

          void main(void) {
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewPosition;

            texCoord = uv;
            vnormal = normal;
          }`;

      const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vs,
        fragmentShader: fs
      });

      material.renderOrder = 1;

      const materialBlack = new THREE.MeshBasicMaterial({
        color: 0x000000
      });

      let earthObj = new THREE.Mesh(geometry, material);
      let earthMask = new THREE.Mesh(geometry, materialBlack);
      canvasManager.objects.earth = earthObj;
      canvasManager.objects.earthMask = earthMask;
    }
    // Make Raycaster for Finding Earth Lat/Lon
    {
      canvasManager.raycaster = new THREE.Raycaster();
    }
  };
  canvasManager.initMoon = () => {
    const radius =  RADIUS_OF_DRAW_MOON;
    const widthSegments = 64;
    const heightSegments = 64;
    const geometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);
    const material = new THREE.MeshLambertMaterial({
      map: loader.load(settingsManager.installDirectory + 'images/moon-1024.jpg'),
    });

    let moon = new THREE.Mesh(geometry, material);
    canvasManager.objects.moon = moon;
  };
  canvasManager.sats = [];
  canvasManager.initSats = () => {
    satBuf = new THREE.BufferGeometry();
    satBuf.boundingBox = null;
    satBuf.computeBoundingSphere();
    satBuf.boundingSphere.radius += 10;

    satBuf.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(satPos), 3));
    satBuf.setAttribute(
      'colorId',
      new THREE.BufferAttribute(new Float32Array(pickColorData), 3));
    satBuf.setAttribute(
      'isStar',
      new THREE.BufferAttribute(new Float32Array(starBufData), 1));

    let uniforms = {
      minSize: {value: 10.0},
      maxSize: {value: 50.0}
    };

    let material =  new THREE.ShaderMaterial({
      uniforms: uniforms,
      depthWrite: false,
      // vertexColors: true, - Cant do this AND custom shaders
      // precision: 'highp',
      blending: THREE.NormalBlending,
      fragmentShader: shaderLoader.shaderData[8].code,
      vertexShader: shaderLoader.shaderData[10].code,
    });
    // Disable for debug to see objects real size
    material.transparent = true;
    material.renderOrder = 5;

    canvasManager.objects.sats = new THREE.Points(satBuf,material);

    var vs3D = `
    attribute vec3 colorId;
    attribute float isStar;
    attribute float pickable;

    uniform float minSize;
    uniform float maxSize;

    varying vec3 vcolorId;

    void main(void){
      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);

      gl_Position = projectionMatrix * modelViewPosition;
      gl_PointSize = min(max(pow(15000.0 \/ gl_Position.z, 2.1), minSize * isStar), maxSize \/ 2.0) * 1.0 * pickable;

      vcolorId = colorId;
    }`;

    var fs3D = `
    varying vec3 vcolorId;
    void main(void) {
      gl_FragColor = vec4(vcolorId.rgb,1.0);
    }`;

    var pickingMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vs3D,
        fragmentShader: fs3D,
        transparent: false
    });

    canvasManager.objects.pickableSats = new THREE.Points(satBuf,pickingMaterial);
  };

  const loader = new THREE.TextureLoader();

  function main() {
    const canvas = document.getElementById('keep3-canvas');

    canvasManager.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true
    });

    // picking
    canvasManager.pickingScene = new THREE.Scene();
    canvasManager.pickingTexture = new THREE.WebGLRenderTarget(canvas.width, canvas.height);
    // canvasManager.pickingTexture.texture.minFilter = THREE.LinearFilter;

    canvasManager.resizeCanvas = () => {
      let dpi;
      if (typeof settingsManager.dpi != 'undefined') {
        dpi = settingsManager.dpi;
      } else {
        dpi = window.devicePixelRatio;
      }

      canvasManager.renderer.setPixelRatio( dpi );

      if (settingsManager.screenshotMode) {
        canvas.width = settingsManager.hiResWidth;
        canvas.height = settingsManager.hiResHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      canvasManager.aspect = canvas.width / canvas.height;  // the canvas default
      canvasManager.camera = new THREE.PerspectiveCamera(canvasManager.fov, canvasManager.aspect, canvasManager.near, canvasManager.far);

      canvasManager.pickingTexture.width = canvas.width;
      canvasManager.pickingTexture.height = canvas.height;

      canvasManager.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true
      });
      canvasManager.aspect = canvas.width / canvas.height;
    };
    canvasManager.resizeCanvas();

    canvasManager.fov = 75;
    canvasManager.aspect = canvas.width / canvas.height;  // the canvas default
    canvasManager.near = 0.1;
    canvasManager.far = 600000;
    canvasManager.camera = new THREE.PerspectiveCamera(canvasManager.fov, canvasManager.aspect, canvasManager.near, canvasManager.far);
    canvasManager.camera.position.z = 20000;
    canvasManager.camera.position.x = 0;
    canvasManager.camera.position.y = 0;

    canvasManager.scene = new THREE.Scene();
    canvasManager.scene.background = new THREE.Color('black');
    // canvasManager.pickingScene.background = new THREE.Color('red');

    canvasManager.objects = {};
    canvasManager.objects.ambientLight = new THREE.AmbientLight( 0x555555 ); // soft white light

    canvasManager.initEarth();
    canvasManager.initMoon();
    canvasManager.initSun();
    canvasManager.initSats();

    var time, drawNow, dt;

    // updateHover
    var updateHoverSatId, updateHoverSatPos;

    // _unProject variables
    var glScreenX, glScreenY, screenVec, comboPMat, invMat, worldVec, gCPr, gCPz,
        gCPrYaw, gCPx, gCPy, fpsTimeNow, fpsElapsed, satData, dragTarget;

    // drawLoop camera variables
    var xDif, yDif, yawTarget, pitchTarget, dragPointR, dragTargetR, dragPointLon,
        dragTargetLon, dragPointLat, dragTargetLat, pitchDif, yawDif;

    // getEarthScreenPoint
    var rayOrigin, ptThru, rayDir, toCenterVec, dParallel, longDir, dPerp, dSubSurf,
        dSurf, ptSurf;

    function render(renderTime) {
      // Setup Time
      {
        drawNow = Date.now();
        dt = drawNow - (time || drawNow);
        if (typeof drawLoopCount != 'undefined') {
          drawLoopCount++;
          if (drawLoopCount > 100) {
            drawLoopCount = null;
            return;
          }
          if (drawLoopCount > 50) {
            if (dt > 500 && !settingsManager.isSlowCPUModeEnabled) {
              // Method of determining if computer is slow
              // selectSat(-1);
              // M.toast({html: `Computer is slow!</br>Forcing Mobile Mode`});
              // settingsManager.isMobileModeEnabled = true;
              // settingsManager.fieldOfView = settingsManager.fieldOfViewMax;
              // webGlInit();
              // settingsManager.isDisableSatHoverBox = true;
              // enableSlowCPUMode();
            }
          }
        }
        if (dt > 20) {
          updateHoverDelayLimit = 10;
        } else if (dt > 50) {
          updateHoverDelayLimit = 15;
        } else {
          if (updateHoverDelayLimit > 1)
          --updateHoverDelayLimit;
        }


        time = drawNow;
        // Update Official Time
        timeManager.lastDrawTime = drawNow;
      }

      // Setup Camera Pitch/yaw
      {
        if ((isDragging && !settingsManager.isMobileModeEnabled) ||
             isDragging && settingsManager.isMobileModeEnabled && (mouseX !== 0 || mouseY !== 0)) {
          // Raycasting on the Earth Disabled - Feels Faster
          {
            // dragTarget = getEarthScreenPoint(mouseX, mouseY);
            // if (typeof dragPoint == 'undefined' || typeof dragTarget == 'undefined' ||
            //     typeof dragTarget.uv.x == 'undefined' || typeof dragTarget.uv.y == 'undefined' ||
            //     typeof dragPoint.uv.x == 'undefined' || typeof dragPoint.uv.y == 'undefined' ||
            // cameraType.current === cameraType.FPS || cameraType.current === cameraType.SATELLITE || cameraType.current=== cameraType.ASTRONOMY ||
            // settingsManager.isMobileModeEnabled) { // random screen drag
            //   xDif = screenDragPoint[0] - mouseX;
            //   yDif = screenDragPoint[1] - mouseY;
            //   yawTarget = dragStartYaw + xDif * settingsManager.cameraMovementSpeed;
            //   pitchTarget = dragStartPitch + yDif * -settingsManager.cameraMovementSpeed;
            //   camPitchSpeed = _normalizeAngle(camPitch - pitchTarget) * -settingsManager.cameraMovementSpeed;
            //   camYawSpeed = _normalizeAngle(camYaw - yawTarget) * -settingsManager.cameraMovementSpeed;
            // } else {  // earth surface point drag
            //   pitchDif = dragPoint.uv.y - dragTarget.uv.y;
            //   yawDif = _normalizeAngle(dragPoint.uv.x - dragTarget.uv.x);
            //   camPitchSpeed = pitchDif * settingsManager.cameraMovementSpeed;
            //   camYawSpeed = yawDif * settingsManager.cameraMovementSpeed;
            // }
          }

          xDif = screenDragPoint[0] - mouseX;
          yDif = screenDragPoint[1] - mouseY;
          yawTarget = dragStartYaw + xDif * settingsManager.cameraMovementSpeed;
          pitchTarget = dragStartPitch + yDif * -settingsManager.cameraMovementSpeed;
          camPitchSpeed = _normalizeAngle(camPitch - pitchTarget) * -settingsManager.cameraMovementSpeed;
          camYawSpeed = _normalizeAngle(camYaw - yawTarget) * -settingsManager.cameraMovementSpeed;

          camSnapMode = false;
        } else {
          // DESKTOP ONLY
          if (!settingsManager.isMobileModeEnabled) {
            camPitchSpeed -= (camPitchSpeed * dt * settingsManager.cameraMovementSpeed); // decay speeds when globe is "thrown"
            camYawSpeed -= (camYawSpeed * dt * settingsManager.cameraMovementSpeed);
          } else if (settingsManager.isMobileModeEnabled) { // MOBILE
            camPitchSpeed -= (camPitchSpeed * dt * settingsManager.cameraMovementSpeed * 5); // decay speeds when globe is "thrown"
            camYawSpeed -= (camYawSpeed * dt * settingsManager.cameraMovementSpeed  * 5);
          }
        }

        camRotateSpeed -= (camRotateSpeed * dt * settingsManager.cameraMovementSpeed);

        if (cameraType.current === cameraType.FPS || cameraType.current === cameraType.SATELLITE || cameraType.current=== cameraType.ASTRONOMY) {

          fpsPitch -= 20 * camPitchSpeed * dt;
          fpsYaw -= 20 * camYawSpeed * dt;
          fpsRotate -= 20 * camRotateSpeed * dt;

          // Prevent Over Rotation
          if (fpsPitch > 90) fpsPitch = 90;
          if (fpsPitch < -90) fpsPitch = -90;
          // ASTRONOMY 180 FOV Bubble Looking out from Sensor
          if (cameraType.current=== cameraType.ASTRONOMY) {
            if (fpsRotate > 90) fpsRotate = 90;
            if (fpsRotate < -90) fpsRotate = -90;
          } else {
            if (fpsRotate > 360) fpsRotate -= 360;
            if (fpsRotate < 0) fpsRotate += 360;
          }
          if (fpsYaw > 360) fpsYaw -= 360;
          if (fpsYaw < 0) fpsYaw += 360;
        } else {
          camPitch += camPitchSpeed * dt;
          camYaw += camYawSpeed * dt;
          fpsRotate += camRotateSpeed * dt;
        }

        if (rotateTheEarth) { camYaw -= rotateTheEarthSpeed * dt; }

        // Zoom Changing
        if (zoomLevel !== zoomTarget) {
          if (zoomLevel > settingsManager.satShader.largeObjectMaxZoom) {
            settingsManager.satShader.maxSize = settingsManager.satShader.maxAllowedSize * 2;
          } else if (zoomLevel < settingsManager.satShader.largeObjectMinZoom) {
            settingsManager.satShader.maxSize = settingsManager.satShader.maxAllowedSize / 2;
          } else {
            settingsManager.satShader.maxSize = settingsManager.satShader.maxAllowedSize;
          }
          // atmosphere.resize();
        }

        if (camSnapMode) {
          camPitch += (camPitchTarget - camPitch) * 0.003 * dt;

          let yawErr = _normalizeAngle(camYawTarget - camYaw);
          camYaw += yawErr * 0.003 * dt;

          zoomLevel = zoomLevel + (zoomTarget - zoomLevel) * dt * 0.0025;
        } else {
          if (isZoomIn) {
            zoomLevel -= zoomLevel * dt / 100 * Math.abs(zoomTarget - zoomLevel);
          } else {
            zoomLevel += zoomLevel * dt / 100 * Math.abs(zoomTarget - zoomLevel);
          }
          if ((zoomLevel >= zoomTarget && !isZoomIn) ||
              (zoomLevel <= zoomTarget && isZoomIn)) {
            zoomLevel = zoomTarget;
          }
        }

        if (camPitch > TAU / 4) camPitch = TAU / 4;
        if (camPitch < -TAU / 4) camPitch = -TAU / 4;
        camYaw = _normalizeAngle(camYaw);
        if (selectedSat !== -1) {
          let sat = satSet.getSat(selectedSat);
          if (!sat.static) {
            _camSnapToSat(sat);
          }
          if (sat.static && cameraType.current=== cameraType.PLANETARIUM) {
            // _camSnapToSat(selectedSat);
          }
          // var satposition = [sat.position.x, sat.position.y, sat.position.z];
          // debugLine.set(satposition, [0, 0, 0]);
        }

        if (typeof missileManager != 'undefined' && missileManager.missileArray.length > 0) {
          for (var i = 0; i < missileManager.missileArray.length; i++) {
            orbitDisplay.updateOrbitBuffer(missileManager.missileArray[i].id);
          }
        }
      }

      _drawLines();
      _drawEarth();
      _drawMoon();
      _drawSun();
      _drawSat(drawNow);

      _updateHover();
      orbitDisplay.glBuffers.traverseVisible(function(child) {
         if (child.type !== 'Group') {
            child.visible = false;
         }
      });
      orbitDisplay.draw();

      canvasManager.camera.position.z =_getCamDist();

      canvasManager.scene.rotation.x = camPitch;
      canvasManager.scene.rotation.y = -camYaw - earthInfo.earthEra;

      canvasManager.pickingScene.rotation.x = camPitch;
      canvasManager.pickingScene.rotation.y = -camYaw - earthInfo.earthEra;

      canvasManager.renderer.render(canvasManager.scene, canvasManager.camera);
      // Debug See id encoding
      // canvasManager.renderer.render(canvasManager.pickingScene, canvasManager.camera);
      _onDrawLoopComplete(drawLoopCallback);

      _screenshotCheck();
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    canvasManager.lines = [];
    canvasManager.scene.add(canvasManager.objects.ambientLight);

    // canvasManager.scene.add(canvasManager.objects.sun.lightEarth);
    canvasManager.objects.earth.add(canvasManager.objects.sun);
    canvasManager.objects.earth.add(canvasManager.objects.sun.lightMoon.target);
    canvasManager.objects.earth.add(canvasManager.objects.moon);
    canvasManager.scene.add(canvasManager.objects.earth);
    canvasManager.scene.add(canvasManager.objects.sats);

    canvasManager.pickingScene.add(canvasManager.objects.earthMask);
    canvasManager.pickingScene.add(canvasManager.objects.pickableSats);


    // canvasManager.addLine([[{x:0,y:0,z:0},{x:10000,y:0,z:0}]]);
    // canvasManager.addLine([[{x:0,y:0,z:0},{x:0,y:10000,z:0}]]);
    // canvasManager.addLine([[{x:0,y:0,z:0},{x:0,y:0,z:10000}]]);

  }

  main();
  canvasManager.isReady = true;


  function _screenshotCheck() {
    // Resize for Screenshots
    if (settingsManager.screenshotMode) {
      if (settingsManager.queuedScreenshot) return;
      canvasManager.resizeCanvas();

      setTimeout(function () {
        let link = document.createElement('a');
        link.download = 'keeptrack.png';

        let d = new Date();
        let n = d.getFullYear();
        let copyrightStr;
        if (!settingsManager.copyrightOveride) {
          copyrightStr = `©${n} KEEPTRACK.SPACE`;
        } else {
          copyrightStr = '';
        }

        link.href = _watermarkedDataURL(canvasDOM2[0],copyrightStr);
        settingsManager.screenshotMode = false;
        settingsManager.queuedScreenshot = false;
        setTimeout(function () {
          link.click();
        }, 10);
        canvasManager.resizeCanvas();
      }, 200);
      settingsManager.queuedScreenshot = true;
    }
  }

  function _drawSat(drawNow) {
    if (typeof satData == 'undefined') return;
    if (typeof satVel == 'undefined') return;
    if (typeof satPos == 'undefined') return;

    drawDivisor = Math.max(timeManager.propRate, 0.001);
    drawDt = Math.min((drawNow - lastDrawTime) / 1000.0, 1.0 / drawDivisor);
    drawDt *= timeManager.propRate; // Adjust drawDt correspond to the propagation rate
    satSet.satDataLenInDraw = satData.length;
    if (!settingsManager.lowPerf && drawDt > settingsManager.minimumDrawDt) {
      if (!settingsManager.isSatOverflyModeOn && !settingsManager.isFOVBubbleModeOn) {
        satSet.satDataLenInDraw -= settingsManager.maxFieldOfViewMarkers;
        for (drawI = 0; drawI < ((satSet.satDataLenInDraw) * 3); drawI++) {
          if (satVel[drawI] != 0) {
            satPos[drawI] += satVel[drawI] * drawDt;
            if (isNaN(satPos[drawI])) {
              satPos[drawI] = 0;
              // console.warn(`Satellite ${satSet.getSat(drawI).SCC_NUM} Reentered?!`);
            }
          }
        }
      } else {
        satSet.satDataLenInDraw *= 3;
        for (drawI = 0; drawI < (satSet.satDataLenInDraw); drawI++) {
          if (satVel[drawI] != 0) {
            satPos[drawI] += satVel[drawI] * drawDt;
            if (isNaN(satPos[drawI])) {
              satPos[drawI] = 0;
              // console.warn(`Satellite ${satSet.getSat(drawI).SCC_NUM} Reentered?!`);
            }
          }
        }
      }

      lastDrawTime = drawNow;

      satBuf.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(satPos), 3));

      satBuf.rotateX(-90 * DEG2RAD);

      canvasManager.objects.sats.geometry.verticesNeedUpdate = true;
      canvasManager.objects.pickableSats.geometry.verticesNeedUpdate = true;
    }
  }
  function _drawEarth() {
    earth.loaded = true;
    earthInfo.lastTime = earthNow;
    earthNow = timeManager.propTime();

    {
      // wall time is not propagation time, so better print it
      // TODO substring causes 12kb memory leak every frame.
      if (earthInfo.lastTime - earthNow < 300) {
        earthInfo.tDS = earthNow.toJSON();
        earthInfo.timeTextStr = earthInfo.timeTextStrEmpty;
        for (earthInfo.iText = 0; earthInfo.iText < 20; earthInfo.iText++) {
          if (earthInfo.iText < 10) earthInfo.timeTextStr += earthInfo.tDS[earthInfo.iText];
          if (earthInfo.iText === 10) earthInfo.timeTextStr += ' ';
          if (earthInfo.iText > 11) earthInfo.timeTextStr += earthInfo.tDS[earthInfo.iText-1];
        }
        if (settingsManager.isPropRateChange && !settingsManager.isAlwaysHidePropRate) {
          if (timeManager.propRate > 1.01 || timeManager.propRate < 0.99) {
            if (timeManager.propRate < 10) earthInfo.propRateDOM.html('Propagation Speed: ' + timeManager.propRate.toFixed(1) + 'x');
            if (timeManager.propRate >= 10) earthInfo.propRateDOM.html('Propagation Speed: ' + timeManager.propRate.toFixed(2) + 'x');
            earthInfo.propRateDOM.show();
            isPropRateVisible = true;
          } else {
            if (isPropRateVisible) {
              earthInfo.propRateDOM.hide();
              isPropRateVisible = false;
            }
          }
          settingsManager.isPropRateChange = false;
        }

        if (!createClockDOMOnce) {
          document.getElementById('datetime-text').innerText = `${earthInfo.timeTextStr} UTC`;
          // document.getElementById('datetime-text-local').innerText = `${timeManager.dateToISOLikeButLocal(earthNow)}`;
          createClockDOMOnce = true;
        } else {
          document.getElementById('datetime-text').childNodes[0].nodeValue = `${earthInfo.timeTextStr} UTC`;
          // document.getElementById('datetime-text-local').childNodes[0].nodeValue = `${timeManager.dateToISOLikeButLocal(earthNow)}`;
        }
      }


      // Don't update the time input unless it is currently being viewed.
      if (settingsManager.isEditTime || !settingsManager.cruncherReady) {
        $('#datetime-input-tb').val(earthInfo.timeTextStr);
      }
    }

    earthInfo.earthJ = timeManager.jday(earthNow.getUTCFullYear(),
                 earthNow.getUTCMonth() + 1, // NOTE:, this function requires months in range 1-12.
                 earthNow.getUTCDate(),
                 earthNow.getUTCHours(),
                 earthNow.getUTCMinutes(),
                 earthNow.getUTCSeconds());
    earthInfo.earthJ += earthNow.getUTCMilliseconds() * MILLISECONDS_PER_DAY;
    earthInfo.earthEra = satellite.gstime(earthInfo.earthJ);

    canvasManager.objects.earth.rotation.y = earthInfo.earthEra;
  }
  function _drawMoon() {
    var now = timeManager.propTime();
    j = timeManager.jday(now.getUTCFullYear(),
                 now.getUTCMonth() + 1, // NOTE:, this function requires months in range 1-12.
                 now.getUTCDate(),
                 now.getUTCHours(),
                 now.getUTCMinutes(),
                 now.getUTCSeconds());
    j += now.getUTCMilliseconds() * MILLISECONDS_PER_DAY;
    var gmst = satellite.gstime(j);

    let moonPos = SunCalc.getMoonPosition(timeManager.propTime(),0,0);
    moonPos = satellite.ecfToEci(lookAnglesToEcf(moonPos.azimuth * RAD2DEG, moonPos.altitude * RAD2DEG, moonPos.distance, 0,0,0), gmst);

    canvasManager.objects.moon.position.x = moonPos.x;
    canvasManager.objects.moon.position.y = moonPos.y;
    canvasManager.objects.moon.position.z = moonPos.z;
  }
  function _drawSun() {
    sun.currentDirection();
    canvasManager.objects.earth.material.uniforms.uLightDirection = {type: 'vec3', value: earth.lightDirection};
    let sunXYZ = sun.getXYZ();
    let sunMaxDist = Math.max(Math.max(sunXYZ.x,sunXYZ.y),sunXYZ.z);
    sunXYZ.x = sunXYZ.x / sunMaxDist * SUN_SCALAR_DISTANCE;
    sunXYZ.y = sunXYZ.y / sunMaxDist * SUN_SCALAR_DISTANCE;
    sunXYZ.z = sunXYZ.z / sunMaxDist * SUN_SCALAR_DISTANCE;

    canvasManager.objects.sun.position.x = sunXYZ.x;
    canvasManager.objects.sun.position.y = sunXYZ.y;
    canvasManager.objects.sun.position.z = sunXYZ.z;

    // canvasManager.objects.sun.lightEarth.position.set(sunXYZ.x, sunXYZ.y, sunXYZ.z);
    // canvasManager.objects.sun.lightEarth.target.position.set(0, 0, 0);

    canvasManager.objects.sun.lightMoon.target.position.set(canvasManager.objects.moon.position.x, canvasManager.objects.moon.position.y, canvasManager.objects.moon.position.z);
  }
};
window.canvasManager = canvasManager;

function _drawScene () {
  if (cameraType.current=== cameraType.FPS || cameraType.current=== cameraType.SATELLITE || cameraType.current=== cameraType.ASTRONOMY) {
    _fpsMovement();
  }
  camMatrix = _drawCamera();

  gl.useProgram(gl.pickShaderProgram);
  gl.uniformMatrix4fv(gl.pickShaderProgram.uPMatrix, false, pMatrix);
  gl.uniformMatrix4fv(gl.pickShaderProgram.camMatrix, false, camMatrix);

  // Why do we clear the color buffer twice?
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // sun.draw(pMatrix, camMatrix);
  // moon.draw(pMatrix, camMatrix);
  // if (typeof debugLine != 'undefined') debugLine.draw();
  // if (cameraType.current != cameraType.FPS) {
  //   atmosphere.draw(pMatrix, camMatrix);
  // }
  // earth.draw(pMatrix, camMatrix);
  // satSet.draw(pMatrix, camMatrix, drawNow);
  // orbitDisplay.draw(pMatrix, camMatrix);

  /* DEBUG - show the pickbuffer on a canvas */
  // debugImageData.data = pickColorMap;
  /* debugImageData.data.set(pickColorMap);
  debugContext.putImageData(debugImageData, 0, 0); */

}
function _drawCamera () {
    camMatrix = camMatrixEmpty;
    mat4.identity(camMatrix);

    /**
    * For FPS style movement rotate the camera and then translate it
    * for traditional view, move the camera and then rotate it
    */

   if (isNaN(camPitch) || isNaN(camYaw) || isNaN(camPitchTarget) || isNaN(camYawTarget) || isNaN(zoomLevel) || isNaN(zoomTarget)) {
     try {
       console.group('Camera Math Error');
       console.log(`camPitch: ${camPitch}`);
       console.log(`camYaw: ${camYaw}`);
       console.log(`camPitchTarget: ${camPitchTarget}`);
       console.log(`camYawTarget: ${camYawTarget}`);
       console.log(`zoomLevel: ${zoomLevel}`);
       console.log(`zoomTarget: ${zoomTarget}`);
       console.log(`settingsManager.cameraMovementSpeed: ${settingsManager.cameraMovementSpeed}`);
       console.groupEnd();
     } catch (e) {
       console.warn('Camera Math Error');
     }
     camPitch = 0.5;
     camYaw = 0.5;
     zoomLevel  = 0.5;
     camPitchTarget = 0;
     camYawTarget = 0;
     zoomTarget = 0.5;
   }

    switch (cameraType.current) {
      case cameraType.DEFAULT: // pivot around the earth with earth in the center
        mat4.translate(camMatrix, camMatrix, [0, _getCamDist(), 0]);
        mat4.rotateX(camMatrix, camMatrix, camPitch);
        mat4.rotateZ(camMatrix, camMatrix, -camYaw);
        break;
      case cameraType.OFFSET: // pivot around the earth with earth offset to the bottom right
        mat4.translate(camMatrix, camMatrix, [15000, _getCamDist(), -6000]);
        mat4.rotateX(camMatrix, camMatrix, camPitch);
        mat4.rotateZ(camMatrix, camMatrix, -camYaw);
        break;
      case cameraType.FPS: // FPS style movement
        mat4.rotate(camMatrix, camMatrix, -fpsPitch * DEG2RAD, [1, 0, 0]);
        mat4.rotate(camMatrix, camMatrix, fpsYaw * DEG2RAD, [0, 0, 1]);
        mat4.translate(camMatrix, camMatrix, [fpsXPos, fpsYPos, -fpsZPos]);
        break;
      case cameraType.PLANETARIUM: // pivot around the earth looking away from the earth
        {
          let satPos = _calculateSensorPos({});

          // Pitch is the opposite of the angle to the latitude
          // Yaw is 90 degrees to the left of the angle to the longitude
          pitchRotate = ((-1 * sensorManager.currentSensor.lat) * DEG2RAD);
          yawRotate = ((90 - sensorManager.currentSensor.long) * DEG2RAD) - satPos.gmst;
          mat4.rotate(camMatrix, camMatrix, pitchRotate, [1, 0, 0]);
          mat4.rotate(camMatrix, camMatrix, yawRotate, [0, 0, 1]);

          mat4.translate(camMatrix, camMatrix, [-satPos.x, -satPos.y, -satPos.z]);

          _showOrbitsAbove();

          break;
        }
      case cameraType.SATELLITE:
        {
          // yawRotate = ((-90 - sensorManager.currentSensor.long) * DEG2RAD);
          if (selectedSat !== -1) lastSelectedSat = selectedSat;
          let sat = satSet.getSat(lastSelectedSat);
          // mat4.rotate(camMatrix, camMatrix, sat.inclination * DEG2RAD, [0, 1, 0]);
          mat4.rotate(camMatrix, camMatrix, -fpsPitch * DEG2RAD, [1, 0, 0]);
          mat4.rotate(camMatrix, camMatrix, fpsYaw * DEG2RAD, [0, 0, 1]);
          mat4.rotate(camMatrix, camMatrix, fpsRotate * DEG2RAD, [0, 1, 0]);

          orbitDisplay.updateOrbitBuffer(lastSelectedSat);
          let satPos = sat.position;
          mat4.translate(camMatrix, camMatrix, [-satPos.x, -satPos.y, -satPos.z]);
          break;
        }
      case cameraType.ASTRONOMY:
        {
          let satPos = _calculateSensorPos({});

          // Pitch is the opposite of the angle to the latitude
          // Yaw is 90 degrees to the left of the angle to the longitude
          pitchRotate = ((-1 * sensorManager.currentSensor.lat) * DEG2RAD);
          yawRotate = ((90 - sensorManager.currentSensor.long) * DEG2RAD) - satPos.gmst;

          // TODO: Calculate elevation for cameraType.ASTRONOMY
          // Idealy the astronomy view would feel more natural and tell you what
          // az/el you are currently looking at.

          // fpsEl = ((fpsPitch + 90) > 90) ? (-(fpsPitch) + 90) : (fpsPitch + 90);
          // $('#el-text').html(' EL: ' + fpsEl.toFixed(2) + ' deg');

          // yawRotate = ((-90 - sensorManager.currentSensor.long) * DEG2RAD);
          let sensor = null;
          if (typeof sensorManager.currentSensor.name == 'undefined') {
            sensor = satSet.getIdFromSensorName(sensorManager.currentSensor.name);
            if (sensor == null) return;
          } else {
            sensor = satSet.getSat(satSet.getIdFromSensorName(sensorManager.currentSensor.name));
          }
          // mat4.rotate(camMatrix, camMatrix, sat.inclination * DEG2RAD, [0, 1, 0]);
          mat4.rotate(camMatrix, camMatrix, (pitchRotate + (-fpsPitch * DEG2RAD)), [1, 0, 0]);
          mat4.rotate(camMatrix, camMatrix, (yawRotate + (fpsYaw * DEG2RAD)), [0, 0, 1]);
          mat4.rotate(camMatrix, camMatrix, fpsRotate * DEG2RAD, [0, 1, 0]);

          // orbitDisplay.updateOrbitBuffer(lastSelectedSat);
          let sensorPos = sensor.position;
          fpsXPos = sensorPos.x;
          fpsYPos = sensorPos.y;
          fpsZPos = sensorPos.z;
          mat4.translate(camMatrix, camMatrix, [-sensorPos.x * 1.01, -sensorPos.y * 1.01, -sensorPos.z * 1.01]); // Scale to get away from Earth

          _showOrbitsAbove(); // Clears Orbit
          break;
        }
    }
    return camMatrix;
  }
var satLabelModeLastTime = 0;
var isSatMiniBoxInUse = false;
var labelCount;
var hoverBoxOnSatMiniElements = [];
var satHoverMiniDOM;

function _onDrawLoopComplete (cb) {
  if (typeof cb == 'undefined') return;
  cb();
}
function _normalizeAngle (angle) {
  angle %= TAU;
  if (angle > Math.PI) angle -= TAU;
  if (angle < -Math.PI) angle += TAU;

  if (isNaN(angle)) {
    angle = 0;
  }

  return angle;
}
function _showOrbitsAbove () {

  if ((!settingsManager.isSatLabelModeOn || cameraType.current !== cameraType.PLANETARIUM)) {
    if (isSatMiniBoxInUse) {
      $('#sat-minibox').html('');
    }
    isSatMiniBoxInUse = false;
    return;
  }

  if (!sensorManager.checkSensorSelected()) return;
  if (drawNow - satLabelModeLastTime < settingsManager.satLabelInterval) return;

  orbitDisplay.clearInViewOrbit();

  var sat;
  labelCount = 0;
  isHoverBoxVisible = true;

  hoverBoxOnSatMiniElements = document.getElementById('sat-minibox');
  hoverBoxOnSatMiniElements.innerHTML = '';
  for (var i = 0; i < (satSet.orbitalSats) && labelCount < settingsManager.maxLabels; i++) {
    sat = satSet.getSatPosOnly(i);

    if (sat.static) continue;
    if (sat.missile) continue;
    if (sat.OT === 1 && ColorScheme.objectTypeFlags.payload === false) continue;
    if (sat.OT === 2 && ColorScheme.objectTypeFlags.rocketBody === false) continue;
    if (sat.OT === 3 && ColorScheme.objectTypeFlags.debris === false) continue;
    if (sat.inview && ColorScheme.objectTypeFlags.inFOV === false) continue;

    satSet.getScreenCoords(i, pMatrix, camMatrix, sat.position);
    if (satScreenPositionArray.error) continue;
    if (typeof satScreenPositionArray.x == 'undefined' || typeof satScreenPositionArray.y == 'undefined') continue;
    if (satScreenPositionArray.x > window.innerWidth || satScreenPositionArray.y > window.innerHeight) continue;

    // Draw Orbits
    orbitDisplay.addInViewOrbit(i);

    // Draw Sat Labels
    // if (settingsManager.isDisableSatHoverBox) continue;
    satHoverMiniDOM = document.createElement("div");
    satHoverMiniDOM.id = 'sat-minibox-' + i;
    satHoverMiniDOM.textContent = sat.SCC_NUM;
    satHoverMiniDOM.setAttribute(
      'style',
      "display: block; position: absolute; left: " + satScreenPositionArray.x + 10 + "px; top: " + satScreenPositionArray.y + "px;"
    );
    hoverBoxOnSatMiniElements.appendChild(satHoverMiniDOM);
    labelCount++;
  }
  isSatMiniBoxInUse = true;
  satLabelModeLastTime = drawNow;
}
function _hoverBoxOnSat (satId, satX, satY) {
  if (cameraType.current === cameraType.PLANETARIUM && !settingsManager.isDemoModeOn) {
    satHoverBoxDOM.css({display: 'none'});
    if (satId === -1) {
      canvasDOM.css({cursor: 'default'});
    } else {
      canvasDOM.css({cursor: 'pointer'});
    }
    return;
  }
  if (satId === -1) {
    if (!isHoverBoxVisible || settingsManager.isDisableSatHoverBox) return;
    if (objectManager.isStarManagerLoaded) {
      if (starManager.isConstellationVisible === true && !starManager.isAllConstellationVisible) starManager.clearConstellations();
    }
    // satHoverBoxDOM.html('(none)');
    satHoverBoxDOM.css({display: 'none'});
    canvasDOM.css({cursor: 'default'});
    isHoverBoxVisible = false;
  } else if (!isDragging && !settingsManager.isDisableSatHoverBox) {
    var sat = satSet.getSatExtraOnly(satId);
    var selectedSatData = satSet.getSatExtraOnly(selectedSat);
    isHoverBoxVisible = true;
    if (sat.static) {
      if (sat.type === 'Launch Facility') {
        var launchSite = objectManager.extractLaunchSite(sat.name);
        satHoverBoxNode1.textContent = (launchSite.site + ', ' + launchSite.sitec);
        satHoverBoxNode2.innerHTML = (sat.type + satellite.distance(sat, selectedSatData) + '');
        satHoverBoxNode3.textContent = ('');
      } else if (sat.type === 'Control Facility') {
        satHoverBoxNode1.textContent = sat.name;
        satHoverBoxNode2.innerHTML = (sat.typeExt + satellite.distance(sat, selectedSatData) + '');
        satHoverBoxNode3.textContent = ('');
      } else if (sat.type === 'Star') {
        if (starManager.findStarsConstellation(sat.name) !== null) {
          satHoverBoxNode1.innerHTML = (sat.name + '</br>' + starManager.findStarsConstellation(sat.name));
        } else {
          satHoverBoxNode1.textContent = (sat.name);
        }
        satHoverBoxNode2.innerHTML = (sat.type);
        satHoverBoxNode3.innerHTML = ('RA: ' + sat.ra.toFixed(3) + ' deg </br> DEC: ' + sat.dec.toFixed(3) + ' deg');
        starManager.drawConstellations(starManager.findStarsConstellation(sat.name));
      } else {
        satHoverBoxNode1.textContent = (sat.name);
        satHoverBoxNode2.innerHTML = (sat.type + satellite.distance(sat, selectedSatData) + '');
        satHoverBoxNode3.textContent = ('');
      }
    } else if (sat.missile) {
      satHoverBoxNode1.innerHTML = (sat.ON + '<br \>' + sat.desc + '');
      satHoverBoxNode2.textContent = '';
      satHoverBoxNode3.textContent = '';
    } else {
      if (objectManager.isSensorManagerLoaded && sensorManager.checkSensorSelected() && isShowNextPass && isShowDistance) {
        satHoverBoxNode1.textContent = (sat.ON);
        satHoverBoxNode2.textContent = (sat.SCC_NUM);
        satHoverBoxNode3.innerHTML = (satellite.nextpass(sat) + satellite.distance(sat, selectedSatData) + '');
      } else if (isShowDistance) {
        satHoverBoxNode1.textContent = (sat.ON);
        satHoverBoxNode2.innerHTML = (sat.SCC_NUM + satellite.distance(sat, selectedSatData) + '');
        satHoverBoxNode3.innerHTML = ('X: ' + sat.position.x.toFixed(2) + ' Y: ' + sat.position.y.toFixed(2) + ' Z: ' + sat.position.z.toFixed(2) + '</br>' +
        'X: ' + sat.velocityX.toFixed(2) + 'km/s Y: ' + sat.velocityY.toFixed(2) + 'km/s Z: ' + sat.velocityZ.toFixed(2)) + 'km/s';
      } else if (objectManager.isSensorManagerLoaded && sensorManager.checkSensorSelected() && isShowNextPass) {
        satHoverBoxNode1.textContent = (sat.ON);
        satHoverBoxNode2.textContent = (sat.SCC_NUM);
        satHoverBoxNode3.textContent = (satellite.nextpass(sat));
      } else {
        satHoverBoxNode1.textContent = (sat.ON);
        satHoverBoxNode2.textContent = (sat.SCC_NUM);
        satHoverBoxNode3.innerHTML = ('X: ' + sat.position.x.toFixed(2) + ' Y: ' + sat.position.y.toFixed(2) + ' Z: ' + sat.position.z.toFixed(2) + '</br>' +
        'X: ' + sat.velocityX.toFixed(2) + ' Y: ' + sat.velocityY.toFixed(2) + ' Z: ' + sat.velocityZ.toFixed(2));
      }
    }
    satHoverBoxDOM.css({
      display: 'block',
      'text-align': 'center',
      position: 'absolute',
      left: satX + 20,
      top: satY - 10
    });
    canvasDOM.css({cursor: 'pointer'});
  }
}
function _calculateSensorPos (pos) {
  var now = timeManager.propTime();
  var j = jday(now.getUTCFullYear(),
  now.getUTCMonth() + 1, // Note, this function requires months in range 1-12.
  now.getUTCDate(),
  now.getUTCHours(),
  now.getUTCMinutes(),
  now.getUTCSeconds());
  j += now.getUTCMilliseconds() * 1.15741e-8; // days per millisecond
  function jday (year, mon, day, hr, minute, sec) {
    return (367.0 * year -
      Math.floor((7 * (year + Math.floor((mon + 9) / 12.0))) * 0.25) +
      Math.floor(275 * mon / 9.0) +
      day + 1721013.5 +
      ((sec / 60.0 + minute) / 60.0 + hr) / 24.0  //  ut in days
    );
  }
  var gmst = satellite.gstime(j);

  var cosLat = Math.cos(sensorManager.currentSensor.lat * DEG2RAD);
  var sinLat = Math.sin(sensorManager.currentSensor.lat * DEG2RAD);
  var cosLon = Math.cos((sensorManager.currentSensor.long * DEG2RAD) + gmst);
  var sinLon = Math.sin((sensorManager.currentSensor.long * DEG2RAD) + gmst);

  pos.x = (RADIUS_OF_EARTH + PLANETARIUM_DIST) * cosLat * cosLon;
  pos.y = (RADIUS_OF_EARTH + PLANETARIUM_DIST) * cosLat * sinLon;
  pos.z = (RADIUS_OF_EARTH + PLANETARIUM_DIST) * sinLat;
  pos.gmst = gmst;
  return pos;
}
function _fpsMovement () {
  fpsTimeNow = Date.now();
  if (fpsLastTime !== 0) {
    fpsElapsed = fpsTimeNow - fpsLastTime;

    if (isFPSForwardSpeedLock && fpsForwardSpeed < 0) {
      fpsForwardSpeed = Math.max(fpsForwardSpeed + Math.min(fpsForwardSpeed * -1.02 * fpsElapsed, -0.2), -settingsManager.fpsForwardSpeed);
    } else if (isFPSForwardSpeedLock && fpsForwardSpeed > 0) {
      fpsForwardSpeed = Math.min(fpsForwardSpeed + Math.max(fpsForwardSpeed * 1.02 * fpsElapsed, 0.2), settingsManager.fpsForwardSpeed);
    }

    if (isFPSSideSpeedLock && fpsSideSpeed < 0) {
      fpsSideSpeed = Math.max(fpsSideSpeed + Math.min(fpsSideSpeed * -1.02 * fpsElapsed, -0.2), -settingsManager.fpsSideSpeed);
    } else if (isFPSSideSpeedLock && fpsSideSpeed < 0) {
      fpsSideSpeed = Math.min(fpsSideSpeed + Math.max(fpsSideSpeed * 1.02 * fpsElapsed, 0.2), settingsManager.fpsSideSpeed);
    }

    if (isFPSVertSpeedLock && fpsVertSpeed < 0) {
      fpsVertSpeed = Math.max(fpsVertSpeed + Math.min(fpsVertSpeed * -1.02 * fpsElapsed, -0.2), -settingsManager.fpsVertSpeed);
    } else if (isFPSVertSpeedLock && fpsVertSpeed < 0) {
      fpsVertSpeed = Math.min(fpsVertSpeed + Math.max(fpsVertSpeed * 1.02 * fpsElapsed, 0.2), settingsManager.fpsVertSpeed);
    }

    // console.log('Front: ' + fpsForwardSpeed + ' - ' + 'Side: ' + fpsSideSpeed + ' - ' + 'Vert: ' + fpsVertSpeed);

    if (cameraType.FPS) {
      if (fpsForwardSpeed !== 0) {
        fpsXPos -= Math.sin(fpsYaw * DEG2RAD) * fpsForwardSpeed * fpsRun * fpsElapsed;
        fpsYPos -= Math.cos(fpsYaw * DEG2RAD) * fpsForwardSpeed * fpsRun * fpsElapsed;
        fpsZPos += Math.sin(fpsPitch * DEG2RAD) * fpsForwardSpeed * fpsRun * fpsElapsed;
      }
      if (fpsVertSpeed !== 0) {
        fpsZPos -= fpsVertSpeed * fpsRun * fpsElapsed;
      }
      if (fpsSideSpeed !== 0) {
        fpsXPos -= Math.cos(-fpsYaw * DEG2RAD) * fpsSideSpeed * fpsRun * fpsElapsed;
        fpsYPos -= Math.sin(-fpsYaw * DEG2RAD) * fpsSideSpeed * fpsRun * fpsElapsed;
      }
    }

    if (!isFPSForwardSpeedLock) fpsForwardSpeed *= Math.min(0.98 * fpsElapsed, 0.98);
    if (!isFPSSideSpeedLock) fpsSideSpeed *= Math.min(0.98 * fpsElapsed, 0.98);
    if (!isFPSVertSpeedLock) fpsVertSpeed *= Math.min(0.98 * fpsElapsed, 0.98);

    if (fpsForwardSpeed < 0.01 && fpsForwardSpeed > -0.01) fpsForwardSpeed = 0;
    if (fpsSideSpeed < 0.01 && fpsSideSpeed > -0.01) fpsSideSpeed = 0;
    if (fpsVertSpeed < 0.01 && fpsVertSpeed > -0.01) fpsVertSpeed = 0;

    fpsPitch += fpsPitchRate * fpsElapsed;
    fpsRotate += fpsRotateRate * fpsElapsed;
    fpsYaw += fpsYawRate * fpsElapsed;

    // console.log('Pitch: ' + fpsPitch + ' - ' + 'Rotate: ' + fpsRotate + ' - ' + 'Yaw: ' + fpsYaw);
  }
  fpsLastTime = fpsTimeNow;
}

canvasManager.lastRayTime = 0;
canvasManager.rayCastInterval = 1000/30;
function getEarthScreenPoint (x, y) {
  // Raycasting Disabled for Now
  // return;
  if (Date.now() - canvasManager.lastRayTime > canvasManager.rayCastInterval) {
    x = ( x / canvasDOM2.width() ) * 2 - 1;
    y = - ( y / canvasDOM2.height() ) * 2 + 1;
    canvasManager.raycaster.setFromCamera( {x:x,y:y} , canvasManager.camera );
    canvasManager.lastRayTime = Date.now();
    canvasManager.lastRayPoint = canvasManager.raycaster.intersectObject(canvasManager.objects.earth)[0];
    return canvasManager.lastRayPoint;
  } else {
    if (typeof dragPoint !== 'undefined') {
      return canvasManager.lastRayPoint;
    }
    return;
  }
}

var currentSearchSats;
function _updateHover () {
  currentSearchSats = searchBox.getLastResultGroup();
  if (searchBox.isHovering()) {
    updateHoverSatId = searchBox.getHoverSat();
    satSet.getScreenCoords(updateHoverSatId, pMatrix, camMatrix);
    _hoverBoxOnSat(updateHoverSatId, satScreenPositionArray.x, satScreenPositionArray.y);
    // if (!_earthHitTest(satScreenPositionArray.x, satScreenPositionArray.y)) {
    // } else {
    //   _hoverBoxOnSat(-1, 0, 0);
    // }
  } else {
    if (!isMouseMoving || isDragging || settingsManager.isMobileModeEnabled) { return; }

    // gl.readPixels in getSatIdFromCoord creates a lot of jank
    // Earlier in the loop we decided how much to throttle updateHover
    // if we skip it this loop, we want to still drawl the last thing
    // it was looking at

    if (++updateHoverDelay >= updateHoverDelayLimit) {
      updateHoverDelay = 0;
      mouseSat = getSatIdFromCoord(mouseX, mouseY);
    }

    if (mouseSat !== -1) {
      orbitDisplay.setHoverOrbit(mouseSat);
    } else {
      orbitDisplay.clearHoverOrbit();
    }

    satSet.setHover(mouseSat);
    _hoverBoxOnSat(mouseSat, mouseX, mouseY);
  }
  function _earthHitTest (x, y) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.pickFb);
    gl.readPixels(x, gl.drawingBufferHeight - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pickColorBuf);

    return false;

    return (pickColorBuf[0] === 0 &&
      pickColorBuf[1] === 0 &&
      pickColorBuf[2] === 0);
    }
  }

function _drawLines() {
  for (let i = 0; i < canvasManager.lines.length; i++) {
    if (typeof canvasManager.lines[i].geometry == 'undefined') {
      let thisLine = canvasManager.lines[i];
      const fs = `
          varying vec4 vColor;

          void main(void) {
            gl_FragColor = vec4(vColor);
          }`;
      const vs = `
          attribute vec4 color;
          varying vec4 vColor;

          void main(void) {
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewPosition;
            gl_PointSize = 1.0;

            vColor = color;
          }`;

      const material = new THREE.ShaderMaterial({
        vertexShader: vs,
        fragmentShader: fs
      });
      material.transparent = true;

      let points = [];
      for (let i = 0; i < thisLine.length; i++) {
        points.push( new THREE.Vector3(thisLine[i].x, thisLine[i].y, thisLine[i].z) );
      }

      var geometry = new THREE.BufferGeometry().setFromPoints(points);
      var line = new THREE.Line(geometry, material);
      canvasManager.lines[i] = line;
    }
    canvasManager.scene.add(canvasManager.lines[i]);
  }
}

function _watermarkedDataURL(canvas,text){
  var tempCanvas=document.createElement('canvas');
  var tempCtx=tempCanvas.getContext('2d');
  var cw,ch;
  cw=tempCanvas.width=canvas.width;
  ch=tempCanvas.height=canvas.height;
  tempCtx.drawImage(canvas,0,0);
  debugger;
  tempCtx.font = "24px nasalization";
  var textWidth = tempCtx.measureText(text).width;
  tempCtx.globalAlpha = 1.0;
  tempCtx.fillStyle ='white';
  tempCtx.fillText(text,cw-textWidth-30,ch-30);
  // tempCtx.fillStyle ='black';
  // tempCtx.fillText(text,cw-textWidth-10+2,ch-20+2);
  // just testing by adding tempCanvas to document
  document.body.appendChild(tempCanvas);
  let image = tempCanvas.toDataURL();
  tempCanvas.parentNode.removeChild(tempCanvas);
  return(image);
}
function _camSnapToSat (sat) {
  /* this function runs every frame that a satellite is selected.
  However, the user might have broken out of the zoom snap or angle snap.
  If so, don't change those targets. */

  if (camAngleSnappedOnSat) {
    var pos = sat.position;
    var r = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
    var yaw = Math.atan2(pos.y, pos.x) + TAU / 4 - earthInfo.earthEra;
    var pitch = Math.atan2(pos.z, r);
    if (!pitch) {
      console.warn('Pitch Calculation Error');
      pitch = 0;
      camZoomSnappedOnSat = false;
      camAngleSnappedOnSat = false;
    }
    if (!yaw) {
      console.warn('Yaw Calculation Error');
      yaw = 0;
      camZoomSnappedOnSat = false;
      camAngleSnappedOnSat = false;
    }
    if (cameraType.current=== cameraType.PLANETARIUM) {
      // camSnap(-pitch, -yaw);
    } else {
      camSnap(pitch, yaw);
    }
  }

  if (camZoomSnappedOnSat) {
    var altitude;
    var camDistTarget;
    if (!sat.missile && !sat.static && sat.active) { // if this is a satellite not a missile
      altitude = sat.getAltitude();
    } if (sat.missile) {
      altitude = sat.maxAlt + 1000;             // if it is a missile use its altitude
      orbitDisplay.setSelectOrbit(sat.satId);
    }
    if (altitude) {
      camDistTarget = altitude + RADIUS_OF_EARTH + settingsManager.camDistBuffer;
    } else {
      camDistTarget = RADIUS_OF_EARTH + settingsManager.camDistBuffer;  // Stay out of the center of the earth. You will get stuck there.
      console.warn('Zoom Calculation Error: ' + altitude + ' -- ' + camDistTarget);
      camZoomSnappedOnSat = false;
      camAngleSnappedOnSat = false;
    }
    if (Math.pow((camDistTarget - DIST_MIN) / (DIST_MAX - DIST_MIN), 1 / ZOOM_EXP) < zoomTarget) {
      zoomTarget = Math.pow((camDistTarget - DIST_MIN) / (DIST_MAX - DIST_MIN), 1 / ZOOM_EXP);
    }
  }

  if (cameraType.current=== cameraType.PLANETARIUM) {
    zoomTarget = 0.01;
  }
}
