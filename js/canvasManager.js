var canvasDOM = $('#keeptrack-canvas');
var canvasDOM2 = $('#keep3-canvas');

var RADIUS_OF_DRAW_SUN = 6600;
var SUN_SCALAR_DISTANCE = 250000;

var RADIUS_OF_DRAW_MOON = 4500;
var MOON_SCALAR_DISTANCE = 7500;

let lastDrawTime = 0;
let earthInfo = {};
let earthNow = 0;
let createClockDOMOnce = false;
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

      const sun = new THREE.Mesh(geometry, material);
      canvasManager.objects.sun = sun;
    }
    // Sun's Light
    {
      const color = 0xFFFFFF;
      const intensity = 1;
      canvasManager.objects.sun.lightEarth = new THREE.DirectionalLight(color, intensity);
      canvasManager.objects.sun.lightMoon = new THREE.DirectionalLight(color, intensity);
    }
  };
  canvasManager.initEarth = () => {
    const radius =  RADIUS_OF_EARTH;
    const widthSegments = 64;
    const heightSegments = 64;
    const geometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);
    const material = new THREE.MeshLambertMaterial({
      map: loader.load(settingsManager.installDirectory + 'images/no_clouds_4096.jpg'),
    });

    let earth = new THREE.Mesh(geometry, material);
    canvasManager.objects.earth = earth;
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
    let geometry = new THREE.BoxGeometry( 1, 1, 1 );
    let material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
    for (var i = 0; i < satData.length; i++) {
      canvasManager.sats[i] = new THREE.Mesh( geometry, material );
    }
  };

  const loader = new THREE.TextureLoader();

  function main() {
    const canvas = document.getElementById('keep3-canvas');

    let renderer = new THREE.WebGLRenderer({canvas});

    function resizeCanvas() {
      let dpi;
      if (typeof settingsManager.dpi != 'undefined') {
        dpi = settingsManager.dpi;
      } else {
        dpi = window.devicePixelRatio;
      }

      _fixDpi(canvas,dpi);

      if (settingsManager.screenshotMode) {
        canvas.width = settingsManager.hiResWidth;
        canvas.height = settingsManager.hiResHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      renderer = new THREE.WebGLRenderer({canvas});
      canvasManager.aspect = canvas.width / canvas.height;
    }
    resizeCanvas();

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

    canvasManager.objects = {};

    canvasManager.objects.ambientLight = new THREE.AmbientLight( 0x222222 ); // soft white light

    canvasManager.initEarth();
    canvasManager.initMoon();
    canvasManager.initSun();
    canvasManager.initSats();

    function render(time) {
      // time *= 0.001;  // convert time to seconds

      _drawLines();
      _drawEarth();
      _drawMoon();
      _drawSun();
      _drawSat(time);

      canvasManager.scene.add(canvasManager.objects.ambientLight);

      canvasManager.camera.position.z =_getCamDist();

      canvasManager.scene.rotation.x = camPitch;
      canvasManager.scene.rotation.y = -camYaw;

      renderer.render(canvasManager.scene, canvasManager.camera);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    canvasManager.lines = [];
    canvasManager.addLine([[{x:0,y:0,z:0},{x:10000,y:0,z:0}]]);
    canvasManager.addLine([[{x:0,y:0,z:0},{x:0,y:10000,z:0}]]);
    canvasManager.addLine([[{x:0,y:0,z:0},{x:0,y:0,z:10000}]]);

  }

  main();

  function _drawLines() {
    for (let i = 0; i < canvasManager.lines.length; i++) {
      if (typeof canvasManager.lines[i].geometry == 'undefined') {
        let thisLine = canvasManager.lines[i];
        var material = new THREE.LineBasicMaterial( { color: 0x0000ff } );
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
          }
        }
      } else {
        satSet.satDataLenInDraw *= 3;
        for (drawI = 0; drawI < (satSet.satDataLenInDraw); drawI++) {
          if (satVel[drawI] != 0) {
            satPos[drawI] += satVel[drawI] * drawDt;
          }
        }
      }
      // for (var i = 0; i < satPos.length; i=i+3) {
      //   try {
      //     canvasManager.sats[i].position.x = satPos[i];
      //     canvasManager.sats[i].position.y = satPos[i+1];
      //     canvasManager.sats[i].position.z = satPos[i+2];
      //   } catch {
      //   }
      // }
      lastDrawTime = drawNow;
    }
  }
  function _drawEarth() {
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

    canvasManager.scene.add(canvasManager.objects.earth);
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

    canvasManager.scene.add(canvasManager.objects.moon);
    canvasManager.objects.moon.position.x = moonPos.x;
    canvasManager.objects.moon.position.y = moonPos.y;
    canvasManager.objects.moon.position.z = moonPos.z;
  }
  function _drawSun() {
    let sunXYZ = sun.getXYZ();
    let sunMaxDist = Math.max(Math.max(sunXYZ.x,sunXYZ.y),sunXYZ.z);
    sunXYZ.x = sunXYZ.x / sunMaxDist * SUN_SCALAR_DISTANCE;
    sunXYZ.y = sunXYZ.y / sunMaxDist * SUN_SCALAR_DISTANCE;
    sunXYZ.z = sunXYZ.z / sunMaxDist * SUN_SCALAR_DISTANCE;
    canvasManager.scene.add(canvasManager.objects.sun);
    canvasManager.objects.sun.position.x = sunXYZ.x;
    canvasManager.objects.sun.position.y = sunXYZ.y;
    canvasManager.objects.sun.position.z = sunXYZ.z;

    canvasManager.scene.add(canvasManager.objects.sun.lightEarth);
    canvasManager.objects.sun.lightEarth.position.set(sunXYZ.x, sunXYZ.y, sunXYZ.z);
    canvasManager.objects.sun.lightEarth.target.position.set(0, 0, 0);

    canvasManager.scene.add(canvasManager.objects.sun.lightMoon.target);
    canvasManager.objects.sun.lightMoon.target.position.set(canvasManager.objects.moon.position.x, canvasManager.objects.moon.position.y, canvasManager.objects.moon.position.z);
  }
  function _fixDpi(canvas, dpi) {
    //create a style object that returns width and height
    let style = {
      height() {
        return +getComputedStyle(canvas).getPropertyValue('height').slice(0,-2);
      },
      width() {
        return +getComputedStyle(canvas).getPropertyValue('width').slice(0,-2);
      }
    };
    //set the correct attributes for a crystal clear image!
    canvas.setAttribute('width', style.width() * dpi);
    canvas.setAttribute('height', style.height() * dpi);
  }
};
window.canvasManager = canvasManager;
