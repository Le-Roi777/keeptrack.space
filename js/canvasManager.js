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

earthInfo.earthJ = 0;
earthInfo.earthEra = 0;
earthInfo.timeTextStr = '';
earthInfo.timeTextStrEmpty = '';
earthInfo.propRateDOM = $('#propRate-status-box');

canvasManager = {};
canvasManager.isEarthDayLoaded = false;
canvasManager.isEarthNightLoaded = false;
canvasManager.isMoonLoaded = false;
canvasManager.isSunLoaded = false;
canvasManager.start = () => {
  const loader = new THREE.TextureLoader();
  function main() {
    _loadOrbitControls();
    const canvas = document.getElementById('keep3-canvas');

    // Scene and Camera
    {
      canvasManager.fov = 45;
      canvasManager.aspect = canvas.width / canvas.height;  // the canvas default
      canvasManager.near = 0.1;
      canvasManager.far = 600000;
      canvasManager.camera = new THREE.PerspectiveCamera(canvasManager.fov, canvasManager.aspect, canvasManager.near, canvasManager.far);

      canvasManager.pickingScene = new THREE.Scene();
      canvasManager.pickingTexture = new THREE.WebGLRenderTarget(
        canvas.width,
        canvas.height,
        {
          stencilBuffer: false
        }
      );

      canvasManager.scene = new THREE.Scene();
      canvasManager.effectsScene = new THREE.Scene();
      // canvasManager.scene.background = new THREE.Color('black');

      canvasManager.resizeCanvas = () => {
        let dpi;
        if (typeof settingsManager.dpi != 'undefined') {
          dpi = settingsManager.dpi;
        } else {
          dpi = window.devicePixelRatio;
        }


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
          // logarithmicDepthBuffer: true,
          powerPerformance: "high-performance",
          stencil: false,
          // depth: false,
          preserveDrawingBuffer: true
        });

        canvasManager.renderer.autoClear = false;

        // Composer for Post Processing
        {
          // canvasManager.composer = new EffectComposer( canvasManager.renderer );
          //
          // // let taaPass = new TAARenderPass( canvasManager.scene, canvasManager.camera );
          // // taaPass.unbiased = true;
          // // taaPass.sampleLevel = 2;
          // // canvasManager.composer.addPass( taaPass );
          //
          // let renderPass = new RenderPass( canvasManager.scene, canvasManager.camera );
          // renderPass.enabled = true;
          // canvasManager.composer.addPass( renderPass );
        }

        // canvasManager.renderer.setPixelRatio( dpi );
        canvasManager.aspect = canvas.width / canvas.height;

        canvasManager.camera.position.z = 44105;
        canvasManager.camera.position.x = 0;
        canvasManager.camera.position.y = 0;

        canvasManager.controls = new OrbitControls( canvasManager.camera, canvasManager.renderer.domElement );
        canvasManager.controls.minDistance = 6800;
        canvasManager.controls.maxDistance = 60000;
        canvasManager.controls.zoomSpeed = 0.5;
        canvasManager.controls.rotateSpeed = 0.025;
        canvasManager.controls.panSpeed = 0.025;
        canvasManager.controls.screenSpacePanning = true;
        canvasManager.controls.autoRotateSpeed = settingsManager.autoRotateSpeed;
        canvasManager.controls.autoRotate = true;
        canvasManager.controls.enableDamping = true;
        canvasManager.controls.dampingFactor = 0.05;
        canvasManager.controls.update();
      };
      canvasManager.resizeCanvas();

      canvasManager.objects = {};
      canvasManager.objects.ambientLight = new THREE.AmbientLight( 0x555555 ); // soft white light
    }

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
          map: loader.load(settingsManager.installDirectory + 'images/sun-1024.jpg',
          function (image) {
             canvasManager.isSunLoaded = true;
          })
        });

        const sunObj = new THREE.Mesh(geometry, material);
        canvasManager.objects.sun = sunObj;
      }
      // Sun's Light
      {
        const color = 0xFFFFFF;
        const intensity = 1;
        canvasManager.objects.sun.lightMoon = new THREE.DirectionalLight(color, intensity);
      }
    };
    canvasManager.initEarth = () => {
      // Make Earth and Black Earth
      {
        const radius =  RADIUS_OF_EARTH;
        const widthSegments = 128;
        const heightSegments = 128;
        const geometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);

        let uniforms = {
          uSampler: {type: THREE.Texture, value: loader.load(settingsManager.installDirectory + 'images/no_clouds_4096.jpg',
          function (image) {
             canvasManager.isEarthDayLoaded = true;
          })},
          uNightSampler: {type: THREE.Texture, value: loader.load(settingsManager.installDirectory + 'images/nightearth-4096.png',
          function (image) {
             canvasManager.isEarthNightLoaded = true;
          })},
          // uSampler: {type: THREE.Texture, value: loader.load(settingsManager.installDirectory + 'images/no_clouds_8k.jpg')},
          // uNightSampler: {type: THREE.Texture, value: loader.load(settingsManager.installDirectory + 'images/6_night_16k.jpg')},
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
          fragmentShader: fs,
        });

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
        map: loader.load(
          settingsManager.installDirectory + 'images/moon-1024.jpg',
          function (image) {
             canvasManager.isMoonLoaded = true;
          })
      });

      let moon = new THREE.Mesh(geometry, material);
      canvasManager.objects.moon = moon;
    };
    canvasManager.initSats = () => {
      satBuf = new THREE.BufferGeometry();

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
        minSize: {value: 9.0},
        maxSize: {value: 80.0}
      };

      const fs = `
        precision mediump float;

        varying vec4 vColor;

        void main(void) {
          vec2 ptCoord = gl_PointCoord * 2.0 - vec2(1.0, 1.0);
          float r = 0.43 - min(abs(length(ptCoord)), 1.0);
          float alpha = pow(2.0 * r + 0.5, 3.0);
          alpha = min(alpha, 1.0);
          gl_FragColor = vec4(vColor.rgb,vColor.a * alpha);
        }
      `;

      const vs = `
        attribute vec4 color;
        attribute float isStar;

        uniform float minSize;
        uniform float maxSize;

        varying vec4 vColor;

        void main(void) {
          vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewPosition;

          gl_PointSize = min(max(pow(15000.0 \/ gl_Position.z, 2.1), minSize * isStar), maxSize) * 1.0;
          vColor = color;
        }
      `;

      let material =  new THREE.ShaderMaterial({
        uniforms: uniforms,
        depthWrite: false,
        // vertexColors: true, - Cant do this AND custom shaders
        // precision: 'highp',
        blending: THREE.NormalBlending,
        fragmentShader: fs,
        vertexShader: vs,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: 1.0,
      });
      // Disable for debug to see objects real size
      material.transparent = true;

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
    canvasManager.initAtmosphere = () => {
      const vs = `
        varying vec3 vNormal;
        void main () {
           vNormal     = normalize( normalMatrix * normal );
           gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`;

      const fs = `
        uniform float coeficient;
        uniform float power;
        uniform vec3  glowColor;

        varying vec3  vNormal;

        void main () {
           float intensity = pow( coeficient - dot(vNormal, vec3(0.0, 0.0, 1.0)), power );
           gl_FragColor    = vec4( glowColor * intensity, 1.0 );
        }`;

      var material    = new THREE.ShaderMaterial({
        uniforms: {
            coeficient  : {
                type    : "f",
                value   : 1.0
            },
            power       : {
                type    : "f",
                value   : 2.0
            },
            glowColor   : {
                type    : "c",
                value   : new THREE.Color('blue')
            },
        },
        vertexShader    : vs,
        fragmentShader  : fs,
        // side        : THREE.FrontSide,
        blending    : THREE.NormalBlending,
        transparent : true,
        side: THREE.BackSide,
        polygonOffset: true,
        polygonOffsetFactor: 10.0,
        polygonOffsetUnits: 1.0,
        depthWrite  : false,
      });

      const radius =  RADIUS_OF_EARTH + 250;
      const widthSegments = 64;
      const heightSegments = 64;
      const geometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);
      material.uniforms.glowColor.value.set(0x00b3ff);
      material.uniforms.coeficient.value  = 0.8;
      material.uniforms.power.value       = 4.0;
      let atmosphere = new THREE.Mesh(geometry, material);
      canvasManager.objects.atmosphere = atmosphere;
    };

    canvasManager.initEarth();
    canvasManager.initAtmosphere();
    canvasManager.initMoon();
    canvasManager.initSun();
    canvasManager.initSats();

    canvasManager.cameraManager = {};
    canvasManager.cameraManager.targetPosition = canvasManager.camera.position;
    canvasManager.cameraManager.moveSpeed = 20.00;
    canvasManager.cameraManager.rotateSpeed = 0.00005;
    canvasManager.cameraManager.zoomSpeed = 75.0;
    canvasManager.cameraManager.dampingFactor = 0.05;
    canvasManager.cameraManager.directionVector = new THREE.Vector3();
    canvasManager.cameraManager.selectedSatVec3 = new THREE.Vector3(0,0,0);
    canvasManager.cameraManager.zoomFactor0 = 800;
    canvasManager.cameraManager.zoomFactor = canvasManager.cameraManager.zoomFactor;
    canvasManager.cameraManager.targetAzimuthAngle = null;
    canvasManager.cameraManager.targetPolarAngle = null;
    canvasManager.cameraManager.targetZoom = null;
    canvasManager.cameraManager.getDistanceFrom0 = () => {
      return canvasManager.camera.position.distanceTo({x:0,y:0,z:0});
    };

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
        if (selectedSat !== -1) {
          let sat = satSet.getSat(selectedSat);
          if (!sat.static) {
            _camSnapToSat(sat);
          }
          if (sat.static && cameraType.current=== cameraType.PLANETARIUM) {
            // _camSnapToSat(selectedSat);
          }
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


      if (canvasManager.cameraManager.targetPosition !== null) {
        if (canvasManager.controls.object.position.manhattanDistanceTo(canvasManager.cameraManager.targetPosition) > 100 ) {
          canvasManager.cameraManager.directionVector.subVectors( canvasManager.cameraManager.targetPosition, canvasManager.controls.object.position).normalize();
          canvasManager.controls.object.position.addScaledVector(canvasManager.cameraManager.directionVector,canvasManager.cameraManager.moveSpeed * dt);
          canvasManager.camera.lookAt(0,0,0);
          if (canvasManager.controls.object.position.x > canvasManager.cameraManager.targetPosition.x - 100 &&
            canvasManager.controls.object.position.x < canvasManager.cameraManager.targetPosition.x + 100 &&
            canvasManager.controls.object.position.y > canvasManager.cameraManager.targetPosition.y - 100 &&
            canvasManager.controls.object.position.y < canvasManager.cameraManager.targetPosition.y + 100 &&
            canvasManager.controls.object.position.z > canvasManager.cameraManager.targetPosition.z - 100 &&
            canvasManager.controls.object.position.z < canvasManager.cameraManager.targetPosition.z + 100 )
            {
              canvasManager.controls.object.position.x = canvasManager.cameraManager.targetPosition.x;
              canvasManager.controls.object.position.y = canvasManager.cameraManager.targetPosition.y;
              canvasManager.controls.object.position.z = canvasManager.cameraManager.targetPosition.z;
              canvasManager.controls.object.position.round();
              canvasManager.cameraManager.targetPosition = null;
            }
          }
      }

      if (canvasManager.cameraManager.targetAzimuthAngle !== null) {
        canvasManager.cameraManager.targetAzimuthAngle = (canvasManager.cameraManager.targetAzimuthAngle > 180 * DEG2RAD) ? canvasManager.cameraManager.targetAzimuthAngle % 360 * DEG2RAD : canvasManager.cameraManager.targetAzimuthAngle;
        canvasManager.cameraManager.targetAzimuthAngle = (canvasManager.cameraManager.targetAzimuthAngle < -180 * DEG2RAD) ? canvasManager.cameraManager.targetAzimuthAngle % 360 * DEG2RAD : canvasManager.cameraManager.targetAzimuthAngle;
        if (canvasManager.controls.getAzimuthalAngle() > canvasManager.cameraManager.targetAzimuthAngle) {
          canvasManager.controls.rotateLeft(canvasManager.cameraManager.rotateSpeed * dt);
        } else {
          canvasManager.controls.rotateLeft(-canvasManager.cameraManager.rotateSpeed * dt);
        }
        if (canvasManager.controls.getAzimuthalAngle() <= canvasManager.cameraManager.targetAzimuthAngle + 0.02 &&
            canvasManager.controls.getAzimuthalAngle() >= canvasManager.cameraManager.targetAzimuthAngle - 0.02) {
              canvasManager.controls.setThetaOverride(canvasManager.cameraManager.targetAzimuthAngle);
              canvasManager.cameraManager.targetAzimuthAngle = null;
            }
      }

      if (canvasManager.cameraManager.targetPolarAngle !== null) {
        canvasManager.cameraManager.targetPolarAngle = (canvasManager.cameraManager.targetPolarAngle > 180 * DEG2RAD) ? canvasManager.cameraManager.targetPolarAngle % 180 * DEG2RAD : canvasManager.cameraManager.targetPolarAngle;
        canvasManager.cameraManager.targetPolarAngle = (canvasManager.cameraManager.targetPolarAngle < -180 * DEG2RAD) ? canvasManager.cameraManager.targetPolarAngle % 180 * DEG2RAD : canvasManager.cameraManager.targetPolarAngle;
        if (canvasManager.controls.getPolarAngle() > canvasManager.cameraManager.targetPolarAngle) {
          canvasManager.controls.rotateUp(canvasManager.cameraManager.rotateSpeed  * dt);
        } else {
          canvasManager.controls.rotateUp(-canvasManager.cameraManager.rotateSpeed * dt);
        }
        if (canvasManager.controls.getPolarAngle() <= canvasManager.cameraManager.targetPolarAngle + 0.02 &&
            canvasManager.controls.getPolarAngle() >= canvasManager.cameraManager.targetPolarAngle - 0.02) {
              canvasManager.controls.setPhiOverride(canvasManager.cameraManager.targetPolarAngle);
              canvasManager.cameraManager.targetPolarAngle = null;
            }
      }

      if (canvasManager.cameraManager.targetZoom !== null) {
        if (canvasManager.cameraManager.getDistanceFrom0() < canvasManager.cameraManager.targetZoom - 30 ||
            canvasManager.cameraManager.getDistanceFrom0() > canvasManager.cameraManager.targetZoom + 30) {
          canvasManager.controls.object.translateZ(
            Math.min(canvasManager.cameraManager.zoomSpeed,
              Math.max(-canvasManager.cameraManager.zoomSpeed,
                (canvasManager.cameraManager.getDistanceFrom0() - canvasManager.cameraManager.targetZoom) *
                -1.0 * dt
              )
            )
          );
        } else {
          canvasManager.cameraManager.targetZoom = null;
        }
      }

      canvasManager.controls.update();
      // _drawCamera();

      // canvasManager.composer.render();
      canvasManager.renderer.clear();
      canvasManager.renderer.render(canvasManager.effectsScene, canvasManager.camera);
      canvasManager.renderer.clearDepth();
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
    // canvasManager.objects.earth.add(canvasManager.objects.atmosphere);
    canvasManager.scene.add(canvasManager.objects.earth);
    canvasManager.scene.add(canvasManager.objects.sats);

    canvasManager.effectsScene.add(canvasManager.objects.ambientLight);
    canvasManager.effectsScene.add(canvasManager.objects.atmosphere);

    canvasManager.pickingScene.add(canvasManager.objects.earthMask);
    canvasManager.pickingScene.add(canvasManager.objects.pickableSats);

    satSet.setColorScheme(ColorScheme.default, true);


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

function _getCamDist () {
  db.log('_getCamDist', true);
  return Math.pow(zoomLevel, ZOOM_EXP) * (DIST_MAX - DIST_MIN) + DIST_MIN;
}

function _drawCamera () {
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
      // canvasManager.scene.rotation.x = camPitch;
      // canvasManager.scene.rotation.y = -camYaw - earthInfo.earthEra;
      //
      // canvasManager.pickingScene.rotation.x = camPitch;
      // canvasManager.pickingScene.rotation.y = -camYaw - earthInfo.earthEra;

      // let dist = _getCamDist();
      // canvasManager.camera.position.x = dist * Math.cos(-camPitch) * Math.cos(-camYaw);
      // canvasManager.camera.position.y = dist * Math.sin(-camPitch) * Math.cos(-camYaw);
      // canvasManager.camera.position.z = dist * Math.sin(-camYaw);
      // canvasManager.camera.lookAt(new THREE.Vector3(0, 0, 0));

      canvasManager.scene.rotation.y = -earthInfo.earthEra;
      canvasManager.pickingScene.rotation.y = -earthInfo.earthEra;

      break;
    case cameraType.OFFSET: // pivot around the earth with earth offset to the bottom right
      canvasManager.scene.rotation.x = camPitch;
      canvasManager.scene.rotation.y = -camYaw - earthInfo.earthEra;

      canvasManager.pickingScene.rotation.x = camPitch;
      canvasManager.pickingScene.rotation.y = -camYaw - earthInfo.earthEra;
      break;
    case cameraType.FPS: // FPS style movement
      canvasManager.emptyEuler.setFromQuaternion( canvasManager.camera.quaternion );

  		canvasManager.emptyEuler.y = -fpsYaw;
  		canvasManager.emptyEuler.x = fpsPitch;

  		canvasManager.emptyEuler.x = Math.max(
        Math.PI / 2 - Math.PI,
        Math.min( Math.PI / 2 - 0, canvasManager.emptyEuler.x )
      );
  		canvasManager.camera.quaternion.setFromEuler( canvasManager.emptyEuler );

      canvasManager.scene.rotation.y = -earthInfo.earthEra;
      canvasManager.pickingScene.rotation.y = -earthInfo.earthEra;
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
        orbitDisplay.updateOrbitBuffer(lastSelectedSat);

        let sat = satSet.getSat(selectedSat);
        let satVec = new THREE.Vector3(sat.position.x, sat.position.y, sat.position.z);
        // satVec.applyAxisAngle(new THREE.Vector3(1.0,0.0,0.0), -90 * DEG2RAD);
        // satVec.applyAxisAngle(new THREE.Vector3(0.0,1.0,0.0), -earthInfo.earthEra);

        canvasManager.camera.position.x = satVec.x;
        canvasManager.camera.position.y = satVec.y;
        canvasManager.camera.position.z = satVec.z;

        // canvasManager.camera.rotateOnWorldAxis(new THREE.Vector3(0.0,1.0,0.0), earthInfo.earthEra);

        canvasManager.emptyEuler.setFromQuaternion( canvasManager.camera.quaternion );

    		canvasManager.emptyEuler.y = -fpsYaw;
    		canvasManager.emptyEuler.x = fpsPitch;

    		canvasManager.emptyEuler.x = Math.max(
          Math.PI / 2 - Math.PI,
          Math.min( Math.PI / 2 - 0, canvasManager.emptyEuler.x )
        );
    		canvasManager.camera.quaternion.setFromEuler( canvasManager.emptyEuler );

        canvasManager.scene.rotation.y = -earthInfo.earthEra;
        canvasManager.pickingScene.rotation.y = -earthInfo.earthEra;

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

function _lla2eci(lat,lon,alt,gmst) {
  gmst = (typeof gmst == 'undefined') ? earthInfo.earthEra : gmst;
  let eci = {};
  cosLat = Math.cos(lat * DEG2RAD);
  sinLat = Math.sin(lat * DEG2RAD);
  cosLon = Math.cos((lon * DEG2RAD) + gmst);
  sinLon = Math.sin((lon * DEG2RAD) + gmst);
  eci.x = (RADIUS_OF_EARTH + alt) * cosLat * cosLon; // 6371 is radius of earth
  eci.y = (RADIUS_OF_EARTH + alt) * cosLat * sinLon;
  eci.z = (RADIUS_OF_EARTH + alt) * sinLat;
  return eci;
}

function rotateToLLA(lat,lon,alt) {
  let eci = _lla2eci(lat,lon,alt);
  let cs = eci2CanvasSpace(eci);
  let sphere = _canvasSpace2spherical(cs.x,cs.y,cs.z);
  if (isNaN(sphere.phi)) {
    console.warn('Phi Check Failed!');
  } else {
    canvasManager.cameraManager.targetPolarAngle = sphere.phi;
  }
  if (isNaN(sphere.theta)) {
    console.warn('Theta Check Failed!');
  } else {
    canvasManager.cameraManager.targetAzimuthAngle = sphere.theta;
  }
  canvasManager.cameraManager.targetZoom = Math.max(sphere.radius,RADIUS_OF_EARTH + 10000);
}

function _canvasSpace2spherical(x,y,z) {
  let spherical = new THREE.Spherical();
  return spherical.setFromVector3(new THREE.Vector3(x,y,z));
}

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
  if (timeManager.lastDrawTime - satLabelModeLastTime < settingsManager.satLabelInterval) return;

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
  satLabelModeLastTime = timeManager.lastlastDrawTime;
}
function _hoverBoxOnSat (satId, satX, satY) {
  if (cameraType.current === cameraType.PLANETARIUM && !settingsManager.isDemoModeOn) {
    satHoverBoxDOM.css({display: 'none'});
    if (satId === -1) {
      canvasDOM2.css({cursor: 'default'});
    } else {
      canvasDOM2.css({cursor: 'pointer'});
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
    canvasDOM2.css({cursor: 'default'});
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
    canvasDOM2.css({cursor: 'pointer'});
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

    if (cameraType.current == cameraType.FPS) {
      if (fpsForwardSpeed !== 0) {
        canvasManager.camera.translateZ(-fpsForwardSpeed * fpsRun * fpsElapsed);
      }
      if (fpsVertSpeed !== 0) {
        canvasManager.camera.translateY(-fpsVertSpeed * fpsRun * fpsElapsed);
      }
      if (fpsSideSpeed !== 0) {
        canvasManager.camera.translateX(fpsSideSpeed * fpsRun * fpsElapsed);
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

function _snapToObject(sat) {
  // try {
  console.log(sat.position);
    let pos = eci2CanvasSpace(sat.position);
    canvasManager.camera.position.x = 0;
    canvasManager.camera.position.y = 0;
    canvasManager.camera.position.z = 0;
    console.log(pos);
    canvasManager.camera.lookAt(pos.x,pos.y,pos.z);
    canvasManager.camera.translateZ(-50000);
    canvasManager.camera.lookAt(pos.x,pos.y,pos.z);
  // } catch (e) {
    // console.warn(`snapToObject can't calculate position in canvas space!`);
  // }
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
        fragmentShader: fs,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: 1.0,
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

  let pos = eci2CanvasSpace(sat.position);
  canvasManager.cameraManager.selectedSatVec3.set(pos.x,pos.y,pos.z);
  if (canvasManager.cameraManager.targetPosition == null) {
      canvasManager.controls.object.position.x = canvasManager.cameraManager.selectedSatVec3.x;
      canvasManager.controls.object.position.y = canvasManager.cameraManager.selectedSatVec3.y;
      canvasManager.controls.object.position.z = canvasManager.cameraManager.selectedSatVec3.z;
      canvasManager.controls.object.position.round();
      canvasManager.controls.object.lookAt(0,0,0);
      canvasManager.controls.object.translateZ(canvasManager.cameraManager.zoomFactor);
  }
  return;

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
function eci2CanvasSpace(position) {
  return {
    x: position.x,
    y: position.z,
    z: position.y * -1
  };
}
function _loadOrbitControls() {
  // This set of controls performs orbiting, dollying (zooming), and panning.
  // Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
  //
  //    Orbit - left mouse / touch: one-finger move
  //    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
  //    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

  let OrbitControls = function(object, domElement) {
    this.object = object;

    this.domElement = domElement !== undefined ? domElement : document;

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the object orbits around
    this.target = new THREE.Vector3();

    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // How far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    this.minAzimuthAngle = -Infinity; // radians
    this.maxAzimuthAngle = Infinity; // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    this.enableDamping = false;
    this.dampingFactor = 0.25;

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

    // Set to false to disable rotating
    this.enableRotate = true;
    this.rotateSpeed = 1.0;

    // Set to false to disable panning
    this.enablePan = true;
    this.panSpeed = 1.0;
    this.screenSpacePanning = false; // if true, pan in screen-space
    this.keyPanSpeed = 7.0; // pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    // Set to false to disable use of the keys
    this.enableKeys = true;

    // The four arrow keys
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

    // Mouse buttons
    this.mouseButtons = {
      LEFT: THREE.MOUSE.LEFT,
      MIDDLE: THREE.MOUSE.MIDDLE,
      RIGHT: THREE.MOUSE.RIGHT
    };

    // for reset
    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();
    this.zoom0 = this.object.zoom;

    //
    // public methods
    //

    this.getPolarAngle = function() {
      return spherical.phi;
    };

    this.getAzimuthalAngle = function() {
      return spherical.theta;
    };

    this.phiOverride = null;
    this.thetaOverride = null;

    this.saveState = function() {
      scope.target0.copy(scope.target);
      scope.position0.copy(scope.object.position);
      scope.zoom0 = scope.object.zoom;
    };

    this.reset = function() {
      scope.target.copy(scope.target0);
      scope.object.position.copy(scope.position0);
      scope.object.zoom = scope.zoom0;

      scope.object.updateProjectionMatrix();
      scope.dispatchEvent(changeEvent);

      scope.update();

      state = STATE.NONE;
    };

    // this method is exposed, but perhaps it would be better if we can make it private...
    this.update = (function() {
      var offset = new THREE.Vector3();

      // so camera.up is the orbit axis
      var quat = new THREE.Quaternion().setFromUnitVectors(
        object.up,
        new THREE.Vector3(0, 1, 0)
      );
      var quatInverse = quat.clone().inverse();

      var lastPosition = new THREE.Vector3();
      var lastQuaternion = new THREE.Quaternion();

      return function update() {
        var position = scope.object.position;

        offset.copy(position).sub(scope.target);

        // rotate offset to "y-axis-is-up" space
        offset.applyQuaternion(quat);

        // angle from z-axis around y-axis
        spherical.setFromVector3(offset);

        if (scope.autoRotate && state === STATE.NONE) {
          scope.rotateLeft(getAutoRotationAngle());
        }

        spherical.theta += sphericalDelta.theta;
        spherical.phi += sphericalDelta.phi;

        // restrict theta to be between desired limits
        spherical.theta = Math.max(
          scope.minAzimuthAngle,
          Math.min(scope.maxAzimuthAngle, spherical.theta)
        );

        if (scope.thetaOverride !== null) {
          spherical.theta = scope.thetaOverride;
          scope.thetaOverride = null;
        }

        // restrict phi to be between desired limits
        spherical.phi = Math.max(
          scope.minPolarAngle,
          Math.min(scope.maxPolarAngle, spherical.phi)
        );

        if (scope.phiOverride !== null) {
          spherical.phi = scope.phiOverride;
          scope.phiOverride = null;
        }

        spherical.makeSafe();

        spherical.radius *= scale;

        // restrict radius to be between desired limits
        spherical.radius = Math.max(
          scope.minDistance,
          Math.min(scope.maxDistance, spherical.radius)
        );

        // move target to panned location
        scope.target.add(panOffset);

        offset.setFromSpherical(spherical);

        // rotate offset back to "camera-up-vector-is-up" space
        offset.applyQuaternion(quatInverse);

        position.copy(scope.target).add(offset);

        scope.object.lookAt(scope.target);

        if (scope.enableDamping === true) {
          sphericalDelta.theta *= 1 - scope.dampingFactor;
          sphericalDelta.phi *= 1 - scope.dampingFactor;

          panOffset.multiplyScalar(1 - scope.dampingFactor);
        } else {
          sphericalDelta.set(0, 0, 0);

          panOffset.set(0, 0, 0);
        }

        scale = 1;

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8

        if (
          zoomChanged ||
          lastPosition.distanceToSquared(scope.object.position) > EPS ||
          8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS
        ) {
          scope.dispatchEvent(changeEvent);

          lastPosition.copy(scope.object.position);
          lastQuaternion.copy(scope.object.quaternion);
          zoomChanged = false;

          return true;
        }

        return false;
      };
    })();

    this.dispose = function() {
      scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
      scope.domElement.removeEventListener('mousedown', onMouseDown, false);
      scope.domElement.removeEventListener('wheel', onMouseWheel, false);

      scope.domElement.removeEventListener('touchstart', onTouchStart, false);
      scope.domElement.removeEventListener('touchend', onTouchEnd, false);
      scope.domElement.removeEventListener('touchmove', onTouchMove, false);

      document.removeEventListener('mousemove', onMouseMove, false);
      document.removeEventListener('mouseup', onMouseUp, false);

      window.removeEventListener('keydown', onKeyDown, false);

      //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
    };

    //
    // internals
    //

    var scope = this;

    var changeEvent = { type: 'change' };
    var startEvent = { type: 'start' };
    var endEvent = { type: 'end' };

    var STATE = {
      NONE: -1,
      ROTATE: 0,
      DOLLY: 1,
      PAN: 2,
      TOUCH_ROTATE: 3,
      TOUCH_DOLLY_PAN: 4
    };

    var state = STATE.NONE;

    var EPS = 0.000001;

    // current position in spherical coordinates
    var spherical = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();

    var scale = 1;
    var panOffset = new THREE.Vector3();
    var zoomChanged = false;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    function getAutoRotationAngle() {
      return ((2 * Math.PI) / 60 / 60) * scope.autoRotateSpeed;
    }

    function getZoomScale() {
      return Math.pow(0.95, scope.zoomSpeed);
    }

    this.setPhiOverride = (phi) => {
      this.phiOverride = phi;
      sphericalDelta.phi = 0;
    };

    this.setThetaOverride = (theta) => {
      this.thetaOverride = theta;
      sphericalDelta.theta = 0;
    };

    this.rotateLeft = (angle) => {
      sphericalDelta.theta -= angle;
    };

    this.rotateUp = (angle) => {
      sphericalDelta.phi -= angle;
    };

    var panLeft = (function() {
      var v = new THREE.Vector3();

      return function panLeft(distance, objectMatrix) {
        v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
        v.multiplyScalar(-distance);

        panOffset.add(v);
      };
    })();

    var panUp = (function() {
      var v = new THREE.Vector3();

      return function panUp(distance, objectMatrix) {
        if (scope.screenSpacePanning === true) {
          v.setFromMatrixColumn(objectMatrix, 1);
        } else {
          v.setFromMatrixColumn(objectMatrix, 0);
          v.crossVectors(scope.object.up, v);
        }

        v.multiplyScalar(distance);

        panOffset.add(v);
      };
    })();

    // deltaX and deltaY are in pixels; right and down are positive
    var pan = (function() {
      var offset = new THREE.Vector3();

      return function pan(deltaX, deltaY) {
        var element =
          scope.domElement === document
            ? scope.domElement.body
            : scope.domElement;

        if (scope.object.isPerspectiveCamera) {
          // perspective
          var position = scope.object.position;
          offset.copy(position).sub(scope.target);
          var targetDistance = offset.length();

          // half of the fov is center to top of screen
          targetDistance *= Math.tan(((scope.object.fov / 2) * Math.PI) / 180.0);

          // we use only clientHeight here so aspect ratio does not distort speed
          panLeft(
            (2 * deltaX * targetDistance) / element.clientHeight,
            scope.object.matrix
          );
          panUp(
            (2 * deltaY * targetDistance) / element.clientHeight,
            scope.object.matrix
          );
        } else if (scope.object.isOrthographicCamera) {
          // orthographic
          panLeft(
            (deltaX * (scope.object.right - scope.object.left)) /
              scope.object.zoom /
              element.clientWidth,
            scope.object.matrix
          );
          panUp(
            (deltaY * (scope.object.top - scope.object.bottom)) /
              scope.object.zoom /
              element.clientHeight,
            scope.object.matrix
          );
        } else {
          // camera neither orthographic nor perspective
          console.warn(
            'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.'
          );
          scope.enablePan = false;
        }
      };
    })();

    function dollyIn(dollyScale) {
      if (scope.object.isPerspectiveCamera) {
        scale /= dollyScale;
      } else if (scope.object.isOrthographicCamera) {
        scope.object.zoom = Math.max(
          scope.minZoom,
          Math.min(scope.maxZoom, scope.object.zoom * dollyScale)
        );
        scope.object.updateProjectionMatrix();
        zoomChanged = true;
      } else {
        console.warn(
          'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.'
        );
        scope.enableZoom = false;
      }
    }

    function dollyOut(dollyScale) {
      if (scope.object.isPerspectiveCamera) {
        scale *= dollyScale;
      } else if (scope.object.isOrthographicCamera) {
        scope.object.zoom = Math.max(
          scope.minZoom,
          Math.min(scope.maxZoom, scope.object.zoom / dollyScale)
        );
        scope.object.updateProjectionMatrix();
        zoomChanged = true;
      } else {
        console.warn(
          'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.'
        );
        scope.enableZoom = false;
      }
    }

    //
    // event callbacks - update the object state
    //

    function handleMouseDownRotate(event) {
      //console.log( 'handleMouseDownRotate' );

      rotateStart.set(event.clientX, event.clientY);
    }

    function handleMouseDownDolly(event) {
      //console.log( 'handleMouseDownDolly' );

      dollyStart.set(event.clientX, event.clientY);
    }

    function handleMouseDownPan(event) {
      //console.log( 'handleMouseDownPan' );

      panStart.set(event.clientX, event.clientY);
    }

    function handleMouseMoveRotate(event) {
      //console.log( 'handleMouseMoveRotate' );

      rotateEnd.set(event.clientX, event.clientY);

      rotateDelta
        .subVectors(rotateEnd, rotateStart)
        .multiplyScalar(scope.rotateSpeed);

      var element =
        scope.domElement === document ? scope.domElement.body : scope.domElement;

      scope.rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

      scope.rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

      rotateStart.copy(rotateEnd);

      scope.update();
    }

    function handleMouseMoveDolly(event) {
      //console.log( 'handleMouseMoveDolly' );

      dollyEnd.set(event.clientX, event.clientY);

      dollyDelta.subVectors(dollyEnd, dollyStart);

      if (dollyDelta.y > 0) {
        dollyIn(getZoomScale());
      } else if (dollyDelta.y < 0) {
        dollyOut(getZoomScale());
      }

      dollyStart.copy(dollyEnd);

      scope.update();
    }

    function handleMouseMovePan(event) {
      //console.log( 'handleMouseMovePan' );

      panEnd.set(event.clientX, event.clientY);

      panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

      pan(panDelta.x, panDelta.y);

      panStart.copy(panEnd);

      scope.update();
    }

    function handleMouseUp(event) {
      // console.log( 'handleMouseUp' );
    }

    function handleMouseWheel(event) {
      // console.log( 'handleMouseWheel' );

      if (event.deltaY < 0) {
        dollyOut(getZoomScale());
        canvasManager.cameraManager.zoomFactor -= 75;
      } else if (event.deltaY > 0) {
        dollyIn(getZoomScale());
        canvasManager.cameraManager.zoomFactor += 75;
      }


      scope.update();
    }

    function handleKeyDown(event) {
      //console.log( 'handleKeyDown' );

      // prevent the browser from scrolling on cursor up/down

      // event.preventDefault();

      switch (event.keyCode) {
        case scope.keys.UP:
          pan(0, scope.keyPanSpeed);
          scope.update();
          break;

        case scope.keys.BOTTOM:
          pan(0, -scope.keyPanSpeed);
          scope.update();
          break;

        case scope.keys.LEFT:
          pan(scope.keyPanSpeed, 0);
          scope.update();
          break;

        case scope.keys.RIGHT:
          pan(-scope.keyPanSpeed, 0);
          scope.update();
          break;
      }
    }

    function handleTouchStartRotate(event) {
      //console.log( 'handleTouchStartRotate' );

      rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
    }

    function handleTouchStartDollyPan(event) {
      //console.log( 'handleTouchStartDollyPan' );

      if (scope.enableZoom) {
        var dx = event.touches[0].pageX - event.touches[1].pageX;
        var dy = event.touches[0].pageY - event.touches[1].pageY;

        var distance = Math.sqrt(dx * dx + dy * dy);

        dollyStart.set(0, distance);
      }

      if (scope.enablePan) {
        var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
        var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

        panStart.set(x, y);
      }
    }

    function handleTouchMoveRotate(event) {
      //console.log( 'handleTouchMoveRotate' );

      rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);

      rotateDelta
        .subVectors(rotateEnd, rotateStart)
        .multiplyScalar(scope.rotateSpeed);

      var element =
        scope.domElement === document ? scope.domElement.body : scope.domElement;

      scope.rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

      scope.rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

      rotateStart.copy(rotateEnd);

      scope.update();
    }

    function handleTouchMoveDollyPan(event) {
      //console.log( 'handleTouchMoveDollyPan' );

      if (scope.enableZoom) {
        var dx = event.touches[0].pageX - event.touches[1].pageX;
        var dy = event.touches[0].pageY - event.touches[1].pageY;

        var distance = Math.sqrt(dx * dx + dy * dy);

        dollyEnd.set(0, distance);

        dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));

        dollyIn(dollyDelta.y);

        dollyStart.copy(dollyEnd);
      }

      if (scope.enablePan) {
        var x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
        var y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

        panEnd.set(x, y);

        panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

        pan(panDelta.x, panDelta.y);

        panStart.copy(panEnd);
      }

      scope.update();
    }

    function handleTouchEnd(event) {
      //console.log( 'handleTouchEnd' );
    }

    //
    // event handlers - FSM: listen for events and reset state
    //

    function onMouseDown(event) {
      if (scope.enabled === false) return;
      canvasManager.controls.autoRotate = false;
      // Prevent the browser from scrolling.

      // event.preventDefault();

      // Manually set the focus since calling preventDefault above
      // prevents the browser from setting it automatically.

      scope.domElement.focus ? scope.domElement.focus() : window.focus();

      switch (event.button) {
        case scope.mouseButtons.LEFT:
          if (event.ctrlKey || event.metaKey || event.shiftKey) {
            if (scope.enablePan === false) return;

            handleMouseDownPan(event);

            state = STATE.PAN;
          } else {
            if (scope.enableRotate === false) return;

            handleMouseDownRotate(event);

            state = STATE.ROTATE;
          }

          break;

        case scope.mouseButtons.MIDDLE:
          if (scope.enableZoom === false) return;

          handleMouseDownDolly(event);

          state = STATE.DOLLY;

          break;

        case scope.mouseButtons.RIGHT:
          if (scope.enablePan === false) return;

          handleMouseDownPan(event);

          state = STATE.PAN;

          break;
      }

      if (state !== STATE.NONE) {
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);

        scope.dispatchEvent(startEvent);
      }
    }

    function onMouseMove(event) {
      if (scope.enabled === false) return;

      // event.preventDefault();

      switch (state) {
        case STATE.ROTATE:
          if (scope.enableRotate === false) return;

          handleMouseMoveRotate(event);

          break;

        case STATE.DOLLY:
          if (scope.enableZoom === false) return;

          handleMouseMoveDolly(event);

          break;

        case STATE.PAN:
          if (scope.enablePan === false) return;

          handleMouseMovePan(event);

          break;
      }
    }

    function onMouseUp(event) {
      if (scope.enabled === false) return;

      handleMouseUp(event);

      document.removeEventListener('mousemove', onMouseMove, false);
      document.removeEventListener('mouseup', onMouseUp, false);

      scope.dispatchEvent(endEvent);

      state = STATE.NONE;
    }

    function onMouseWheel(event) {
      if (
        scope.enabled === false ||
        scope.enableZoom === false ||
        (state !== STATE.NONE && state !== STATE.ROTATE)
      )
        return;

      // event.preventDefault();
      event.stopPropagation();

      scope.dispatchEvent(startEvent);

      handleMouseWheel(event);

      scope.dispatchEvent(endEvent);
    }

    function onKeyDown(event) {
      if (
        scope.enabled === false ||
        scope.enableKeys === false ||
        scope.enablePan === false
      )
        return;

      handleKeyDown(event);
    }

    function onTouchStart(event) {
      if (scope.enabled === false) return;

      canvasManager.controls.autoRotate = false;

      // event.preventDefault();

      switch (event.touches.length) {
        case 1: // one-fingered touch: rotate
          if (scope.enableRotate === false) return;

          handleTouchStartRotate(event);

          state = STATE.TOUCH_ROTATE;

          break;

        case 2: // two-fingered touch: dolly-pan
          if (scope.enableZoom === false && scope.enablePan === false) return;

          handleTouchStartDollyPan(event);

          state = STATE.TOUCH_DOLLY_PAN;

          break;

        default:
          state = STATE.NONE;
      }

      if (state !== STATE.NONE) {
        scope.dispatchEvent(startEvent);
      }
    }

    function onTouchMove(event) {
      if (scope.enabled === false) return;

      // event.preventDefault();
      event.stopPropagation();

      switch (event.touches.length) {
        case 1: // one-fingered touch: rotate
          if (scope.enableRotate === false) return;
          if (state !== STATE.TOUCH_ROTATE) return; // is this needed?

          handleTouchMoveRotate(event);

          break;

        case 2: // two-fingered touch: dolly-pan
          if (scope.enableZoom === false && scope.enablePan === false) return;
          if (state !== STATE.TOUCH_DOLLY_PAN) return; // is this needed?

          handleTouchMoveDollyPan(event);

          break;

        default:
          state = STATE.NONE;
      }
    }

    function onTouchEnd(event) {
      if (scope.enabled === false) return;

      handleTouchEnd(event);

      scope.dispatchEvent(endEvent);

      state = STATE.NONE;
    }

    function onContextMenu(event) {
      if (scope.enabled === false) return;

      // event.preventDefault();
    }

    //

    scope.domElement.addEventListener('contextmenu', onContextMenu, false);

    scope.domElement.addEventListener('mousedown', onMouseDown, false);
    scope.domElement.addEventListener('wheel', onMouseWheel, false);

    scope.domElement.addEventListener('touchstart', onTouchStart, false);
    scope.domElement.addEventListener('touchend', onTouchEnd, false);
    scope.domElement.addEventListener('touchmove', onTouchMove, false);

    window.addEventListener('keydown', onKeyDown, false);

    // force an update at start

    this.update();
  };

  OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
  OrbitControls.prototype.constructor = OrbitControls;

  Object.defineProperties(OrbitControls.prototype, {
    center: {
      get: function() {
        console.warn('THREE.OrbitControls: .center has been renamed to .target');
        return this.target;
      }
    },

    // backward compatibility

    noZoom: {
      get: function() {
        console.warn(
          'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.'
        );
        return !this.enableZoom;
      },

      set: function(value) {
        console.warn(
          'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.'
        );
        this.enableZoom = !value;
      }
    },

    noRotate: {
      get: function() {
        console.warn(
          'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.'
        );
        return !this.enableRotate;
      },

      set: function(value) {
        console.warn(
          'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.'
        );
        this.enableRotate = !value;
      }
    },

    noPan: {
      get: function() {
        console.warn(
          'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.'
        );
        return !this.enablePan;
      },

      set: function(value) {
        console.warn(
          'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.'
        );
        this.enablePan = !value;
      }
    },

    noKeys: {
      get: function() {
        console.warn(
          'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.'
        );
        return !this.enableKeys;
      },

      set: function(value) {
        console.warn(
          'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.'
        );
        this.enableKeys = !value;
      }
    },

    staticMoving: {
      get: function() {
        console.warn(
          'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.'
        );
        return !this.enableDamping;
      },

      set: function(value) {
        console.warn(
          'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.'
        );
        this.enableDamping = !value;
      }
    },

    dynamicDampingFactor: {
      get: function() {
        console.warn(
          'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.'
        );
        return this.dampingFactor;
      },

      set: function(value) {
        console.warn(
          'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.'
        );
        this.dampingFactor = value;
      }
    }
  });

  window.OrbitControls = OrbitControls;
}
